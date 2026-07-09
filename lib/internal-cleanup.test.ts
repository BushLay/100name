import assert from "node:assert/strict"
import test from "node:test"

import { parseInternalCleanupInput } from "./server/internal-cleanup.ts"

test("parseInternalCleanupInput defaults to dry run", () => {
  assert.deepEqual(parseInternalCleanupInput(undefined), {
    dryRun: true,
    source: "unknown",
    reason: null,
    requestedBy: null,
    requestId: null,
  })
  assert.deepEqual(parseInternalCleanupInput(null), {
    dryRun: true,
    source: "unknown",
    reason: null,
    requestedBy: null,
    requestId: null,
  })
  assert.deepEqual(parseInternalCleanupInput({}), {
    dryRun: true,
    source: "unknown",
    reason: null,
    requestedBy: null,
    requestId: null,
  })
})

test("parseInternalCleanupInput accepts an explicit boolean", () => {
  assert.deepEqual(
    parseInternalCleanupInput({
      dryRun: false,
      source: "cron",
      reason: " daily retention ",
      requestedBy: " scheduler ",
      requestId: " req-123 ",
    }),
    {
      dryRun: false,
      source: "cron",
      reason: "daily retention",
      requestedBy: "scheduler",
      requestId: "req-123",
    }
  )
})

test("parseInternalCleanupInput rejects invalid payloads", () => {
  assert.throws(() => parseInternalCleanupInput("nope"), /json object/i)
  assert.throws(() => parseInternalCleanupInput({ dryRun: "false" }), /dryRun must be a boolean/i)
  assert.throws(() => parseInternalCleanupInput({ source: "timer" }), /source must be one of/i)
})
