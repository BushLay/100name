import assert from "node:assert/strict"
import test from "node:test"

import { parseInternalAlertDrillInput } from "./server/internal-alert-drill.ts"

test("parseInternalAlertDrillInput returns safe defaults", () => {
  assert.deepEqual(parseInternalAlertDrillInput(undefined), {
    severity: "warn",
    source: "unknown",
    message: "Operator-triggered alert drill.",
    reason: null,
    requestedBy: null,
    requestId: null,
  })
})

test("parseInternalAlertDrillInput normalizes valid values", () => {
  assert.deepEqual(
    parseInternalAlertDrillInput({
      severity: " error ",
      source: " cron ",
      message: "  Pager drill for nightly ops  ",
      reason: "  monthly drill ",
      requestedBy: "  scheduler ",
      requestId: "  req-123 ",
    }),
    {
      severity: "error",
      source: "cron",
      message: "Pager drill for nightly ops",
      reason: "monthly drill",
      requestedBy: "scheduler",
      requestId: "req-123",
    }
  )
})

test("parseInternalAlertDrillInput rejects invalid payloads", () => {
  assert.throws(() => parseInternalAlertDrillInput("bad"), /Alert drill body must be a JSON object/i)
  assert.throws(() => parseInternalAlertDrillInput({ severity: "info" }), /severity must be one of/i)
  assert.throws(() => parseInternalAlertDrillInput({ source: "worker" }), /source must be one of/i)
})
