import assert from "node:assert/strict"
import test from "node:test"

import {
  parseOpsCleanupArgs,
  parseOpsNightlyMaintenanceArgs,
} from "./ops-maintenance.mjs"

test("parseOpsCleanupArgs defaults to a dry-run cron cleanup", () => {
  assert.deepEqual(parseOpsCleanupArgs([]), {
    dryRun: true,
    source: "cron",
    reason: "scheduled retention cleanup",
    requestedBy: "ops-cleanup",
  })
})

test("parseOpsCleanupArgs accepts apply mode and trims explicit values", () => {
  assert.deepEqual(
    parseOpsCleanupArgs([
      "--apply",
      "--source=admin",
      "--reason= nightly retention apply ",
      "--requested-by= scheduler ",
    ]),
    {
      dryRun: false,
      source: "admin",
      reason: "nightly retention apply",
      requestedBy: "scheduler",
    }
  )
})

test("parseOpsCleanupArgs rejects invalid sources and unknown flags", () => {
  assert.throws(() => parseOpsCleanupArgs(["--source=worker"]), /source must be one of/i)
  assert.throws(() => parseOpsCleanupArgs(["--mystery-flag"]), /Unknown argument/i)
})

test("parseOpsNightlyMaintenanceArgs supports step skips and cleanup overrides", () => {
  assert.deepEqual(
    parseOpsNightlyMaintenanceArgs([
      "--skip-daily-report",
      "--apply",
      "--reason=nightly cleanup",
      "--requested-by=night-ops",
    ]),
    {
      runReadinessCheck: true,
      runCleanup: true,
      runDailyReport: false,
      cleanup: {
        dryRun: false,
        source: "cron",
        reason: "nightly cleanup",
        requestedBy: "night-ops",
      },
    }
  )
})
