import assert from "node:assert/strict"
import test from "node:test"

import {
  buildIncidentActions,
  buildIncidentTimeline,
  summarizeAudit,
} from "./ops-reporting.mjs"

function createAuditFixture() {
  return {
    deliverySummary: {
      pendingMagicLinks: 1,
      failedMagicLinks: 2,
      bouncedMagicLinks: 1,
      complainedMagicLinks: 0,
      expiredUnconsumedMagicLinks: 3,
    },
    suspiciousActivity: {
      totalFlags: 2,
      activeRestrictionsOnFlaggedPlayers: 1,
    },
    operationalAlertSummary: {
      last24Hours: {
        totalAlerts: 4,
        sentAlerts: 2,
        suppressedAlerts: 1,
        failedAlerts: 1,
        warnAlerts: 1,
        errorAlerts: 3,
      },
      latestDispatchStatus: "suppressed",
      latestRecoveryAlertAt: "2026-07-09T10:00:00.000Z",
      topEvents: [{ event: "internal.readiness.degraded", count: 2 }],
    },
    readinessProbeSummary: {
      latestStatus: "passing",
      latestEscalationLevel: "critical",
      recoveredSincePreviousFailingRun: true,
      last24Hours: {
        totalRuns: 5,
        failingRuns: 2,
        warningRuns: 1,
      },
      consecutiveFailingRuns: 0,
      topFailingChecks: [{ name: "health_ok", count: 2 }],
    },
    recurringJobFreshnessSummary: {
      warningJobs: 1,
      errorJobs: 1,
      items: [
        {
          jobType: "readiness_probe",
          label: "scheduled readiness probes",
          status: "error",
          message: "scheduled readiness probes have not run for 7 hour(s).",
        },
        {
          jobType: "retention_cleanup",
          label: "scheduled retention cleanup",
          status: "warning",
          message: "scheduled retention cleanup have not run for 32 hour(s).",
        },
      ],
    },
    recentOperationalAlerts: [
      {
        createdAt: "2026-07-09T10:10:00.000Z",
        dispatchStatus: "failed",
        severity: "error",
        event: "internal.readiness.degraded",
        message: "Operational readiness degraded.",
      },
    ],
    recentReadinessProbeRuns: [
      {
        createdAt: "2026-07-09T10:09:00.000Z",
        ok: false,
        failedChecks: 2,
        warningChecks: 1,
      },
    ],
    recentCleanupRuns: [
      {
        createdAt: "2026-07-09T10:08:00.000Z",
        dryRun: false,
        deleted: {
          magicLinkTokens: 3,
          deliveryEvents: 4,
        },
      },
    ],
    recentLeaderboardRecomputeRuns: [
      {
        createdAt: "2026-07-09T10:07:00.000Z",
        dryRun: true,
        totalDates: 2,
        snapshots: {
          insertedRows: 10,
        },
      },
    ],
    recentAbuseRestrictions: [
      {
        createdAt: "2026-07-09T10:06:00.000Z",
        liftedAt: null,
        active: true,
        targetType: "player",
        targetValue: "player-123",
      },
    ],
  }
}

test("summarizeAudit includes operational alert health", () => {
  const summary = summarizeAudit(createAuditFixture())

  assert.equal(summary.operationalAlerts?.failedAlerts24h, 1)
  assert.equal(summary.operationalAlerts?.latestDispatchStatus, "suppressed")
  assert.equal(summary.operations.recentOperationalAlerts, 1)
  assert.equal(summary.readiness?.recoveredSincePreviousFailingRun, true)
  assert.equal(summary.recurringJobs?.errorJobs, 1)
})

test("buildIncidentActions surfaces alert-delivery and recovery concerns", () => {
  const actions = buildIncidentActions({
    readiness: {
      ok: false,
      summary: {
        recoveredSincePreviousFailingRun: true,
      },
    },
    audit: createAuditFixture(),
  })

  assert.deepEqual(actions, [
    "readiness failed",
    "email delivery failures detected",
    "critical readiness escalation detected",
    "operational alert dispatch failures detected",
    "operational alerts are currently being suppressed",
    "readiness recovered after a previous failing run",
    "scheduled jobs missing or stale: scheduled readiness probes",
  ])
})

test("buildIncidentTimeline merges operational events into one chronology", () => {
  const timeline = buildIncidentTimeline(createAuditFixture())

  assert.equal(timeline.length, 5)
  assert.deepEqual(timeline[0], {
    at: "2026-07-09T10:10:00.000Z",
    category: "operational_alert",
    title: "failed error alert",
    detail: "internal.readiness.degraded: Operational readiness degraded.",
    severity: "error",
  })
  assert.equal(timeline[1]?.category, "readiness_probe")
  assert.equal(timeline[4]?.category, "abuse_restriction")
})
