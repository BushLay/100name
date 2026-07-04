import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateNextStreak,
  createEmptyGrowthStorage,
  getAverageGuessCount,
  getDailyCompletionRate,
  incrementShareClicks,
  recordDailyCompletion,
  sanitizeGrowthStorage,
  toAnalyticsPayload,
  upsertAnalyticsAttempt,
} from "./growth.ts"

test("calculateNextStreak increments only on consecutive completion dates", () => {
  assert.equal(calculateNextStreak(0, null, "2026-07-01"), 1)
  assert.equal(calculateNextStreak(3, "2026-07-01", "2026-07-02"), 4)
  assert.equal(calculateNextStreak(3, "2026-07-01", "2026-07-04"), 1)
})

test("growth analytics track attempts, shares, and completion", () => {
  let storage = createEmptyGrowthStorage()
  storage = upsertAnalyticsAttempt(storage, "2026-07-01", {
    attempts: 5,
    guessesSubmitted: 4,
  })
  storage = incrementShareClicks(storage, "2026-07-01")
  storage = recordDailyCompletion(storage, "2026-07-01", 120000)

  assert.equal(storage.currentStreak, 1)
  assert.equal(storage.lastPlayedDate, "2026-07-01")
  assert.equal(storage.maxStreak, 1)
  assert.equal(storage.analytics.totalShareClicks, 1)
  assert.equal(getAverageGuessCount(storage), 4)
  assert.equal(getDailyCompletionRate(storage), 100)

  assert.deepEqual(toAnalyticsPayload(storage, "2026-07-01"), {
    date: "2026-07-01",
    completed: true,
    attempts: 5,
    guessesSubmitted: 4,
    completionTimeMs: 120000,
    shareClicks: 1,
  })
})

test("sanitizeGrowthStorage migrates missing optional fields from older localStorage", () => {
  const storage = sanitizeGrowthStorage({
    playedDatesHistory: ["2026-07-01"],
    currentStreak: 2,
    maxStreak: 5,
    dailyRecords: {},
    analytics: {
      daily: {},
      totalShareClicks: 3,
    },
  })

  assert.equal(storage.lastPlayedDate, null)
  assert.equal(storage.lastCompletedDate, null)
  assert.equal(storage.analytics.totalShareClicks, 3)
  assert.deepEqual(storage.playedDatesHistory, ["2026-07-01"])
})
