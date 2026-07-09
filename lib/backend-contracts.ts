import type { DailyThemeId } from "@/lib/daily"

export type PlayerId = string
export type SessionId = string
export type AttemptId = string
export type EventId = string

export type AcceptedGuess = {
  qid: string
  name: string
}

export type OpenGameState = {
  player: PlayerProfile
  score: number
  targetScore: number
  acceptedGuesses: AcceptedGuess[]
  completed: boolean
  updatedAt: string
}

export type DailyThemeSnapshot = {
  themeId: DailyThemeId
  title: string
  categoryLabel: string
  targetScore: number
}

export type PlayerProfile = {
  id: PlayerId
  handle: string | null
  isGuest: boolean
  recoveryConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type PlayerStats = {
  currentStreak: number
  maxStreak: number
  completedDays: number
  averageCompletionTimeMs: number | null
  averageGuessCount: number
  successRate: number
}

export type EmailAuthStatus = {
  email: string | null
  verified: boolean
}

export type DailyAttemptStatus = "in_progress" | "completed" | "abandoned" | "invalidated"

export type DailyAttempt = {
  id: AttemptId
  playerId: PlayerId
  sessionId: SessionId
  date: string
  theme: DailyThemeSnapshot
  status: DailyAttemptStatus
  score: number
  attempts: number
  guessesSubmitted: number
  startedAt: string
  completedAt: string | null
  bestTimeMs: number | null
  streakAtCompletion: number
  shareText: string
  createdAt: string
  updatedAt: string
}

export type DailyAnalyticsSnapshot = {
  date: string
  attempts: number
  guessesSubmitted: number
  shareClicks: number
  completed: boolean
  completionTimeMs: number | null
}

export type GuessEvent = {
  id: EventId
  attemptId: AttemptId
  playerId: PlayerId
  date: string
  query: string
  normalizedQuery: string
  qid: string | null
  resolvedName: string | null
  isAccepted: boolean
  rejectionReason:
    | "duplicate"
    | "not_found"
    | "rule_mismatch"
    | "network_error"
    | "empty_input"
    | null
  responseTimeMs: number | null
  createdAt: string
}

export type DailyLeaderboardEntry = {
  rank: number
  playerId: PlayerId
  handle: string
  date: string
  themeLabel: string
  score: number
  targetScore: number
  completionTimeMs: number | null
  streakAtCompletion: number
  completedAt: string | null
}

export type PlayerHistoryEntry = {
  attemptId: AttemptId
  date: string
  themeLabel: string
  score: number
  targetScore: number
  attempts: number
  completionTimeMs: number | null
  streakAtCompletion: number
  completed: boolean
}

export type OverviewAnalytics = {
  activePlayers7d: number
  activePlayers30d: number
  sessionsStarted7d: number
  sessionsCompleted7d: number
  averageGuessesPerAttempt: number
  shareRate: number
}

export type DailyChallengeState = {
  player: PlayerProfile
  stats: PlayerStats
  attempt: DailyAttempt
  acceptedGuesses: AcceptedGuess[]
  analytics: DailyAnalyticsSnapshot
  leaderboardPreview: DailyLeaderboardEntry[]
}

export type SessionBootstrapResponse = {
  player: PlayerProfile
  sessionId: SessionId
  stats: PlayerStats
}

export type LeaderboardSummaryResponse = {
  player: PlayerProfile
  stats: PlayerStats
  emailAuth: EmailAuthStatus
  today: {
    date: string
    entry: DailyLeaderboardEntry | null
  }
  fastest: DailyLeaderboardEntry[]
  streaks: DailyLeaderboardEntry[]
  history: PlayerHistoryEntry[]
  overview: OverviewAnalytics
}

export type IdentityStatusResponse = {
  player: PlayerProfile
  stats: PlayerStats
  emailAuth: EmailAuthStatus
}

export type ClaimIdentityRequest = {
  handle: string
}

export type ClaimIdentityResponse = {
  player: PlayerProfile
  recoveryCode: string
  recoveryCodeIssuedAt: string
}

export type RecoverSessionRequest = {
  handle: string
  recoveryCode: string
}

export type RecoverSessionResponse = {
  player: PlayerProfile
  sessionId: SessionId
  stats: PlayerStats
}

export type RequestMagicLinkRequest = {
  email: string
}

export type RequestMagicLinkResponse = {
  ok: true
  mode: "link" | "login"
  email: string
  expiresAt: string
  previewUrl: string | null
}

export type VerifyMagicLinkResponse = {
  player: PlayerProfile
  sessionId: SessionId
  stats: PlayerStats
  mode: "link" | "login"
}

export type SubmitGuessRequest = {
  date: string
  name: string
  clientAttemptId?: AttemptId
}

export type SubmitGuessResponse = {
  accepted: boolean
  message: string
  state: DailyChallengeState
  guess: GuessEvent | null
}

export type SubmitOpenGuessRequest = {
  name: string
}

export type SubmitOpenGuessResponse = {
  accepted: boolean
  message: string
  state: OpenGameState
}

export type CompleteAttemptRequest = {
  date: string
  clientAttemptId?: AttemptId
}

export type CompleteAttemptResponse = {
  attempt: DailyAttempt
  stats: PlayerStats
  leaderboardPreview: DailyLeaderboardEntry[]
}

export type TrackShareRequest = {
  date: string
  attemptId: AttemptId
  destination: "copy" | "twitter" | "reddit" | "discord" | "system_share"
}

export type TrackShareResponse = {
  ok: true
  shareClicks: number
}
