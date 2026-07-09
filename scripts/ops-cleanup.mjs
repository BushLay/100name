import process from "node:process"

import { parseOpsCleanupArgs } from "../lib/ops-maintenance.mjs"

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    console.error(`${name} is required.`)
    process.exit(1)
  }

  return value
}

function printUsage() {
  console.log(`Usage: npm.cmd run ops:cleanup -- [--dry-run|--apply] [--source=cron] [--reason=text] [--requested-by=name]

Examples:
  npm.cmd run ops:cleanup
  npm.cmd run ops:cleanup -- --apply --requested-by=nightly-retention-job`)
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

const cleanupOptions = parseOpsCleanupArgs(process.argv.slice(2))
const result = await fetchJson(`${baseUrl}/api/internal/cleanup`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-name100-admin-secret": adminSecret,
    "x-name100-operator": cleanupOptions.requestedBy,
  },
  body: JSON.stringify(cleanupOptions),
})

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl,
      cleanup: cleanupOptions,
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
