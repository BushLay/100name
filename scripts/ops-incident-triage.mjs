import process from "node:process"
import {
  buildIncidentActions,
  buildIncidentTimeline,
  summarizeAudit,
} from "../lib/ops-reporting.mjs"

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    console.error(`${name} is required.`)
    process.exit(1)
  }

  return value
}

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const payload = await response.json()

  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

async function archiveOperationalReport(baseUrl, headers, payload) {
  return fetchJson(`${baseUrl}/api/internal/ops-reports`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
      "x-name100-operator": "ops-incident-triage",
    },
    body: JSON.stringify(payload),
  })
}

const baseUrl = (
  process.env.NAME100_RELEASE_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  ""
).replace(/\/$/, "")
const adminSecret = getRequiredEnv("NAME100_ADMIN_SECRET")

if (!baseUrl) {
  console.error("NAME100_RELEASE_BASE_URL or NEXT_PUBLIC_SITE_URL is required.")
  process.exit(1)
}

const headers = {
  "content-type": "application/json",
  "x-name100-admin-secret": adminSecret,
  "x-name100-operator": "ops-incident-triage",
}

const readinessUrl = new URL(`${baseUrl}/api/internal/readiness`)
readinessUrl.searchParams.set("record", "true")
readinessUrl.searchParams.set("reason", "incident triage readiness check")

const auditUrl = `${baseUrl}/api/internal/audit`

const [readinessResult, auditResult] = await Promise.all([
  fetchJson(readinessUrl, {
    method: "GET",
    headers,
  }),
  fetchJson(auditUrl, {
    method: "GET",
    headers: {
      "x-name100-admin-secret": adminSecret,
    },
  }),
])

const triage = {
  generatedAt: new Date().toISOString(),
  readiness: readinessResult.payload,
  audit: auditResult.payload,
  summary: auditResult.ok ? summarizeAudit(auditResult.payload) : null,
  incidentTimeline: auditResult.ok ? buildIncidentTimeline(auditResult.payload) : [],
  actions: buildIncidentActions({
    readiness: readinessResult.payload,
    audit: auditResult.ok ? auditResult.payload : null,
  }),
}

let cleanupPreview = null
let recomputePreview = null

if (process.argv.includes("--with-cleanup-preview")) {
  const result = await fetchJson(`${baseUrl}/api/internal/cleanup`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      dryRun: true,
      source: "admin",
      reason: "incident triage cleanup preview",
      requestedBy: "ops-incident-triage",
    }),
  })
  cleanupPreview = result.payload
  triage.actions.push("cleanup preview requested")
}

if (process.argv.includes("--with-recompute-preview")) {
  const result = await fetchJson(`${baseUrl}/api/internal/recompute-leaderboards`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      dryRun: true,
      source: "admin",
      days: 1,
      reason: "incident triage recompute preview",
      requestedBy: "ops-incident-triage",
    }),
  })
  recomputePreview = result.payload
  triage.actions.push("leaderboard recompute preview requested")
}

let archiveResult = null

if (auditResult.ok) {
  archiveResult = await archiveOperationalReport(baseUrl, headers, {
    reportType: "incident_triage",
    source: "api",
    reason: "incident triage snapshot",
    requestedBy: "ops-incident-triage",
    summary: triage.summary,
    actions: triage.actions,
    timeline: triage.incidentTimeline.map((item) => ({
      at: item.at,
      category: item.category,
      title: item.title,
      detail: item.detail,
      severity: item.severity ?? null,
    })),
  })
}

console.log(
  JSON.stringify(
    {
      ...triage,
      cleanupPreview,
      recomputePreview,
      archiveStatus: archiveResult ? archiveResult.status : null,
      archive: archiveResult?.payload ?? null,
    },
    null,
    2
  )
)

if (!readinessResult.ok || !auditResult.ok || (archiveResult && !archiveResult.ok)) {
  process.exit(1)
}
