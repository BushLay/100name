import process from "node:process"

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  return value || null
}

function getOptionalEnv(name) {
  return process.env[name]?.trim() || null
}

function parseStoreDriver() {
  const configured = getOptionalEnv("NAME100_STORE_DRIVER")

  if (configured === "postgres") {
    return "postgres"
  }

  if (configured === "file") {
    return "file"
  }

  return process.env.NODE_ENV === "production" ? "postgres" : "file"
}

function parseRateLimitDriver(storeDriver) {
  const configured = getOptionalEnv("NAME100_RATE_LIMIT_DRIVER")

  if (configured === "postgres") {
    return "postgres"
  }

  if (configured === "memory") {
    return "memory"
  }

  return storeDriver === "postgres" ? "postgres" : "memory"
}

function expect(condition, message, failures) {
  if (!condition) {
    failures.push(message)
  }
}

async function runRemoteHealthCheck(baseUrl, adminSecret, failures, warnings) {
  const healthResponse = await fetch(`${baseUrl}/api/internal/health`)

  if (!healthResponse.ok) {
    failures.push(`Health endpoint returned HTTP ${healthResponse.status}.`)
    return
  }

  const health = await healthResponse.json()
  expect(health.driver === "postgres", "Health check did not report postgres as the active driver.", failures)
  expect(health.adminSecretConfigured === true, "Health check reported admin secret is not configured.", failures)
  expect(health.rateLimitMode === "postgres", "Health check did not report postgres rate limiting.", failures)
  expect(
    Array.isArray(health.checks) && health.checks.every((check) => check.ok),
    "Health check reported at least one degraded dependency.",
    failures
  )

  const auditResponse = await fetch(`${baseUrl}/api/internal/audit`, {
    headers: {
      "x-name100-admin-secret": adminSecret,
    },
  })

  if (auditResponse.status === 401) {
    failures.push("Audit endpoint rejected the configured admin secret.")
    return
  }

  if (!auditResponse.ok) {
    warnings.push(`Audit endpoint returned HTTP ${auditResponse.status}; verify protected operator access manually.`)
    return
  }

  const audit = await auditResponse.json()
  expect(Boolean(audit.generatedAt), "Audit endpoint did not return a generated timestamp.", failures)
  expect(Boolean(audit.driver), "Audit endpoint did not return a store driver.", failures)
}

const failures = []
const warnings = []

try {
  const nodeEnv = getRequiredEnv("NODE_ENV")
  const siteUrl = getRequiredEnv("NEXT_PUBLIC_SITE_URL")
  const storeDriver = parseStoreDriver()
  const rateLimitDriver = parseRateLimitDriver(storeDriver)
  const databaseUrl = getOptionalEnv("DATABASE_URL")
  const adminSecret = getOptionalEnv("NAME100_ADMIN_SECRET")
  const emailDriver = getOptionalEnv("NAME100_EMAIL_DELIVERY_DRIVER") || "log"
  const emailWebhookUrl = getOptionalEnv("NAME100_EMAIL_WEBHOOK_URL")
  const emailFrom = getOptionalEnv("NAME100_EMAIL_FROM")
  const backupDir = getOptionalEnv("NAME100_BACKUP_DIR")
  const restoreDatabaseUrl = getOptionalEnv("NAME100_RESTORE_DATABASE_URL")
  const alertWebhookUrl = getOptionalEnv("NAME100_ALERT_WEBHOOK_URL")
  const remoteBaseUrl = getOptionalEnv("NAME100_RELEASE_BASE_URL") || siteUrl

  expect(Boolean(nodeEnv), "NODE_ENV is required for release-readiness checks.", failures)
  expect(Boolean(siteUrl), "NEXT_PUBLIC_SITE_URL is required for release-readiness checks.", failures)
  expect(nodeEnv === "production", "NODE_ENV must be production for a release-readiness run.", failures)
  expect(Boolean(siteUrl) && siteUrl.startsWith("https://"), "NEXT_PUBLIC_SITE_URL must use HTTPS.", failures)
  expect(storeDriver === "postgres", "Production releases must run with NAME100_STORE_DRIVER=postgres.", failures)
  expect(databaseUrl !== null, "DATABASE_URL must be configured for production releases.", failures)
  expect(rateLimitDriver === "postgres", "Production releases must use postgres-backed rate limiting.", failures)
  expect(Boolean(adminSecret), "NAME100_ADMIN_SECRET must be configured.", failures)
  expect(Boolean(alertWebhookUrl), "NAME100_ALERT_WEBHOOK_URL should be configured before long-term operation.", failures)
  expect(Boolean(emailFrom), "NAME100_EMAIL_FROM must be configured.", failures)
  expect(Boolean(backupDir), "NAME100_BACKUP_DIR should be configured for operator backups.", failures)
  expect(
    Boolean(restoreDatabaseUrl),
    "NAME100_RESTORE_DATABASE_URL should point at an isolated restore-drill database.",
    failures
  )

  if (emailDriver === "webhook") {
    expect(Boolean(emailWebhookUrl), "NAME100_EMAIL_WEBHOOK_URL is required when webhook email delivery is enabled.", failures)
  } else {
    warnings.push("Email delivery is not set to webhook; production sign-in email flow is not fully configured.")
  }

  if (!remoteBaseUrl) {
    warnings.push("Remote readiness checks were skipped because no release base URL could be resolved.")
  } else if (!remoteBaseUrl.startsWith("https://")) {
    failures.push("NAME100_RELEASE_BASE_URL or NEXT_PUBLIC_SITE_URL must point to an HTTPS deployment.")
  } else if (adminSecret) {
    await runRemoteHealthCheck(remoteBaseUrl.replace(/\/$/, ""), adminSecret, failures, warnings)
  } else {
    warnings.push("Remote readiness checks were skipped because NAME100_ADMIN_SECRET is missing.")
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : "Release-readiness check failed.")
}

if (warnings.length > 0) {
  console.log("Warnings:")
  for (const warning of warnings) {
    console.log(`- ${warning}`)
  }
}

if (failures.length > 0) {
  console.error("Release readiness failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("Release readiness passed.")
