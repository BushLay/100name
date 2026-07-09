export const MAX_INCIDENT_TIMELINE_ITEMS = 12

export function summarizeAudit(audit) {
  const readiness = audit?.readinessProbeSummary ?? null
  const delivery = audit?.deliverySummary ?? null
  const suspicious = audit?.suspiciousActivity ?? null
  const operationalAlerts = audit?.operationalAlertSummary ?? null
  const recurringJobs = audit?.recurringJobFreshnessSummary ?? null

  return {
    readiness: readiness
      ? {
          latestStatus: readiness.latestStatus,
          latestEscalationLevel: readiness.latestEscalationLevel,
          totalRuns24h: readiness.last24Hours.totalRuns,
          failingRuns24h: readiness.last24Hours.failingRuns,
          consecutiveFailingRuns: readiness.consecutiveFailingRuns,
          topFailingChecks: readiness.topFailingChecks,
          recoveredSincePreviousFailingRun: readiness.recoveredSincePreviousFailingRun,
        }
      : null,
    delivery: delivery
      ? {
          pendingMagicLinks: delivery.pendingMagicLinks,
          failedMagicLinks: delivery.failedMagicLinks,
          bouncedMagicLinks: delivery.bouncedMagicLinks,
          complainedMagicLinks: delivery.complainedMagicLinks,
          expiredUnconsumedMagicLinks: delivery.expiredUnconsumedMagicLinks,
        }
      : null,
    suspiciousActivity: suspicious
      ? {
          totalFlags: suspicious.totalFlags,
          flaggedPlayersAlreadyRestricted: suspicious.activeRestrictionsOnFlaggedPlayers,
        }
      : null,
    operationalAlerts: operationalAlerts
      ? {
          totalAlerts24h: operationalAlerts.last24Hours.totalAlerts,
          sentAlerts24h: operationalAlerts.last24Hours.sentAlerts,
          suppressedAlerts24h: operationalAlerts.last24Hours.suppressedAlerts,
          failedAlerts24h: operationalAlerts.last24Hours.failedAlerts,
          latestDispatchStatus: operationalAlerts.latestDispatchStatus,
          latestRecoveryAlertAt: operationalAlerts.latestRecoveryAlertAt,
          topEvents: operationalAlerts.topEvents,
        }
      : null,
    recurringJobs: recurringJobs
      ? {
          warningJobs: recurringJobs.warningJobs,
          errorJobs: recurringJobs.errorJobs,
          items: recurringJobs.items,
        }
      : null,
    operations: {
      recentOperationalAlerts: audit?.recentOperationalAlerts?.length ?? 0,
      recentReadinessProbes: audit?.recentReadinessProbeRuns?.length ?? 0,
      recentCleanupRuns: audit?.recentCleanupRuns?.length ?? 0,
      recentLeaderboardRecomputeRuns: audit?.recentLeaderboardRecomputeRuns?.length ?? 0,
      recentAbuseRestrictions: audit?.recentAbuseRestrictions?.length ?? 0,
    },
  }
}

export function buildIncidentActions(input) {
  const actions = []
  const readiness = input?.readiness ?? null
  const audit = input?.audit ?? null
  const deliverySummary = audit?.deliverySummary ?? null
  const readinessSummary = audit?.readinessProbeSummary ?? null
  const operationalAlertSummary = audit?.operationalAlertSummary ?? null
  const recurringJobs = audit?.recurringJobFreshnessSummary ?? null

  if (readiness && readiness.ok === false) {
    actions.push("readiness failed")
  }

  if (deliverySummary) {
    const deliveryFailures =
      deliverySummary.failedMagicLinks +
      deliverySummary.bouncedMagicLinks +
      deliverySummary.complainedMagicLinks

    if (deliveryFailures > 0) {
      actions.push("email delivery failures detected")
    }
  }

  if (readinessSummary?.latestEscalationLevel === "critical") {
    actions.push("critical readiness escalation detected")
  }

  if ((operationalAlertSummary?.last24Hours.failedAlerts ?? 0) > 0) {
    actions.push("operational alert dispatch failures detected")
  }

  if (
    operationalAlertSummary?.latestDispatchStatus === "suppressed" &&
    (operationalAlertSummary?.last24Hours.suppressedAlerts ?? 0) > 0
  ) {
    actions.push("operational alerts are currently being suppressed")
  }

  if (readiness?.summary?.recoveredSincePreviousFailingRun) {
    actions.push("readiness recovered after a previous failing run")
  }

  if ((recurringJobs?.errorJobs ?? 0) > 0) {
    const staleLabels = recurringJobs.items
      .filter((item) => item.status === "error")
      .map((item) => item.label)

    actions.push(`scheduled jobs missing or stale: ${staleLabels.join(", ")}`)
  } else if ((recurringJobs?.warningJobs ?? 0) > 0) {
    const staleLabels = recurringJobs.items
      .filter((item) => item.status === "warning")
      .map((item) => item.label)

    actions.push(`scheduled jobs need review: ${staleLabels.join(", ")}`)
  }

  return [...new Set(actions)]
}

function buildTimelineItem(input) {
  return {
    at: input.at,
    category: input.category,
    title: input.title,
    detail: input.detail,
    severity: input.severity ?? null,
  }
}

export function buildIncidentTimeline(audit) {
  const timeline = []

  for (const alert of audit?.recentOperationalAlerts ?? []) {
    timeline.push(
      buildTimelineItem({
        at: alert.createdAt,
        category: "operational_alert",
        title: `${alert.dispatchStatus} ${alert.severity} alert`,
        detail: `${alert.event}: ${alert.message}`,
        severity: alert.severity,
      })
    )
  }

  for (const run of audit?.recentReadinessProbeRuns ?? []) {
    timeline.push(
      buildTimelineItem({
        at: run.createdAt,
        category: "readiness_probe",
        title: run.ok ? "passing readiness probe" : "failing readiness probe",
        detail: `${run.failedChecks} failed check(s), ${run.warningChecks} warning check(s)`,
        severity: run.ok ? "warn" : "error",
      })
    )
  }

  for (const run of audit?.recentCleanupRuns ?? []) {
    timeline.push(
      buildTimelineItem({
        at: run.createdAt,
        category: "retention_cleanup",
        title: run.dryRun ? "cleanup dry run" : "cleanup applied",
        detail: `deleted ${run.deleted.magicLinkTokens} tokens and ${run.deleted.deliveryEvents} delivery events`,
      })
    )
  }

  for (const run of audit?.recentLeaderboardRecomputeRuns ?? []) {
    timeline.push(
      buildTimelineItem({
        at: run.createdAt,
        category: "leaderboard_recompute",
        title: run.dryRun ? "leaderboard recompute dry run" : "leaderboard recompute applied",
        detail: `${run.totalDates} date(s), ${run.snapshots.insertedRows} inserted row(s)`,
      })
    )
  }

  for (const restriction of audit?.recentAbuseRestrictions ?? []) {
    timeline.push(
      buildTimelineItem({
        at: restriction.liftedAt ?? restriction.createdAt,
        category: "abuse_restriction",
        title: restriction.active ? "abuse restriction active" : "abuse restriction lifted",
        detail: `${restriction.targetType}:${restriction.targetValue}`,
      })
    )
  }

  return timeline
    .filter((item) => item.at)
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, MAX_INCIDENT_TIMELINE_ITEMS)
}
