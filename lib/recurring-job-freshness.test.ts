import assert from "node:assert/strict"
import test from "node:test"

import { buildRecurringJobFreshnessSummary } from "./server/recurring-job-freshness.ts"

test("buildRecurringJobFreshnessSummary reports healthy scheduled jobs", () => {
  const now = new Date("2026-07-09T12:00:00.000Z").getTime()
  const summary = buildRecurringJobFreshnessSummary({
    now,
    readinessProbeRuns: [
      {
        id: "readiness-1",
        jobType: "readiness_probe",
        source: "cron",
        reason: null,
        requestedBy: "ops-readiness-check",
        requestId: null,
        driver: "postgres",
        ok: true,
        failedChecks: 0,
        warningChecks: 0,
        checks: [],
        createdAt: "2026-07-09T11:10:00.000Z",
      },
    ],
    cleanupRuns: [
      {
        id: "cleanup-1",
        jobType: "retention_cleanup",
        source: "cron",
        reason: null,
        requestedBy: "ops-nightly-maintenance",
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
        createdAt: "2026-07-09T00:30:00.000Z",
      },
    ],
    operationalReports: [
      {
        id: "report-1",
        jobType: "operational_report",
        reportType: "daily_report",
        source: "cron",
        reason: null,
        requestedBy: "ops-nightly-maintenance",
        requestId: null,
        driver: "postgres",
        summary: {},
        actions: [],
        timeline: [],
        createdAt: "2026-07-09T00:35:00.000Z",
      },
    ],
  })

  assert.equal(summary.errorJobs, 0)
  assert.equal(summary.warningJobs, 0)
  assert.deepEqual(
    summary.items.map((item) => item.status),
    ["healthy", "healthy", "healthy"]
  )
})

test("buildRecurringJobFreshnessSummary flags missing or stale scheduled jobs", () => {
  const now = new Date("2026-07-09T12:00:00.000Z").getTime()
  const summary = buildRecurringJobFreshnessSummary({
    now,
    readinessProbeRuns: [],
    cleanupRuns: [
      {
        id: "cleanup-1",
        jobType: "retention_cleanup",
        source: "cron",
        reason: null,
        requestedBy: "ops-nightly-maintenance",
        requestId: null,
        dryRun: true,
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
        createdAt: "2026-07-07T03:00:00.000Z",
      },
    ],
    operationalReports: [],
  })

  assert.equal(summary.errorJobs, 2)
  assert.equal(summary.warningJobs, 1)
  assert.equal(summary.items[0]?.jobType, "readiness_probe")
  assert.equal(summary.items[0]?.status, "error")
  assert.match(summary.items[0]?.message ?? "", /No scheduled readiness probes/i)
  assert.equal(summary.items[1]?.status, "error")
  assert.equal(summary.items[2]?.status, "warning")
})
