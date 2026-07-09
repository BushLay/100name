import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  AcceptedGuess,
  AttemptId,
  ClaimIdentityResponse,
  DailyAnalyticsSnapshot,
  DailyAttempt,
  DailyChallengeState,
  DailyLeaderboardEntry,
  GuessEvent,
  LeaderboardSummaryResponse,
  OpenGameState,
  OverviewAnalytics,
  PlayerHistoryEntry,
  PlayerProfile,
  PlayerStats,
  RequestMagicLinkResponse,
  RecoverSessionResponse,
  SessionBootstrapResponse,
  SessionId,
  SubmitOpenGuessRequest,
  SubmitOpenGuessResponse,
  SubmitGuessRequest,
  SubmitGuessResponse,
  TrackShareRequest,
  TrackShareResponse,
  VerifyMagicLinkResponse,
} from "@/lib/backend-contracts"
import {
  buildDailyShareText,
  getDailyChallenge,
  getDailyThemeMessages,
  getDailyThemeValidator,
  isValidChallengeDate,
} from "@/lib/daily"
import { createMagicLinkToken, hashMagicLinkToken, validateEmailAddress } from "@/lib/email-auth"
import { WINNING_SCORE, validateGuess, validateGuessWithRules } from "@/lib/game"
import { createRecoveryCode, normalizeRecoveryCode, validatePlayerHandle } from "@/lib/identity"
import { summarizeOperationalAlertRuns } from "@/lib/operational-alerts"
import type {
  AdminCleanupRun,
  AdminIncidentHistoryItem,
  AdminLeaderboardRecomputeRun,
  AdminOperationalAlertRun,
  AdminOperationalReportRun,
  AdminReadinessProbeRun,
  AdminAbuseRestriction,
  AdminAuditIdentityEvent,
  AdminAuditMagicLink,
  AdminSuspiciousActivityFlag,
  EmailDeliveryStatus,
  GetAdminAuditInput,
  RecomputeLeaderboardSnapshotsInput,
  RecomputeLeaderboardSnapshotsResult,
  RecordEmailDeliveryEventInput,
  RecordEmailDeliveryEventResult,
  RecordOperationalAlertInput,
  RecordOperationalAlertResult,
  RecordOperationalReportInput,
  RecordOperationalReportResult,
  RecordReadinessProbeResult,
  SetAbuseRestrictionInput,
  SetAbuseRestrictionResult,
  ReadinessProbeInput,
  RunRetentionCleanupInput,
  RunRetentionCleanupResult,
} from "@/lib/server/store-types"
import { isDuplicateEmailDeliveryEventCandidate } from "@/lib/server/email-delivery-events"
import { getSiteUrl } from "@/lib/site"
import { deliverMagicLink } from "@/lib/server/email-delivery"
import {
  getEmailDeliveryEventRetentionDays,
  getMagicLinkRetentionDays,
  getOperationalReportRetentionDays,
  getMagicLinkTtlMinutes,
} from "@/lib/server/env"
import { summarizeReadinessProbeRuns } from "@/lib/server/readiness"
import { buildRecurringJobFreshnessSummary } from "@/lib/server/recurring-job-freshness"
import {
  getAdminSecret,
  getRateLimitDriver,
  getStoreDriver,
  isProductionEnvironment,
} from "@/lib/server/env"

type PersistedSession = {
  id: SessionId
  playerId: string
  token: string
  anonymousTokenHash: string
  userAgent: string | null
  ipHash: string | null
  createdAt: string
  lastSeenAt: string
}

type PersistedPlayer = PlayerProfile & {
  recoveryCodeHash: string | null
  recoveryCodeGeneratedAt: string | null
  email: string | null
  emailVerifiedAt: string | null
}

type PersistedMagicLinkToken = {
  id: string
  playerId: string
  email: string
  tokenHash: string
  mode: "link" | "login"
  expiresAt: string
  consumedAt: string | null
  createdAt: string
}

type PersistedMagicLinkDeliveryEvent = {
  id: string
  tokenId: string
  playerId: string
  email: string
  mode: "link" | "login"
  driver: "log" | "webhook"
  status: EmailDeliveryStatus
  providerMessageId: string | null
  providerEventId: string | null
  failureReason: string | null
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type PersistedAttempt = DailyAttempt & {
  shareClicks: number
  acceptedGuesses: AcceptedGuess[]
}

type PersistedShareEvent = {
  id: string
  attemptId: AttemptId
  playerId: string
  destination: TrackShareRequest["destination"]
  createdAt: string
}

type PersistedIdentityEvent = {
  id: string
  playerId: string | null
  eventType: "claim_identity" | "recover_session" | "failed_recovery"
  handle: string | null
  ipHash: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

type PersistedOpenGame = {
  playerId: string
  score: number
  acceptedGuesses: AcceptedGuess[]
  updatedAt: string
}

type PersistedCleanupRun = AdminCleanupRun
type PersistedReadinessProbeRun = AdminReadinessProbeRun

type PersistedLeaderboardSnapshot = {
  date: string
  entries: DailyLeaderboardEntry[]
  computedAt: string
}

type PersistedLeaderboardRecomputeRun = AdminLeaderboardRecomputeRun
type PersistedOperationalAlertRun = AdminOperationalAlertRun
type PersistedOperationalReportRun = AdminOperationalReportRun
type PersistedAbuseRestriction = AdminAbuseRestriction

type BackendState = {
  players: PersistedPlayer[]
  sessions: PersistedSession[]
  attempts: PersistedAttempt[]
  openGames: PersistedOpenGame[]
  guessEvents: GuessEvent[]
  shareEvents: PersistedShareEvent[]
  identityEvents: PersistedIdentityEvent[]
  magicLinkTokens: PersistedMagicLinkToken[]
  magicLinkDeliveryEvents: PersistedMagicLinkDeliveryEvent[]
  operationalAlerts: PersistedOperationalAlertRun[]
  operationalReports: PersistedOperationalReportRun[]
  readinessProbeRuns: PersistedReadinessProbeRun[]
  cleanupRuns: PersistedCleanupRun[]
  leaderboardSnapshots: PersistedLeaderboardSnapshot[]
  leaderboardRecomputeRuns: PersistedLeaderboardRecomputeRun[]
  abuseRestrictions: PersistedAbuseRestriction[]
}

type SessionContext = {
  player: PersistedPlayer
  session: PersistedSession
  created: boolean
}

const SESSION_COOKIE_NAME = "name100_session"
const storagePath =
  process.env.NAME100_STORAGE_FILE?.trim() ||
  path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "backend.json")

let writeQueue = Promise.resolve()

function nowIso() {
  return new Date().toISOString()
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function createEmptyState(): BackendState {
  return {
    players: [],
    sessions: [],
    attempts: [],
    openGames: [],
    guessEvents: [],
    shareEvents: [],
    identityEvents: [],
    magicLinkTokens: [],
    magicLinkDeliveryEvents: [],
    operationalAlerts: [],
    operationalReports: [],
    readinessProbeRuns: [],
    cleanupRuns: [],
    leaderboardSnapshots: [],
    leaderboardRecomputeRuns: [],
    abuseRestrictions: [],
  }
}

async function readState() {
  try {
    const raw = await readFile(storagePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<BackendState>

    return {
      ...createEmptyState(),
      ...parsed,
      magicLinkDeliveryEvents: parsed.magicLinkDeliveryEvents ?? [],
      operationalAlerts: parsed.operationalAlerts ?? [],
      operationalReports: parsed.operationalReports ?? [],
      readinessProbeRuns: parsed.readinessProbeRuns ?? [],
      cleanupRuns: parsed.cleanupRuns ?? [],
      leaderboardSnapshots: parsed.leaderboardSnapshots ?? [],
      leaderboardRecomputeRuns: parsed.leaderboardRecomputeRuns ?? [],
      abuseRestrictions: parsed.abuseRestrictions ?? [],
    }
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException

    if (candidate.code === "ENOENT") {
      return createEmptyState()
    }

    throw error
  }
}

async function saveState(state: BackendState) {
  await mkdir(path.dirname(storagePath), { recursive: true })
  await writeFile(storagePath, JSON.stringify(state, null, 2))
}

async function withState<T>(callback: (state: BackendState) => Promise<T> | T) {
  const run = writeQueue.then(async () => {
    const state = await readState()
    const result = await callback(state)
    await saveState(state)
    return result
  })

  writeQueue = run.then(
    () => undefined,
    () => undefined
  )

  return run
}

function getPlayerAttempts(state: BackendState, playerId: string) {
  return state.attempts.filter((attempt) => attempt.playerId === playerId)
}

function getOrCreateOpenGame(state: BackendState, playerId: string) {
  const existingGame = state.openGames.find((game) => game.playerId === playerId)

  if (existingGame) {
    return existingGame
  }

  const nextGame: PersistedOpenGame = {
    playerId,
    score: 0,
    acceptedGuesses: [],
    updatedAt: nowIso(),
  }
  state.openGames.push(nextGame)
  return nextGame
}

function buildOpenGameState(player: PlayerProfile, game: PersistedOpenGame): OpenGameState {
  return {
    player,
    score: game.score,
    targetScore: WINNING_SCORE,
    acceptedGuesses: game.acceptedGuesses,
    completed: game.score >= WINNING_SCORE,
    updatedAt: game.updatedAt,
  }
}

function computePlayerStats(state: BackendState, playerId: string): PlayerStats {
  const attempts = getPlayerAttempts(state, playerId)
  const completedAttempts = attempts.filter((attempt) => attempt.status === "completed")
  const averageCompletionTimeMs =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((sum, attempt) => sum + (attempt.bestTimeMs ?? 0), 0) /
            completedAttempts.length
        )
      : null
  const averageGuessCount =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((sum, attempt) => sum + attempt.guessesSubmitted, 0) / attempts.length
        )
      : 0
  const successRate =
    attempts.length > 0 ? Math.round((completedAttempts.length / attempts.length) * 100) : 0
  const currentStreak =
    completedAttempts.sort((left, right) => right.date.localeCompare(left.date))[0]
      ?.streakAtCompletion ?? 0
  const maxStreak = completedAttempts.reduce(
    (best, attempt) => Math.max(best, attempt.streakAtCompletion),
    0
  )

  return {
    currentStreak,
    maxStreak,
    completedDays: completedAttempts.length,
    averageCompletionTimeMs,
    averageGuessCount,
    successRate,
  }
}

function computeOverviewAnalytics(state: BackendState): OverviewAnalytics {
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const recentAttempts = state.attempts.filter(
    (attempt) => new Date(attempt.updatedAt).getTime() >= sevenDaysAgo
  )
  const recentPlayers7d = new Set(
    state.attempts
      .filter((attempt) => new Date(attempt.updatedAt).getTime() >= sevenDaysAgo)
      .map((attempt) => attempt.playerId)
  )
  const recentPlayers30d = new Set(
    state.attempts
      .filter((attempt) => new Date(attempt.updatedAt).getTime() >= thirtyDaysAgo)
      .map((attempt) => attempt.playerId)
  )
  const completed7d = recentAttempts.filter((attempt) => attempt.status === "completed")
  const totalShares7d = state.shareEvents.filter(
    (event) => new Date(event.createdAt).getTime() >= sevenDaysAgo
  ).length

  return {
    activePlayers7d: recentPlayers7d.size,
    activePlayers30d: recentPlayers30d.size,
    sessionsStarted7d: recentAttempts.length,
    sessionsCompleted7d: completed7d.length,
    averageGuessesPerAttempt:
      recentAttempts.length > 0
        ? Math.round(
            recentAttempts.reduce((sum, attempt) => sum + attempt.guessesSubmitted, 0) /
              recentAttempts.length
          )
        : 0,
    shareRate:
      recentAttempts.length > 0 ? Math.round((totalShares7d / recentAttempts.length) * 100) : 0,
  }
}

function mapAttemptToLeaderboardEntry(
  state: BackendState,
  attempt: PersistedAttempt,
  rank: number
): DailyLeaderboardEntry {
  const player = state.players.find((candidate) => candidate.id === attempt.playerId)

  return {
    rank,
    playerId: attempt.playerId,
    handle: player?.handle ?? `Guest ${attempt.playerId.slice(0, 8)}`,
    date: attempt.date,
    themeLabel: attempt.theme.categoryLabel,
    score: attempt.score,
    targetScore: attempt.theme.targetScore,
    completionTimeMs: attempt.bestTimeMs,
    streakAtCompletion: attempt.streakAtCompletion,
    completedAt: attempt.completedAt,
  }
}

function buildLeaderboardPreview(state: BackendState, date: string): DailyLeaderboardEntry[] {
  return state.attempts
    .filter((attempt) => attempt.date === date && attempt.status === "completed")
    .sort((left, right) => {
      const leftTime = left.bestTimeMs ?? Number.MAX_SAFE_INTEGER
      const rightTime = right.bestTimeMs ?? Number.MAX_SAFE_INTEGER

      if (leftTime !== rightTime) {
        return leftTime - rightTime
      }

      return left.completedAt?.localeCompare(right.completedAt ?? "") ?? 0
    })
    .slice(0, 10)
    .map((attempt, index) => mapAttemptToLeaderboardEntry(state, attempt, index + 1))
}

function buildFastestLeaderboard(state: BackendState): DailyLeaderboardEntry[] {
  return state.attempts
    .filter((attempt) => attempt.status === "completed" && typeof attempt.bestTimeMs === "number")
    .sort((left, right) => {
      const leftTime = left.bestTimeMs ?? Number.MAX_SAFE_INTEGER
      const rightTime = right.bestTimeMs ?? Number.MAX_SAFE_INTEGER

      if (leftTime !== rightTime) {
        return leftTime - rightTime
      }

      return left.date.localeCompare(right.date)
    })
    .slice(0, 10)
    .map((attempt, index) => mapAttemptToLeaderboardEntry(state, attempt, index + 1))
}

function buildStreakLeaderboard(state: BackendState): DailyLeaderboardEntry[] {
  return state.attempts
    .filter((attempt) => attempt.status === "completed")
    .sort((left, right) => {
      if (left.streakAtCompletion !== right.streakAtCompletion) {
        return right.streakAtCompletion - left.streakAtCompletion
      }

      return left.date.localeCompare(right.date)
    })
    .slice(0, 10)
    .map((attempt, index) => mapAttemptToLeaderboardEntry(state, attempt, index + 1))
}

function buildPlayerHistory(state: BackendState, playerId: string): PlayerHistoryEntry[] {
  return getPlayerAttempts(state, playerId)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 10)
    .map((attempt) => ({
      attemptId: attempt.id,
      date: attempt.date,
      themeLabel: attempt.theme.categoryLabel,
      score: attempt.score,
      targetScore: attempt.theme.targetScore,
      attempts: attempt.attempts,
      completionTimeMs: attempt.bestTimeMs,
      streakAtCompletion: attempt.streakAtCompletion,
      completed: attempt.status === "completed",
    }))
}

function getAttemptAnalytics(attempt: PersistedAttempt): DailyAnalyticsSnapshot {
  return {
    date: attempt.date,
    attempts: attempt.attempts,
    guessesSubmitted: attempt.guessesSubmitted,
    shareClicks: attempt.shareClicks,
    completed: attempt.status === "completed",
    completionTimeMs: attempt.bestTimeMs,
  }
}

function buildDailyState(state: BackendState, player: PlayerProfile, attempt: PersistedAttempt): DailyChallengeState {
  return {
    player,
    stats: computePlayerStats(state, player.id),
    attempt,
    acceptedGuesses: attempt.acceptedGuesses,
    analytics: getAttemptAnalytics(attempt),
    leaderboardPreview: buildLeaderboardPreview(state, attempt.date),
  }
}

function getPreviousDateString(date: string) {
  const current = new Date(`${date}T00:00:00Z`)
  current.setUTCDate(current.getUTCDate() - 1)
  return current.toISOString().slice(0, 10)
}

function calculateNextStreak(state: BackendState, playerId: string, nextCompletedDate: string) {
  const completedAttempts = getPlayerAttempts(state, playerId)
    .filter((attempt) => attempt.status === "completed")
    .sort((left, right) => left.date.localeCompare(right.date))
  const lastCompletedAttempt = completedAttempts.at(-1)

  if (!lastCompletedAttempt) {
    return 1
  }

  if (lastCompletedAttempt.date === nextCompletedDate) {
    return lastCompletedAttempt.streakAtCompletion || 1
  }

  return getPreviousDateString(nextCompletedDate) === lastCompletedAttempt.date
    ? lastCompletedAttempt.streakAtCompletion + 1
    : 1
}

function createPlayer(createdAt: string): PersistedPlayer {
  return {
    id: randomUUID(),
    handle: null,
    isGuest: true,
    recoveryConfigured: false,
    recoveryCodeHash: null,
    recoveryCodeGeneratedAt: null,
    email: null,
    emailVerifiedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

function createSession(playerId: string, token: string, userAgent: string | null, ipHash: string | null, createdAt: string): PersistedSession {
  return {
    id: randomUUID(),
    playerId,
    token,
    anonymousTokenHash: sha256(token),
    userAgent,
    ipHash,
    createdAt,
    lastSeenAt: createdAt,
  }
}

function updatePersistedPlayerProfile(
  player: PersistedPlayer,
  input: {
    handle?: string | null
    isGuest?: boolean
    recoveryCodeHash?: string | null
    recoveryCodeGeneratedAt?: string | null
  }
) {
  if (typeof input.handle !== "undefined") {
    player.handle = input.handle
  }

  if (typeof input.isGuest !== "undefined") {
    player.isGuest = input.isGuest
  }

  if (typeof input.recoveryCodeHash !== "undefined") {
    player.recoveryCodeHash = input.recoveryCodeHash
  }

  if (typeof input.recoveryCodeGeneratedAt !== "undefined") {
    player.recoveryCodeGeneratedAt = input.recoveryCodeGeneratedAt
  }

  player.recoveryConfigured = Boolean(player.recoveryCodeHash)
  player.updatedAt = nowIso()
}

function getEmailAuthStatus(player: PersistedPlayer) {
  return {
    email: player.email,
    verified: Boolean(player.email && player.emailVerifiedAt),
  }
}

function consumeMagicLinkToken(state: BackendState, tokenHash: string) {
  const token = state.magicLinkTokens.find((candidate) => candidate.tokenHash === tokenHash)

  if (!token || token.consumedAt || new Date(token.expiresAt).getTime() < Date.now()) {
    return null
  }

  token.consumedAt = nowIso()
  return token
}

function createMagicLinkDeliveryEvent(
  state: BackendState,
  input: {
    tokenId: string
    playerId: string
    email: string
    mode: "link" | "login"
    driver: "log" | "webhook"
    status: EmailDeliveryStatus
    providerMessageId: string | null
    providerEventId?: string | null
    failureReason?: string | null
    payload?: Record<string, unknown>
    occurredAt?: string | null
  }
) {
  const timestamp = input.occurredAt ?? nowIso()
  const event: PersistedMagicLinkDeliveryEvent = {
    id: randomUUID(),
    tokenId: input.tokenId,
    playerId: input.playerId,
    email: input.email,
    mode: input.mode,
    driver: input.driver,
    status: input.status,
    providerMessageId: input.providerMessageId,
    providerEventId: input.providerEventId ?? null,
    failureReason: input.failureReason ?? null,
    payload: input.payload ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  state.magicLinkDeliveryEvents.push(event)
  return event
}

function getLatestMagicLinkDeliveryEvent(state: BackendState, tokenId: string) {
  return state.magicLinkDeliveryEvents
    .filter((event) => event.tokenId === tokenId)
    .sort((left, right) => {
      const updatedOrder = right.updatedAt.localeCompare(left.updatedAt)

      if (updatedOrder !== 0) {
        return updatedOrder
      }

      return right.createdAt.localeCompare(left.createdAt)
    })[0] ?? null
}

function buildDeliverySummary(state: BackendState) {
  const now = Date.now()
  const latestEvents = state.magicLinkTokens.map((token) => ({
    token,
    latestDeliveryEvent: getLatestMagicLinkDeliveryEvent(state, token.id),
  }))

  return {
    totalMagicLinks: state.magicLinkTokens.length,
    pendingMagicLinks: latestEvents.filter(
      ({ token, latestDeliveryEvent }) =>
        !token.consumedAt &&
        new Date(token.expiresAt).getTime() >= now &&
        (!latestDeliveryEvent ||
          latestDeliveryEvent.status === "generated" ||
          latestDeliveryEvent.status === "queued")
    ).length,
    deliveredMagicLinks: latestEvents.filter(
      ({ latestDeliveryEvent }) => latestDeliveryEvent?.status === "delivered"
    ).length,
    failedMagicLinks: latestEvents.filter(
      ({ latestDeliveryEvent }) => latestDeliveryEvent?.status === "failed"
    ).length,
    bouncedMagicLinks: latestEvents.filter(
      ({ latestDeliveryEvent }) => latestDeliveryEvent?.status === "bounced"
    ).length,
    complainedMagicLinks: latestEvents.filter(
      ({ latestDeliveryEvent }) => latestDeliveryEvent?.status === "complained"
    ).length,
    consumedMagicLinks: state.magicLinkTokens.filter((token) => Boolean(token.consumedAt)).length,
    expiredUnconsumedMagicLinks: state.magicLinkTokens.filter(
      (token) => !token.consumedAt && new Date(token.expiresAt).getTime() < now
    ).length,
  }
}

function getLeaderboardSnapshot(state: BackendState, date: string) {
  return state.leaderboardSnapshots.find((snapshot) => snapshot.date === date) ?? null
}

function findLargestEventWindow(
  timestamps: string[],
  windowMs: number
): {
  count: number
  firstEventAt: string | null
  lastEventAt: string | null
} {
  if (timestamps.length === 0) {
    return {
      count: 0,
      firstEventAt: null,
      lastEventAt: null,
    }
  }

  const values = timestamps
    .map((timestamp) => ({
      timestamp,
      time: new Date(timestamp).getTime(),
    }))
    .sort((left, right) => left.time - right.time)
  let best = {
    count: 0,
    firstEventAt: null as string | null,
    lastEventAt: null as string | null,
  }
  let startIndex = 0

  for (let endIndex = 0; endIndex < values.length; endIndex += 1) {
    while (values[endIndex].time - values[startIndex].time > windowMs) {
      startIndex += 1
    }

    const count = endIndex - startIndex + 1

    if (count >= best.count) {
      best = {
        count,
        firstEventAt: values[startIndex]?.timestamp ?? null,
        lastEventAt: values[endIndex]?.timestamp ?? null,
      }
    }
  }

  return best
}

function buildSuspiciousActivity(state: BackendState) {
  const now = Date.now()
  const flags: AdminSuspiciousActivityFlag[] = []

  for (const player of state.players) {
    const activeRestriction = Boolean(getActivePlayerRestriction(state, player.id))
    const acceptedGuessBurst = findLargestEventWindow(
      state.guessEvents
        .filter(
          (event) =>
            event.playerId === player.id &&
            event.isAccepted &&
            new Date(event.createdAt).getTime() >= now - 7 * 24 * 60 * 60 * 1000
        )
        .map((event) => event.createdAt),
      2_000
    )

    if (acceptedGuessBurst.count >= 6) {
      flags.push({
        id: `accepted_guess_burst:${player.id}`,
        signalType: "accepted_guess_burst",
        severity: acceptedGuessBurst.count >= 8 ? "high" : "medium",
        playerId: player.id,
        handle: player.handle,
        summary: `${acceptedGuessBurst.count} accepted guesses landed within 2 seconds.`,
        detectedAt: acceptedGuessBurst.lastEventAt ?? player.updatedAt,
        activeRestriction,
        evidence: {
          eventCount: acceptedGuessBurst.count,
          windowSeconds: 2,
          firstEventAt: acceptedGuessBurst.firstEventAt,
          lastEventAt: acceptedGuessBurst.lastEventAt,
        },
      })
    }

    const invalidGuessBurst = findLargestEventWindow(
      state.guessEvents
        .filter(
          (event) =>
            event.playerId === player.id &&
            !event.isAccepted &&
            new Date(event.createdAt).getTime() >= now - 24 * 60 * 60 * 1000
        )
        .map((event) => event.createdAt),
      10 * 60 * 1000
    )

    if (invalidGuessBurst.count >= 12) {
      flags.push({
        id: `invalid_guess_burst:${player.id}`,
        signalType: "invalid_guess_burst",
        severity: invalidGuessBurst.count >= 20 ? "high" : "medium",
        playerId: player.id,
        handle: player.handle,
        summary: `${invalidGuessBurst.count} rejected guesses were submitted within 10 minutes.`,
        detectedAt: invalidGuessBurst.lastEventAt ?? player.updatedAt,
        activeRestriction,
        evidence: {
          eventCount: invalidGuessBurst.count,
          windowSeconds: 600,
          firstEventAt: invalidGuessBurst.firstEventAt,
          lastEventAt: invalidGuessBurst.lastEventAt,
        },
      })
    }
  }

  const failedRecoveryByHandle = new Map<string, PersistedIdentityEvent[]>()

  for (const event of state.identityEvents) {
    if (
      event.eventType === "failed_recovery" &&
      event.handle &&
      new Date(event.createdAt).getTime() >= now - 24 * 60 * 60 * 1000
    ) {
      const normalizedHandle = event.handle.toLowerCase()
      const events = failedRecoveryByHandle.get(normalizedHandle) ?? []
      events.push(event)
      failedRecoveryByHandle.set(normalizedHandle, events)
    }
  }

  for (const [normalizedHandle, events] of failedRecoveryByHandle.entries()) {
    if (events.length < 3) {
      continue
    }

    const matchingPlayer =
      state.players.find((player) => player.handle?.toLowerCase() === normalizedHandle) ?? null
    const failedRecoveryBurst = findLargestEventWindow(
      events.map((event) => event.createdAt),
      24 * 60 * 60 * 1000
    )

    flags.push({
      id: `failed_recovery_burst:${matchingPlayer?.id ?? normalizedHandle}`,
      signalType: "failed_recovery_burst",
      severity: failedRecoveryBurst.count >= 6 ? "high" : "medium",
      playerId: matchingPlayer?.id ?? null,
      handle: matchingPlayer?.handle ?? events[0]?.handle ?? null,
      summary: `${failedRecoveryBurst.count} failed recovery attempts targeted the same handle in 24 hours.`,
      detectedAt: failedRecoveryBurst.lastEventAt ?? events.at(-1)?.createdAt ?? nowIso(),
      activeRestriction: matchingPlayer ? Boolean(getActivePlayerRestriction(state, matchingPlayer.id)) : false,
      evidence: {
        eventCount: failedRecoveryBurst.count,
        windowSeconds: 86_400,
        firstEventAt: failedRecoveryBurst.firstEventAt,
        lastEventAt: failedRecoveryBurst.lastEventAt,
      },
    })
  }

  const sortedFlags = flags.sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "high" ? -1 : 1
    }

    return right.detectedAt.localeCompare(left.detectedAt)
  })

  return {
    totalFlags: sortedFlags.length,
    activeRestrictionsOnFlaggedPlayers: sortedFlags.filter((flag) => flag.activeRestriction).length,
    items: sortedFlags.slice(0, 12),
  }
}

function getActivePlayerRestriction(state: BackendState, playerId: string) {
  return (
    state.abuseRestrictions.find(
      (restriction) =>
        restriction.active &&
        restriction.targetType === "player" &&
        restriction.targetValue === playerId
    ) ?? null
  )
}

function assertPlayerNotRestricted(state: BackendState, playerId: string) {
  const restriction = getActivePlayerRestriction(state, playerId)

  if (restriction) {
    throw new Error("This player is currently restricted from write actions.")
  }
}

function recordLeaderboardRecomputeRun(
  state: BackendState,
  input: {
    recomputeInput: RecomputeLeaderboardSnapshotsInput
    result: RecomputeLeaderboardSnapshotsResult
  }
) {
  const entry: PersistedLeaderboardRecomputeRun = {
    id: randomUUID(),
    jobType: "leaderboard_recompute",
    source: input.recomputeInput.source ?? "unknown",
    reason: input.recomputeInput.reason ?? null,
    requestedBy: input.recomputeInput.requestedBy ?? null,
    requestId: input.recomputeInput.requestId ?? null,
    dryRun: input.result.dryRun,
    driver: input.result.driver,
    dates: input.result.dates,
    totalDates: input.result.totalDates,
    snapshots: input.result.snapshots,
    createdAt: input.result.generatedAt,
  }

  state.leaderboardRecomputeRuns = [entry, ...state.leaderboardRecomputeRuns].slice(0, 250)
}

function recordCleanupRun(
  state: BackendState,
  input: {
    cleanupInput: RunRetentionCleanupInput
    result: RunRetentionCleanupResult
  }
) {
  const entry: PersistedCleanupRun = {
    id: randomUUID(),
    jobType: "retention_cleanup",
    source: input.cleanupInput.source ?? "unknown",
    reason: input.cleanupInput.reason ?? null,
    requestedBy: input.cleanupInput.requestedBy ?? null,
    requestId: input.cleanupInput.requestId ?? null,
    dryRun: input.result.dryRun,
    driver: input.result.driver,
    deleted: input.result.deleted,
    remaining: input.result.remaining,
    retention: input.result.retention,
    createdAt: input.result.generatedAt,
  }

  state.cleanupRuns = [entry, ...state.cleanupRuns].slice(0, 250)
}

function recordReadinessProbeRun(
  state: BackendState,
  input: {
    readinessInput: ReadinessProbeInput & {
      readiness: {
        ok: boolean
        summary: {
          failedChecks: number
          warningChecks: number
        }
        checks: Array<{
          name: string
          ok: boolean
          severity: "info" | "warn" | "error"
          message: string
        }>
      }
    }
    generatedAt: string
    driver: string
  }
) {
  const entry: PersistedReadinessProbeRun = {
    id: randomUUID(),
    jobType: "readiness_probe",
    source: input.readinessInput.source ?? "unknown",
    reason: input.readinessInput.reason ?? null,
    requestedBy: input.readinessInput.requestedBy ?? null,
    requestId: input.readinessInput.requestId ?? null,
    driver: input.driver,
    ok: input.readinessInput.readiness.ok,
    failedChecks: input.readinessInput.readiness.summary.failedChecks,
    warningChecks: input.readinessInput.readiness.summary.warningChecks,
    checks: input.readinessInput.readiness.checks.map((check) => ({
      name: check.name,
      ok: check.ok,
      severity: check.severity,
      message: check.message,
    })),
    createdAt: input.generatedAt,
  }

  state.readinessProbeRuns = [entry, ...state.readinessProbeRuns].slice(0, 250)
  return entry
}

function recordOperationalAlertRun(
  state: BackendState,
  input: {
    alertInput: RecordOperationalAlertInput
    generatedAt: string
    driver: string
  }
) {
  const entry: PersistedOperationalAlertRun = {
    id: randomUUID(),
    jobType: "operational_alert",
    source: input.alertInput.source ?? "api",
    requestId: input.alertInput.requestId ?? null,
    route: input.alertInput.route ?? null,
    driver: input.driver,
    event: input.alertInput.event,
    severity: input.alertInput.severity,
    message: input.alertInput.message,
    metadata: input.alertInput.metadata ?? {},
    dedupKey: input.alertInput.dedupKey ?? null,
    dispatchStatus: input.alertInput.dispatchStatus,
    suppressionReason: input.alertInput.suppressionReason ?? null,
    errorMessage: input.alertInput.errorMessage ?? null,
    createdAt: input.generatedAt,
  }

  state.operationalAlerts = [entry, ...state.operationalAlerts].slice(0, 250)
  return entry
}

function recordOperationalReportRun(
  state: BackendState,
  input: {
    reportInput: RecordOperationalReportInput
    generatedAt: string
    driver: string
  }
) {
  const entry: PersistedOperationalReportRun = {
    id: randomUUID(),
    jobType: "operational_report",
    reportType: input.reportInput.reportType,
    source: input.reportInput.source ?? "api",
    reason: input.reportInput.reason ?? null,
    requestedBy: input.reportInput.requestedBy ?? null,
    requestId: input.reportInput.requestId ?? null,
    driver: input.driver,
    summary: input.reportInput.summary,
    actions: input.reportInput.actions,
    timeline: input.reportInput.timeline,
    createdAt: input.generatedAt,
  }

  state.operationalReports = [entry, ...state.operationalReports].slice(0, 250)
  return entry
}

function buildAbuseRestriction(
  input: Omit<AdminAbuseRestriction, "id" | "createdAt" | "active" | "liftedAt" | "liftedReason"> &
    Partial<Pick<AdminAbuseRestriction, "id" | "createdAt" | "active" | "liftedAt" | "liftedReason">>
): PersistedAbuseRestriction {
  return {
    id: input.id ?? randomUUID(),
    targetType: input.targetType,
    targetValue: input.targetValue,
    reason: input.reason ?? null,
    source: input.source,
    requestedBy: input.requestedBy ?? null,
    requestId: input.requestId ?? null,
    active: input.active ?? true,
    createdAt: input.createdAt ?? nowIso(),
    liftedAt: input.liftedAt ?? null,
    liftedReason: input.liftedReason ?? null,
  }
}

function findDuplicateMagicLinkDeliveryEvent(
  state: BackendState,
  input: {
    tokenId: string
    eventType: Exclude<EmailDeliveryStatus, "generated">
    providerMessageId: string | null
    providerEventId: string | null
    occurredAt: string | null
    failureReason: string | null
  }
) {
  return state.magicLinkDeliveryEvents.find((event) =>
    isDuplicateEmailDeliveryEventCandidate(
      {
        tokenId: event.tokenId,
        eventType: event.status as Exclude<EmailDeliveryStatus, "generated">,
        providerMessageId: event.providerMessageId,
        providerEventId: event.providerEventId,
        occurredAt: event.updatedAt,
        failureReason: event.failureReason,
      },
      input
    )
  ) ?? null
}

function recordIdentityEvent(
  state: BackendState,
  input: {
    playerId: string | null
    eventType: PersistedIdentityEvent["eventType"]
    handle: string | null
    ipHash: string | null
    userAgent: string | null
    metadata?: Record<string, unknown>
  }
) {
  state.identityEvents.push({
    id: randomUUID(),
    playerId: input.playerId,
    eventType: input.eventType,
    handle: input.handle,
    ipHash: input.ipHash,
    userAgent: input.userAgent,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  })
}

function getOrCreateSession(state: BackendState, sessionToken: string | null, userAgent: string | null, ipHash: string | null): SessionContext {
  const now = nowIso()
  const existingSession = sessionToken
    ? state.sessions.find((session) => session.token === sessionToken)
    : null

  if (existingSession) {
    existingSession.lastSeenAt = now
    const player = state.players.find((candidate) => candidate.id === existingSession.playerId)

    if (!player) {
      const nextPlayer = createPlayer(now)
      state.players.push(nextPlayer)
      existingSession.playerId = nextPlayer.id
      return {
        player: nextPlayer,
        session: existingSession,
        created: false,
      }
    }

    player.updatedAt = now
    return {
      player,
      session: existingSession,
      created: false,
    }
  }

  const player = createPlayer(now)
  const nextToken = randomUUID()
  const session = createSession(player.id, nextToken, userAgent, ipHash, now)
  state.players.push(player)
  state.sessions.push(session)

  return {
    player,
    session,
    created: true,
  }
}

function createAttempt(playerId: string, sessionId: string, date: string): PersistedAttempt {
  const challenge = getDailyChallenge(date)
  const timestamp = nowIso()

  return {
    id: randomUUID(),
    playerId,
    sessionId,
    date,
    theme: {
      themeId: challenge.themeId,
      title: challenge.title,
      categoryLabel: challenge.categoryLabel,
      targetScore: challenge.targetScore,
    },
    status: "in_progress",
    score: 0,
    attempts: 0,
    guessesSubmitted: 0,
    startedAt: timestamp,
    completedAt: null,
    bestTimeMs: null,
    streakAtCompletion: 0,
    shareText: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    shareClicks: 0,
    acceptedGuesses: [],
  }
}

function getOrCreateAttempt(state: BackendState, playerId: string, sessionId: string, date: string) {
  const existingAttempt = state.attempts.find(
    (attempt) => attempt.playerId === playerId && attempt.date === date
  )

  if (existingAttempt) {
    existingAttempt.sessionId = sessionId
    return existingAttempt
  }

  const attempt = createAttempt(playerId, sessionId, date)
  state.attempts.push(attempt)
  return attempt
}

function createGuessEvent(attempt: PersistedAttempt, playerId: string, payload: {
  query: string
  normalizedQuery: string
  qid: string | null
  resolvedName: string | null
  isAccepted: boolean
  rejectionReason: GuessEvent["rejectionReason"]
}): GuessEvent {
  return {
    id: randomUUID(),
    attemptId: attempt.id,
    playerId,
    date: attempt.date,
    query: payload.query,
    normalizedQuery: payload.normalizedQuery,
    qid: payload.qid,
    resolvedName: payload.resolvedName,
    isAccepted: payload.isAccepted,
    rejectionReason: payload.rejectionReason,
    responseTimeMs: null,
    createdAt: nowIso(),
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
}

export async function getHealthStatus() {
  const timestamp = nowIso()

  return {
    ok: true,
    driver: getStoreDriver(),
    mode: "development-file-store",
    environment: isProductionEnvironment() ? "production" : "development",
    timestamp,
    uptimeSeconds: Math.round(process.uptime()),
    adminSecretConfigured: Boolean(getAdminSecret()),
    rateLimitMode: getRateLimitDriver(),
    databaseUrlConfigured: false,
    checks: [
      {
        name: "file_store_ready",
        ok: true,
        message: "File-backed development store is available.",
      },
    ],
  }
}

export async function initializeDatabase() {
  return {
    ok: true,
    driver: getStoreDriver(),
    initialized: false,
    message: "File-backed development store does not require database initialization.",
  }
}

export async function getOpenGameState(input: {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    assertPlayerNotRestricted(state, context.player.id)
    const game = getOrCreateOpenGame(state, context.player.id)

    return {
      state: buildOpenGameState(context.player, game),
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function submitOpenGuess(input: {
  request: SubmitOpenGuessRequest
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    const game = getOrCreateOpenGame(state, context.player.id)
    const result = await validateGuess(
      input.request.name,
      game.acceptedGuesses.map((guess) => guess.qid),
      game.score
    )

    if (result.valid) {
      game.score = result.score
      game.acceptedGuesses.push({ qid: result.qid, name: result.name })
      game.updatedAt = nowIso()
    }

    const response: SubmitOpenGuessResponse = {
      accepted: result.valid,
      message: result.message,
      state: buildOpenGameState(context.player, game),
    }

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function bootstrapSession(input: {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )

    const response: SessionBootstrapResponse = {
      player: context.player,
      sessionId: context.session.id,
      stats: computePlayerStats(state, context.player.id),
    }

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function getDailyState(input: {
  date: string
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  if (!isValidChallengeDate(input.date)) {
    throw new Error("Invalid daily date.")
  }

  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    assertPlayerNotRestricted(state, context.player.id)
    const attempt = getOrCreateAttempt(state, context.player.id, context.session.id, input.date)

    return {
      state: buildDailyState(state, context.player, attempt),
      overview: computeOverviewAnalytics(state),
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function submitGuess(input: {
  date: string
  request: SubmitGuessRequest
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  if (!isValidChallengeDate(input.date)) {
    throw new Error("Invalid daily date.")
  }

  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    assertPlayerNotRestricted(state, context.player.id)
    const attempt = getOrCreateAttempt(state, context.player.id, context.session.id, input.date)
    const themeValidator = getDailyThemeValidator(attempt.theme.themeId)
    const themeMessages = getDailyThemeMessages(attempt.theme.themeId)
    const guessStartedAt = Date.now()

    attempt.attempts += 1
    attempt.guessesSubmitted += 1
    attempt.updatedAt = nowIso()

    const result = await validateGuessWithRules(
      input.request.name,
      attempt.acceptedGuesses.map((guess) => guess.qid),
      attempt.score,
      undefined,
      {
        targetScore: attempt.theme.targetScore,
        validateEntity: themeValidator,
        invalidEntityMessage: themeMessages.invalidEntityMessage,
        successMessage: themeMessages.successMessage,
      }
    )

    const guessEvent = createGuessEvent(attempt, context.player.id, {
      query: input.request.name,
      normalizedQuery: input.request.name.trim().toLowerCase(),
      qid: result.qid || null,
      resolvedName: result.name || null,
      isAccepted: result.valid,
      rejectionReason: result.valid
        ? null
        : result.message.match(/already been guessed/i)
          ? "duplicate"
          : result.message.match(/No matching person/i)
            ? "not_found"
            : result.message.match(/full name/i)
              ? "empty_input"
              : "rule_mismatch",
    })
    guessEvent.responseTimeMs = Date.now() - guessStartedAt
    state.guessEvents.push(guessEvent)

    if (result.valid) {
      attempt.score = result.score
      attempt.acceptedGuesses.push({ qid: result.qid, name: result.name })
    }

    if (result.valid && result.won && attempt.status !== "completed") {
      const completedAt = nowIso()
      const durationMs =
        new Date(completedAt).getTime() - new Date(attempt.startedAt).getTime()
      const streakAtCompletion = calculateNextStreak(state, context.player.id, attempt.date)

      attempt.status = "completed"
      attempt.completedAt = completedAt
      attempt.bestTimeMs = durationMs
      attempt.streakAtCompletion = streakAtCompletion
      attempt.shareText = buildDailyShareText({
        date: attempt.date,
        score: attempt.score,
        targetScore: attempt.theme.targetScore,
        durationMs,
        streak: streakAtCompletion,
        shareTitle: attempt.theme.title,
        shareLabel: attempt.theme.categoryLabel.toLowerCase(),
        url: `${getSiteUrl()}/daily/${attempt.date}`,
      })
    }

    attempt.updatedAt = nowIso()

    const response: SubmitGuessResponse = {
      accepted: result.valid,
      message: result.message,
      state: buildDailyState(state, context.player, attempt),
      guess: guessEvent,
    }

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function trackShare(input: {
  date: string
  request: TrackShareRequest
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  if (!isValidChallengeDate(input.date)) {
    throw new Error("Invalid daily date.")
  }

  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    const attempt = getOrCreateAttempt(state, context.player.id, context.session.id, input.date)

    attempt.shareClicks += 1
    attempt.updatedAt = nowIso()
    state.shareEvents.push({
      id: randomUUID(),
      attemptId: attempt.id,
      playerId: context.player.id,
      destination: input.request.destination,
      createdAt: nowIso(),
    })

    const response: TrackShareResponse = {
      ok: true,
      shareClicks: attempt.shareClicks,
    }

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function getLeaderboardSummary(input: {
  date: string
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    const todayEntries = buildLeaderboardPreview(state, input.date)
    const response: LeaderboardSummaryResponse = {
      player: context.player,
      stats: computePlayerStats(state, context.player.id),
      emailAuth: getEmailAuthStatus(context.player),
      today: {
        date: input.date,
        entry: todayEntries.find((entry) => entry.playerId === context.player.id) ?? null,
      },
      fastest: buildFastestLeaderboard(state),
      streaks: buildStreakLeaderboard(state),
      history: buildPlayerHistory(state, context.player.id),
      overview: computeOverviewAnalytics(state),
    }

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function getIdentityStatus(input: {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )

    return {
      player: context.player,
      stats: computePlayerStats(state, context.player.id),
      emailAuth: getEmailAuthStatus(context.player),
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function claimIdentity(input: {
  request: { handle: string }
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    assertPlayerNotRestricted(state, context.player.id)
    const normalizedHandle = validatePlayerHandle(input.request.handle)
    const conflictingPlayer = state.players.find(
      (player) => player.handle === normalizedHandle && player.id !== context.player.id
    )

    if (conflictingPlayer) {
      throw new Error("That handle is already in use.")
    }

    const recoveryCode = createRecoveryCode()
    const recoveryCodeIssuedAt = nowIso()
    updatePersistedPlayerProfile(context.player, {
      handle: normalizedHandle,
      isGuest: false,
      recoveryCodeHash: sha256(normalizeRecoveryCode(recoveryCode)),
      recoveryCodeGeneratedAt: recoveryCodeIssuedAt,
    })

    const response: ClaimIdentityResponse = {
      player: context.player,
      recoveryCode,
      recoveryCodeIssuedAt,
    }

    recordIdentityEvent(state, {
      playerId: context.player.id,
      eventType: "claim_identity",
      handle: normalizedHandle,
      ipHash: input.ipAddress ? sha256(input.ipAddress) : null,
      userAgent: input.userAgent,
      metadata: {
        recoveryCodeRotated: true,
      },
    })

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function recoverSession(input: {
  request: { handle: string; recoveryCode: string }
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const normalizedHandle = validatePlayerHandle(input.request.handle)
    const normalizedRecoveryCode = normalizeRecoveryCode(input.request.recoveryCode)
    const player = state.players.find(
      (candidate) =>
        candidate.handle === normalizedHandle &&
        candidate.recoveryCodeHash === sha256(normalizedRecoveryCode)
    )

    if (!player) {
      recordIdentityEvent(state, {
        playerId: null,
        eventType: "failed_recovery",
        handle: normalizedHandle,
        ipHash: input.ipAddress ? sha256(input.ipAddress) : null,
        userAgent: input.userAgent,
      })
      throw new Error("Invalid handle or recovery code.")
    }

    assertPlayerNotRestricted(state, player.id)

    const timestamp = nowIso()
    const sessionToken = randomUUID()
    const session = createSession(
      player.id,
      sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null,
      timestamp
    )
    state.sessions.push(session)
    player.updatedAt = timestamp

    const response: RecoverSessionResponse = {
      player,
      sessionId: session.id,
      stats: computePlayerStats(state, player.id),
    }

    recordIdentityEvent(state, {
      playerId: player.id,
      eventType: "recover_session",
      handle: player.handle,
      ipHash: input.ipAddress ? sha256(input.ipAddress) : null,
      userAgent: input.userAgent,
    })

    return {
      ...response,
      sessionToken: session.token,
      created: true,
    }
  })
}

export async function requestMagicLink(input: {
  request: { email: string }
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    assertPlayerNotRestricted(state, context.player.id)
    const normalizedEmail = validateEmailAddress(input.request.email)
    const existingPlayer = state.players.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail
    )
    const targetPlayer = existingPlayer ?? context.player
    assertPlayerNotRestricted(state, targetPlayer.id)
    const mode: "link" | "login" = existingPlayer ? "login" : "link"

    if (!existingPlayer) {
      const conflictingEmail = state.players.find(
        (candidate) => candidate.id !== context.player.id && candidate.email?.toLowerCase() === normalizedEmail
      )

      if (conflictingEmail) {
        throw new Error("That email address is already linked to another player.")
      }

      updatePersistedPlayerProfile(targetPlayer, {})
      targetPlayer.email = normalizedEmail
      targetPlayer.emailVerifiedAt = null
    }

    const rawToken = createMagicLinkToken()
    const expiresAt = new Date(Date.now() + getMagicLinkTtlMinutes() * 60 * 1000).toISOString()
    const tokenId = randomUUID()
    state.magicLinkTokens.push({
      id: tokenId,
      playerId: targetPlayer.id,
      email: normalizedEmail,
      tokenHash: hashMagicLinkToken(rawToken),
      mode,
      expiresAt,
      consumedAt: null,
      createdAt: nowIso(),
    })

    const magicLinkUrl = `${getSiteUrl()}/api/session/email/verify?token=${rawToken}`
    const delivery = await deliverMagicLink({
      email: normalizedEmail,
      magicLinkUrl,
      tokenId,
      playerId: targetPlayer.id,
      mode,
      handle: targetPlayer.handle,
    })
    createMagicLinkDeliveryEvent(state, {
      tokenId,
      playerId: targetPlayer.id,
      email: normalizedEmail,
      mode,
      driver: delivery.driver,
      status: delivery.driver === "log" ? "generated" : "queued",
      providerMessageId: delivery.providerMessageId,
      payload: delivery.responsePayload ?? {},
      occurredAt: delivery.attemptedAt,
    })

    const response: RequestMagicLinkResponse = {
      ok: true,
      mode,
      email: normalizedEmail,
      expiresAt,
      previewUrl: delivery.previewUrl,
    }

    return {
      ...response,
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}

export async function verifyMagicLink(input: {
  token: string
  userAgent: string | null
  ipAddress: string | null
}) {
  return withState(async (state) => {
    const magicLink = consumeMagicLinkToken(state, hashMagicLinkToken(input.token))

    if (!magicLink) {
      throw new Error("Magic link is invalid or expired.")
    }

    const player = state.players.find((candidate) => candidate.id === magicLink.playerId)

    if (!player) {
      throw new Error("Magic link player could not be found.")
    }

    assertPlayerNotRestricted(state, player.id)

    magicLink.consumedAt = nowIso()
    player.email = magicLink.email
    player.emailVerifiedAt = nowIso()
    player.updatedAt = nowIso()
    const sessionToken = randomUUID()
    const session = createSession(
      player.id,
      sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null,
      nowIso()
    )
    state.sessions.push(session)

    const response: VerifyMagicLinkResponse = {
      player,
      sessionId: session.id,
      stats: computePlayerStats(state, player.id),
      mode: magicLink.mode,
    }

    return {
      ...response,
      sessionToken: session.token,
      created: true,
    }
  })
}

function buildAdminAuditPage<TItem, TFilters>(input: {
  items: TItem[]
  limit: number
  offset: number
  total: number
  filters: TFilters
}) {
  return {
    filters: input.filters,
    pagination: {
      limit: input.limit,
      offset: input.offset,
      returned: input.items.length,
      total: input.total,
      hasMore: input.offset + input.items.length < input.total,
    },
    items: input.items,
  }
}

function includesCaseInsensitive(value: string | null | undefined, search: string) {
  return value?.toLowerCase().includes(search) ?? false
}

function buildIncidentHistoryItems(state: BackendState) {
  return [
    ...state.operationalAlerts.map<AdminIncidentHistoryItem>((alert) => ({
      id: alert.id,
      category: "operational_alert",
      at: alert.createdAt,
      source: alert.source,
      title: `${alert.dispatchStatus} ${alert.severity} alert`,
      detail: `${alert.event}: ${alert.message}`,
      severity: alert.severity,
      requestId: alert.requestId,
    })),
    ...state.readinessProbeRuns.map<AdminIncidentHistoryItem>((run) => ({
      id: run.id,
      category: "readiness_probe",
      at: run.createdAt,
      source: run.source,
      title: run.ok ? "passing readiness probe" : "failing readiness probe",
      detail: `${run.failedChecks} failed check(s), ${run.warningChecks} warning check(s).`,
      severity: run.ok ? "warn" : "error",
      requestId: run.requestId,
    })),
    ...state.cleanupRuns.map<AdminIncidentHistoryItem>((run) => ({
      id: run.id,
      category: "retention_cleanup",
      at: run.createdAt,
      source: run.source,
      title: run.dryRun ? "cleanup dry run" : "cleanup applied",
      detail: `Deleted ${run.deleted.magicLinkTokens} tokens, ${run.deleted.deliveryEvents} delivery events, and ${run.deleted.operationalReports} archived ops reports.`,
      severity: null,
      requestId: run.requestId,
    })),
    ...state.leaderboardRecomputeRuns.map<AdminIncidentHistoryItem>((run) => ({
      id: run.id,
      category: "leaderboard_recompute",
      at: run.createdAt,
      source: run.source,
      title: run.dryRun ? "leaderboard recompute dry run" : "leaderboard recompute applied",
      detail: `${run.totalDates} date(s), ${run.snapshots.insertedRows} inserted row(s).`,
      severity: null,
      requestId: run.requestId,
    })),
    ...state.abuseRestrictions.map<AdminIncidentHistoryItem>((restriction) => ({
      id: restriction.id,
      category: "abuse_restriction",
      at: restriction.liftedAt ?? restriction.createdAt,
      source: restriction.source,
      title: restriction.active ? "abuse restriction active" : "abuse restriction lifted",
      detail: `${restriction.targetType}:${restriction.targetValue}`,
      severity: null,
      requestId: restriction.requestId,
    })),
  ]
}

export async function getAdminAudit(input: GetAdminAuditInput) {
  return withState(async (state) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
    const sortedOperationalAlerts = state.operationalAlerts
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const sortedOperationalReports = state.operationalReports
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const sortedReadinessProbeRuns = state.readinessProbeRuns
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const sortedCleanupRuns = state.cleanupRuns
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const sortedLeaderboardRecomputeRuns = state.leaderboardRecomputeRuns
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const sortedAbuseRestrictions = state.abuseRestrictions
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const filteredIdentityEvents = [...state.identityEvents]
      .filter((event) =>
        input.identity.eventType ? event.eventType === input.identity.eventType : true
      )
      .filter((event) =>
        input.identity.handle
          ? (event.handle ?? "").toLowerCase().includes(input.identity.handle.toLowerCase())
          : true
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const filteredMagicLinks = [...state.magicLinkTokens]
      .filter((token) => (input.magicLinks.mode ? token.mode === input.magicLinks.mode : true))
      .filter((token) =>
        input.magicLinks.email
          ? token.email.toLowerCase().includes(input.magicLinks.email.toLowerCase())
          : true
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

    return {
      driver: getStoreDriver(),
      generatedAt: nowIso(),
      totals: {
        players: state.players.length,
        claimedPlayers: state.players.filter((player) => !player.isGuest).length,
        verifiedEmails: state.players.filter((player) => Boolean(player.emailVerifiedAt)).length,
        activeSessions7d: state.sessions.filter(
          (session) => new Date(session.lastSeenAt).getTime() >= sevenDaysAgo
        ).length,
        failedRecoveries24h: state.identityEvents.filter(
          (event) =>
            event.eventType === "failed_recovery" &&
            new Date(event.createdAt).getTime() >= twentyFourHoursAgo
        ).length,
      },
      deliverySummary: buildDeliverySummary(state),
      identityEvents: buildAdminAuditPage({
        items: filteredIdentityEvents
          .slice(input.identity.offset, input.identity.offset + input.identity.limit)
          .map<AdminAuditIdentityEvent>((event) => ({
            id: event.id,
            playerId: event.playerId,
            eventType: event.eventType,
            handle: event.handle,
            createdAt: event.createdAt,
            metadata: event.metadata,
          })),
        limit: input.identity.limit,
        offset: input.identity.offset,
        total: filteredIdentityEvents.length,
        filters: {
          eventType: input.identity.eventType,
          handle: input.identity.handle,
        },
      }),
      magicLinks: buildAdminAuditPage({
        items: filteredMagicLinks
          .slice(input.magicLinks.offset, input.magicLinks.offset + input.magicLinks.limit)
          .map<AdminAuditMagicLink>((token) => {
            const latestDeliveryEvent = getLatestMagicLinkDeliveryEvent(state, token.id)

            return {
              id: token.id,
              playerId: token.playerId,
              email: token.email,
              mode: token.mode,
              expiresAt: token.expiresAt,
              consumedAt: token.consumedAt,
              createdAt: token.createdAt,
              delivery: {
                status: latestDeliveryEvent?.status ?? null,
                driver: latestDeliveryEvent?.driver ?? null,
                providerMessageId: latestDeliveryEvent?.providerMessageId ?? null,
                lastEventAt: latestDeliveryEvent?.updatedAt ?? null,
                failureReason: latestDeliveryEvent?.failureReason ?? null,
              },
            }
          }),
        limit: input.magicLinks.limit,
        offset: input.magicLinks.offset,
        total: filteredMagicLinks.length,
        filters: {
          mode: input.magicLinks.mode,
          email: input.magicLinks.email,
        },
      }),
      operationalReports: buildAdminAuditPage({
        items: sortedOperationalReports
          .filter((report) =>
            input.operationalReports.reportType
              ? report.reportType === input.operationalReports.reportType
              : true
          )
          .filter((report) =>
            input.operationalReports.sinceDays
              ? new Date(report.createdAt).getTime() >=
                Date.now() - input.operationalReports.sinceDays * 24 * 60 * 60 * 1000
              : true
            )
          .filter((report) => {
            const search = input.operationalReports.search?.toLowerCase()

            if (!search) {
              return true
            }

            return (
              includesCaseInsensitive(report.reportType, search) ||
              includesCaseInsensitive(report.reason, search) ||
              includesCaseInsensitive(report.requestedBy, search) ||
              report.actions.some((action) => action.toLowerCase().includes(search)) ||
              JSON.stringify(report.summary).toLowerCase().includes(search)
            )
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(
            input.operationalReports.offset,
            input.operationalReports.offset + input.operationalReports.limit
          ),
        limit: input.operationalReports.limit,
        offset: input.operationalReports.offset,
        total: state.operationalReports
          .filter((report) =>
            input.operationalReports.reportType
              ? report.reportType === input.operationalReports.reportType
              : true
          )
          .filter((report) =>
            input.operationalReports.sinceDays
              ? new Date(report.createdAt).getTime() >=
                Date.now() - input.operationalReports.sinceDays * 24 * 60 * 60 * 1000
              : true
          )
          .filter((report) => {
            const search = input.operationalReports.search?.toLowerCase()

            if (!search) {
              return true
            }

            return (
              includesCaseInsensitive(report.reportType, search) ||
              includesCaseInsensitive(report.reason, search) ||
              includesCaseInsensitive(report.requestedBy, search) ||
              report.actions.some((action) => action.toLowerCase().includes(search)) ||
              JSON.stringify(report.summary).toLowerCase().includes(search)
            )
          }).length,
        filters: {
          reportType: input.operationalReports.reportType,
          sinceDays: input.operationalReports.sinceDays,
          search: input.operationalReports.search,
        },
      }),
      incidentHistory: buildAdminAuditPage({
        items: buildIncidentHistoryItems(state)
          .filter((item) =>
            input.incidentHistory.category ? item.category === input.incidentHistory.category : true
          )
          .filter((item) =>
            input.incidentHistory.sinceDays
              ? new Date(item.at).getTime() >=
                Date.now() - input.incidentHistory.sinceDays * 24 * 60 * 60 * 1000
              : true
          )
          .filter((item) => {
            const search = input.incidentHistory.search?.toLowerCase()

            if (!search) {
              return true
            }

            return (
              includesCaseInsensitive(item.title, search) ||
              includesCaseInsensitive(item.detail, search) ||
              includesCaseInsensitive(item.requestId, search)
            )
          })
          .sort((left, right) => right.at.localeCompare(left.at))
          .slice(input.incidentHistory.offset, input.incidentHistory.offset + input.incidentHistory.limit),
        limit: input.incidentHistory.limit,
        offset: input.incidentHistory.offset,
        total: buildIncidentHistoryItems(state)
          .filter((item) =>
            input.incidentHistory.category ? item.category === input.incidentHistory.category : true
          )
          .filter((item) =>
            input.incidentHistory.sinceDays
              ? new Date(item.at).getTime() >=
                Date.now() - input.incidentHistory.sinceDays * 24 * 60 * 60 * 1000
              : true
          )
          .filter((item) => {
            const search = input.incidentHistory.search?.toLowerCase()

            if (!search) {
              return true
            }

            return (
              includesCaseInsensitive(item.title, search) ||
              includesCaseInsensitive(item.detail, search) ||
              includesCaseInsensitive(item.requestId, search)
            )
          }).length,
        filters: {
          category: input.incidentHistory.category,
          sinceDays: input.incidentHistory.sinceDays,
          search: input.incidentHistory.search,
        },
      }),
      suspiciousActivity: buildSuspiciousActivity(state),
      operationalAlertSummary: summarizeOperationalAlertRuns(sortedOperationalAlerts),
      recentOperationalAlerts: sortedOperationalAlerts.slice(0, 10),
      readinessProbeSummary: summarizeReadinessProbeRuns(sortedReadinessProbeRuns),
      recurringJobFreshnessSummary: buildRecurringJobFreshnessSummary({
        readinessProbeRuns: sortedReadinessProbeRuns,
        cleanupRuns: sortedCleanupRuns,
        operationalReports: sortedOperationalReports,
      }),
      recentReadinessProbeRuns: sortedReadinessProbeRuns.slice(0, 10),
      recentCleanupRuns: sortedCleanupRuns.slice(0, 10),
      recentLeaderboardRecomputeRuns: sortedLeaderboardRecomputeRuns.slice(0, 10),
      recentAbuseRestrictions: sortedAbuseRestrictions.slice(0, 10),
    }
  })
}

export async function recordEmailDeliveryEvent(input: RecordEmailDeliveryEventInput) {
  return withState<RecordEmailDeliveryEventResult>(async (state) => {
    const matchedToken = input.tokenId
      ? state.magicLinkTokens.find((token) => token.id === input.tokenId)
      : input.providerMessageId
        ? [...state.magicLinkDeliveryEvents]
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .find((event) => event.providerMessageId === input.providerMessageId)
            ? state.magicLinkTokens.find(
                (token) =>
                  token.id ===
                  state.magicLinkDeliveryEvents.find(
                    (event) => event.providerMessageId === input.providerMessageId
                  )?.tokenId
              )
            : null
        : null

    if (!matchedToken) {
      return {
        ok: true,
        matched: false,
        deduplicated: false,
        eventId: null,
        tokenId: input.tokenId,
      } satisfies RecordEmailDeliveryEventResult
    }

    const duplicateEvent = findDuplicateMagicLinkDeliveryEvent(state, {
      tokenId: matchedToken.id,
      eventType: input.eventType,
      providerMessageId:
        input.providerMessageId ??
        getLatestMagicLinkDeliveryEvent(state, matchedToken.id)?.providerMessageId ??
        null,
      providerEventId: input.providerEventId,
      occurredAt: input.occurredAt,
      failureReason: input.failureReason,
    })

    if (duplicateEvent) {
      return {
        ok: true,
        matched: true,
        deduplicated: true,
        eventId: duplicateEvent.id,
        tokenId: matchedToken.id,
      } satisfies RecordEmailDeliveryEventResult
    }

    const event = createMagicLinkDeliveryEvent(state, {
      tokenId: matchedToken.id,
      playerId: matchedToken.playerId,
      email: matchedToken.email,
      mode: matchedToken.mode,
      driver: input.providerMessageId ? "webhook" : getLatestMagicLinkDeliveryEvent(state, matchedToken.id)?.driver ?? "webhook",
      status: input.eventType,
      providerMessageId:
        input.providerMessageId ??
        getLatestMagicLinkDeliveryEvent(state, matchedToken.id)?.providerMessageId ??
        null,
      providerEventId: input.providerEventId,
      failureReason: input.failureReason,
      payload: input.payload,
      occurredAt: input.occurredAt,
    })

    return {
      ok: true,
      matched: true,
      deduplicated: false,
      eventId: event.id,
      tokenId: matchedToken.id,
    } satisfies RecordEmailDeliveryEventResult
  })
}

export async function recordReadinessProbe(
  input: ReadinessProbeInput & {
    readiness: {
      ok: boolean
      summary: {
        failedChecks: number
        warningChecks: number
      }
      checks: Array<{
        name: string
        ok: boolean
        severity: "info" | "warn" | "error"
        message: string
      }>
    }
  }
) {
  return withState<RecordReadinessProbeResult>(async (state) => {
    const generatedAt = nowIso()
    const run = recordReadinessProbeRun(state, {
      readinessInput: input,
      generatedAt,
      driver: getStoreDriver(),
    })

    return {
      ok: true,
      driver: getStoreDriver(),
      generatedAt,
      run,
    } satisfies RecordReadinessProbeResult
  })
}

export async function recordOperationalAlert(input: RecordOperationalAlertInput) {
  return withState<RecordOperationalAlertResult>(async (state) => {
    const generatedAt = nowIso()
    const alert = recordOperationalAlertRun(state, {
      alertInput: input,
      generatedAt,
      driver: getStoreDriver(),
    })

    return {
      ok: true,
      driver: getStoreDriver(),
      generatedAt,
      alert,
    } satisfies RecordOperationalAlertResult
  })
}

export async function recordOperationalReport(input: RecordOperationalReportInput) {
  return withState<RecordOperationalReportResult>(async (state) => {
    const generatedAt = nowIso()
    const report = recordOperationalReportRun(state, {
      reportInput: input,
      generatedAt,
      driver: getStoreDriver(),
    })

    return {
      ok: true,
      driver: getStoreDriver(),
      generatedAt,
      report,
    } satisfies RecordOperationalReportResult
  })
}

export async function runRetentionCleanup(input: RunRetentionCleanupInput) {
  return withState<RunRetentionCleanupResult>(async (state) => {
    const now = Date.now()
    const magicLinkRetentionDays = getMagicLinkRetentionDays()
    const deliveryEventRetentionDays = getEmailDeliveryEventRetentionDays()
    const operationalReportRetentionDays = getOperationalReportRetentionDays()
    const magicLinkCutoff = now - magicLinkRetentionDays * 24 * 60 * 60 * 1000
    const deliveryEventCutoff = now - deliveryEventRetentionDays * 24 * 60 * 60 * 1000
    const operationalReportCutoff =
      now - operationalReportRetentionDays * 24 * 60 * 60 * 1000
    const tokenIdsToDelete = new Set(
      state.magicLinkTokens
        .filter((token) => new Date(token.expiresAt).getTime() < magicLinkCutoff)
        .map((token) => token.id)
    )
    const deliveryEventsToDelete = state.magicLinkDeliveryEvents.filter(
      (event) =>
        tokenIdsToDelete.has(event.tokenId) || new Date(event.updatedAt).getTime() < deliveryEventCutoff
    )
    const operationalReportsToDelete = state.operationalReports.filter(
      (report) => new Date(report.createdAt).getTime() < operationalReportCutoff
    )
    const deleted = {
      magicLinkTokens: tokenIdsToDelete.size,
      deliveryEvents: deliveryEventsToDelete.length,
      operationalReports: operationalReportsToDelete.length,
    }

    if (!input.dryRun) {
      state.magicLinkTokens = state.magicLinkTokens.filter((token) => !tokenIdsToDelete.has(token.id))
      state.magicLinkDeliveryEvents = state.magicLinkDeliveryEvents.filter(
        (event) =>
          !tokenIdsToDelete.has(event.tokenId) &&
          new Date(event.updatedAt).getTime() >= deliveryEventCutoff
      )
      state.operationalReports = state.operationalReports.filter(
        (report) => new Date(report.createdAt).getTime() >= operationalReportCutoff
      )
    }

    const remaining = {
      magicLinkTokens: input.dryRun
        ? state.magicLinkTokens.length - deleted.magicLinkTokens
        : state.magicLinkTokens.length,
      deliveryEvents: input.dryRun
        ? state.magicLinkDeliveryEvents.length - deleted.deliveryEvents
        : state.magicLinkDeliveryEvents.length,
      operationalReports: input.dryRun
        ? state.operationalReports.length - deleted.operationalReports
        : state.operationalReports.length,
    }

    const result = {
      ok: true,
      driver: getStoreDriver(),
      dryRun: input.dryRun,
      generatedAt: nowIso(),
      retention: {
        magicLinkDays: magicLinkRetentionDays,
        deliveryEventDays: deliveryEventRetentionDays,
        operationalReportDays: operationalReportRetentionDays,
      },
      deleted,
      remaining,
    } satisfies RunRetentionCleanupResult

    recordCleanupRun(state, {
      cleanupInput: input,
      result,
    })

    return result
  })
}

function buildRecomputeDates(input: RecomputeLeaderboardSnapshotsInput) {
  const anchorDate = input.date ?? nowIso().slice(0, 10)
  const days = input.days ?? 1
  const dates: string[] = []

  for (let index = 0; index < days; index += 1) {
    const current = new Date(`${anchorDate}T00:00:00Z`)
    current.setUTCDate(current.getUTCDate() - index)
    dates.push(current.toISOString().slice(0, 10))
  }

  return dates
}

export async function recomputeLeaderboardSnapshots(input: RecomputeLeaderboardSnapshotsInput) {
  return withState<RecomputeLeaderboardSnapshotsResult>(async (state) => {
    const dates = buildRecomputeDates(input)
    let deletedRows = 0
    let insertedRows = 0
    const nextSnapshots = [...state.leaderboardSnapshots]

    for (const date of dates) {
      const entries = buildLeaderboardPreview(state, date)
      const existingIndex = nextSnapshots.findIndex((snapshot) => snapshot.date === date)
      const existingRows = existingIndex >= 0 ? nextSnapshots[existingIndex].entries.length : 0

      deletedRows += existingRows
      insertedRows += entries.length

      if (!input.dryRun) {
        const snapshot: PersistedLeaderboardSnapshot = {
          date,
          entries,
          computedAt: nowIso(),
        }

        if (existingIndex >= 0) {
          nextSnapshots.splice(existingIndex, 1, snapshot)
        } else {
          nextSnapshots.push(snapshot)
        }
      }
    }

    if (!input.dryRun) {
      state.leaderboardSnapshots = nextSnapshots
    }

    const result = {
      ok: true,
      driver: getStoreDriver(),
      dryRun: input.dryRun,
      generatedAt: nowIso(),
      dates,
      totalDates: dates.length,
      snapshots: {
        deletedRows,
        insertedRows,
      },
    } satisfies RecomputeLeaderboardSnapshotsResult

    recordLeaderboardRecomputeRun(state, {
      recomputeInput: input,
      result,
    })

    return result
  })
}

export async function setAbuseRestriction(input: SetAbuseRestrictionInput) {
  return withState<SetAbuseRestrictionResult>(async (state) => {
    let restriction: PersistedAbuseRestriction | null = null

    if (input.action === "activate") {
      const existing = state.abuseRestrictions.find(
        (candidate) =>
          candidate.active &&
          candidate.targetType === input.targetType &&
          candidate.targetValue === input.targetValue
      )

      if (existing) {
        existing.reason = input.reason ?? existing.reason
        existing.requestedBy = input.requestedBy ?? existing.requestedBy
        existing.requestId = input.requestId ?? existing.requestId
        restriction = existing
      } else {
        restriction = buildAbuseRestriction({
          targetType: input.targetType ?? "player",
          targetValue: input.targetValue ?? "",
          reason: input.reason ?? null,
          source: input.source ?? "unknown",
          requestedBy: input.requestedBy ?? null,
          requestId: input.requestId ?? null,
        })
        state.abuseRestrictions.unshift(restriction)
      }
    } else {
      const existing = state.abuseRestrictions.find((candidate) => candidate.id === input.restrictionId)

      if (!existing) {
        throw new Error("Abuse restriction could not be found.")
      }

      existing.active = false
      existing.liftedAt = nowIso()
      existing.liftedReason = input.reason ?? null
      existing.requestedBy = input.requestedBy ?? existing.requestedBy
      existing.requestId = input.requestId ?? existing.requestId
      restriction = existing
    }

    return {
      ok: true,
      driver: getStoreDriver(),
      generatedAt: nowIso(),
      restriction,
    } satisfies SetAbuseRestrictionResult
  })
}

export async function getDailyLeaderboard(input: {
  date: string
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  if (!isValidChallengeDate(input.date)) {
    throw new Error("Invalid daily date.")
  }

  return withState(async (state) => {
    const context = getOrCreateSession(
      state,
      input.sessionToken,
      input.userAgent,
      input.ipAddress ? sha256(input.ipAddress) : null
    )
    const snapshotEntries = getLeaderboardSnapshot(state, input.date)?.entries ?? null

    return {
      entries: snapshotEntries ?? buildLeaderboardPreview(state, input.date),
      sessionToken: context.session.token,
      created: context.created,
    }
  })
}
