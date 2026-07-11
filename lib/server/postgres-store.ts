import "server-only"

import { createHash, randomUUID } from "node:crypto"

import { Pool, type PoolClient } from "pg"

import type {
  AcceptedGuess,
  ClaimIdentityResponse,
  DailyChallengeState,
  DailyLeaderboardEntry,
  EmailAuthStatus,
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
  type DailyThemeId,
  getDailyChallenge,
  getDailyThemeMessages,
  getDailyThemeQueryValidator,
  getDailyThemeValidator,
  isValidChallengeDate,
} from "@/lib/daily"
import { createMagicLinkToken, hashMagicLinkToken, validateEmailAddress } from "@/lib/email-auth"
import { WINNING_SCORE, validateGuess, validateGuessWithRules } from "@/lib/game"
import { createRecoveryCode, normalizeRecoveryCode, validatePlayerHandle } from "@/lib/identity"
import { summarizeOperationalAlertRuns } from "@/lib/operational-alerts"
import { isDuplicateEmailDeliveryEventCandidate } from "@/lib/server/email-delivery-events"
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
import { deliverMagicLink } from "@/lib/server/email-delivery"
import { runDatabaseMigrations } from "@/lib/server/db-init"
import { buildRecurringJobFreshnessSummary } from "@/lib/server/recurring-job-freshness"
import { summarizeReadinessProbeRuns } from "@/lib/server/readiness"
import {
  getAdminSecret,
  getDatabaseUrl,
  getEmailDeliveryEventRetentionDays,
  getMagicLinkTtlMinutes,
  getMagicLinkRetentionDays,
  getOperationalReportRetentionDays,
  getRateLimitDriver,
  getStoreDriver,
  isProductionEnvironment,
  requireDatabaseUrl,
} from "@/lib/server/env"
import { getSiteUrl } from "@/lib/site"

const SESSION_COOKIE_NAME = "name100_session"

let pool: Pool | null = null

type SessionContext = {
  player: PlayerProfile
  sessionId: string
  sessionToken: string
  created: boolean
}

type AttemptRecord = {
  id: string
  playerId: string
  sessionId: string
  date: string
  themeId: string
  themeTitle: string
  themeLabel: string
  targetScore: number
  status: "in_progress" | "completed" | "abandoned" | "invalidated"
  score: number
  attempts: number
  guessesSubmitted: number
  startedAt: string
  completedAt: string | null
  bestTimeMs: number | null
  streakAtCompletion: number
  shareText: string
  shareClicks: number
  createdAt: string
  updatedAt: string
}

type OpenGameRecord = {
  id: string
  playerId: string
  score: number
  updatedAt: string
}

function getPool() {
  if (pool) {
    return pool
  }

  const connectionString = requireDatabaseUrl()

  pool = new Pool({
    connectionString,
  })

  return pool
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function mapPlayer(row: {
  id: string
  handle: string | null
  is_guest: boolean
  recovery_code_hash?: string | null
  created_at: string
  updated_at: string
}): PlayerProfile {
  return {
    id: row.id,
    handle: row.handle,
    isGuest: row.is_guest,
    recoveryConfigured: Boolean(row.recovery_code_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAttempt(row: {
  id: string
  player_id: string
  session_id: string
  date: Date | string
  theme_id: string
  theme_title: string
  theme_label: string
  target_score: number
  status: AttemptRecord["status"]
  score: number
  attempts: number
  guesses_submitted: number
  started_at: string
  completed_at: string | null
  best_time_ms: number | null
  streak_at_completion: number
  share_text: string
  share_clicks: number
  created_at: string
  updated_at: string
}): AttemptRecord {
  const date =
    typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10)

  return {
    id: row.id,
    playerId: row.player_id,
    sessionId: row.session_id,
    date,
    themeId: row.theme_id,
    themeTitle: row.theme_title,
    themeLabel: row.theme_label,
    targetScore: row.target_score,
    status: row.status,
    score: row.score,
    attempts: row.attempts,
    guessesSubmitted: row.guesses_submitted,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    bestTimeMs: row.best_time_ms,
    streakAtCompletion: row.streak_at_completion,
    shareText: row.share_text,
    shareClicks: row.share_clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildOpenGameState(
  player: PlayerProfile,
  game: OpenGameRecord,
  acceptedGuesses: AcceptedGuess[]
): OpenGameState {
  return {
    player,
    score: game.score,
    targetScore: WINNING_SCORE,
    acceptedGuesses,
    completed: game.score >= WINNING_SCORE,
    updatedAt: game.updatedAt,
  }
}

function mapAttemptToDailyState(
  attempt: AttemptRecord,
  acceptedGuesses: AcceptedGuess[],
  player: PlayerProfile,
  stats: PlayerStats,
  leaderboardPreview: DailyLeaderboardEntry[]
): DailyChallengeState {
  return {
    player,
    stats,
    attempt: {
      id: attempt.id,
      playerId: attempt.playerId,
      sessionId: attempt.sessionId,
      date: attempt.date,
      theme: {
        themeId: attempt.themeId as DailyThemeId,
        title: attempt.themeTitle,
        categoryLabel: attempt.themeLabel,
        targetScore: attempt.targetScore,
      },
      status: attempt.status,
      score: attempt.score,
      attempts: attempt.attempts,
      guessesSubmitted: attempt.guessesSubmitted,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      bestTimeMs: attempt.bestTimeMs,
      streakAtCompletion: attempt.streakAtCompletion,
      shareText: attempt.shareText,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    },
    acceptedGuesses,
    analytics: {
      date: attempt.date,
      attempts: attempt.attempts,
      guessesSubmitted: attempt.guessesSubmitted,
      shareClicks: attempt.shareClicks,
      completed: attempt.status === "completed",
      completionTimeMs: attempt.bestTimeMs,
    },
    leaderboardPreview,
  }
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect()

  try {
    await client.query("begin")
    const result = await callback(client)
    await client.query("commit")
    return result
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

async function computePlayerStats(client: PoolClient, playerId: string): Promise<PlayerStats> {
  const aggregateResult = await client.query<{
    completed_days: string
    average_completion_time_ms: string | null
    average_guess_count: string | null
    success_rate: string | null
    max_streak: string | null
  }>(
    `
      select
        count(*) filter (where status = 'completed') as completed_days,
        round(avg(best_time_ms) filter (where status = 'completed'))::text as average_completion_time_ms,
        round(avg(guesses_submitted))::text as average_guess_count,
        round((count(*) filter (where status = 'completed')::numeric / nullif(count(*), 0)) * 100)::text as success_rate,
        max(streak_at_completion)::text as max_streak
      from daily_attempts
      where player_id = $1
    `,
    [playerId]
  )
  const streakResult = await client.query<{ streak_at_completion: number }>(
    `
      select streak_at_completion
      from daily_attempts
      where player_id = $1 and status = 'completed'
      order by date desc
      limit 1
    `,
    [playerId]
  )
  const aggregate = aggregateResult.rows[0]

  return {
    currentStreak: streakResult.rows[0]?.streak_at_completion ?? 0,
    maxStreak: Number(aggregate?.max_streak ?? 0),
    completedDays: Number(aggregate?.completed_days ?? 0),
    averageCompletionTimeMs: aggregate?.average_completion_time_ms
      ? Number(aggregate.average_completion_time_ms)
      : null,
    averageGuessCount: Number(aggregate?.average_guess_count ?? 0),
    successRate: Number(aggregate?.success_rate ?? 0),
  }
}

async function getPlayerEmailAuthStatus(
  client: PoolClient,
  playerId: string
): Promise<EmailAuthStatus> {
  const result = await client.query<{
    email: string | null
    email_verified_at: string | null
  }>(
    `
      select email, email_verified_at
      from players
      where id = $1
      limit 1
    `,
    [playerId]
  )
  const row = result.rows[0]

  return {
    email: row?.email ?? null,
    verified: Boolean(row?.email && row?.email_verified_at),
  }
}

async function assertPlayerNotRestricted(client: PoolClient, playerId: string) {
  const result = await client.query<{ id: string }>(
    `
      select id
      from abuse_restrictions
      where target_type = 'player'
        and target_value = $1
        and lifted_at is null
      order by created_at desc
      limit 1
    `,
    [playerId]
  )

  if (result.rows[0]) {
    throw new Error("This player is currently restricted from write actions.")
  }
}

async function computeOverviewAnalytics(client: PoolClient): Promise<OverviewAnalytics> {
  const result = await client.query<{
    active_players_7d: string
    active_players_30d: string
    sessions_started_7d: string
    sessions_completed_7d: string
    average_guesses_per_attempt: string | null
    share_rate: string | null
  }>(`
    with attempts_7d as (
      select *
      from daily_attempts
      where updated_at >= now() - interval '7 days'
    ),
    attempts_30d as (
      select *
      from daily_attempts
      where updated_at >= now() - interval '30 days'
    ),
    shares_7d as (
      select count(*) as count
      from share_events
      where created_at >= now() - interval '7 days'
    )
    select
      (select count(distinct player_id) from attempts_7d)::text as active_players_7d,
      (select count(distinct player_id) from attempts_30d)::text as active_players_30d,
      (select count(*) from attempts_7d)::text as sessions_started_7d,
      (select count(*) from attempts_7d where status = 'completed')::text as sessions_completed_7d,
      (select round(avg(guesses_submitted))::text from attempts_7d) as average_guesses_per_attempt,
      (
        select round(((select count from shares_7d)::numeric / nullif((select count(*) from attempts_7d), 0)) * 100)::text
      ) as share_rate
  `)
  const row = result.rows[0]

  return {
    activePlayers7d: Number(row?.active_players_7d ?? 0),
    activePlayers30d: Number(row?.active_players_30d ?? 0),
    sessionsStarted7d: Number(row?.sessions_started_7d ?? 0),
    sessionsCompleted7d: Number(row?.sessions_completed_7d ?? 0),
    averageGuessesPerAttempt: Number(row?.average_guesses_per_attempt ?? 0),
    shareRate: Number(row?.share_rate ?? 0),
  }
}

async function getAcceptedGuesses(client: PoolClient, attemptId: string): Promise<AcceptedGuess[]> {
  const result = await client.query<{
    qid: string
    resolved_name: string
  }>(
    `
      select qid, resolved_name
      from accepted_guesses
      where attempt_id = $1
      order by created_at asc
    `,
    [attemptId]
  )

  return result.rows.map((row) => ({
    qid: row.qid,
    name: row.resolved_name,
  }))
}

async function getOpenAcceptedGuesses(client: PoolClient, openGameId: string): Promise<AcceptedGuess[]> {
  const result = await client.query<{
    qid: string
    resolved_name: string
  }>(
    `
      select qid, resolved_name
      from open_game_guesses
      where open_game_id = $1
      order by created_at asc
    `,
    [openGameId]
  )

  return result.rows.map((row) => ({
    qid: row.qid,
    name: row.resolved_name,
  }))
}

async function buildLeaderboardPreview(client: PoolClient, date: string): Promise<DailyLeaderboardEntry[]> {
  const result = await client.query<{
    player_id: string
    handle: string | null
    date: Date | string
    theme_label: string
    score: number
    target_score: number
    best_time_ms: number | null
    streak_at_completion: number
    completed_at: string | null
  }>(
    `
      select
        da.player_id,
        p.handle,
        da.date,
        da.theme_label,
        da.score,
        da.target_score,
        da.best_time_ms,
        da.streak_at_completion,
        da.completed_at
      from daily_attempts da
      join players p on p.id = da.player_id
      where da.date = $1 and da.status = 'completed'
      order by da.best_time_ms asc nulls last, da.completed_at asc nulls last
      limit 10
    `,
    [date]
  )

  return result.rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    handle: row.handle ?? `Guest ${row.player_id.slice(0, 8)}`,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
    themeLabel: row.theme_label,
    score: row.score,
    targetScore: row.target_score,
    completionTimeMs: row.best_time_ms,
    streakAtCompletion: row.streak_at_completion,
    completedAt: row.completed_at,
  }))
}

async function getDailyLeaderboardSnapshotEntries(
  client: PoolClient,
  date: string
): Promise<DailyLeaderboardEntry[] | null> {
  const result = await client.query<{
    rank: number
    player_id: string
    handle: string | null
    date: Date | string
    theme_label: string
    score: number
    target_score: number
    completion_time_ms: number | null
    streak_at_completion: number
    completed_at: string | null
  }>(
    `
      select
        dls.rank,
        dls.player_id,
        p.handle,
        dls.date,
        da.theme_label,
        dls.score,
        dls.target_score,
        dls.completion_time_ms,
        dls.streak_at_completion,
        da.completed_at
      from daily_leaderboard_snapshots dls
      join players p on p.id = dls.player_id
      join daily_attempts da on da.id = dls.attempt_id
      where dls.date = $1 and dls.leaderboard_type = 'daily'
      order by dls.rank asc
    `,
    [date]
  )

  if (result.rows.length === 0) {
    return null
  }

  return result.rows.map((row) => ({
    rank: row.rank,
    playerId: row.player_id,
    handle: row.handle ?? `Guest ${row.player_id.slice(0, 8)}`,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
    themeLabel: row.theme_label,
    score: row.score,
    targetScore: row.target_score,
    completionTimeMs: row.completion_time_ms,
    streakAtCompletion: row.streak_at_completion,
    completedAt: row.completed_at,
  }))
}

async function buildFastestLeaderboard(client: PoolClient): Promise<DailyLeaderboardEntry[]> {
  const result = await client.query<{
    player_id: string
    handle: string | null
    date: Date | string
    theme_label: string
    score: number
    target_score: number
    best_time_ms: number | null
    streak_at_completion: number
    completed_at: string | null
  }>(
    `
      select
        da.player_id,
        p.handle,
        da.date,
        da.theme_label,
        da.score,
        da.target_score,
        da.best_time_ms,
        da.streak_at_completion,
        da.completed_at
      from daily_attempts da
      join players p on p.id = da.player_id
      where da.status = 'completed'
      order by da.best_time_ms asc nulls last, da.date asc
      limit 10
    `
  )

  return result.rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    handle: row.handle ?? `Guest ${row.player_id.slice(0, 8)}`,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
    themeLabel: row.theme_label,
    score: row.score,
    targetScore: row.target_score,
    completionTimeMs: row.best_time_ms,
    streakAtCompletion: row.streak_at_completion,
    completedAt: row.completed_at,
  }))
}

async function buildStreakLeaderboard(client: PoolClient): Promise<DailyLeaderboardEntry[]> {
  const result = await client.query<{
    player_id: string
    handle: string | null
    date: Date | string
    theme_label: string
    score: number
    target_score: number
    best_time_ms: number | null
    streak_at_completion: number
    completed_at: string | null
  }>(
    `
      select
        da.player_id,
        p.handle,
        da.date,
        da.theme_label,
        da.score,
        da.target_score,
        da.best_time_ms,
        da.streak_at_completion,
        da.completed_at
      from daily_attempts da
      join players p on p.id = da.player_id
      where da.status = 'completed'
      order by da.streak_at_completion desc, da.date asc
      limit 10
    `
  )

  return result.rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    handle: row.handle ?? `Guest ${row.player_id.slice(0, 8)}`,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
    themeLabel: row.theme_label,
    score: row.score,
    targetScore: row.target_score,
    completionTimeMs: row.best_time_ms,
    streakAtCompletion: row.streak_at_completion,
    completedAt: row.completed_at,
  }))
}

async function buildPlayerHistory(client: PoolClient, playerId: string): Promise<PlayerHistoryEntry[]> {
  const result = await client.query<{
    id: string
    date: Date | string
    theme_label: string
    score: number
    target_score: number
    attempts: number
    best_time_ms: number | null
    streak_at_completion: number
    status: AttemptRecord["status"]
  }>(
    `
      select id, date, theme_label, score, target_score, attempts, best_time_ms, streak_at_completion, status
      from daily_attempts
      where player_id = $1
      order by date desc
      limit 10
    `,
    [playerId]
  )

  return result.rows.map((row) => ({
    attemptId: row.id,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10),
    themeLabel: row.theme_label,
    score: row.score,
    targetScore: row.target_score,
    attempts: row.attempts,
    completionTimeMs: row.best_time_ms,
    streakAtCompletion: row.streak_at_completion,
    completed: row.status === "completed",
  }))
}

async function getOrCreateSession(
  client: PoolClient,
  sessionToken: string | null,
  userAgent: string | null,
  ipAddress: string | null
): Promise<SessionContext> {
  if (sessionToken) {
    const existingResult = await client.query<{
      session_id: string
      player_id: string
      handle: string | null
      is_guest: boolean
      recovery_code_hash: string | null
      created_at: string
      updated_at: string
    }>(
      `
        select
          ps.id as session_id,
          p.id as player_id,
          p.handle,
          p.is_guest,
          p.recovery_code_hash,
          p.created_at,
          p.updated_at
        from player_sessions ps
        join players p on p.id = ps.player_id
        where ps.anonymous_token_hash = $1
        limit 1
      `,
      [sha256(sessionToken)]
    )

    if (existingResult.rows[0]) {
      const row = existingResult.rows[0]

      await client.query(
        `
          update player_sessions
          set last_seen_at = now(), user_agent = $2, ip_hash = coalesce($3, ip_hash)
          where id = $1
        `,
        [row.session_id, userAgent, ipAddress ? sha256(ipAddress) : null]
      )
      await client.query(
        `
          update players
          set updated_at = now()
          where id = $1
        `,
        [row.player_id]
      )

      return {
        player: mapPlayer({
          id: row.player_id,
          handle: row.handle,
          is_guest: row.is_guest,
          recovery_code_hash: row.recovery_code_hash,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }),
        sessionId: row.session_id,
        sessionToken,
        created: false,
      }
    }
  }

  const playerResult = await client.query<{
    id: string
    handle: string | null
    is_guest: boolean
    recovery_code_hash: string | null
    created_at: string
    updated_at: string
  }>(
    `
      insert into players (handle, is_guest)
      values (null, true)
      returning id, handle, is_guest, recovery_code_hash, created_at, updated_at
    `
  )
  const nextToken = randomUUID()
  const player = mapPlayer(playerResult.rows[0])
  const sessionResult = await client.query<{ id: string }>(
    `
      insert into player_sessions (player_id, anonymous_token_hash, user_agent, ip_hash)
      values ($1, $2, $3, $4)
      returning id
    `,
    [player.id, sha256(nextToken), userAgent, ipAddress ? sha256(ipAddress) : null]
  )

  return {
    player,
    sessionId: sessionResult.rows[0].id,
    sessionToken: nextToken,
    created: true,
  }
}

async function getOrCreateAttempt(
  client: PoolClient,
  playerId: string,
  sessionId: string,
  date: string
): Promise<AttemptRecord> {
  const existingResult = await client.query<{
    id: string
    player_id: string
    session_id: string
    date: Date | string
    theme_id: string
    theme_title: string
    theme_label: string
    target_score: number
    status: AttemptRecord["status"]
    score: number
    attempts: number
    guesses_submitted: number
    started_at: string
    completed_at: string | null
    best_time_ms: number | null
    streak_at_completion: number
    share_text: string
    share_clicks: number
    created_at: string
    updated_at: string
  }>(
    `
      select *
      from daily_attempts
      where player_id = $1 and date = $2
      limit 1
    `,
    [playerId, date]
  )

  if (existingResult.rows[0]) {
    const updatedResult = await client.query(existingResult.command ? `
      update daily_attempts
      set session_id = $2, updated_at = now()
      where id = $1
      returning *
    ` : `
      update daily_attempts
      set session_id = $2, updated_at = now()
      where id = $1
      returning *
    `, [existingResult.rows[0].id, sessionId])

    return mapAttempt(updatedResult.rows[0] as never)
  }

  const challenge = getDailyChallenge(date)
  const insertedResult = await client.query(
    `
      insert into daily_attempts (
        player_id,
        session_id,
        date,
        theme_id,
        theme_title,
        theme_label,
        target_score,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'in_progress')
      returning *
    `,
    [
      playerId,
      sessionId,
      date,
      challenge.themeId,
      challenge.title,
      challenge.categoryLabel,
      challenge.targetScore,
    ]
  )

  return mapAttempt(insertedResult.rows[0] as never)
}

async function getOrCreateOpenGame(
  client: PoolClient,
  playerId: string
): Promise<OpenGameRecord> {
  const existingResult = await client.query<{
    id: string
    player_id: string
    score: number
    updated_at: string
  }>(
    `
      select id, player_id, score, updated_at
      from open_game_sessions
      where player_id = $1
      limit 1
    `,
    [playerId]
  )

  if (existingResult.rows[0]) {
    return {
      id: existingResult.rows[0].id,
      playerId: existingResult.rows[0].player_id,
      score: existingResult.rows[0].score,
      updatedAt: existingResult.rows[0].updated_at,
    }
  }

  const insertedResult = await client.query<{
    id: string
    player_id: string
    score: number
    updated_at: string
  }>(
    `
      insert into open_game_sessions (player_id)
      values ($1)
      returning id, player_id, score, updated_at
    `,
    [playerId]
  )

  return {
    id: insertedResult.rows[0].id,
    playerId: insertedResult.rows[0].player_id,
    score: insertedResult.rows[0].score,
    updatedAt: insertedResult.rows[0].updated_at,
  }
}

async function getAttemptState(client: PoolClient, player: PlayerProfile, attempt: AttemptRecord) {
  const [stats, acceptedGuesses, leaderboardPreview] = await Promise.all([
    computePlayerStats(client, player.id),
    getAcceptedGuesses(client, attempt.id),
    buildLeaderboardPreview(client, attempt.date),
  ])

  return mapAttemptToDailyState(attempt, acceptedGuesses, player, stats, leaderboardPreview)
}

async function createGuessEvent(
  client: PoolClient,
  attemptId: string,
  playerId: string,
  date: string,
  payload: Omit<GuessEvent, "id" | "attemptId" | "playerId" | "date" | "createdAt">
) {
  const result = await client.query<{
    id: string
    created_at: string
  }>(
    `
      insert into guess_events (
        attempt_id,
        player_id,
        date,
        query,
        normalized_query,
        qid,
        resolved_name,
        is_accepted,
        rejection_reason,
        response_time_ms
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id, created_at
    `,
    [
      attemptId,
      playerId,
      date,
      payload.query,
      payload.normalizedQuery,
      payload.qid,
      payload.resolvedName,
      payload.isAccepted,
      payload.rejectionReason,
      payload.responseTimeMs,
    ]
  )

  return {
    id: result.rows[0].id,
    attemptId,
    playerId,
    date,
    query: payload.query,
    normalizedQuery: payload.normalizedQuery,
    qid: payload.qid,
    resolvedName: payload.resolvedName,
    isAccepted: payload.isAccepted,
    rejectionReason: payload.rejectionReason,
    responseTimeMs: payload.responseTimeMs,
    createdAt: result.rows[0].created_at,
  } satisfies GuessEvent
}

async function createIdentityEvent(
  client: PoolClient,
  input: {
    playerId: string | null
    eventType: "claim_identity" | "recover_session" | "failed_recovery"
    handle: string | null
    ipAddress: string | null
    userAgent: string | null
    metadata?: Record<string, unknown>
  }
) {
  await client.query(
    `
      insert into player_identity_events (
        player_id,
        event_type,
        handle,
        ip_hash,
        user_agent,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      input.playerId,
      input.eventType,
      input.handle,
      input.ipAddress ? sha256(input.ipAddress) : null,
      input.userAgent,
      JSON.stringify(input.metadata ?? {}),
    ]
  )
}

async function createMagicLinkDeliveryEvent(
  client: PoolClient,
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
  try {
    const result = await client.query<{ id: string }>(
      `
        insert into email_delivery_events (
          token_id,
          player_id,
          email,
          mode,
          driver,
          status,
          provider_message_id,
          provider_event_id,
          failure_reason,
          payload,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, coalesce($11::timestamptz, now()), coalesce($11::timestamptz, now()))
        returning id
      `,
      [
        input.tokenId,
        input.playerId,
        input.email,
        input.mode,
        input.driver,
        input.status,
        input.providerMessageId,
        input.providerEventId ?? null,
        input.failureReason ?? null,
        JSON.stringify(input.payload ?? {}),
        input.occurredAt,
      ]
    )

    return result.rows[0].id
  } catch (error) {
    const candidate = error as { code?: string }

    if (candidate.code === "23505" && input.providerEventId) {
      const existingResult = await client.query<{ id: string }>(
        `
          select id
          from email_delivery_events
          where provider_event_id = $1
          limit 1
        `,
        [input.providerEventId]
      )

      if (existingResult.rows[0]) {
        return existingResult.rows[0].id
      }
    }

    throw error
  }
}

async function getPreviousCompletedStreak(client: PoolClient, playerId: string, date: string) {
  const result = await client.query<{ date: Date | string; streak_at_completion: number }>(
    `
      select date, streak_at_completion
      from daily_attempts
      where player_id = $1 and status = 'completed' and date <= $2
      order by date desc
      limit 1
    `,
    [playerId, date]
  )
  const row = result.rows[0]

  if (!row) {
    return 1
  }

  const previousDate =
    typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10)

  if (previousDate === date) {
    return row.streak_at_completion || 1
  }

  const current = new Date(`${date}T00:00:00Z`)
  current.setUTCDate(current.getUTCDate() - 1)

  return current.toISOString().slice(0, 10) === previousDate ? row.streak_at_completion + 1 : 1
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
}

export async function getHealthStatus() {
  const startedAt = Date.now()
  const pool = getPool()
  const result = await pool.query<{
    ok: number
    schema_migrations_exists: string | null
  }>(`
    select
      1 as ok,
      to_regclass('public.schema_migrations')::text as schema_migrations_exists
  `)
  const latencyMs = Date.now() - startedAt

  return {
    ok: result.rows[0]?.ok === 1,
    driver: getStoreDriver(),
    mode: "postgres",
    environment: isProductionEnvironment() ? "production" : "development",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    adminSecretConfigured: Boolean(getAdminSecret()),
    rateLimitMode: getRateLimitDriver(),
    databaseUrlConfigured: Boolean(getDatabaseUrl()),
    checks: [
      {
        name: "database_ping",
        ok: result.rows[0]?.ok === 1,
        message: "PostgreSQL connection is healthy.",
        latencyMs,
      },
      {
        name: "schema_migrations_ready",
        ok: Boolean(result.rows[0]?.schema_migrations_exists),
        message: result.rows[0]?.schema_migrations_exists
          ? "Database migration tracking table is present."
          : "Database migration tracking table has not been initialized yet.",
      },
    ],
  }
}

export async function initializeDatabase() {
  const client = await getPool().connect()

  try {
    const migrationResult = await runDatabaseMigrations(client)

    return {
      ok: true,
      driver: getStoreDriver(),
      initialized: true,
      totalMigrations: migrationResult.totalMigrations,
      appliedMigrations: migrationResult.appliedMigrations,
      message:
        migrationResult.appliedMigrations.length > 0
          ? `Applied ${migrationResult.appliedMigrations.length} database migration(s).`
          : "No pending database migrations.",
    }
  } finally {
    client.release()
  }
}

export async function getOpenGameState(input: {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    const game = await getOrCreateOpenGame(client, context.player.id)
    const acceptedGuesses = await getOpenAcceptedGuesses(client, game.id)

    return {
      state: buildOpenGameState(context.player, game, acceptedGuesses),
      sessionToken: context.sessionToken,
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
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    await assertPlayerNotRestricted(client, context.player.id)
    let game = await getOrCreateOpenGame(client, context.player.id)
    const acceptedGuesses = await getOpenAcceptedGuesses(client, game.id)
    const result = await validateGuess(
      input.request.name,
      acceptedGuesses.map((guess) => guess.qid),
      game.score
    )

    if (result.valid) {
      await client.query(
        `
          update open_game_sessions
          set score = $2, updated_at = now()
          where id = $1
        `,
        [game.id, result.score]
      )
      await client.query(
        `
          insert into open_game_guesses (open_game_id, qid, resolved_name)
          values ($1, $2, $3)
          on conflict (open_game_id, qid) do nothing
        `,
        [game.id, result.qid, result.name]
      )
      game = {
        ...game,
        score: result.score,
        updatedAt: new Date().toISOString(),
      }
      acceptedGuesses.push({ qid: result.qid, name: result.name })
    }

    const response: SubmitOpenGuessResponse = {
      accepted: result.valid,
      message: result.message,
      state: buildOpenGameState(context.player, game, acceptedGuesses),
    }

    return {
      ...response,
      sessionToken: context.sessionToken,
      created: context.created,
    }
  })
}

export async function bootstrapSession(input: {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    const response: SessionBootstrapResponse = {
      player: context.player,
      sessionId: context.sessionId,
      stats: await computePlayerStats(client, context.player.id),
    }

    return {
      ...response,
      sessionToken: context.sessionToken,
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

  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    const attempt = await getOrCreateAttempt(client, context.player.id, context.sessionId, input.date)

    return {
      state: await getAttemptState(client, context.player, attempt),
      overview: await computeOverviewAnalytics(client),
      sessionToken: context.sessionToken,
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

  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    await assertPlayerNotRestricted(client, context.player.id)
    let attempt = await getOrCreateAttempt(client, context.player.id, context.sessionId, input.date)
    const acceptedGuesses = await getAcceptedGuesses(client, attempt.id)
    const themeValidator = getDailyThemeValidator(attempt.themeId as never)
    const themeQueryValidator = getDailyThemeQueryValidator(attempt.themeId as never)
    const themeMessages = getDailyThemeMessages(attempt.themeId as never)
    const guessStartedAt = Date.now()
    const result = await validateGuessWithRules(
      input.request.name,
      acceptedGuesses.map((guess) => guess.qid),
      attempt.score,
      undefined,
      {
        targetScore: attempt.targetScore,
        validateEntity: themeValidator,
        validateQuery: themeQueryValidator,
        invalidEntityMessage: themeMessages.invalidEntityMessage,
        successMessage: themeMessages.successMessage,
      }
    )
    const responseTimeMs = Date.now() - guessStartedAt
    let streakAtCompletion = attempt.streakAtCompletion
    let completedAt = attempt.completedAt
    let bestTimeMs = attempt.bestTimeMs
    let shareText = attempt.shareText
    let nextScore = attempt.score
    const nextStatus = result.valid && result.won ? "completed" : attempt.status

    if (result.valid) {
      nextScore = result.score
    }

    if (result.valid && result.won && attempt.status !== "completed") {
      completedAt = new Date().toISOString()
      bestTimeMs = new Date(completedAt).getTime() - new Date(attempt.startedAt).getTime()
      streakAtCompletion = await getPreviousCompletedStreak(client, context.player.id, attempt.date)
      shareText = buildDailyShareText({
        date: attempt.date,
        score: nextScore,
        targetScore: attempt.targetScore,
        durationMs: bestTimeMs,
        streak: streakAtCompletion,
        shareTitle: attempt.themeTitle,
        shareLabel: attempt.themeLabel.toLowerCase(),
        url: `${getSiteUrl()}/daily/${attempt.date}`,
      })
    }

    const updatedAttemptResult = await client.query(
      `
        update daily_attempts
        set
          attempts = attempts + 1,
          guesses_submitted = guesses_submitted + 1,
          score = $2,
          status = $3,
          completed_at = $4,
          best_time_ms = $5,
          streak_at_completion = $6,
          share_text = $7,
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        attempt.id,
        nextScore,
        nextStatus,
        completedAt,
        bestTimeMs,
        streakAtCompletion,
        shareText,
      ]
    )
    attempt = mapAttempt(updatedAttemptResult.rows[0] as never)

    if (result.valid) {
      await client.query(
        `
          insert into accepted_guesses (attempt_id, qid, resolved_name)
          values ($1, $2, $3)
          on conflict (attempt_id, qid) do nothing
        `,
        [attempt.id, result.qid, result.name]
      )
    }

    const guess = await createGuessEvent(client, attempt.id, context.player.id, attempt.date, {
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
      responseTimeMs,
    })

    const response: SubmitGuessResponse = {
      accepted: result.valid,
      message: result.message,
      state: await getAttemptState(client, context.player, attempt),
      guess,
    }

    return {
      ...response,
      sessionToken: context.sessionToken,
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

  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    await assertPlayerNotRestricted(client, context.player.id)
    const attempt = await getOrCreateAttempt(client, context.player.id, context.sessionId, input.date)
    const updateResult = await client.query<{ share_clicks: number }>(
      `
        update daily_attempts
        set share_clicks = share_clicks + 1, updated_at = now()
        where id = $1
        returning share_clicks
      `,
      [attempt.id]
    )

    await client.query(
      `
        insert into share_events (attempt_id, player_id, destination)
        values ($1, $2, $3)
      `,
      [attempt.id, context.player.id, input.request.destination]
    )

    const response: TrackShareResponse = {
      ok: true,
      shareClicks: updateResult.rows[0].share_clicks,
    }

    return {
      ...response,
      sessionToken: context.sessionToken,
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
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    const [stats, emailAuth, todayEntries, fastest, streaks, history, overview] = await Promise.all([
      computePlayerStats(client, context.player.id),
      getPlayerEmailAuthStatus(client, context.player.id),
      buildLeaderboardPreview(client, input.date),
      buildFastestLeaderboard(client),
      buildStreakLeaderboard(client),
      buildPlayerHistory(client, context.player.id),
      computeOverviewAnalytics(client),
    ])
    const response: LeaderboardSummaryResponse = {
      player: context.player,
      stats,
      emailAuth,
      today: {
        date: input.date,
        entry: todayEntries.find((entry) => entry.playerId === context.player.id) ?? null,
      },
      fastest,
      streaks,
      history,
      overview,
    }

    return {
      ...response,
      sessionToken: context.sessionToken,
      created: context.created,
    }
  })
}

export async function getIdentityStatus(input: {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}) {
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )

    return {
      player: context.player,
      stats: await computePlayerStats(client, context.player.id),
      emailAuth: await getPlayerEmailAuthStatus(client, context.player.id),
      sessionToken: context.sessionToken,
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
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    await assertPlayerNotRestricted(client, context.player.id)
    const normalizedHandle = validatePlayerHandle(input.request.handle)
    const conflictResult = await client.query<{ id: string }>(
      `
        select id
        from players
        where handle = $1 and id <> $2
        limit 1
      `,
      [normalizedHandle, context.player.id]
    )

    if (conflictResult.rows[0]) {
      throw new Error("That handle is already in use.")
    }

    const recoveryCode = createRecoveryCode()
    const recoveryCodeIssuedAt = new Date().toISOString()
    const updatedPlayerResult = await client.query<{
      id: string
      handle: string | null
      is_guest: boolean
      recovery_code_hash: string | null
      created_at: string
      updated_at: string
    }>(
      `
        update players
        set
          handle = $2,
          is_guest = false,
          recovery_code_hash = $3,
          recovery_code_generated_at = $4,
          updated_at = now()
        where id = $1
        returning id, handle, is_guest, recovery_code_hash, created_at, updated_at
      `,
      [
        context.player.id,
        normalizedHandle,
        sha256(normalizeRecoveryCode(recoveryCode)),
        recoveryCodeIssuedAt,
      ]
    )
    const response: ClaimIdentityResponse = {
      player: mapPlayer(updatedPlayerResult.rows[0]),
      recoveryCode,
      recoveryCodeIssuedAt,
    }

    await createIdentityEvent(client, {
      playerId: context.player.id,
      eventType: "claim_identity",
      handle: normalizedHandle,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        recoveryCodeRotated: true,
      },
    })

    return {
      ...response,
      sessionToken: context.sessionToken,
      created: context.created,
    }
  })
}

export async function recoverSession(input: {
  request: { handle: string; recoveryCode: string }
  userAgent: string | null
  ipAddress: string | null
}) {
  return withTransaction(async (client) => {
    const normalizedHandle = validatePlayerHandle(input.request.handle)
    const recoveryCodeHash = sha256(normalizeRecoveryCode(input.request.recoveryCode))
    const playerResult = await client.query<{
      id: string
      handle: string | null
      is_guest: boolean
      recovery_code_hash: string | null
      created_at: string
      updated_at: string
    }>(
      `
        select id, handle, is_guest, recovery_code_hash, created_at, updated_at
        from players
        where handle = $1 and recovery_code_hash = $2
        limit 1
      `,
      [normalizedHandle, recoveryCodeHash]
    )

    if (!playerResult.rows[0]) {
      await createIdentityEvent(client, {
        playerId: null,
        eventType: "failed_recovery",
        handle: normalizedHandle,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })
      throw new Error("Invalid handle or recovery code.")
    }

    await assertPlayerNotRestricted(client, playerResult.rows[0].id)

    const sessionToken = randomUUID()
    const sessionResult = await client.query<{ id: string }>(
      `
        insert into player_sessions (player_id, anonymous_token_hash, user_agent, ip_hash)
        values ($1, $2, $3, $4)
        returning id
      `,
      [
        playerResult.rows[0].id,
        sha256(sessionToken),
        input.userAgent,
        input.ipAddress ? sha256(input.ipAddress) : null,
      ]
    )
    const response: RecoverSessionResponse = {
      player: mapPlayer(playerResult.rows[0]),
      sessionId: sessionResult.rows[0].id,
      stats: await computePlayerStats(client, playerResult.rows[0].id),
    }

    await createIdentityEvent(client, {
      playerId: playerResult.rows[0].id,
      eventType: "recover_session",
      handle: playerResult.rows[0].handle,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })

    return {
      ...response,
      sessionToken,
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
  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    await assertPlayerNotRestricted(client, context.player.id)
    const normalizedEmail = validateEmailAddress(input.request.email)
    const existingEmailResult = await client.query<{
      id: string
      handle: string | null
    }>(
      `
        select id, handle
        from players
        where lower(email) = lower($1)
        limit 1
      `,
      [normalizedEmail]
    )
    const targetPlayerId = existingEmailResult.rows[0]?.id ?? context.player.id
    await assertPlayerNotRestricted(client, targetPlayerId)
    const targetHandle = existingEmailResult.rows[0]?.handle ?? context.player.handle
    const mode: "link" | "login" = existingEmailResult.rows[0] ? "login" : "link"

    if (!existingEmailResult.rows[0]) {
      await client.query(
        `
          update players
          set email = $2, email_verified_at = null, updated_at = now()
          where id = $1
        `,
        [context.player.id, normalizedEmail]
      )
    }

    const rawToken = createMagicLinkToken()
    const expiresAtDate = new Date(Date.now() + getMagicLinkTtlMinutes() * 60 * 1000)
    const expiresAt = expiresAtDate.toISOString()
    const tokenInsertResult = await client.query<{ id: string }>(
      `
        insert into email_magic_link_tokens (player_id, email, token_hash, mode, expires_at)
        values ($1, $2, $3, $4, $5)
        returning id
      `,
      [targetPlayerId, normalizedEmail, hashMagicLinkToken(rawToken), mode, expiresAt]
    )
    const tokenId = tokenInsertResult.rows[0].id

    const magicLinkUrl = `${getSiteUrl()}/api/session/email/verify?token=${rawToken}`
    const delivery = await deliverMagicLink({
      email: normalizedEmail,
      magicLinkUrl,
      tokenId,
      playerId: targetPlayerId,
      mode,
      handle: targetHandle,
    })
    await createMagicLinkDeliveryEvent(client, {
      tokenId,
      playerId: targetPlayerId,
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
      sessionToken: context.sessionToken,
      created: context.created,
    }
  })
}

export async function verifyMagicLink(input: {
  token: string
  userAgent: string | null
  ipAddress: string | null
}) {
  return withTransaction(async (client) => {
    const tokenHash = hashMagicLinkToken(input.token)
    const tokenResult = await client.query<{
      id: string
      player_id: string
      email: string
      mode: "link" | "login"
      expires_at: string
      consumed_at: string | null
    }>(
      `
        select id, player_id, email, mode, expires_at, consumed_at
        from email_magic_link_tokens
        where token_hash = $1
        limit 1
      `,
      [tokenHash]
    )
    const tokenRow = tokenResult.rows[0]

    if (!tokenRow || tokenRow.consumed_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
      throw new Error("Magic link is invalid or expired.")
    }

    await assertPlayerNotRestricted(client, tokenRow.player_id)

    await client.query(
      `
        update email_magic_link_tokens
        set consumed_at = now()
        where id = $1
      `,
      [tokenRow.id]
    )
    await client.query(
      `
        update players
        set email = $2, email_verified_at = now(), updated_at = now()
        where id = $1
      `,
      [tokenRow.player_id, tokenRow.email]
    )

    const sessionToken = randomUUID()
    const sessionResult = await client.query<{ id: string }>(
      `
        insert into player_sessions (player_id, anonymous_token_hash, user_agent, ip_hash)
        values ($1, $2, $3, $4)
        returning id
      `,
      [
        tokenRow.player_id,
        sha256(sessionToken),
        input.userAgent,
        input.ipAddress ? sha256(input.ipAddress) : null,
      ]
    )
    const playerResult = await client.query<{
      id: string
      handle: string | null
      is_guest: boolean
      recovery_code_hash: string | null
      created_at: string
      updated_at: string
    }>(
      `
        select id, handle, is_guest, recovery_code_hash, created_at, updated_at
        from players
        where id = $1
        limit 1
      `,
      [tokenRow.player_id]
    )
    const response: VerifyMagicLinkResponse = {
      player: mapPlayer(playerResult.rows[0]),
      sessionId: sessionResult.rows[0].id,
      stats: await computePlayerStats(client, tokenRow.player_id),
      mode: tokenRow.mode,
    }

    return {
      ...response,
      sessionToken,
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

async function recordCleanupRun(
  client: PoolClient,
  input: {
    cleanupInput: RunRetentionCleanupInput
    result: RunRetentionCleanupResult
  }
) {
  await client.query(
    `
      insert into operations_job_runs (
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        dry_run,
        driver,
        deleted_magic_link_tokens,
        deleted_delivery_events,
        deleted_operational_reports,
        remaining_magic_link_tokens,
        remaining_delivery_events,
        remaining_operational_reports,
        magic_link_retention_days,
        delivery_event_retention_days,
        operational_report_retention_days,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `,
    [
      "retention_cleanup",
      input.cleanupInput.source ?? "unknown",
      input.cleanupInput.reason ?? null,
      input.cleanupInput.requestedBy ?? null,
      input.cleanupInput.requestId ?? null,
      input.result.dryRun,
      input.result.driver,
      input.result.deleted.magicLinkTokens,
      input.result.deleted.deliveryEvents,
      input.result.deleted.operationalReports,
      input.result.remaining.magicLinkTokens,
      input.result.remaining.deliveryEvents,
      input.result.remaining.operationalReports,
      input.result.retention.magicLinkDays,
      input.result.retention.deliveryEventDays,
      input.result.retention.operationalReportDays,
      input.result.generatedAt,
    ]
  )
}

async function recordLeaderboardRecomputeRun(
  client: PoolClient,
  input: {
    recomputeInput: RecomputeLeaderboardSnapshotsInput
    result: RecomputeLeaderboardSnapshotsResult
  }
) {
  await client.query(
    `
      insert into operations_job_runs (
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        dry_run,
        driver,
        deleted_magic_link_tokens,
        deleted_delivery_events,
        remaining_magic_link_tokens,
        remaining_delivery_events,
        magic_link_retention_days,
        delivery_event_retention_days,
        recompute_dates,
        recompute_total_dates,
        snapshot_deleted_rows,
        snapshot_inserted_rows,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, 0, 0, 0, $8::jsonb, $9, $10, $11, $12)
    `,
    [
      "leaderboard_recompute",
      input.recomputeInput.source ?? "unknown",
      input.recomputeInput.reason ?? null,
      input.recomputeInput.requestedBy ?? null,
      input.recomputeInput.requestId ?? null,
      input.result.dryRun,
      input.result.driver,
      JSON.stringify(input.result.dates),
      input.result.totalDates,
      input.result.snapshots.deletedRows,
      input.result.snapshots.insertedRows,
      input.result.generatedAt,
    ]
  )
}

async function recordReadinessProbeRun(
  client: PoolClient,
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
  const result = await client.query<{
    id: string
    job_type: "readiness_probe"
    source: AdminReadinessProbeRun["source"]
    reason: string | null
    requested_by: string | null
    request_id: string | null
    driver: string
    readiness_ok: boolean | null
    readiness_failed_checks: number | null
    readiness_warning_checks: number | null
    readiness_checks:
      | Array<{
          name: string
          ok: boolean
          severity: "info" | "warn" | "error"
          message: string
        }>
      | null
    created_at: string
  }>(
    `
      insert into operations_job_runs (
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        dry_run,
        driver,
        deleted_magic_link_tokens,
        deleted_delivery_events,
        remaining_magic_link_tokens,
        remaining_delivery_events,
        magic_link_retention_days,
        delivery_event_retention_days,
        readiness_ok,
        readiness_failed_checks,
        readiness_warning_checks,
        readiness_checks,
        created_at
      )
      values ($1, $2, $3, $4, $5, false, $6, 0, 0, 0, 0, 0, 0, $7, $8, $9, $10::jsonb, $11)
      returning
        id,
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        driver,
        readiness_ok,
        readiness_failed_checks,
        readiness_warning_checks,
        readiness_checks,
        created_at
    `,
    [
      "readiness_probe",
      input.readinessInput.source ?? "unknown",
      input.readinessInput.reason ?? null,
      input.readinessInput.requestedBy ?? null,
      input.readinessInput.requestId ?? null,
      input.driver,
      input.readinessInput.readiness.ok,
      input.readinessInput.readiness.summary.failedChecks,
      input.readinessInput.readiness.summary.warningChecks,
      JSON.stringify(input.readinessInput.readiness.checks),
      input.generatedAt,
    ]
  )

  const row = result.rows[0]

  return {
    id: row.id,
    jobType: row.job_type,
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    driver: row.driver,
    ok: row.readiness_ok ?? false,
    failedChecks: row.readiness_failed_checks ?? 0,
    warningChecks: row.readiness_warning_checks ?? 0,
    checks: row.readiness_checks ?? [],
    createdAt: row.created_at,
  } satisfies AdminReadinessProbeRun
}

async function recordOperationalAlertRun(
  client: PoolClient,
  input: {
    alertInput: RecordOperationalAlertInput
    generatedAt: string
    driver: string
  }
) {
  const result = await client.query<{
    id: string
    job_type: "operational_alert"
    source: AdminOperationalAlertRun["source"]
    requested_by: string | null
    request_id: string | null
    driver: string
    alert_event: string | null
    alert_severity: "warn" | "error" | null
    alert_message: string | null
    alert_metadata: Record<string, unknown> | null
    alert_dedup_key: string | null
    alert_dispatch_status: "sent" | "suppressed" | "failed" | null
    alert_suppression_reason:
      | "webhook_unconfigured"
      | "below_threshold"
      | "deduplicated"
      | null
    alert_error_message: string | null
    created_at: string
  }>(
    `
      insert into operations_job_runs (
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        dry_run,
        driver,
        deleted_magic_link_tokens,
        deleted_delivery_events,
        remaining_magic_link_tokens,
        remaining_delivery_events,
        magic_link_retention_days,
        delivery_event_retention_days,
        alert_event,
        alert_severity,
        alert_message,
        alert_metadata,
        alert_dedup_key,
        alert_dispatch_status,
        alert_suppression_reason,
        alert_error_message,
        created_at
      )
      values (
        $1, $2, null, $3, $4, false, $5, 0, 0, 0, 0, 0, 0, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14
      )
      returning
        id,
        job_type,
        source,
        requested_by,
        request_id,
        driver,
        alert_event,
        alert_severity,
        alert_message,
        alert_metadata,
        alert_dedup_key,
        alert_dispatch_status,
        alert_suppression_reason,
        alert_error_message,
        created_at
    `,
    [
      "operational_alert",
      input.alertInput.source ?? "api",
      input.alertInput.route ?? null,
      input.alertInput.requestId ?? null,
      input.driver,
      input.alertInput.event,
      input.alertInput.severity,
      input.alertInput.message,
      JSON.stringify(input.alertInput.metadata ?? {}),
      input.alertInput.dedupKey ?? null,
      input.alertInput.dispatchStatus,
      input.alertInput.suppressionReason ?? null,
      input.alertInput.errorMessage ?? null,
      input.generatedAt,
    ]
  )

  const row = result.rows[0]

  return {
    id: row.id,
    jobType: row.job_type,
    source: row.source,
    requestId: row.request_id,
    route: row.requested_by,
    driver: row.driver,
    event: row.alert_event ?? "unknown",
    severity: row.alert_severity ?? "warn",
    message: row.alert_message ?? "",
    metadata: row.alert_metadata ?? {},
    dedupKey: row.alert_dedup_key,
    dispatchStatus: row.alert_dispatch_status ?? "suppressed",
    suppressionReason: row.alert_suppression_reason,
    errorMessage: row.alert_error_message,
    createdAt: row.created_at,
  } satisfies AdminOperationalAlertRun
}

async function recordOperationalReportRun(
  client: PoolClient,
  input: {
    reportInput: RecordOperationalReportInput
    generatedAt: string
    driver: string
  }
) {
  const result = await client.query<{
    id: string
    job_type: "operational_report"
    source: AdminOperationalReportRun["source"]
    reason: string | null
    requested_by: string | null
    request_id: string | null
    driver: string
    report_type: "daily_report" | "incident_triage" | null
    report_summary: Record<string, unknown> | null
    report_actions: string[] | null
    report_timeline:
      | Array<{
          at: string
          category: "operational_alert" | "readiness_probe" | "retention_cleanup" | "leaderboard_recompute" | "abuse_restriction"
          title: string
          detail: string
          severity: "warn" | "error" | null
        }>
      | null
    created_at: string
  }>(
    `
      insert into operations_job_runs (
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        dry_run,
        driver,
        deleted_magic_link_tokens,
        deleted_delivery_events,
        remaining_magic_link_tokens,
        remaining_delivery_events,
        magic_link_retention_days,
        delivery_event_retention_days,
        report_type,
        report_summary,
        report_actions,
        report_timeline,
        created_at
      )
      values (
        $1, $2, $3, $4, $5, false, $6, 0, 0, 0, 0, 0, 0, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11
      )
      returning
        id,
        job_type,
        source,
        reason,
        requested_by,
        request_id,
        driver,
        report_type,
        report_summary,
        report_actions,
        report_timeline,
        created_at
    `,
    [
      "operational_report",
      input.reportInput.source ?? "api",
      input.reportInput.reason ?? null,
      input.reportInput.requestedBy ?? null,
      input.reportInput.requestId ?? null,
      input.driver,
      input.reportInput.reportType,
      JSON.stringify(input.reportInput.summary),
      JSON.stringify(input.reportInput.actions),
      JSON.stringify(input.reportInput.timeline),
      input.generatedAt,
    ]
  )

  const row = result.rows[0]

  return {
    id: row.id,
    jobType: row.job_type,
    reportType: row.report_type ?? "daily_report",
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    driver: row.driver,
    summary: row.report_summary ?? {},
    actions: row.report_actions ?? [],
    timeline: row.report_timeline ?? [],
    createdAt: row.created_at,
  } satisfies AdminOperationalReportRun
}

export async function getAdminAudit(input: GetAdminAuditInput) {
  const pool = getPool()
  const identityWhereParts: string[] = []
  const identityWhereValues: string[] = []

  if (input.identity.eventType) {
    identityWhereParts.push(`event_type = $${identityWhereValues.length + 1}`)
    identityWhereValues.push(input.identity.eventType)
  }

  if (input.identity.handle) {
    identityWhereParts.push(`coalesce(handle, '') ilike $${identityWhereValues.length + 1}`)
    identityWhereValues.push(`%${input.identity.handle}%`)
  }

  const magicWhereParts: string[] = []
  const magicWhereValues: string[] = []

  if (input.magicLinks.mode) {
    magicWhereParts.push(`mode = $${magicWhereValues.length + 1}`)
    magicWhereValues.push(input.magicLinks.mode)
  }

  if (input.magicLinks.email) {
    magicWhereParts.push(`email ilike $${magicWhereValues.length + 1}`)
    magicWhereValues.push(`%${input.magicLinks.email}%`)
  }

  const identityWhereSql =
    identityWhereParts.length > 0 ? `where ${identityWhereParts.join(" and ")}` : ""
  const magicWhereSql = magicWhereParts.length > 0 ? `where ${magicWhereParts.join(" and ")}` : ""
  const [
    totalsResult,
    identityCountResult,
    identityEventsResult,
    magicCountResult,
    magicLinksResult,
    suspiciousAcceptedGuessBurstsResult,
    suspiciousInvalidGuessBurstsResult,
    suspiciousFailedRecoveriesResult,
    operationalAlertsResult,
    operationalReportsCountResult,
    operationalReportsResult,
    recentOperationalReportsResult,
    incidentHistoryCountResult,
    incidentHistoryResult,
    readinessProbeRunsResult,
    cleanupRunsResult,
    leaderboardRecomputeRunsResult,
    abuseRestrictionsResult,
  ] = await Promise.all([
    pool.query<{
      players: string
      claimed_players: string
      verified_emails: string
      active_sessions_7d: string
      failed_recoveries_24h: string
      total_magic_links: string
      pending_magic_links: string
      delivered_magic_links: string
      failed_magic_links: string
      bounced_magic_links: string
      complained_magic_links: string
      consumed_magic_links: string
      expired_unconsumed_magic_links: string
    }>(`
      with latest_delivery_events as (
        select distinct on (token_id)
          token_id,
          status
        from email_delivery_events
        order by token_id, updated_at desc, created_at desc
      )
      select
        (select count(*) from players)::text as players,
        (select count(*) from players where is_guest = false)::text as claimed_players,
        (select count(*) from players where email_verified_at is not null)::text as verified_emails,
        (select count(*) from player_sessions where last_seen_at >= now() - interval '7 days')::text as active_sessions_7d,
        (
          select count(*)
          from player_identity_events
          where event_type = 'failed_recovery'
            and created_at >= now() - interval '24 hours'
        )::text as failed_recoveries_24h,
        (select count(*) from email_magic_link_tokens)::text as total_magic_links,
        (
          select count(*)
          from email_magic_link_tokens emlt
          left join latest_delivery_events lde on lde.token_id = emlt.id
          where emlt.consumed_at is null
            and emlt.expires_at >= now()
            and (lde.status is null or lde.status in ('generated', 'queued'))
        )::text as pending_magic_links,
        (select count(*) from latest_delivery_events where status = 'delivered')::text as delivered_magic_links,
        (select count(*) from latest_delivery_events where status = 'failed')::text as failed_magic_links,
        (select count(*) from latest_delivery_events where status = 'bounced')::text as bounced_magic_links,
        (select count(*) from latest_delivery_events where status = 'complained')::text as complained_magic_links,
        (select count(*) from email_magic_link_tokens where consumed_at is not null)::text as consumed_magic_links,
        (
          select count(*)
          from email_magic_link_tokens
          where consumed_at is null
            and expires_at < now()
        )::text as expired_unconsumed_magic_links
    `),
    pool.query<{ total: string }>(
      `
        select count(*)::text as total
        from player_identity_events
        ${identityWhereSql}
      `,
      identityWhereValues
    ),
    pool.query<{
      id: string
      player_id: string | null
      event_type: AdminAuditIdentityEvent["eventType"]
      handle: string | null
      created_at: string
      metadata: Record<string, unknown> | null
    }>(
      `
        select id, player_id, event_type, handle, created_at, metadata
        from player_identity_events
        ${identityWhereSql}
        order by created_at desc
        limit $${identityWhereValues.length + 1}
        offset $${identityWhereValues.length + 2}
      `,
      [...identityWhereValues, String(input.identity.limit), String(input.identity.offset)]
    ),
    pool.query<{ total: string }>(
      `
        select count(*)::text as total
        from email_magic_link_tokens
        ${magicWhereSql}
      `,
      magicWhereValues
    ),
    pool.query<{
      id: string
      player_id: string
      email: string
      mode: AdminAuditMagicLink["mode"]
      expires_at: string
      consumed_at: string | null
      created_at: string
      delivery_status: EmailDeliveryStatus | null
      delivery_driver: "log" | "webhook" | null
      delivery_provider_message_id: string | null
      delivery_updated_at: string | null
      delivery_failure_reason: string | null
    }>(
      `
        select
          emlt.id,
          emlt.player_id,
          emlt.email,
          emlt.mode,
          emlt.expires_at,
          emlt.consumed_at,
          emlt.created_at,
          ede.status as delivery_status,
          ede.driver as delivery_driver,
          ede.provider_message_id as delivery_provider_message_id,
          ede.updated_at as delivery_updated_at,
          ede.failure_reason as delivery_failure_reason
        from email_magic_link_tokens emlt
        left join lateral (
          select status, driver, provider_message_id, updated_at, failure_reason
          from email_delivery_events
          where token_id = emlt.id
          order by updated_at desc, created_at desc
          limit 1
        ) ede on true
        ${magicWhereSql}
        order by created_at desc
        limit $${magicWhereValues.length + 1}
        offset $${magicWhereValues.length + 2}
      `,
      [...magicWhereValues, String(input.magicLinks.limit), String(input.magicLinks.offset)]
    ),
    pool.query<{
      player_id: string
      handle: string | null
      burst_count: string
      first_event_at: string
      last_event_at: string
      active_restriction: boolean
    }>(
      `
        with accepted_windows as (
          select
            ge.player_id,
            p.handle,
            count(*) over (
              partition by ge.player_id
              order by ge.created_at
              range between interval '2 seconds' preceding and current row
            ) as burst_count,
            min(ge.created_at) over (
              partition by ge.player_id
              order by ge.created_at
              range between interval '2 seconds' preceding and current row
            ) as first_event_at,
            ge.created_at as last_event_at,
            exists(
              select 1
              from abuse_restrictions ar
              where ar.target_type = 'player'
                and ar.target_value = ge.player_id
                and ar.lifted_at is null
            ) as active_restriction
          from guess_events ge
          join players p on p.id = ge.player_id
          where ge.is_accepted = true
            and ge.created_at >= now() - interval '7 days'
        ),
        ranked_windows as (
          select *,
            row_number() over (
              partition by player_id
              order by burst_count desc, last_event_at desc
            ) as row_num
          from accepted_windows
        )
        select
          player_id,
          handle,
          burst_count::text,
          first_event_at,
          last_event_at,
          active_restriction
        from ranked_windows
        where row_num = 1
          and burst_count >= 6
        order by burst_count desc, last_event_at desc
        limit 8
      `
    ),
    pool.query<{
      player_id: string
      handle: string | null
      burst_count: string
      first_event_at: string
      last_event_at: string
      active_restriction: boolean
    }>(
      `
        with invalid_windows as (
          select
            ge.player_id,
            p.handle,
            count(*) over (
              partition by ge.player_id
              order by ge.created_at
              range between interval '10 minutes' preceding and current row
            ) as burst_count,
            min(ge.created_at) over (
              partition by ge.player_id
              order by ge.created_at
              range between interval '10 minutes' preceding and current row
            ) as first_event_at,
            ge.created_at as last_event_at,
            exists(
              select 1
              from abuse_restrictions ar
              where ar.target_type = 'player'
                and ar.target_value = ge.player_id
                and ar.lifted_at is null
            ) as active_restriction
          from guess_events ge
          join players p on p.id = ge.player_id
          where ge.is_accepted = false
            and ge.created_at >= now() - interval '24 hours'
        ),
        ranked_windows as (
          select *,
            row_number() over (
              partition by player_id
              order by burst_count desc, last_event_at desc
            ) as row_num
          from invalid_windows
        )
        select
          player_id,
          handle,
          burst_count::text,
          first_event_at,
          last_event_at,
          active_restriction
        from ranked_windows
        where row_num = 1
          and burst_count >= 12
        order by burst_count desc, last_event_at desc
        limit 8
      `
    ),
    pool.query<{
      player_id: string | null
      handle: string | null
      failed_count: string
      first_event_at: string
      last_event_at: string
      active_restriction: boolean
    }>(
      `
        with failed_recoveries as (
          select
            lower(pie.handle) as normalized_handle,
            max(p.id) as player_id,
            max(p.handle) as handle,
            count(*) as failed_count,
            min(pie.created_at) as first_event_at,
            max(pie.created_at) as last_event_at
          from player_identity_events pie
          left join players p on lower(p.handle) = lower(pie.handle)
          where pie.event_type = 'failed_recovery'
            and pie.handle is not null
            and pie.created_at >= now() - interval '24 hours'
          group by lower(pie.handle)
        )
        select
          fr.player_id,
          fr.handle,
          fr.failed_count::text,
          fr.first_event_at,
          fr.last_event_at,
          exists(
            select 1
            from abuse_restrictions ar
            where ar.target_type = 'player'
              and ar.target_value = fr.player_id
              and ar.lifted_at is null
          ) as active_restriction
        from failed_recoveries fr
        where fr.failed_count >= 3
        order by fr.failed_count desc, fr.last_event_at desc
        limit 8
      `
    ),
    pool.query<{
      id: string
      job_type: "operational_alert"
      source: AdminOperationalAlertRun["source"]
      requested_by: string | null
      request_id: string | null
      driver: string
      alert_event: string | null
      alert_severity: "warn" | "error" | null
      alert_message: string | null
      alert_metadata: Record<string, unknown> | null
      alert_dedup_key: string | null
      alert_dispatch_status: "sent" | "suppressed" | "failed" | null
      alert_suppression_reason:
        | "webhook_unconfigured"
        | "below_threshold"
        | "deduplicated"
        | null
      alert_error_message: string | null
      created_at: string
    }>(
      `
        select
          id,
          job_type,
          source,
          requested_by,
          request_id,
          driver,
          alert_event,
          alert_severity,
          alert_message,
          alert_metadata,
          alert_dedup_key,
          alert_dispatch_status,
          alert_suppression_reason,
          alert_error_message,
          created_at
        from operations_job_runs
        where job_type = 'operational_alert'
        order by created_at desc
        limit 250
      `
    ),
    pool.query<{
      total: string
    }>(
      `
        select count(*)::text as total
        from operations_job_runs
        where job_type = 'operational_report'
        ${input.operationalReports.reportType ? "and report_type = $1" : ""}
        ${
          input.operationalReports.sinceDays
            ? `and created_at >= now() - make_interval(days => $${
                input.operationalReports.reportType ? 2 : 1
              })`
            : ""
        }
        ${
          input.operationalReports.search
            ? `and (
                report_type::text ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(reason, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(requested_by, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(report_actions::text, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(report_summary::text, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
              )`
            : ""
        }
      `,
      [
        ...(input.operationalReports.reportType ? [input.operationalReports.reportType] : []),
        ...(input.operationalReports.sinceDays ? [String(input.operationalReports.sinceDays)] : []),
        ...(input.operationalReports.search ? [`%${input.operationalReports.search}%`] : []),
      ]
    ),
    pool.query<{
      id: string
      job_type: "operational_report"
      source: AdminOperationalReportRun["source"]
      reason: string | null
      requested_by: string | null
      request_id: string | null
      driver: string
      report_type: "daily_report" | "incident_triage" | null
      report_summary: Record<string, unknown> | null
      report_actions: string[] | null
      report_timeline:
        | Array<{
            at: string
            category:
              | "operational_alert"
              | "readiness_probe"
              | "retention_cleanup"
              | "leaderboard_recompute"
              | "abuse_restriction"
            title: string
            detail: string
            severity: "warn" | "error" | null
          }>
        | null
      created_at: string
    }>(
      `
        select
          id,
          job_type,
          source,
          reason,
          requested_by,
          request_id,
          driver,
          report_type,
          report_summary,
          report_actions,
          report_timeline,
          created_at
        from operations_job_runs
        where job_type = 'operational_report'
        ${input.operationalReports.reportType ? "and report_type = $1" : ""}
        ${
          input.operationalReports.sinceDays
            ? `and created_at >= now() - make_interval(days => $${
                input.operationalReports.reportType ? 2 : 1
              })`
            : ""
        }
        ${
          input.operationalReports.search
            ? `and (
                report_type::text ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(reason, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(requested_by, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(report_actions::text, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(report_summary::text, '') ilike $${
                  (input.operationalReports.reportType ? 1 : 0) +
                  (input.operationalReports.sinceDays ? 1 : 0) +
                  1
                }
              )`
            : ""
        }
        order by created_at desc
        limit $${
          (input.operationalReports.reportType ? 1 : 0) +
          (input.operationalReports.sinceDays ? 1 : 0) +
          (input.operationalReports.search ? 1 : 0) +
          1
        }
        offset $${
          (input.operationalReports.reportType ? 1 : 0) +
          (input.operationalReports.sinceDays ? 1 : 0) +
          (input.operationalReports.search ? 1 : 0) +
          2
        }
      `,
      [
        ...(input.operationalReports.reportType ? [input.operationalReports.reportType] : []),
        ...(input.operationalReports.sinceDays ? [String(input.operationalReports.sinceDays)] : []),
        ...(input.operationalReports.search ? [`%${input.operationalReports.search}%`] : []),
        String(input.operationalReports.limit),
        String(input.operationalReports.offset),
      ]
    ),
    pool.query<{
      id: string
      job_type: "operational_report"
      source: AdminOperationalReportRun["source"]
      reason: string | null
      requested_by: string | null
      request_id: string | null
      driver: string
      report_type: "daily_report" | "incident_triage" | null
      report_summary: Record<string, unknown> | null
      report_actions: string[] | null
      report_timeline:
        | Array<{
            at: string
            category:
              | "operational_alert"
              | "readiness_probe"
              | "retention_cleanup"
              | "leaderboard_recompute"
              | "abuse_restriction"
            title: string
            detail: string
            severity: "warn" | "error" | null
          }>
        | null
      created_at: string
    }>(
      `
        select
          id,
          job_type,
          source,
          reason,
          requested_by,
          request_id,
          driver,
          report_type,
          report_summary,
          report_actions,
          report_timeline,
          created_at
        from operations_job_runs
        where job_type = 'operational_report'
        order by created_at desc
        limit 25
      `
    ),
    pool.query<{ total: string }>(
      `
        with incident_items as (
          select
            id::text as id,
            case job_type
              when 'operational_alert' then 'operational_alert'
              when 'readiness_probe' then 'readiness_probe'
              when 'retention_cleanup' then 'retention_cleanup'
              when 'leaderboard_recompute' then 'leaderboard_recompute'
            end as category,
            created_at as at,
            source,
            request_id,
            case
              when job_type = 'operational_alert' then concat(coalesce(alert_dispatch_status, 'unknown'), ' ', coalesce(alert_severity, 'warn'), ' alert')
              when job_type = 'readiness_probe' then case when readiness_ok then 'passing readiness probe' else 'failing readiness probe' end
              when job_type = 'retention_cleanup' then case when dry_run then 'cleanup dry run' else 'cleanup applied' end
              when job_type = 'leaderboard_recompute' then case when dry_run then 'leaderboard recompute dry run' else 'leaderboard recompute applied' end
            end as title,
            case
              when job_type = 'operational_alert' then concat(coalesce(alert_event, 'unknown'), ': ', coalesce(alert_message, ''))
              when job_type = 'readiness_probe' then concat(coalesce(readiness_failed_checks, 0), ' failed check(s), ', coalesce(readiness_warning_checks, 0), ' warning check(s).')
              when job_type = 'retention_cleanup' then concat('Deleted ', deleted_magic_link_tokens, ' tokens, ', deleted_delivery_events, ' delivery events, and ', deleted_operational_reports, ' archived ops reports.')
              when job_type = 'leaderboard_recompute' then concat(coalesce(recompute_total_dates, 0), ' date(s), ', coalesce(snapshot_inserted_rows, 0), ' inserted row(s).')
            end as detail,
            case
              when job_type = 'operational_alert' then alert_severity
              when job_type = 'readiness_probe' then case when readiness_ok then 'warn' else 'error' end
              else null
            end as severity
          from operations_job_runs
          where job_type in ('operational_alert', 'readiness_probe', 'retention_cleanup', 'leaderboard_recompute')

          union all

          select
            id::text as id,
            'abuse_restriction' as category,
            coalesce(lifted_at, created_at) as at,
            source,
            request_id,
            case when lifted_at is null then 'abuse restriction active' else 'abuse restriction lifted' end as title,
            concat(target_type, ':', target_value) as detail,
            null as severity
          from abuse_restrictions
        )
        select count(*)::text as total
        from incident_items
        where 1 = 1
        ${input.incidentHistory.category ? "and category = $1" : ""}
        ${
          input.incidentHistory.sinceDays
            ? `and at >= now() - make_interval(days => $${
                input.incidentHistory.category ? 2 : 1
              })`
            : ""
        }
        ${
          input.incidentHistory.search
            ? `and (
                coalesce(title, '') ilike $${
                  (input.incidentHistory.category ? 1 : 0) +
                  (input.incidentHistory.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(detail, '') ilike $${
                  (input.incidentHistory.category ? 1 : 0) +
                  (input.incidentHistory.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(request_id, '') ilike $${
                  (input.incidentHistory.category ? 1 : 0) +
                  (input.incidentHistory.sinceDays ? 1 : 0) +
                  1
                }
              )`
            : ""
        }
      `,
      [
        ...(input.incidentHistory.category ? [input.incidentHistory.category] : []),
        ...(input.incidentHistory.sinceDays ? [String(input.incidentHistory.sinceDays)] : []),
        ...(input.incidentHistory.search ? [`%${input.incidentHistory.search}%`] : []),
      ]
    ),
    pool.query<{
      id: string
      category: AdminIncidentHistoryItem["category"]
      at: string
      source: AdminIncidentHistoryItem["source"]
      request_id: string | null
      title: string
      detail: string
      severity: "warn" | "error" | null
    }>(
      `
        with incident_items as (
          select
            id::text as id,
            case job_type
              when 'operational_alert' then 'operational_alert'
              when 'readiness_probe' then 'readiness_probe'
              when 'retention_cleanup' then 'retention_cleanup'
              when 'leaderboard_recompute' then 'leaderboard_recompute'
            end as category,
            created_at as at,
            source,
            request_id,
            case
              when job_type = 'operational_alert' then concat(coalesce(alert_dispatch_status, 'unknown'), ' ', coalesce(alert_severity, 'warn'), ' alert')
              when job_type = 'readiness_probe' then case when readiness_ok then 'passing readiness probe' else 'failing readiness probe' end
              when job_type = 'retention_cleanup' then case when dry_run then 'cleanup dry run' else 'cleanup applied' end
              when job_type = 'leaderboard_recompute' then case when dry_run then 'leaderboard recompute dry run' else 'leaderboard recompute applied' end
            end as title,
            case
              when job_type = 'operational_alert' then concat(coalesce(alert_event, 'unknown'), ': ', coalesce(alert_message, ''))
              when job_type = 'readiness_probe' then concat(coalesce(readiness_failed_checks, 0), ' failed check(s), ', coalesce(readiness_warning_checks, 0), ' warning check(s).')
              when job_type = 'retention_cleanup' then concat('Deleted ', deleted_magic_link_tokens, ' tokens, ', deleted_delivery_events, ' delivery events, and ', deleted_operational_reports, ' archived ops reports.')
              when job_type = 'leaderboard_recompute' then concat(coalesce(recompute_total_dates, 0), ' date(s), ', coalesce(snapshot_inserted_rows, 0), ' inserted row(s).')
            end as detail,
            case
              when job_type = 'operational_alert' then alert_severity
              when job_type = 'readiness_probe' then case when readiness_ok then 'warn' else 'error' end
              else null
            end as severity
          from operations_job_runs
          where job_type in ('operational_alert', 'readiness_probe', 'retention_cleanup', 'leaderboard_recompute')

          union all

          select
            id::text as id,
            'abuse_restriction' as category,
            coalesce(lifted_at, created_at) as at,
            source,
            request_id,
            case when lifted_at is null then 'abuse restriction active' else 'abuse restriction lifted' end as title,
            concat(target_type, ':', target_value) as detail,
            null as severity
          from abuse_restrictions
        )
        select id, category, at, source, request_id, title, detail, severity
        from incident_items
        where 1 = 1
        ${input.incidentHistory.category ? "and category = $1" : ""}
        ${
          input.incidentHistory.sinceDays
            ? `and at >= now() - make_interval(days => $${
                input.incidentHistory.category ? 2 : 1
              })`
            : ""
        }
        ${
          input.incidentHistory.search
            ? `and (
                coalesce(title, '') ilike $${
                  (input.incidentHistory.category ? 1 : 0) +
                  (input.incidentHistory.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(detail, '') ilike $${
                  (input.incidentHistory.category ? 1 : 0) +
                  (input.incidentHistory.sinceDays ? 1 : 0) +
                  1
                }
                or coalesce(request_id, '') ilike $${
                  (input.incidentHistory.category ? 1 : 0) +
                  (input.incidentHistory.sinceDays ? 1 : 0) +
                  1
                }
              )`
            : ""
        }
        order by at desc
        limit $${
          (input.incidentHistory.category ? 1 : 0) +
          (input.incidentHistory.sinceDays ? 1 : 0) +
          (input.incidentHistory.search ? 1 : 0) +
          1
        }
        offset $${
          (input.incidentHistory.category ? 1 : 0) +
          (input.incidentHistory.sinceDays ? 1 : 0) +
          (input.incidentHistory.search ? 1 : 0) +
          2
        }
      `,
      [
        ...(input.incidentHistory.category ? [input.incidentHistory.category] : []),
        ...(input.incidentHistory.sinceDays ? [String(input.incidentHistory.sinceDays)] : []),
        ...(input.incidentHistory.search ? [`%${input.incidentHistory.search}%`] : []),
        String(input.incidentHistory.limit),
        String(input.incidentHistory.offset),
      ]
    ),
    pool.query<{
      id: string
      job_type: "readiness_probe"
      source: AdminReadinessProbeRun["source"]
      reason: string | null
      requested_by: string | null
      request_id: string | null
      driver: string
      readiness_ok: boolean | null
      readiness_failed_checks: number | null
      readiness_warning_checks: number | null
      readiness_checks:
        | Array<{
            name: string
            ok: boolean
            severity: "info" | "warn" | "error"
            message: string
          }>
        | null
      created_at: string
    }>(
      `
        select
          id,
          job_type,
          source,
          reason,
          requested_by,
          request_id,
          driver,
          readiness_ok,
          readiness_failed_checks,
          readiness_warning_checks,
          readiness_checks,
          created_at
        from operations_job_runs
        where job_type = 'readiness_probe'
        order by created_at desc
        limit 10
      `
    ),
    pool.query<{
      id: string
      job_type: "retention_cleanup"
      source: AdminCleanupRun["source"]
      reason: string | null
      requested_by: string | null
      request_id: string | null
      dry_run: boolean
      driver: string
      deleted_magic_link_tokens: number
      deleted_delivery_events: number
      deleted_operational_reports: number | null
      remaining_magic_link_tokens: number
      remaining_delivery_events: number
      remaining_operational_reports: number | null
      magic_link_retention_days: number
      delivery_event_retention_days: number
      operational_report_retention_days: number | null
      created_at: string
    }>(
      `
        select
          id,
          job_type,
          source,
          reason,
          requested_by,
          request_id,
          dry_run,
          driver,
          deleted_magic_link_tokens,
          deleted_delivery_events,
          deleted_operational_reports,
          remaining_magic_link_tokens,
          remaining_delivery_events,
          remaining_operational_reports,
          magic_link_retention_days,
          delivery_event_retention_days,
          operational_report_retention_days,
          created_at
        from operations_job_runs
        where job_type = 'retention_cleanup'
        order by created_at desc
        limit 10
      `
    ),
    pool.query<{
      id: string
      job_type: "leaderboard_recompute"
      source: AdminLeaderboardRecomputeRun["source"]
      reason: string | null
      requested_by: string | null
      request_id: string | null
      dry_run: boolean
      driver: string
      recompute_dates: string[] | null
      recompute_total_dates: number | null
      snapshot_deleted_rows: number | null
      snapshot_inserted_rows: number | null
      created_at: string
    }>(
      `
        select
          id,
          job_type,
          source,
          reason,
          requested_by,
          request_id,
          dry_run,
          driver,
          recompute_dates,
          recompute_total_dates,
          snapshot_deleted_rows,
          snapshot_inserted_rows,
          created_at
        from operations_job_runs
        where job_type = 'leaderboard_recompute'
        order by created_at desc
        limit 10
      `
    ),
    pool.query<{
      id: string
      target_type: "player"
      target_value: string
      reason: string | null
      source: AdminAbuseRestriction["source"]
      requested_by: string | null
      request_id: string | null
      created_at: string
      lifted_at: string | null
      lifted_reason: string | null
    }>(
      `
        select
          id,
          target_type,
          target_value,
          reason,
          source,
          requested_by,
          request_id,
          created_at,
          lifted_at,
          lifted_reason
        from abuse_restrictions
        order by created_at desc
        limit 10
      `
    ),
  ])
  const totals = totalsResult.rows[0]
  const identityTotal = Number(identityCountResult.rows[0]?.total ?? 0)
  const magicTotal = Number(magicCountResult.rows[0]?.total ?? 0)
  const suspiciousActivityFlags: AdminSuspiciousActivityFlag[] = [
    ...suspiciousAcceptedGuessBurstsResult.rows.map((row) => {
      const eventCount = Number(row.burst_count)

      return {
        id: `accepted_guess_burst:${row.player_id}`,
        signalType: "accepted_guess_burst",
        severity: eventCount >= 8 ? "high" : "medium",
        playerId: row.player_id,
        handle: row.handle,
        summary: `${eventCount} accepted guesses landed within 2 seconds.`,
        detectedAt: row.last_event_at,
        activeRestriction: row.active_restriction,
        evidence: {
          eventCount,
          windowSeconds: 2,
          firstEventAt: row.first_event_at,
          lastEventAt: row.last_event_at,
        },
      } satisfies AdminSuspiciousActivityFlag
    }),
    ...suspiciousInvalidGuessBurstsResult.rows.map((row) => {
      const eventCount = Number(row.burst_count)

      return {
        id: `invalid_guess_burst:${row.player_id}`,
        signalType: "invalid_guess_burst",
        severity: eventCount >= 20 ? "high" : "medium",
        playerId: row.player_id,
        handle: row.handle,
        summary: `${eventCount} rejected guesses were submitted within 10 minutes.`,
        detectedAt: row.last_event_at,
        activeRestriction: row.active_restriction,
        evidence: {
          eventCount,
          windowSeconds: 600,
          firstEventAt: row.first_event_at,
          lastEventAt: row.last_event_at,
        },
      } satisfies AdminSuspiciousActivityFlag
    }),
    ...suspiciousFailedRecoveriesResult.rows.map((row) => {
      const eventCount = Number(row.failed_count)

      return {
        id: `failed_recovery_burst:${row.player_id ?? row.handle ?? row.last_event_at}`,
        signalType: "failed_recovery_burst",
        severity: eventCount >= 6 ? "high" : "medium",
        playerId: row.player_id,
        handle: row.handle,
        summary: `${eventCount} failed recovery attempts targeted the same handle in 24 hours.`,
        detectedAt: row.last_event_at,
        activeRestriction: row.active_restriction,
        evidence: {
          eventCount,
          windowSeconds: 86_400,
          firstEventAt: row.first_event_at,
          lastEventAt: row.last_event_at,
        },
      } satisfies AdminSuspiciousActivityFlag
    }),
  ].sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "high" ? -1 : 1
      }

      return right.detectedAt.localeCompare(left.detectedAt)
    })
  const suspiciousActivityItems = suspiciousActivityFlags.slice(0, 12)
  const recentOperationalAlerts = operationalAlertsResult.rows.slice(0, 10).map((row) => ({
    id: row.id,
    jobType: row.job_type,
    source: row.source,
    requestId: row.request_id,
    route: row.requested_by,
    driver: row.driver,
    event: row.alert_event ?? "unknown",
    severity: row.alert_severity ?? "warn",
    message: row.alert_message ?? "",
    metadata: row.alert_metadata ?? {},
    dedupKey: row.alert_dedup_key,
    dispatchStatus: row.alert_dispatch_status ?? "suppressed",
    suppressionReason: row.alert_suppression_reason,
    errorMessage: row.alert_error_message,
    createdAt: row.created_at,
  }))
  const operationalReportsPageItems = operationalReportsResult.rows.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    reportType: row.report_type ?? "daily_report",
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    driver: row.driver,
    summary: row.report_summary ?? {},
    actions: row.report_actions ?? [],
    timeline: row.report_timeline ?? [],
    createdAt: row.created_at,
  }))
  const recentOperationalReports = recentOperationalReportsResult.rows.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    reportType: row.report_type ?? "daily_report",
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    driver: row.driver,
    summary: row.report_summary ?? {},
    actions: row.report_actions ?? [],
    timeline: row.report_timeline ?? [],
    createdAt: row.created_at,
  }))
  const readinessProbeRuns = readinessProbeRunsResult.rows.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    driver: row.driver,
    ok: row.readiness_ok ?? false,
    failedChecks: row.readiness_failed_checks ?? 0,
    warningChecks: row.readiness_warning_checks ?? 0,
    checks: row.readiness_checks ?? [],
    createdAt: row.created_at,
  }))
  const recentCleanupRuns = cleanupRunsResult.rows.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    dryRun: row.dry_run,
    driver: row.driver,
    deleted: {
      magicLinkTokens: row.deleted_magic_link_tokens,
      deliveryEvents: row.deleted_delivery_events,
      operationalReports: row.deleted_operational_reports ?? 0,
    },
    remaining: {
      magicLinkTokens: row.remaining_magic_link_tokens,
      deliveryEvents: row.remaining_delivery_events,
      operationalReports: row.remaining_operational_reports ?? 0,
    },
    retention: {
      magicLinkDays: row.magic_link_retention_days,
      deliveryEventDays: row.delivery_event_retention_days,
      operationalReportDays: row.operational_report_retention_days ?? 180,
    },
    createdAt: row.created_at,
  }))
  const recentLeaderboardRecomputeRuns = leaderboardRecomputeRunsResult.rows.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    source: row.source,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    dryRun: row.dry_run,
    driver: row.driver,
    dates: row.recompute_dates ?? [],
    totalDates: row.recompute_total_dates ?? 0,
    snapshots: {
      deletedRows: row.snapshot_deleted_rows ?? 0,
      insertedRows: row.snapshot_inserted_rows ?? 0,
    },
    createdAt: row.created_at,
  }))
  const recentAbuseRestrictions = abuseRestrictionsResult.rows.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetValue: row.target_value,
    reason: row.reason,
    source: row.source,
    requestedBy: row.requested_by,
    requestId: row.request_id,
    active: row.lifted_at === null,
    createdAt: row.created_at,
    liftedAt: row.lifted_at,
    liftedReason: row.lifted_reason,
  }))

  return {
    driver: getStoreDriver(),
    generatedAt: new Date().toISOString(),
    totals: {
      players: Number(totals?.players ?? 0),
      claimedPlayers: Number(totals?.claimed_players ?? 0),
      verifiedEmails: Number(totals?.verified_emails ?? 0),
      activeSessions7d: Number(totals?.active_sessions_7d ?? 0),
      failedRecoveries24h: Number(totals?.failed_recoveries_24h ?? 0),
    },
    deliverySummary: {
      totalMagicLinks: Number(totals?.total_magic_links ?? 0),
      pendingMagicLinks: Number(totals?.pending_magic_links ?? 0),
      deliveredMagicLinks: Number(totals?.delivered_magic_links ?? 0),
      failedMagicLinks: Number(totals?.failed_magic_links ?? 0),
      bouncedMagicLinks: Number(totals?.bounced_magic_links ?? 0),
      complainedMagicLinks: Number(totals?.complained_magic_links ?? 0),
      consumedMagicLinks: Number(totals?.consumed_magic_links ?? 0),
      expiredUnconsumedMagicLinks: Number(totals?.expired_unconsumed_magic_links ?? 0),
    },
    identityEvents: buildAdminAuditPage({
      items: identityEventsResult.rows.map((row) => ({
        id: row.id,
        playerId: row.player_id,
        eventType: row.event_type,
        handle: row.handle,
        createdAt: row.created_at,
        metadata: row.metadata ?? {},
      })),
      limit: input.identity.limit,
      offset: input.identity.offset,
      total: identityTotal,
      filters: {
        eventType: input.identity.eventType,
        handle: input.identity.handle,
      },
    }),
    magicLinks: buildAdminAuditPage({
      items: magicLinksResult.rows.map((row) => ({
        id: row.id,
        playerId: row.player_id,
        email: row.email,
        mode: row.mode,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        createdAt: row.created_at,
        delivery: {
          status: row.delivery_status,
          driver: row.delivery_driver,
          providerMessageId: row.delivery_provider_message_id,
          lastEventAt: row.delivery_updated_at,
          failureReason: row.delivery_failure_reason,
        },
      })),
      limit: input.magicLinks.limit,
      offset: input.magicLinks.offset,
      total: magicTotal,
      filters: {
        mode: input.magicLinks.mode,
        email: input.magicLinks.email,
      },
    }),
    suspiciousActivity: {
      totalFlags: suspiciousActivityFlags.length,
      activeRestrictionsOnFlaggedPlayers: suspiciousActivityFlags.filter(
        (item) => item.activeRestriction
      ).length,
      items: suspiciousActivityItems,
    },
    operationalAlertSummary: summarizeOperationalAlertRuns(
      operationalAlertsResult.rows.map((row) => ({
        event: row.alert_event ?? "unknown",
        severity: row.alert_severity ?? "warn",
        dispatchStatus: row.alert_dispatch_status ?? "suppressed",
        createdAt: row.created_at,
      }))
    ),
    recentOperationalAlerts,
    operationalReports: buildAdminAuditPage({
      items: operationalReportsPageItems,
      limit: input.operationalReports.limit,
      offset: input.operationalReports.offset,
      total: Number(operationalReportsCountResult.rows[0]?.total ?? 0),
      filters: {
        reportType: input.operationalReports.reportType,
        sinceDays: input.operationalReports.sinceDays,
        search: input.operationalReports.search,
      },
    }),
    incidentHistory: buildAdminAuditPage({
      items: incidentHistoryResult.rows.map((row) => ({
        id: row.id,
        category: row.category,
        at: row.at,
        source: row.source,
        title: row.title,
        detail: row.detail,
        severity: row.severity,
        requestId: row.request_id,
      })),
      limit: input.incidentHistory.limit,
      offset: input.incidentHistory.offset,
      total: Number(incidentHistoryCountResult.rows[0]?.total ?? 0),
      filters: {
        category: input.incidentHistory.category,
        sinceDays: input.incidentHistory.sinceDays,
        search: input.incidentHistory.search,
      },
    }),
    readinessProbeSummary: summarizeReadinessProbeRuns(readinessProbeRuns),
    recurringJobFreshnessSummary: buildRecurringJobFreshnessSummary({
      readinessProbeRuns,
      cleanupRuns: recentCleanupRuns,
      operationalReports: recentOperationalReports,
    }),
    recentReadinessProbeRuns: readinessProbeRuns,
    recentCleanupRuns,
    recentLeaderboardRecomputeRuns,
    recentAbuseRestrictions,
  }
}

export async function recordEmailDeliveryEvent(input: RecordEmailDeliveryEventInput) {
  return withTransaction<RecordEmailDeliveryEventResult>(async (client) => {
    const tokenResult = await client.query<{
      id: string
      player_id: string
      email: string
      mode: "link" | "login"
      driver: "log" | "webhook" | null
      provider_message_id: string | null
    }>(
      `
        select
          emlt.id,
          emlt.player_id,
          emlt.email,
          emlt.mode,
          ede.driver,
          ede.provider_message_id
        from email_magic_link_tokens emlt
        left join lateral (
          select driver, provider_message_id
          from email_delivery_events
          where token_id = emlt.id
          order by updated_at desc, created_at desc
          limit 1
        ) ede on true
        where ($1::uuid is not null and emlt.id = $1::uuid)
           or ($2::varchar is not null and ede.provider_message_id = $2)
        limit 1
      `,
      [input.tokenId, input.providerMessageId]
    )
    const token = tokenResult.rows[0]

    if (!token) {
      return {
        ok: true,
        matched: false,
        deduplicated: false,
        eventId: null,
        tokenId: input.tokenId,
      } satisfies RecordEmailDeliveryEventResult
    }

    const duplicateCandidateResult = await client.query<{
      id: string
      status: Exclude<EmailDeliveryStatus, "generated">
      provider_message_id: string | null
      provider_event_id: string | null
      updated_at: string
      failure_reason: string | null
    }>(
      `
        select id, status, provider_message_id, provider_event_id, updated_at, failure_reason
        from email_delivery_events
        where token_id = $1
        order by updated_at desc, created_at desc
      `,
      [token.id]
    )
    const duplicateEvent = duplicateCandidateResult.rows.find((event) =>
      isDuplicateEmailDeliveryEventCandidate(
        {
          tokenId: token.id,
          eventType: event.status,
          providerMessageId: event.provider_message_id,
          providerEventId: event.provider_event_id,
          occurredAt: event.updated_at,
          failureReason: event.failure_reason,
        },
        {
          tokenId: token.id,
          eventType: input.eventType,
          providerMessageId: input.providerMessageId ?? token.provider_message_id,
          providerEventId: input.providerEventId,
          occurredAt: input.occurredAt,
          failureReason: input.failureReason,
        }
      )
    )

    if (duplicateEvent) {
      return {
        ok: true,
        matched: true,
        deduplicated: true,
        eventId: duplicateEvent.id,
        tokenId: token.id,
      } satisfies RecordEmailDeliveryEventResult
    }

    const eventId = await createMagicLinkDeliveryEvent(client, {
      tokenId: token.id,
      playerId: token.player_id,
      email: token.email,
      mode: token.mode,
      driver: token.driver ?? "webhook",
      status: input.eventType,
      providerMessageId: input.providerMessageId ?? token.provider_message_id,
      providerEventId: input.providerEventId,
      failureReason: input.failureReason,
      payload: input.payload,
      occurredAt: input.occurredAt,
    })

    return {
      ok: true,
      matched: true,
      deduplicated: false,
      eventId,
      tokenId: token.id,
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
  return withTransaction<RecordReadinessProbeResult>(async (client) => {
    const generatedAt = new Date().toISOString()
    const run = await recordReadinessProbeRun(client, {
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
  return withTransaction<RecordOperationalAlertResult>(async (client) => {
    const generatedAt = new Date().toISOString()
    const alert = await recordOperationalAlertRun(client, {
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
  return withTransaction<RecordOperationalReportResult>(async (client) => {
    const generatedAt = new Date().toISOString()
    const report = await recordOperationalReportRun(client, {
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
  return withTransaction<RunRetentionCleanupResult>(async (client) => {
    const magicLinkRetentionDays = getMagicLinkRetentionDays()
    const deliveryEventRetentionDays = getEmailDeliveryEventRetentionDays()
    const operationalReportRetentionDays = getOperationalReportRetentionDays()
    const staleTokensResult = await client.query<{ id: string }>(
      `
        select id
        from email_magic_link_tokens
        where expires_at < now() - make_interval(days => $1)
      `,
      [magicLinkRetentionDays]
    )
    const tokenIdsToDelete = staleTokensResult.rows.map((row) => row.id)
    const tokenIdsSqlArray = tokenIdsToDelete.length > 0 ? tokenIdsToDelete : []
    const deliveryCountsResult = await client.query<{
      cascaded_delivery_events: string
      stale_delivery_events: string
      remaining_magic_link_tokens: string
      remaining_delivery_events: string
      stale_operational_reports: string
      remaining_operational_reports: string
    }>(
      `
        select
          (
            select count(*)
            from email_delivery_events
            where token_id = any($1::uuid[])
          )::text as cascaded_delivery_events,
          (
            select count(*)
            from email_delivery_events
            where updated_at < now() - make_interval(days => $2)
              and not (token_id = any($1::uuid[]))
          )::text as stale_delivery_events,
          (
            select count(*)
            from email_magic_link_tokens
          )::text as remaining_magic_link_tokens,
          (
            select count(*)
            from email_delivery_events
          )::text as remaining_delivery_events
          ,
          (
            select count(*)
            from operations_job_runs
            where job_type = 'operational_report'
              and created_at < now() - make_interval(days => $3)
          )::text as stale_operational_reports,
          (
            select count(*)
            from operations_job_runs
            where job_type = 'operational_report'
          )::text as remaining_operational_reports
      `,
      [tokenIdsSqlArray, deliveryEventRetentionDays, operationalReportRetentionDays]
    )
    const counts = deliveryCountsResult.rows[0]
    const deleted = {
      magicLinkTokens: tokenIdsToDelete.length,
      deliveryEvents:
        Number(counts?.cascaded_delivery_events ?? 0) +
        Number(counts?.stale_delivery_events ?? 0),
      operationalReports: Number(counts?.stale_operational_reports ?? 0),
    }

    if (!input.dryRun) {
      await client.query(
        `
          delete from email_delivery_events
          where updated_at < now() - make_interval(days => $1)
            and not (token_id = any($2::uuid[]))
        `,
        [deliveryEventRetentionDays, tokenIdsSqlArray]
      )
      await client.query(
        `
          delete from email_magic_link_tokens
          where id = any($1::uuid[])
        `,
        [tokenIdsSqlArray]
      )
      await client.query(
        `
          delete from operations_job_runs
          where job_type = 'operational_report'
            and created_at < now() - make_interval(days => $1)
        `,
        [operationalReportRetentionDays]
      )
    }

    const remaining = {
      magicLinkTokens: input.dryRun
        ? Number(counts?.remaining_magic_link_tokens ?? 0) - deleted.magicLinkTokens
        : Number(
            (
              await client.query<{ count: string }>("select count(*)::text as count from email_magic_link_tokens")
            ).rows[0]?.count ?? 0
          ),
      deliveryEvents: input.dryRun
        ? Number(counts?.remaining_delivery_events ?? 0) - deleted.deliveryEvents
        : Number(
            (
              await client.query<{ count: string }>("select count(*)::text as count from email_delivery_events")
            ).rows[0]?.count ?? 0
          ),
      operationalReports: input.dryRun
        ? Number(counts?.remaining_operational_reports ?? 0) - deleted.operationalReports
        : Number(
            (
              await client.query<{
                count: string
              }>(
                "select count(*)::text as count from operations_job_runs where job_type = 'operational_report'"
              )
            ).rows[0]?.count ?? 0
          ),
    }

    const result = {
      ok: true,
      driver: getStoreDriver(),
      dryRun: input.dryRun,
      generatedAt: new Date().toISOString(),
      retention: {
        magicLinkDays: magicLinkRetentionDays,
        deliveryEventDays: deliveryEventRetentionDays,
        operationalReportDays: operationalReportRetentionDays,
      },
      deleted,
      remaining,
    } satisfies RunRetentionCleanupResult

    await recordCleanupRun(client, {
      cleanupInput: input,
      result,
    })

    return result
  })
}

function buildRecomputeDates(input: RecomputeLeaderboardSnapshotsInput) {
  const anchorDate = input.date ?? new Date().toISOString().slice(0, 10)
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
  return withTransaction<RecomputeLeaderboardSnapshotsResult>(async (client) => {
    const dates = buildRecomputeDates(input)
    let deletedRows = 0
    let insertedRows = 0
    const generatedAt = new Date().toISOString()

    for (const date of dates) {
      const existingCountResult = await client.query<{ count: string }>(
        `
          select count(*)::text as count
          from daily_leaderboard_snapshots
          where date = $1 and leaderboard_type = 'daily'
        `,
        [date]
      )
      const existingRows = Number(existingCountResult.rows[0]?.count ?? 0)
      const insertableRowsResult = await client.query<{ count: string }>(
        `
          with ranked_attempts as (
            select
              da.id,
              row_number() over (
                order by da.best_time_ms asc nulls last, da.completed_at asc nulls last
              ) as rank
            from daily_attempts da
            where da.date = $1
              and da.status = 'completed'
          )
          select count(*)::text as count
          from ranked_attempts
          where rank <= 10
        `,
        [date]
      )

      deletedRows += existingRows
      insertedRows += Number(insertableRowsResult.rows[0]?.count ?? 0)

      if (!input.dryRun) {
        await client.query(
          `
            delete from daily_leaderboard_snapshots
            where date = $1 and leaderboard_type = 'daily'
          `,
          [date]
        )
        await client.query(
          `
            insert into daily_leaderboard_snapshots (
              date,
              leaderboard_type,
              rank,
              player_id,
              attempt_id,
              score,
              target_score,
              completion_time_ms,
              streak_at_completion,
              computed_at
            )
            with ranked_attempts as (
              select
                da.id as attempt_id,
                da.player_id,
                da.date,
                da.score,
                da.target_score,
                da.best_time_ms,
                da.streak_at_completion,
                row_number() over (
                  order by da.best_time_ms asc nulls last, da.completed_at asc nulls last
                ) as rank
              from daily_attempts da
              where da.date = $1
                and da.status = 'completed'
            )
            select
              date,
              'daily',
              rank,
              player_id,
              attempt_id,
              score,
              target_score,
              best_time_ms,
              streak_at_completion,
              $2
            from ranked_attempts
            where rank <= 10
            order by rank asc
          `,
          [date, generatedAt]
        )
      }
    }

    const result = {
      ok: true,
      driver: getStoreDriver(),
      dryRun: input.dryRun,
      generatedAt,
      dates,
      totalDates: dates.length,
      snapshots: {
        deletedRows,
        insertedRows,
      },
    } satisfies RecomputeLeaderboardSnapshotsResult

    await recordLeaderboardRecomputeRun(client, {
      recomputeInput: input,
      result,
    })

    return result
  })
}

export async function setAbuseRestriction(input: SetAbuseRestrictionInput) {
  return withTransaction<SetAbuseRestrictionResult>(async (client) => {
    let row:
      | {
          id: string
          target_type: "player"
          target_value: string
          reason: string | null
          source: AdminAbuseRestriction["source"]
          requested_by: string | null
          request_id: string | null
          created_at: string
          lifted_at: string | null
          lifted_reason: string | null
        }
      | undefined

    if (input.action === "activate") {
      row = (
        await client.query<{
          id: string
          target_type: "player"
          target_value: string
          reason: string | null
          source: AdminAbuseRestriction["source"]
          requested_by: string | null
          request_id: string | null
          created_at: string
          lifted_at: string | null
          lifted_reason: string | null
        }>(
          `
            insert into abuse_restrictions (
              target_type,
              target_value,
              reason,
              source,
              requested_by,
              request_id
            )
            values ($1, $2, $3, $4, $5, $6)
            returning
              id,
              target_type,
              target_value,
              reason,
              source,
              requested_by,
              request_id,
              created_at,
              lifted_at,
              lifted_reason
          `,
          [
            input.targetType ?? "player",
            input.targetValue ?? "",
            input.reason ?? null,
            input.source ?? "unknown",
            input.requestedBy ?? null,
            input.requestId ?? null,
          ]
        )
      ).rows[0]
    } else {
      row = (
        await client.query<{
          id: string
          target_type: "player"
          target_value: string
          reason: string | null
          source: AdminAbuseRestriction["source"]
          requested_by: string | null
          request_id: string | null
          created_at: string
          lifted_at: string | null
          lifted_reason: string | null
        }>(
          `
            update abuse_restrictions
            set
              lifted_at = now(),
              lifted_reason = $2
            where id = $1
            returning
              id,
              target_type,
              target_value,
              reason,
              source,
              requested_by,
              request_id,
              created_at,
              lifted_at,
              lifted_reason
          `,
          [input.restrictionId, input.reason ?? null]
        )
      ).rows[0]

      if (!row) {
        throw new Error("Abuse restriction could not be found.")
      }
    }

    return {
      ok: true,
      driver: getStoreDriver(),
      generatedAt: new Date().toISOString(),
      restriction: {
        id: row.id,
        targetType: row.target_type,
        targetValue: row.target_value,
        reason: row.reason,
        source: row.source,
        requestedBy: row.requested_by,
        requestId: row.request_id,
        active: row.lifted_at === null,
        createdAt: row.created_at,
        liftedAt: row.lifted_at,
        liftedReason: row.lifted_reason,
      },
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

  return withTransaction(async (client) => {
    const context = await getOrCreateSession(
      client,
      input.sessionToken,
      input.userAgent,
      input.ipAddress
    )
    const snapshotEntries = await getDailyLeaderboardSnapshotEntries(client, input.date)

    return {
      entries: snapshotEntries ?? (await buildLeaderboardPreview(client, input.date)),
      sessionToken: context.sessionToken,
      created: context.created,
    }
  })
}
