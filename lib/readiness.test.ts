import assert from "node:assert/strict"
import test from "node:test"

import {
  buildInternalReadiness,
  calculateReadinessEscalation,
  summarizeReadinessProbeRuns,
} from "./server/readiness.ts"

test("buildInternalReadiness reports a healthy baseline", () => {
  const result = buildInternalReadiness({
    health: {
      ok: true,
      driver: "postgres",
      mode: "postgres",
      environment: "production",
      timestamp: new Date().toISOString(),
      uptimeSeconds: 100,
      adminSecretConfigured: true,
      rateLimitMode: "postgres",
      databaseUrlConfigured: true,
      checks: [
        {
          name: "database_ping",
          ok: true,
          message: "ok",
        },
      ],
    },
    audit: {
      driver: "postgres",
      generatedAt: new Date().toISOString(),
      totals: {
        players: 10,
        claimedPlayers: 5,
        verifiedEmails: 3,
        activeSessions7d: 8,
        failedRecoveries24h: 1,
      },
      deliverySummary: {
        totalMagicLinks: 5,
        pendingMagicLinks: 1,
        deliveredMagicLinks: 4,
        failedMagicLinks: 1,
        bouncedMagicLinks: 0,
        complainedMagicLinks: 0,
        consumedMagicLinks: 3,
        expiredUnconsumedMagicLinks: 0,
      },
      identityEvents: {
        filters: {
          eventType: null,
          handle: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      magicLinks: {
        filters: {
          mode: null,
          email: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      suspiciousActivity: {
        totalFlags: 1,
        activeRestrictionsOnFlaggedPlayers: 0,
        items: [],
      },
      operationalAlertSummary: {
        last24Hours: {
          totalAlerts: 0,
          sentAlerts: 0,
          suppressedAlerts: 0,
          failedAlerts: 0,
          warnAlerts: 0,
          errorAlerts: 0,
        },
        latestDispatchStatus: "unknown",
        latestRecoveryAlertAt: null,
        topEvents: [],
      },
      recentOperationalAlerts: [],
      operationalReports: {
        filters: {
          reportType: null,
          sinceDays: null,
          search: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      incidentHistory: {
        filters: {
          category: null,
          sinceDays: null,
          search: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      readinessProbeSummary: {
        last24Hours: {
          totalRuns: 0,
          failingRuns: 0,
          warningRuns: 0,
        },
        latestStatus: "unknown",
        latestEscalationLevel: "none",
        recoveredSincePreviousFailingRun: false,
        consecutiveFailingRuns: 0,
        topFailingChecks: [],
      },
      recurringJobFreshnessSummary: {
        warningJobs: 0,
        errorJobs: 0,
        items: [
          {
            jobType: "readiness_probe",
            label: "scheduled readiness probes",
            expectedIntervalHours: 1,
            warningAfterHours: 2,
            errorAfterHours: 6,
            latestRunAt: new Date().toISOString(),
            latestSource: "cron",
            latestRequestedBy: "ops-readiness-check",
            ageHours: 0.5,
            status: "healthy",
            message: "scheduled readiness probes last ran 0.5 hour(s) ago.",
          },
          {
            jobType: "retention_cleanup",
            label: "scheduled retention cleanup",
            expectedIntervalHours: 24,
            warningAfterHours: 30,
            errorAfterHours: 54,
            latestRunAt: new Date().toISOString(),
            latestSource: "cron",
            latestRequestedBy: "ops-nightly-maintenance",
            ageHours: 12,
            status: "healthy",
            message: "scheduled retention cleanup last ran 12 hour(s) ago.",
          },
          {
            jobType: "daily_report",
            label: "scheduled daily reports",
            expectedIntervalHours: 24,
            warningAfterHours: 30,
            errorAfterHours: 54,
            latestRunAt: new Date().toISOString(),
            latestSource: "cron",
            latestRequestedBy: "ops-nightly-maintenance",
            ageHours: 12,
            status: "healthy",
            message: "scheduled daily reports last ran 12 hour(s) ago.",
          },
        ],
      },
      recentReadinessProbeRuns: [],
      recentCleanupRuns: [
        {
          id: "cleanup-1",
          jobType: "retention_cleanup",
          source: "cron",
          reason: null,
          requestedBy: null,
          requestId: null,
          dryRun: false,
          driver: "postgres",
          deleted: {
            magicLinkTokens: 0,
            deliveryEvents: 0,
            operationalReports: 0,
          },
          remaining: {
            magicLinkTokens: 0,
            deliveryEvents: 0,
            operationalReports: 0,
          },
          retention: {
            magicLinkDays: 30,
            deliveryEventDays: 90,
            operationalReportDays: 180,
          },
          createdAt: new Date().toISOString(),
        },
      ],
      recentLeaderboardRecomputeRuns: [
        {
          id: "recompute-1",
          jobType: "leaderboard_recompute",
          source: "admin",
          reason: null,
          requestedBy: null,
          requestId: null,
          dryRun: false,
          driver: "postgres",
          dates: ["2026-07-09"],
          totalDates: 1,
          snapshots: {
            deletedRows: 0,
            insertedRows: 10,
          },
          createdAt: new Date().toISOString(),
        },
      ],
      recentAbuseRestrictions: [],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.summary.failedChecks, 0)
  assert.equal(result.summary.consecutiveFailingRuns, 0)
  assert.equal(result.summary.escalationLevel, "none")
  assert.equal(result.summary.recoveredSincePreviousFailingRun, false)
})

test("buildInternalReadiness escalates failed dependencies and incident signals", () => {
  const result = buildInternalReadiness({
    health: {
      ok: false,
      driver: "postgres",
      mode: "postgres",
      environment: "production",
      timestamp: new Date().toISOString(),
      uptimeSeconds: 100,
      adminSecretConfigured: false,
      rateLimitMode: "memory",
      databaseUrlConfigured: true,
      checks: [
        {
          name: "database_ping",
          ok: false,
          message: "failed",
        },
      ],
    },
    audit: {
      driver: "postgres",
      generatedAt: new Date().toISOString(),
      totals: {
        players: 10,
        claimedPlayers: 5,
        verifiedEmails: 3,
        activeSessions7d: 8,
        failedRecoveries24h: 25,
      },
      deliverySummary: {
        totalMagicLinks: 5,
        pendingMagicLinks: 1,
        deliveredMagicLinks: 4,
        failedMagicLinks: 30,
        bouncedMagicLinks: 10,
        complainedMagicLinks: 2,
        consumedMagicLinks: 3,
        expiredUnconsumedMagicLinks: 0,
      },
      identityEvents: {
        filters: {
          eventType: null,
          handle: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      magicLinks: {
        filters: {
          mode: null,
          email: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      suspiciousActivity: {
        totalFlags: 25,
        activeRestrictionsOnFlaggedPlayers: 2,
        items: [],
      },
      operationalAlertSummary: {
        last24Hours: {
          totalAlerts: 0,
          sentAlerts: 0,
          suppressedAlerts: 0,
          failedAlerts: 0,
          warnAlerts: 0,
          errorAlerts: 0,
        },
        latestDispatchStatus: "unknown",
        latestRecoveryAlertAt: null,
        topEvents: [],
      },
      recentOperationalAlerts: [],
      operationalReports: {
        filters: {
          reportType: null,
          sinceDays: null,
          search: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      incidentHistory: {
        filters: {
          category: null,
          sinceDays: null,
          search: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      readinessProbeSummary: {
        last24Hours: {
          totalRuns: 0,
          failingRuns: 0,
          warningRuns: 0,
        },
        latestStatus: "unknown",
        latestEscalationLevel: "none",
        recoveredSincePreviousFailingRun: false,
        consecutiveFailingRuns: 0,
        topFailingChecks: [],
      },
      recurringJobFreshnessSummary: {
        warningJobs: 1,
        errorJobs: 2,
        items: [
          {
            jobType: "readiness_probe",
            label: "scheduled readiness probes",
            expectedIntervalHours: 1,
            warningAfterHours: 2,
            errorAfterHours: 6,
            latestRunAt: null,
            latestSource: null,
            latestRequestedBy: null,
            ageHours: null,
            status: "error",
            message: "No scheduled readiness probes have been recorded yet.",
          },
          {
            jobType: "retention_cleanup",
            label: "scheduled retention cleanup",
            expectedIntervalHours: 24,
            warningAfterHours: 30,
            errorAfterHours: 54,
            latestRunAt: null,
            latestSource: null,
            latestRequestedBy: null,
            ageHours: null,
            status: "warning",
            message: "No scheduled retention cleanup have been recorded yet.",
          },
          {
            jobType: "daily_report",
            label: "scheduled daily reports",
            expectedIntervalHours: 24,
            warningAfterHours: 30,
            errorAfterHours: 54,
            latestRunAt: null,
            latestSource: null,
            latestRequestedBy: null,
            ageHours: null,
            status: "error",
            message: "scheduled daily reports have not run for 72 hour(s).",
          },
        ],
      },
      recentReadinessProbeRuns: [],
      recentCleanupRuns: [],
      recentLeaderboardRecomputeRuns: [],
      recentAbuseRestrictions: [],
    },
  })

  assert.equal(result.ok, false)
  assert.ok(result.summary.failedChecks >= 3)
  assert.ok(result.summary.warningChecks >= 3)
  assert.equal(result.summary.consecutiveFailingRuns, 1)
  assert.equal(result.summary.escalationLevel, "error")
  assert.equal(result.summary.recoveredSincePreviousFailingRun, false)
})

test("summarizeReadinessProbeRuns reports current drift trends", () => {
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const summary = summarizeReadinessProbeRuns([
    {
      id: "run-1",
      jobType: "readiness_probe",
      source: "cron",
      reason: null,
      requestedBy: null,
      requestId: null,
      driver: "postgres",
      ok: false,
      failedChecks: 2,
      warningChecks: 0,
      checks: [
        {
          name: "health_ok",
          ok: false,
          severity: "error",
          message: "failed",
        },
      ],
      createdAt: fiveMinutesAgo,
    },
    {
      id: "run-2",
      jobType: "readiness_probe",
      source: "cron",
      reason: null,
      requestedBy: null,
      requestId: null,
      driver: "postgres",
      ok: false,
      failedChecks: 1,
      warningChecks: 1,
      checks: [
        {
          name: "health_ok",
          ok: false,
          severity: "error",
          message: "failed",
        },
        {
          name: "magic_link_failures",
          ok: false,
          severity: "warn",
          message: "warn",
        },
      ],
      createdAt: tenMinutesAgo,
    },
    {
      id: "run-3",
      jobType: "readiness_probe",
      source: "cron",
      reason: null,
      requestedBy: null,
      requestId: null,
      driver: "postgres",
      ok: true,
      failedChecks: 0,
      warningChecks: 0,
      checks: [],
      createdAt: twoDaysAgo,
    },
  ])

  assert.deepEqual(summary.last24Hours, {
    totalRuns: 2,
    failingRuns: 2,
    warningRuns: 0,
  })
  assert.equal(summary.latestStatus, "failing")
  assert.equal(summary.latestEscalationLevel, "error")
  assert.equal(summary.recoveredSincePreviousFailingRun, false)
  assert.equal(summary.consecutiveFailingRuns, 2)
  assert.equal(summary.topFailingChecks[0]?.name, "health_ok")
  assert.equal(summary.topFailingChecks[0]?.count, 2)
})

test("buildInternalReadiness reports recovery after a previous failing state", () => {
  const result = buildInternalReadiness({
    health: {
      ok: true,
      driver: "postgres",
      mode: "postgres",
      environment: "production",
      timestamp: new Date().toISOString(),
      uptimeSeconds: 100,
      adminSecretConfigured: true,
      rateLimitMode: "postgres",
      databaseUrlConfigured: true,
      checks: [
        {
          name: "database_ping",
          ok: true,
          message: "ok",
        },
      ],
    },
    audit: {
      driver: "postgres",
      generatedAt: new Date().toISOString(),
      totals: {
        players: 10,
        claimedPlayers: 5,
        verifiedEmails: 3,
        activeSessions7d: 8,
        failedRecoveries24h: 0,
      },
      deliverySummary: {
        totalMagicLinks: 5,
        pendingMagicLinks: 1,
        deliveredMagicLinks: 4,
        failedMagicLinks: 0,
        bouncedMagicLinks: 0,
        complainedMagicLinks: 0,
        consumedMagicLinks: 3,
        expiredUnconsumedMagicLinks: 0,
      },
      identityEvents: {
        filters: {
          eventType: null,
          handle: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      magicLinks: {
        filters: {
          mode: null,
          email: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      suspiciousActivity: {
        totalFlags: 0,
        activeRestrictionsOnFlaggedPlayers: 0,
        items: [],
      },
      operationalAlertSummary: {
        last24Hours: {
          totalAlerts: 0,
          sentAlerts: 0,
          suppressedAlerts: 0,
          failedAlerts: 0,
          warnAlerts: 0,
          errorAlerts: 0,
        },
        latestDispatchStatus: "unknown",
        latestRecoveryAlertAt: null,
        topEvents: [],
      },
      recentOperationalAlerts: [],
      operationalReports: {
        filters: {
          reportType: null,
          sinceDays: null,
          search: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      incidentHistory: {
        filters: {
          category: null,
          sinceDays: null,
          search: null,
        },
        pagination: {
          limit: 20,
          offset: 0,
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
      },
      readinessProbeSummary: {
        last24Hours: {
          totalRuns: 2,
          failingRuns: 1,
          warningRuns: 0,
        },
        latestStatus: "failing",
        latestEscalationLevel: "error",
        recoveredSincePreviousFailingRun: false,
        consecutiveFailingRuns: 2,
        topFailingChecks: [{ name: "health_ok", count: 2 }],
      },
      recurringJobFreshnessSummary: {
        warningJobs: 0,
        errorJobs: 0,
        items: [
          {
            jobType: "readiness_probe",
            label: "scheduled readiness probes",
            expectedIntervalHours: 1,
            warningAfterHours: 2,
            errorAfterHours: 6,
            latestRunAt: new Date().toISOString(),
            latestSource: "cron",
            latestRequestedBy: "ops-readiness-check",
            ageHours: 0.3,
            status: "healthy",
            message: "scheduled readiness probes last ran 0.3 hour(s) ago.",
          },
          {
            jobType: "retention_cleanup",
            label: "scheduled retention cleanup",
            expectedIntervalHours: 24,
            warningAfterHours: 30,
            errorAfterHours: 54,
            latestRunAt: new Date().toISOString(),
            latestSource: "cron",
            latestRequestedBy: "ops-nightly-maintenance",
            ageHours: 8,
            status: "healthy",
            message: "scheduled retention cleanup last ran 8 hour(s) ago.",
          },
          {
            jobType: "daily_report",
            label: "scheduled daily reports",
            expectedIntervalHours: 24,
            warningAfterHours: 30,
            errorAfterHours: 54,
            latestRunAt: new Date().toISOString(),
            latestSource: "cron",
            latestRequestedBy: "ops-nightly-maintenance",
            ageHours: 8,
            status: "healthy",
            message: "scheduled daily reports last ran 8 hour(s) ago.",
          },
        ],
      },
      recentReadinessProbeRuns: [],
      recentCleanupRuns: [],
      recentLeaderboardRecomputeRuns: [
        {
          id: "recompute-1",
          jobType: "leaderboard_recompute",
          source: "admin",
          reason: null,
          requestedBy: null,
          requestId: null,
          dryRun: false,
          driver: "postgres",
          dates: ["2026-07-09"],
          totalDates: 1,
          snapshots: {
            deletedRows: 0,
            insertedRows: 10,
          },
          createdAt: new Date().toISOString(),
        },
      ],
      recentAbuseRestrictions: [],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.summary.recoveredSincePreviousFailingRun, true)
})

test("calculateReadinessEscalation upgrades repeated failures to critical", () => {
  assert.deepEqual(
    calculateReadinessEscalation({
      ok: false,
      warningChecks: 0,
      previousConsecutiveFailingRuns: 2,
    }),
    {
      consecutiveFailingRuns: 3,
      escalationLevel: "critical",
    }
  )

  assert.deepEqual(
    calculateReadinessEscalation({
      ok: true,
      warningChecks: 2,
      previousConsecutiveFailingRuns: 5,
    }),
    {
      consecutiveFailingRuns: 0,
      escalationLevel: "warning",
    }
  )
})
