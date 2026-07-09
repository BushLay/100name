import type {
  AdminAuditResult,
  AdminRecurringJobFreshnessItem,
  AdminReadinessProbeRun,
  AdminReadinessProbeSummary,
  HealthStatus,
} from "./store-types.ts"

export type ReadinessSeverity = "info" | "warn" | "error"
export type ReadinessEscalationLevel = "none" | "warning" | "error" | "critical"

export type ReadinessCheck = {
  name: string
  ok: boolean
  severity: ReadinessSeverity
  message: string
  metadata?: Record<string, unknown>
}

export type InternalReadinessResult = {
  ok: boolean
  generatedAt: string
  summary: {
    failedChecks: number
    warningChecks: number
    consecutiveFailingRuns: number
    escalationLevel: ReadinessEscalationLevel
    recoveredSincePreviousFailingRun: boolean
  }
  checks: ReadinessCheck[]
}

export function calculateReadinessEscalation(input: {
  ok: boolean
  warningChecks: number
  previousConsecutiveFailingRuns: number
}) {
  if (!input.ok) {
    const consecutiveFailingRuns = input.previousConsecutiveFailingRuns + 1

    return {
      consecutiveFailingRuns,
      escalationLevel:
        consecutiveFailingRuns >= 3 ? "critical" : "error",
    } as const
  }

  return {
    consecutiveFailingRuns: 0,
    escalationLevel: input.warningChecks > 0 ? "warning" : "none",
  } as const
}

export function summarizeReadinessProbeRuns(runs: AdminReadinessProbeRun[]) {
  const now = Date.now()
  const last24HoursRuns = runs.filter(
    (run) => new Date(run.createdAt).getTime() >= now - 24 * 60 * 60 * 1000
  )
  const topFailingCheckCounts = new Map<string, number>()
  let consecutiveFailingRuns = 0

  for (const run of runs) {
    if (!run.ok) {
      consecutiveFailingRuns += 1
    } else {
      break
    }
  }

  for (const run of last24HoursRuns) {
    for (const check of run.checks) {
      if (!check.ok) {
        topFailingCheckCounts.set(check.name, (topFailingCheckCounts.get(check.name) ?? 0) + 1)
      }
    }
  }

  const topFailingChecks = [...topFailingCheckCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
    }))

  return {
    last24Hours: {
      totalRuns: last24HoursRuns.length,
      failingRuns: last24HoursRuns.filter((run) => !run.ok).length,
      warningRuns: last24HoursRuns.filter((run) => run.ok && run.warningChecks > 0).length,
    },
    latestStatus: runs[0] ? (runs[0].ok ? "passing" : "failing") : "unknown",
    latestEscalationLevel:
      runs[0]
        ? calculateReadinessEscalation({
            ok: runs[0].ok,
            warningChecks: runs[0].warningChecks,
            previousConsecutiveFailingRuns: Math.max(0, consecutiveFailingRuns - (runs[0].ok ? 0 : 1)),
          }).escalationLevel
        : "none",
    recoveredSincePreviousFailingRun:
      Boolean(runs[0]?.ok) && runs.slice(1).some((run) => !run.ok),
    consecutiveFailingRuns,
    topFailingChecks,
  } satisfies AdminReadinessProbeSummary
}

export function buildInternalReadiness(input: {
  health: HealthStatus
  audit: AdminAuditResult
}) {
  const checks: ReadinessCheck[] = []
  const recurringJobFreshnessSummary = input.audit.recurringJobFreshnessSummary ?? {
    warningJobs: 0,
    errorJobs: 0,
    items: [],
  }
  const recurringJobFreshness =
    recurringJobFreshnessSummary.items.reduce<
      Partial<Record<AdminRecurringJobFreshnessItem["jobType"], AdminRecurringJobFreshnessItem>>
    >((result, item) => {
      result[item.jobType] = item
      return result
    }, {})

  checks.push({
    name: "health_ok",
    ok: input.health.ok && input.health.checks.every((check) => check.ok),
    severity: "error",
    message: input.health.ok
      ? "Health endpoint dependencies are passing."
      : "Health endpoint reported one or more failed dependencies.",
    metadata: {
      failedChecks: input.health.checks.filter((check) => !check.ok).map((check) => check.name),
      driver: input.health.driver,
    },
  })

  checks.push({
    name: "admin_secret_configured",
    ok: input.health.adminSecretConfigured,
    severity: "error",
    message: input.health.adminSecretConfigured
      ? "Admin secret is configured."
      : "Admin secret is not configured.",
  })

  checks.push({
    name: "postgres_rate_limit_mode",
    ok: input.health.rateLimitMode === "postgres",
    severity: "error",
    message:
      input.health.rateLimitMode === "postgres"
        ? "Shared Postgres rate limiting is enabled."
        : "Rate limiting is not using the shared Postgres mode.",
    metadata: {
      rateLimitMode: input.health.rateLimitMode,
    },
  })

  checks.push({
    name: "failed_recoveries_24h",
    ok: input.audit.totals.failedRecoveries24h < 10,
    severity: input.audit.totals.failedRecoveries24h >= 20 ? "error" : "warn",
    message: `${input.audit.totals.failedRecoveries24h} failed recoveries were recorded in the last 24 hours.`,
    metadata: {
      failedRecoveries24h: input.audit.totals.failedRecoveries24h,
    },
  })

  checks.push({
    name: "magic_link_failures",
    ok:
      input.audit.deliverySummary.failedMagicLinks +
        input.audit.deliverySummary.bouncedMagicLinks +
        input.audit.deliverySummary.complainedMagicLinks <
      20,
    severity:
      input.audit.deliverySummary.failedMagicLinks +
        input.audit.deliverySummary.bouncedMagicLinks +
        input.audit.deliverySummary.complainedMagicLinks >=
      40
        ? "error"
        : "warn",
    message: `${input.audit.deliverySummary.failedMagicLinks} failed, ${input.audit.deliverySummary.bouncedMagicLinks} bounced, and ${input.audit.deliverySummary.complainedMagicLinks} complained magic links are currently visible in the audit window.`,
    metadata: {
      failedMagicLinks: input.audit.deliverySummary.failedMagicLinks,
      bouncedMagicLinks: input.audit.deliverySummary.bouncedMagicLinks,
      complainedMagicLinks: input.audit.deliverySummary.complainedMagicLinks,
    },
  })

  checks.push({
    name: "suspicious_activity_flags",
    ok: input.audit.suspiciousActivity.totalFlags < 10,
    severity: input.audit.suspiciousActivity.totalFlags >= 20 ? "error" : "warn",
    message: `${input.audit.suspiciousActivity.totalFlags} suspicious activity flag(s) require operator review.`,
    metadata: {
      totalFlags: input.audit.suspiciousActivity.totalFlags,
      flaggedPlayersAlreadyRestricted:
        input.audit.suspiciousActivity.activeRestrictionsOnFlaggedPlayers,
    },
  })

  checks.push({
    name: "cleanup_job_history_present",
    ok: input.audit.recentCleanupRuns.length > 0,
    severity: "warn",
    message:
      input.audit.recentCleanupRuns.length > 0
        ? "Cleanup job history is present."
        : "No cleanup history is recorded yet.",
  })

  checks.push({
    name: "leaderboard_recompute_history_present",
    ok: input.audit.recentLeaderboardRecomputeRuns.length > 0,
    severity: "warn",
    message:
      input.audit.recentLeaderboardRecomputeRuns.length > 0
        ? "Leaderboard recompute history is present."
        : "No leaderboard recompute history is recorded yet.",
  })

  checks.push({
    name: "scheduled_readiness_probes_fresh",
    ok: recurringJobFreshness.readiness_probe?.status === "healthy",
    severity:
      recurringJobFreshness.readiness_probe?.status === "error" ? "error" : "warn",
    message:
      recurringJobFreshness.readiness_probe?.message ??
      "Scheduled readiness probe freshness is unknown.",
    metadata: recurringJobFreshness.readiness_probe
      ? {
          latestRunAt: recurringJobFreshness.readiness_probe.latestRunAt,
          ageHours: recurringJobFreshness.readiness_probe.ageHours,
          status: recurringJobFreshness.readiness_probe.status,
        }
      : undefined,
  })

  checks.push({
    name: "scheduled_cleanup_fresh",
    ok: recurringJobFreshness.retention_cleanup?.status === "healthy",
    severity:
      recurringJobFreshness.retention_cleanup?.status === "error" ? "error" : "warn",
    message:
      recurringJobFreshness.retention_cleanup?.message ??
      "Scheduled cleanup freshness is unknown.",
    metadata: recurringJobFreshness.retention_cleanup
      ? {
          latestRunAt: recurringJobFreshness.retention_cleanup.latestRunAt,
          ageHours: recurringJobFreshness.retention_cleanup.ageHours,
          status: recurringJobFreshness.retention_cleanup.status,
        }
      : undefined,
  })

  checks.push({
    name: "scheduled_daily_reports_fresh",
    ok: recurringJobFreshness.daily_report?.status === "healthy",
    severity:
      recurringJobFreshness.daily_report?.status === "error" ? "error" : "warn",
    message:
      recurringJobFreshness.daily_report?.message ??
      "Scheduled daily report freshness is unknown.",
    metadata: recurringJobFreshness.daily_report
      ? {
          latestRunAt: recurringJobFreshness.daily_report.latestRunAt,
          ageHours: recurringJobFreshness.daily_report.ageHours,
          status: recurringJobFreshness.daily_report.status,
        }
      : undefined,
  })

  const failedChecks = checks.filter((check) => !check.ok && check.severity === "error").length
  const warningChecks = checks.filter((check) => !check.ok && check.severity === "warn").length
  const escalation = calculateReadinessEscalation({
    ok: failedChecks === 0,
    warningChecks,
    previousConsecutiveFailingRuns: input.audit.readinessProbeSummary.consecutiveFailingRuns,
  })
  const recoveredSincePreviousFailingRun =
    failedChecks === 0 &&
    input.audit.readinessProbeSummary.latestStatus === "failing"

  return {
    ok: failedChecks === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      failedChecks,
      warningChecks,
      consecutiveFailingRuns: escalation.consecutiveFailingRuns,
      escalationLevel: escalation.escalationLevel,
      recoveredSincePreviousFailingRun,
    },
    checks,
  } satisfies InternalReadinessResult
}
