import process from "node:process"

import { buildIncidentTimeline, summarizeAudit } from "../lib/ops-reporting.mjs"
import { parseOpsNightlyMaintenanceArgs } from "../lib/ops-maintenance.mjs"

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    console.error(`${name} is required.`)
    process.exit(1)
  }

  return value
}

function printUsage() {
  console.log(`Usage: npm.cmd run ops:nightly-maintenance -- [--skip-readiness] [--skip-cleanup] [--skip-daily-report] [--dry-run|--apply] [--reason=text] [--requested-by=name]

Examples:
  npm.cmd run ops:nightly-maintenance
  npm.cmd run ops:nightly-maintenance -- --apply --requested-by=nightly-ops-job`)
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
      "x-name100-operator": "ops-nightly-maintenance",
    },
    body: JSON.stringify(payload),
  })
}

if (process.argv.includes("--help")) {
  printUsage()
  process.exit(0)
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

const options = parseOpsNightlyMaintenanceArgs(process.argv.slice(2))
const headers = {
  "x-name100-admin-secret": adminSecret,
}
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  plan: {
    runReadinessCheck: options.runReadinessCheck,
    runCleanup: options.runCleanup,
    runDailyReport: options.runDailyReport,
    cleanup: options.cleanup,
  },
  readinessCheck: null,
  cleanup: null,
  dailyReport: null,
}

if (options.runReadinessCheck) {
  const readinessUrl = new URL(`${baseUrl}/api/internal/readiness`)
  readinessUrl.searchParams.set("record", "true")
  readinessUrl.searchParams.set("reason", "nightly maintenance readiness check")

  const readinessResult = await fetchJson(readinessUrl, {
    method: "GET",
    headers: {
      ...headers,
      "x-name100-operator": "ops-nightly-maintenance",
    },
  })

  summary.readinessCheck = {
    ok: readinessResult.ok,
    status: readinessResult.status,
    payload: readinessResult.payload,
  }
}

if (options.runCleanup) {
  const cleanupResult = await fetchJson(`${baseUrl}/api/internal/cleanup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
      "x-name100-operator": options.cleanup.requestedBy,
    },
    body: JSON.stringify(options.cleanup),
  })

  summary.cleanup = {
    ok: cleanupResult.ok,
    status: cleanupResult.status,
    payload: cleanupResult.payload,
  }
}

if (options.runDailyReport) {
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
      reason: "nightly maintenance daily report",
      requestedBy: "ops-nightly-maintenance",
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

  summary.dailyReport = {
    ok: readinessResult.ok && auditResult.ok && (!archiveResult || archiveResult.ok),
    readinessStatus: readinessResult.status,
    auditStatus: auditResult.status,
    archiveStatus: archiveResult?.status ?? null,
    payload: report,
    archive: archiveResult?.payload ?? null,
  }
}

const failures = [
  summary.readinessCheck && !summary.readinessCheck.ok ? "readinessCheck" : null,
  summary.cleanup && !summary.cleanup.ok ? "cleanup" : null,
  summary.dailyReport && !summary.dailyReport.ok ? "dailyReport" : null,
].filter(Boolean)

console.log(JSON.stringify(summary, null, 2))

if (failures.length > 0) {
  process.exit(1)
}
