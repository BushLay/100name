import assert from "node:assert/strict"
import test from "node:test"

import { parseOpsAlertDrillArgs } from "./ops-alert-drill.mjs"

test("parseOpsAlertDrillArgs returns safe defaults", () => {
  assert.deepEqual(parseOpsAlertDrillArgs([]), {
    severity: "warn",
    message: "Operator-triggered alert drill.",
    reason: null,
    requestedBy: "ops-alert-drill",
  })
})

test("parseOpsAlertDrillArgs accepts explicit values", () => {
  assert.deepEqual(
    parseOpsAlertDrillArgs([
      "--severity=error",
      "--message= pager drill ",
      "--reason= monthly check ",
      "--requested-by= nightly-ops ",
    ]),
    {
      severity: "error",
      message: "pager drill",
      reason: "monthly check",
      requestedBy: "nightly-ops",
    }
  )
})

test("parseOpsAlertDrillArgs rejects invalid flags", () => {
  assert.throws(() => parseOpsAlertDrillArgs(["--severity=info"]), /severity must be one of/i)
  assert.throws(() => parseOpsAlertDrillArgs(["--unknown"]), /Unknown argument/i)
})
