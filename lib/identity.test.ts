import assert from "node:assert/strict"
import test from "node:test"

import {
  createRecoveryCode,
  normalizeRecoveryCode,
  normalizePlayerHandle,
  validatePlayerHandle,
} from "./identity.ts"

test("validatePlayerHandle normalizes and accepts supported handles", () => {
  assert.equal(normalizePlayerHandle("  Player_100 "), "player_100")
  assert.equal(validatePlayerHandle("Player_100"), "player_100")
})

test("validatePlayerHandle rejects unsupported handles", () => {
  assert.throws(() => validatePlayerHandle("ab"), /3-20 characters/i)
  assert.throws(() => validatePlayerHandle("bad-handle"), /3-20 characters/i)
})

test("recovery helpers normalize and format recovery codes", () => {
  const recoveryCode = createRecoveryCode()

  assert.match(recoveryCode, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  assert.equal(normalizeRecoveryCode("ab-cd ef12"), "ABCDEF12")
})
