import assert from "node:assert/strict"
import test from "node:test"

import { parseInternalLeaderboardRecomputeInput } from "./server/internal-leaderboard-recompute.ts"

test("parseInternalLeaderboardRecomputeInput defaults to today's dry run", () => {
  const result = parseInternalLeaderboardRecomputeInput(undefined)

  assert.equal(result.dryRun, true)
  assert.equal(result.days, 1)
  assert.equal(result.source, "unknown")
  assert.equal(typeof result.date, "string")
})

test("parseInternalLeaderboardRecomputeInput accepts explicit values", () => {
  assert.deepEqual(
    parseInternalLeaderboardRecomputeInput({
      dryRun: false,
      date: "2026-01-05",
      days: 7,
      source: "cron",
      reason: " nightly rebuild ",
      requestedBy: " job-runner ",
      requestId: " req-7 ",
    }),
    {
      dryRun: false,
      date: "2026-01-05",
      days: 7,
      source: "cron",
      reason: "nightly rebuild",
      requestedBy: "job-runner",
      requestId: "req-7",
    }
  )
})

test("parseInternalLeaderboardRecomputeInput rejects invalid payloads", () => {
  assert.throws(() => parseInternalLeaderboardRecomputeInput("bad"), /json object/i)
  assert.throws(
    () => parseInternalLeaderboardRecomputeInput({ days: 0 }),
    /days must be an integer between 1 and 90/i
  )
  assert.throws(
    () => parseInternalLeaderboardRecomputeInput({ date: "2026/13/99" }),
    /valid challenge date/i
  )
})
