import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOperationalAlertKey,
  shouldDispatchOperationalAlert,
  summarizeOperationalAlertRuns,
} from "./operational-alerts.ts"

test("shouldDispatchOperationalAlert bypasses severity thresholds for recovery notifications", () => {
  assert.equal(shouldDispatchOperationalAlert("warn", "error", true), true)
})

test("shouldDispatchOperationalAlert respects configured severity thresholds by default", () => {
  assert.equal(shouldDispatchOperationalAlert("warn", "error"), false)
  assert.equal(shouldDispatchOperationalAlert("error", "error"), true)
})

test("buildOperationalAlertKey prefers an explicit dedup key", () => {
  assert.equal(
    buildOperationalAlertKey({
      event: "internal.readiness.recovered",
      severity: "warn",
      message: "Operational readiness recovered after a previous failing probe.",
      dedupKey: "internal.readiness.recovered",
      metadata: {
        route: "/api/internal/readiness",
        stateTransition: "failing->passing",
      },
    }),
    "internal.readiness.recovered"
  )
})

test("buildOperationalAlertKey falls back to route and status metadata", () => {
  assert.equal(
    buildOperationalAlertKey({
      event: "internal.readiness.degraded",
      severity: "error",
      message: "Operational readiness degraded.",
      metadata: {
        route: "/api/internal/readiness",
        status: 503,
      },
    }),
    "internal.readiness.degraded:error:/api/internal/readiness:503:Operational readiness degraded."
  )
})

test("summarizeOperationalAlertRuns reports delivery and recovery history", () => {
  const now = new Date()

  const summary = summarizeOperationalAlertRuns([
    {
      event: "internal.readiness.recovered",
      severity: "warn",
      dispatchStatus: "sent",
      createdAt: now.toISOString(),
    },
    {
      event: "internal.readiness.degraded",
      severity: "error",
      dispatchStatus: "failed",
      createdAt: new Date(now.getTime() - 60_000).toISOString(),
    },
    {
      event: "internal.readiness.degraded",
      severity: "error",
      dispatchStatus: "suppressed",
      createdAt: new Date(now.getTime() - 120_000).toISOString(),
    },
  ])

  assert.deepEqual(summary.last24Hours, {
    totalAlerts: 3,
    sentAlerts: 1,
    suppressedAlerts: 1,
    failedAlerts: 1,
    warnAlerts: 1,
    errorAlerts: 2,
  })
  assert.equal(summary.latestDispatchStatus, "sent")
  assert.equal(summary.latestRecoveryAlertAt, now.toISOString())
  assert.deepEqual(summary.topEvents, [
    {
      event: "internal.readiness.degraded",
      count: 2,
    },
    {
      event: "internal.readiness.recovered",
      count: 1,
    },
  ])
})
