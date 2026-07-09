const VALID_CLEANUP_SOURCES = new Set(["admin", "api", "cron", "unknown"])

function getFlagValue(argument) {
  const [, rawValue = ""] = argument.split("=", 2)
  return rawValue.trim()
}

function normalizeCleanupSource(value, fallback) {
  const normalized = value.trim()

  if (!normalized) {
    return fallback
  }

  if (!VALID_CLEANUP_SOURCES.has(normalized)) {
    throw new Error("source must be one of: admin, api, cron, unknown.")
  }

  return normalized
}

export function parseOpsCleanupArgs(
  argv,
  defaults = {
    dryRun: true,
    source: "cron",
    reason: "scheduled retention cleanup",
    requestedBy: "ops-cleanup",
  }
) {
  const options = {
    dryRun: defaults.dryRun,
    source: defaults.source,
    reason: defaults.reason,
    requestedBy: defaults.requestedBy,
  }

  for (const argument of argv) {
    if (argument === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (argument === "--apply") {
      options.dryRun = false
      continue
    }

    if (argument.startsWith("--source=")) {
      options.source = normalizeCleanupSource(getFlagValue(argument), defaults.source)
      continue
    }

    if (argument.startsWith("--reason=")) {
      const value = getFlagValue(argument)
      options.reason = value || defaults.reason
      continue
    }

    if (argument.startsWith("--requested-by=")) {
      const value = getFlagValue(argument)
      options.requestedBy = value || defaults.requestedBy
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

export function parseOpsNightlyMaintenanceArgs(argv) {
  const options = {
    runReadinessCheck: true,
    runCleanup: true,
    runDailyReport: true,
    cleanup: parseOpsCleanupArgs([], {
      dryRun: true,
      source: "cron",
      reason: "nightly retention cleanup",
      requestedBy: "ops-nightly-maintenance",
    }),
  }
  const cleanupArgs = []

  for (const argument of argv) {
    if (argument === "--skip-readiness") {
      options.runReadinessCheck = false
      continue
    }

    if (argument === "--skip-cleanup") {
      options.runCleanup = false
      continue
    }

    if (argument === "--skip-daily-report") {
      options.runDailyReport = false
      continue
    }

    cleanupArgs.push(argument)
  }

  options.cleanup = parseOpsCleanupArgs(cleanupArgs, {
    dryRun: true,
    source: "cron",
    reason: "nightly retention cleanup",
    requestedBy: "ops-nightly-maintenance",
  })

  return options
}
