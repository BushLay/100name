import process from "node:process"
import { buildIncidentTimeline, summarizeAudit } from "../lib/ops-reporting.mjs"

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
      "x-name100-operator": "ops-daily-report",
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
  "x-name100-admin-secret": adminSecret,
}

const [readinessResult, auditResult] = await Promise.all([
  fetchJson(`${baseUrl}/api/internal/readiness`, {
    method: "GET",
    headers,
  }),
  fetchJson(`${baseUrl}/api/internal/audit`, {
    method: "GET",
    headers,
  }),
])

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  readinessStatus: readinessResult.status,
  auditStatus: auditResult.status,
  summary: auditResult.ok ? summarizeAudit(auditResult.payload) : null,
  incidentTimeline: auditResult.ok ? buildIncidentTimeline(auditResult.payload) : [],
  readiness: readinessResult.payload,
}

let archiveResult = null

if (auditResult.ok) {
  archiveResult = await archiveOperationalReport(baseUrl, headers, {
    reportType: "daily_report",
    source: "cron",
    reason: "scheduled daily report",
    requestedBy: "ops-daily-report",
    summary: report.summary,
    actions: [],
    timeline: report.incidentTimeline.map((item) => ({
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
      ...report,
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
