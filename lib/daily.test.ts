import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDailyShareText,
  fetchDailyDataset,
  formatDuration,
  generateDailySeed,
  getDailyChallenge,
  getDailyRoute,
  getDailyThemeMessages,
  getTodayDateString,
  getDailyThemeValidator,
  isValidChallengeDate,
} from "./daily.ts"

test("generateDailySeed stays stable for the same date", () => {
  assert.equal(generateDailySeed("2026-07-01"), generateDailySeed("2026-07-01"))
})

test("fetchDailyDataset is deterministic for a seed", () => {
  const first = fetchDailyDataset(42)
  const second = fetchDailyDataset(42)

  assert.equal(first.id, second.id)
  assert.equal(first.targetScore, 20)
})

test("getDailyChallenge returns a fixed theme and target score for a date", () => {
  const challenge = getDailyChallenge("2026-07-01")

  assert.equal(challenge.date, "2026-07-01")
  assert.ok(challenge.targetScore > 0)
  assert.ok(challenge.themeId.length > 0)
  assert.ok(challenge.title.length > 0)
  assert.equal(challenge.faq.length > 0, true)
})

test("getDailyChallenge supports curated theme overrides for specific dates", () => {
  const challenge = getDailyChallenge("2026-07-11")

  assert.equal(challenge.date, "2026-07-11")
  assert.equal(challenge.themeId, "silo-season-3-cast")
  assert.equal(challenge.targetScore, 9)
  assert.match(challenge.title, /silo/i)
})

test("daily helpers format urls, durations, and share text", () => {
  assert.equal(getDailyRoute("2026-07-01"), "/daily/2026-07-01")
  assert.equal(formatDuration(133000), "2m 13s")
  assert.equal(isValidChallengeDate("2026-07-01"), true)
  assert.equal(isValidChallengeDate("2026/07/01"), false)
  assert.equal(getTodayDateString(new Date(2026, 6, 8, 0, 30, 0)), "2026-07-08")

  const text = buildDailyShareText({
    date: "2026-07-01",
    score: 20,
    targetScore: 20,
    durationMs: 133000,
    shareLabel: "female actors",
    shareTitle: "Female actors challenge",
    url: "/daily/2026-07-01",
  })

  assert.match(text, /20\/20/)
  assert.match(text, /Female actors challenge/)
  assert.match(text, /female actors today/i)
  assert.match(text, /🟩🟩🟩🟩🟩/)
  assert.match(text, /⏱ 2m 13s/)
  assert.match(text, /🔥 Streak: 0 days/)
})

test("theme validators and messages are available for a daily challenge", () => {
  const challenge = getDailyChallenge("2026-07-02")
  const validator = getDailyThemeValidator(challenge.themeId)
  const messages = getDailyThemeMessages(challenge.themeId)

  assert.equal(typeof validator, "function")
  assert.ok(messages.invalidEntityMessage.length > 0)
  assert.ok(messages.successMessage.length > 0)
})
