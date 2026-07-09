import process from "node:process"

import { parseOpsAlertDrillArgs } from "../lib/ops-alert-drill.mjs"

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    console.error(`${name} is required.`)
    process.exit(1)
  }

  return value
}

function printUsage() {
  console.log(`Usage: npm.cmd run ops:alert-drill -- [--severity=warn|error] [--message=text] [--reason=text] [--requested-by=name]

Examples:
  npm.cmd run ops:alert-drill
  npm.cmd run ops:alert-drill -- --severity=error --reason=monthly pager drill`)
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

const alertDrill = parseOpsAlertDrillArgs(process.argv.slice(2))
const result = await fetchJson(`${baseUrl}/api/internal/alert-drill`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-name100-admin-secret": adminSecret,
    "x-name100-operator": alertDrill.requestedBy,
  },
  body: JSON.stringify({
    severity: alertDrill.severity,
    message: alertDrill.message,
    reason: alertDrill.reason,
    source: "cron",
    requestedBy: alertDrill.requestedBy,
  }),
})

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl,
      drill: alertDrill,
      status: result.status,
      ok: result.ok,
      payload: result.payload,
    },
    null,
    2
  )
)

if (!result.ok) {
  process.exit(1)
}
