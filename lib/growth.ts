export type GuessItem = {
  qid: string
  name: string
}

export type DailyAnalyticsRecord = {
  date: string
  attempts: number
  guessesSubmitted: number
  shareClicks: number
  completed: boolean
  completionTimeMs: number | null
}

export type DailyRecord = {
  date: string
  score: number
  targetScore: number | null
  themeLabel: string
  guessedQIDs: string[]
  guessedNames: GuessItem[]
  attempts: number
  startedAt: number | null
  completedAt: number | null
  bestTimeMs: number | null
  completed: boolean
  shareText: string
  lastPlayedAt: number | null
  streakAtCompletion: number
  dailyDataset: string[]
}

export type GrowthStorage = {
  playedDatesHistory: string[]
  dailyRecords: Record<string, DailyRecord>
  currentStreak: number
  lastPlayedDate: string | null
  lastCompletedDate: string | null
  maxStreak: number
  analytics: {
    daily: Record<string, DailyAnalyticsRecord>
    totalShareClicks: number
  }
}

export type LeaderboardEntry = {
  label: string
  date: string
  score: number
  targetScore: number | null
  themeLabel: string
  attempts: number
  durationMs: number | null
  streak: number
  completed: boolean
}

export type AnalyticsApiPayload = {
  date: string
  completed: boolean
  attempts: number
  guessesSubmitted: number
  completionTimeMs: number | null
  shareClicks: number
}

export const GROWTH_STORAGE_KEY = "name100-growth-state"

function getPreviousDateString(date: string) {
  const current = new Date(`${date}T00:00:00Z`)
  current.setUTCDate(current.getUTCDate() - 1)
  return current.toISOString().slice(0, 10)
}

export function createEmptyDailyRecord(date: string): DailyRecord {
  return {
    date,
    score: 0,
    targetScore: null,
    themeLabel: "",
    guessedQIDs: [],
    guessedNames: [],
    attempts: 0,
    startedAt: null,
    completedAt: null,
    bestTimeMs: null,
    completed: false,
    shareText: "",
    lastPlayedAt: null,
    streakAtCompletion: 0,
    dailyDataset: [],
  }
}

export function createEmptyGrowthStorage(): GrowthStorage {
  return {
    playedDatesHistory: [],
    dailyRecords: {},
    currentStreak: 0,
    lastPlayedDate: null,
    lastCompletedDate: null,
    maxStreak: 0,
    analytics: {
      daily: {},
      totalShareClicks: 0,
    },
  }
}

export function getOrCreateDailyRecord(storage: GrowthStorage, date: string) {
  return storage.dailyRecords[date] ?? createEmptyDailyRecord(date)
}

export function withPlayedDate(history: string[], date: string) {
  return history.includes(date) ? history : [date, ...history]
}

export function getCompletedRecords(storage: GrowthStorage) {
  return Object.values(storage.dailyRecords).filter((record) => record.completed)
}

export function getOrCreateAnalyticsRecord(storage: GrowthStorage, date: string): DailyAnalyticsRecord {
  return (
    storage.analytics.daily[date] ?? {
      date,
      attempts: 0,
      guessesSubmitted: 0,
      shareClicks: 0,
      completed: false,
      completionTimeMs: null,
    }
  )
}

export function getAverageCompletionTime(storage: GrowthStorage) {
  const records = getCompletedRecords(storage).filter(
    (record) => typeof record.bestTimeMs === "number"
  )

  if (records.length === 0) {
    return null
  }

  const total = records.reduce((sum, record) => sum + (record.bestTimeMs ?? 0), 0)

  return Math.round(total / records.length)
}

export function getSuccessRate(storage: GrowthStorage) {
  if (storage.playedDatesHistory.length === 0) {
    return 0
  }

  const completedDates = new Set(getCompletedRecords(storage).map((record) => record.date))

  return Math.round((completedDates.size / storage.playedDatesHistory.length) * 100)
}

export function calculateNextStreak(
  currentStreak: number,
  lastCompletedDate: string | null,
  nextCompletedDate: string
) {
  if (!lastCompletedDate) {
    return 1
  }

  if (lastCompletedDate === nextCompletedDate) {
    return currentStreak || 1
  }

  return getPreviousDateString(nextCompletedDate) === lastCompletedDate
    ? currentStreak + 1
    : 1
}

export function recordDailyCompletion(
  storage: GrowthStorage,
  date: string,
  completionTimeMs: number
) {
  const nextStreak = calculateNextStreak(
    storage.currentStreak,
    storage.lastCompletedDate,
    date
  )
  const analyticsRecord = getOrCreateAnalyticsRecord(storage, date)

  return {
    ...storage,
    currentStreak: nextStreak,
    lastPlayedDate: date,
    lastCompletedDate: date,
    maxStreak: Math.max(storage.maxStreak, nextStreak),
    analytics: {
      ...storage.analytics,
      daily: {
        ...storage.analytics.daily,
        [date]: {
          ...analyticsRecord,
          completed: true,
          completionTimeMs,
        },
      },
    },
  }
}

export function incrementShareClicks(storage: GrowthStorage, date: string) {
  const analyticsRecord = getOrCreateAnalyticsRecord(storage, date)

  return {
    ...storage,
    lastPlayedDate: storage.lastPlayedDate ?? date,
    analytics: {
      ...storage.analytics,
      totalShareClicks: storage.analytics.totalShareClicks + 1,
      daily: {
        ...storage.analytics.daily,
        [date]: {
          ...analyticsRecord,
          shareClicks: analyticsRecord.shareClicks + 1,
        },
      },
    },
  }
}

export function upsertAnalyticsAttempt(
  storage: GrowthStorage,
  date: string,
  {
    attempts,
    guessesSubmitted,
  }: {
    attempts: number
    guessesSubmitted: number
  }
) {
  const analyticsRecord = getOrCreateAnalyticsRecord(storage, date)

  return {
    ...storage,
    lastPlayedDate: date,
    analytics: {
      ...storage.analytics,
      daily: {
        ...storage.analytics.daily,
        [date]: {
          ...analyticsRecord,
          attempts,
          guessesSubmitted,
        },
      },
    },
  }
}

export function getAverageGuessCount(storage: GrowthStorage) {
  const entries = Object.values(storage.analytics.daily)

  if (entries.length === 0) {
    return 0
  }

  return Math.round(
    entries.reduce((sum, record) => sum + record.guessesSubmitted, 0) / entries.length
  )
}

export function getDailyCompletionRate(storage: GrowthStorage) {
  const entries = Object.values(storage.analytics.daily)

  if (entries.length === 0) {
    return 0
  }

  const completed = entries.filter((entry) => entry.completed).length

  return Math.round((completed / entries.length) * 100)
}

export function toAnalyticsPayload(storage: GrowthStorage, date: string): AnalyticsApiPayload {
  const analyticsRecord = getOrCreateAnalyticsRecord(storage, date)

  return {
    date,
    completed: analyticsRecord.completed,
    attempts: analyticsRecord.attempts,
    guessesSubmitted: analyticsRecord.guessesSubmitted,
    completionTimeMs: analyticsRecord.completionTimeMs,
    shareClicks: analyticsRecord.shareClicks,
  }
}

export function getFastestLeaderboard(storage: GrowthStorage) {
  return getCompletedRecords(storage)
    .filter((record) => typeof record.bestTimeMs === "number")
    .sort((left, right) => (left.bestTimeMs ?? Number.MAX_SAFE_INTEGER) - (right.bestTimeMs ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 10)
    .map<LeaderboardEntry>((record) => ({
      label: `You - ${record.date}`,
      date: record.date,
      score: record.score,
      targetScore: record.targetScore,
      themeLabel: record.themeLabel,
      attempts: record.attempts,
      durationMs: record.bestTimeMs,
      streak: record.streakAtCompletion,
      completed: record.completed,
    }))
}

export function getStreakLeaderboard(storage: GrowthStorage) {
  return getCompletedRecords(storage)
    .sort((left, right) => right.streakAtCompletion - left.streakAtCompletion)
    .slice(0, 10)
    .map<LeaderboardEntry>((record) => ({
      label: `You - ${record.date}`,
      date: record.date,
      score: record.score,
      targetScore: record.targetScore,
      themeLabel: record.themeLabel,
      attempts: record.attempts,
      durationMs: record.bestTimeMs,
      streak: record.streakAtCompletion,
      completed: record.completed,
    }))
}

export function getTodayRanking(storage: GrowthStorage, date: string) {
  const record = getOrCreateDailyRecord(storage, date)

  return [
    {
      label: "You",
      date,
      score: record.score,
      targetScore: record.targetScore,
      themeLabel: record.themeLabel,
      attempts: record.attempts,
      durationMs: record.bestTimeMs,
      streak: storage.currentStreak,
      completed: record.completed,
    },
  ]
}

export function sanitizeGrowthStorage(value: unknown): GrowthStorage {
  const empty = createEmptyGrowthStorage()

  if (!value || typeof value !== "object") {
    return empty
  }

  const candidate = value as Partial<GrowthStorage>

  return {
    playedDatesHistory: Array.isArray(candidate.playedDatesHistory)
      ? candidate.playedDatesHistory.filter((item): item is string => typeof item === "string")
      : [],
    dailyRecords:
      candidate.dailyRecords && typeof candidate.dailyRecords === "object"
        ? (candidate.dailyRecords as Record<string, DailyRecord>)
        : {},
    currentStreak:
      typeof candidate.currentStreak === "number" ? candidate.currentStreak : 0,
    lastPlayedDate:
      typeof candidate.lastPlayedDate === "string" ? candidate.lastPlayedDate : null,
    lastCompletedDate:
      typeof candidate.lastCompletedDate === "string" ? candidate.lastCompletedDate : null,
    maxStreak: typeof candidate.maxStreak === "number" ? candidate.maxStreak : 0,
    analytics:
      candidate.analytics && typeof candidate.analytics === "object"
        ? {
            daily:
              candidate.analytics.daily && typeof candidate.analytics.daily === "object"
                ? candidate.analytics.daily
                : {},
            totalShareClicks:
              typeof candidate.analytics.totalShareClicks === "number"
                ? candidate.analytics.totalShareClicks
                : 0,
          }
        : empty.analytics,
  }
}
