import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import pg from "pg"

import { getDailyChallenge, getTodayDateString } from "../lib/daily.ts"

const DEFAULT_PLAYERS = 12
const DEFAULT_DAYS = 7
const MAX_PLAYERS = 100
const MAX_DAYS = 60
const POSTGRES_BATCH_SIZE = 250

function parsePositiveInt(value, fallback, label, max) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}.`)
  }

  return parsed
}

function printUsage() {
  console.log(`Usage: npm.cmd run seed:demo -- [players] [days]

Examples:
  npm.cmd run seed:demo
  npm.cmd run seed:demo -- 16 10`)
}

function getStorageDriver() {
  return process.env.NAME100_STORE_DRIVER?.trim() || "file"
}

function getStoragePath() {
  return (
    process.env.NAME100_STORAGE_FILE?.trim() ||
    path.join(process.cwd(), ".data", "backend.json")
  )
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function mulberry32(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function buildDateWindow(days) {
  const today = getTodayDateString()
  const end = new Date(`${today}T00:00:00Z`)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - (days - index - 1))
    return date.toISOString().slice(0, 10)
  })
}

function buildAcceptedGuesses(attemptId, playerIndex, dateIndex, score) {
  return Array.from({ length: score }, (_, index) => ({
    id: randomUUID(),
    attemptId,
    qid: `QDEMO${playerIndex + 1}${dateIndex + 1}${index + 1}`,
    resolvedName: `Demo Person ${playerIndex + 1}-${dateIndex + 1}-${index + 1}`,
    createdAt: new Date(Date.now() - (score - index) * 1_000).toISOString(),
  }))
}

function buildGuessEvents({
  attemptId,
  playerId,
  date,
  playerIndex,
  dateIndex,
  acceptedCount,
  guessesSubmitted,
  acceptedGuesses,
}) {
  const rejectedCount = Math.max(guessesSubmitted - acceptedCount, 0)
  const acceptedEvents = acceptedGuesses.map((guess, index) => ({
    id: randomUUID(),
    attemptId,
    playerId,
    date,
    query: guess.resolvedName,
    normalizedQuery: guess.resolvedName.toLowerCase(),
    qid: guess.qid,
    resolvedName: guess.resolvedName,
    isAccepted: true,
    rejectionReason: null,
    responseTimeMs: 100 + index,
    createdAt: guess.createdAt,
  }))
  const rejectedEvents = Array.from({ length: rejectedCount }, (_, index) => ({
    id: randomUUID(),
    attemptId,
    playerId,
    date,
    query: `Rejected Demo ${playerIndex + 1}-${dateIndex + 1}-${index + 1}`,
    normalizedQuery: `rejected demo ${playerIndex + 1}-${dateIndex + 1}-${index + 1}`,
    qid: null,
    resolvedName: null,
    isAccepted: false,
    rejectionReason: "rule_mismatch",
    responseTimeMs: 180 + index,
    createdAt: new Date(Date.now() - (rejectedCount - index) * 1_200).toISOString(),
  }))

  return [...acceptedEvents, ...rejectedEvents]
}

function buildDemoDataset({ playerCount, days }) {
  const dates = buildDateWindow(days)
  const random = mulberry32(playerCount * 1000 + days * 17)
  const players = []
  const sessions = []
  const attempts = []
  const acceptedGuesses = []
  const guessEvents = []

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const playerId = randomUUID()
    const handle = `demo_player_${String(playerIndex + 1).padStart(2, "0")}`
    const createdAt = new Date(Date.now() - (days + playerIndex + 2) * 86_400_000).toISOString()
    const recoveryCode = `${handle}-seed`
    players.push({
      id: playerId,
      handle,
      isGuest: false,
      recoveryConfigured: true,
      recoveryCodeHash: sha256(recoveryCode),
      recoveryCodeGeneratedAt: createdAt,
      email: `${handle}@example.com`,
      emailVerifiedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    })

    const sessionToken = randomUUID()
    const sessionId = randomUUID()
    sessions.push({
      id: sessionId,
      playerId,
      token: sessionToken,
      anonymousTokenHash: sha256(sessionToken),
      userAgent: "seed-demo-script",
      ipHash: sha256(`demo-ip-${playerIndex + 1}`),
      createdAt,
      lastSeenAt: createdAt,
    })

    let previousCompletedDate = null
    let currentStreak = 0

    dates.forEach((date, dateIndex) => {
      const challenge = getDailyChallenge(date)
      const forceTodayCompletion = dateIndex === dates.length - 1 && playerIndex < 6
      const shouldComplete =
        forceTodayCompletion || random() > Math.min(0.58, playerIndex * 0.03 + dateIndex * 0.015)
      const attemptsCount = 1 + Math.floor(random() * 3)
      const acceptedCount = shouldComplete
        ? challenge.targetScore
        : Math.max(4, challenge.targetScore - 3 - Math.floor(random() * 8))
      const guessesSubmitted = acceptedCount + Math.floor(random() * 5)
      const startedAtDate = new Date(`${date}T08:00:00.000Z`)
      startedAtDate.setUTCMinutes(startedAtDate.getUTCMinutes() + playerIndex * 9 + dateIndex * 4)
      const bestTimeMs = shouldComplete
        ? 180_000 + playerIndex * 11_000 + dateIndex * 7_000 + Math.floor(random() * 90_000)
        : null
      const completedAt = shouldComplete
        ? new Date(startedAtDate.getTime() + bestTimeMs).toISOString()
        : null

      if (shouldComplete) {
        currentStreak =
          previousCompletedDate &&
          new Date(`${previousCompletedDate}T00:00:00Z`).getTime() + 86_400_000 ===
            new Date(`${date}T00:00:00Z`).getTime()
            ? currentStreak + 1
            : 1
        previousCompletedDate = date
      } else {
        currentStreak = 0
      }

      const attemptId = randomUUID()
      const acceptedForAttempt = buildAcceptedGuesses(
        attemptId,
        playerIndex,
        dateIndex,
        acceptedCount
      )
      attempts.push({
        id: attemptId,
        playerId,
        sessionId,
        date,
        theme: {
          themeId: challenge.themeId,
          title: challenge.title,
          categoryLabel: challenge.categoryLabel,
          targetScore: challenge.targetScore,
        },
        status: shouldComplete ? "completed" : "in_progress",
        score: acceptedCount,
        attempts: attemptsCount,
        guessesSubmitted,
        startedAt: startedAtDate.toISOString(),
        completedAt,
        bestTimeMs,
        streakAtCompletion: shouldComplete ? currentStreak : 0,
        shareText: `${challenge.shareTitle} ${acceptedCount}/${challenge.targetScore}`,
        shareClicks: Math.floor(random() * 4),
        acceptedGuesses: acceptedForAttempt.map((guess) => ({
          qid: guess.qid,
          name: guess.resolvedName,
        })),
        createdAt: startedAtDate.toISOString(),
        updatedAt: completedAt ?? startedAtDate.toISOString(),
      })
      acceptedGuesses.push(...acceptedForAttempt)
      guessEvents.push(
        ...buildGuessEvents({
          attemptId,
          playerId,
          date,
          playerIndex,
          dateIndex,
          acceptedCount,
          guessesSubmitted,
          acceptedGuesses: acceptedForAttempt,
        })
      )
    })
  }

  return {
    players,
    sessions,
    attempts,
    acceptedGuesses,
    guessEvents,
  }
}

async function insertRows(client, tableName, columns, rows, mapRow) {
  if (rows.length === 0) {
    return
  }

  for (let start = 0; start < rows.length; start += POSTGRES_BATCH_SIZE) {
    const chunk = rows.slice(start, start + POSTGRES_BATCH_SIZE)
    const values = []
    const placeholders = chunk.map((row, rowIndex) => {
      const mapped = mapRow(row)
      values.push(...mapped)

      const baseIndex = rowIndex * columns.length
      const numbered = columns.map((_, columnIndex) => `$${baseIndex + columnIndex + 1}`)
      return `(${numbered.join(",")})`
    })

    await client.query(
      `
        insert into ${tableName} (${columns.join(", ")})
        values ${placeholders.join(",\n")}
      `
    , values)
  }
}

async function seedFileStore(dataset) {
  const storagePath = getStoragePath()
  const emptyState = {
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

  let state = emptyState

  try {
    const raw = await readFile(storagePath, "utf8")
    state = { ...emptyState, ...JSON.parse(raw) }
  } catch {
    state = emptyState
  }

  const demoPlayerIds = new Set(
    (state.players ?? [])
      .filter((player) => typeof player.handle === "string" && player.handle.startsWith("demo_player_"))
      .map((player) => player.id)
  )
  const demoSessionIds = new Set(
    (state.sessions ?? [])
      .filter((session) => demoPlayerIds.has(session.playerId))
      .map((session) => session.id)
  )
  const demoAttemptIds = new Set(
    (state.attempts ?? [])
      .filter((attempt) => demoPlayerIds.has(attempt.playerId))
      .map((attempt) => attempt.id)
  )

  state.players = (state.players ?? []).filter((player) => !demoPlayerIds.has(player.id))
  state.sessions = (state.sessions ?? []).filter((session) => !demoSessionIds.has(session.id))
  state.attempts = (state.attempts ?? []).filter((attempt) => !demoAttemptIds.has(attempt.id))
  state.guessEvents = (state.guessEvents ?? []).filter((event) => !demoAttemptIds.has(event.attemptId))
  state.shareEvents = (state.shareEvents ?? []).filter((event) => !demoAttemptIds.has(event.attemptId))

  state.players.push(...dataset.players)
  state.sessions.push(...dataset.sessions)
  state.attempts.push(...dataset.attempts)
  state.guessEvents.push(...dataset.guessEvents)

  await mkdir(path.dirname(storagePath), { recursive: true })
  await writeFile(storagePath, JSON.stringify(state, null, 2))

  return { storagePath, deletedPlayers: demoPlayerIds.size }
}

async function seedPostgres(dataset) {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when NAME100_STORE_DRIVER=postgres.")
  }

  const pool = new pg.Pool({ connectionString: databaseUrl })
  const client = await pool.connect()

  try {
    console.log("[seed] connected to postgres")
    await client.query("begin")
    console.log("[seed] clearing existing demo players")
    await client.query("delete from players where handle like 'demo_player_%'")
    console.log(`[seed] inserting ${dataset.players.length} players`)
    await insertRows(
      client,
      "players",
      [
        "id",
        "handle",
        "is_guest",
        "recovery_code_hash",
        "recovery_code_generated_at",
        "email",
        "email_verified_at",
        "created_at",
        "updated_at",
      ],
      dataset.players,
      (player) => [
        player.id,
        player.handle,
        player.isGuest,
        player.recoveryCodeHash,
        player.recoveryCodeGeneratedAt,
        player.email,
        player.emailVerifiedAt,
        player.createdAt,
        player.updatedAt,
      ]
    )

    console.log(`[seed] inserting ${dataset.sessions.length} sessions`)
    await insertRows(
      client,
      "player_sessions",
      ["id", "player_id", "anonymous_token_hash", "user_agent", "ip_hash", "created_at", "last_seen_at"],
      dataset.sessions,
      (session) => [
        session.id,
        session.playerId,
        session.anonymousTokenHash,
        session.userAgent,
        session.ipHash,
        session.createdAt,
        session.lastSeenAt,
      ]
    )

    console.log(`[seed] inserting ${dataset.attempts.length} attempts`)
    await insertRows(
      client,
      "daily_attempts",
      [
        "id",
        "player_id",
        "session_id",
        "date",
        "theme_id",
        "theme_title",
        "theme_label",
        "target_score",
        "status",
        "score",
        "attempts",
        "guesses_submitted",
        "started_at",
        "completed_at",
        "best_time_ms",
        "streak_at_completion",
        "share_text",
        "share_clicks",
        "created_at",
        "updated_at",
      ],
      dataset.attempts,
      (attempt) => [
        attempt.id,
        attempt.playerId,
        attempt.sessionId,
        attempt.date,
        attempt.theme.themeId,
        attempt.theme.title,
        attempt.theme.categoryLabel,
        attempt.theme.targetScore,
        attempt.status,
        attempt.score,
        attempt.attempts,
        attempt.guessesSubmitted,
        attempt.startedAt,
        attempt.completedAt,
        attempt.bestTimeMs,
        attempt.streakAtCompletion,
        attempt.shareText,
        attempt.shareClicks,
        attempt.createdAt,
        attempt.updatedAt,
      ]
    )

    console.log(`[seed] inserting ${dataset.acceptedGuesses.length} accepted guesses`)
    await insertRows(
      client,
      "accepted_guesses",
      ["id", "attempt_id", "qid", "resolved_name", "created_at"],
      dataset.acceptedGuesses,
      (guess) => [guess.id, guess.attemptId, guess.qid, guess.resolvedName, guess.createdAt]
    )

    console.log(`[seed] inserting ${dataset.guessEvents.length} guess events`)
    await insertRows(
      client,
      "guess_events",
      [
        "id",
        "attempt_id",
        "player_id",
        "date",
        "query",
        "normalized_query",
        "qid",
        "resolved_name",
        "is_accepted",
        "rejection_reason",
        "response_time_ms",
        "created_at",
      ],
      dataset.guessEvents,
      (event) => [
        event.id,
        event.attemptId,
        event.playerId,
        event.date,
        event.query,
        event.normalizedQuery,
        event.qid,
        event.resolvedName,
        event.isAccepted,
        event.rejectionReason,
        event.responseTimeMs,
        event.createdAt,
      ]
    )

    await client.query("commit")
    console.log("[seed] postgres transaction committed")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage()
    return
  }

  const playerCount = parsePositiveInt(process.argv[2], DEFAULT_PLAYERS, "players", MAX_PLAYERS)
  const days = parsePositiveInt(process.argv[3], DEFAULT_DAYS, "days", MAX_DAYS)
  const dataset = buildDemoDataset({ playerCount, days })
  const driver = getStorageDriver()

  if (driver === "postgres") {
    await seedPostgres(dataset)
  } else {
    await seedFileStore(dataset)
  }

  const completedAttempts = dataset.attempts.filter((attempt) => attempt.status === "completed").length
  const today = getTodayDateString()
  const todayCompleted = dataset.attempts.filter(
    (attempt) => attempt.date === today && attempt.status === "completed"
  ).length

  console.log(
    JSON.stringify(
      {
        ok: true,
        driver,
        seededPlayers: dataset.players.length,
        seededAttempts: dataset.attempts.length,
        completedAttempts,
        todayCompleted,
        dateWindow: buildDateWindow(days),
      },
      null,
      2
    )
  )
}

await main()
