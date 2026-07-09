import assert from "node:assert/strict"
import test from "node:test"

import { parseInternalAbuseRestrictionInput } from "./server/internal-abuse-restrictions.ts"

test("parseInternalAbuseRestrictionInput parses activation", () => {
  assert.deepEqual(
    parseInternalAbuseRestrictionInput({
      action: "activate",
      targetType: "player",
      targetValue: "player-123",
      reason: " abuse ",
      source: "admin",
    }),
    {
      action: "activate",
      targetType: "player",
      targetValue: "player-123",
      reason: "abuse",
      source: "admin",
      requestedBy: null,
      requestId: null,
    }
  )
})

test("parseInternalAbuseRestrictionInput parses lifting", () => {
  assert.deepEqual(
    parseInternalAbuseRestrictionInput({
      action: "lift",
      restrictionId: "restriction-1",
      reason: " cleared ",
    }),
    {
      action: "lift",
      restrictionId: "restriction-1",
      reason: "cleared",
      source: "unknown",
      requestedBy: null,
      requestId: null,
    }
  )
})

test("parseInternalAbuseRestrictionInput rejects invalid payloads", () => {
  assert.throws(() => parseInternalAbuseRestrictionInput(null), /json object/i)
  assert.throws(
    () => parseInternalAbuseRestrictionInput({ action: "activate" }),
    /targetType must be one of/i
  )
  assert.throws(
    () => parseInternalAbuseRestrictionInput({ action: "lift" }),
    /restrictionId is required/i
  )
})
