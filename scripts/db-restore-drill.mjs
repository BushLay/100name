import { readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import { Client } from "pg"

const restoreDatabaseUrl = process.env.NAME100_RESTORE_DATABASE_URL

if (!restoreDatabaseUrl) {
  console.error("NAME100_RESTORE_DATABASE_URL is required to run a restore drill.")
  process.exit(1)
}

const backupPathArg = process.argv[2]

if (!backupPathArg) {
  console.error("Usage: node scripts/db-restore-drill.mjs <backup-file>")
  process.exit(1)
}

const backupPath = path.resolve(process.cwd(), backupPathArg)
const raw = await readFile(backupPath, "utf8")
const backup = JSON.parse(raw)

if (backup.format !== "name100-postgres-json-v1" || !backup.tables) {
  console.error("Backup file format is not supported.")
  process.exit(1)
}

const tableOrder = [
  "schema_migrations",
  "players",
  "player_sessions",
  "daily_attempts",
  "accepted_guesses",
  "open_games",
  "open_game_guesses",
  "guess_events",
  "share_events",
  "player_identity_events",
  "email_magic_link_tokens",
  "email_delivery_events",
  "operations_job_runs",
  "daily_leaderboard_snapshots",
  "abuse_restrictions",
]

const client = new Client({ connectionString: restoreDatabaseUrl })

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatValue(value) {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value)
  }

  return String(value)
}

try {
  await client.connect()
  await client.query("begin")

  try {
    for (const tableName of [...tableOrder].reverse()) {
      await client.query(`delete from ${tableName}`)
    }

    for (const tableName of tableOrder) {
      const rows = Array.isArray(backup.tables[tableName]) ? backup.tables[tableName] : []

      for (const candidate of rows) {
        if (!isPlainObject(candidate)) {
          continue
        }

        const entries = Object.entries(candidate)

        if (entries.length === 0) {
          continue
        }

        const columns = entries.map(([key]) => key)
        const placeholders = entries.map((_, index) => `$${index + 1}`)
        const values = entries.map(([, value]) => formatValue(value))

        await client.query(
          `insert into ${tableName} (${columns.join(", ")}) values (${placeholders.join(", ")})`,
          values
        )
      }
    }

    const verification = await client.query(`
      select
        (select count(*)::text from players) as players,
        (select count(*)::text from player_sessions) as sessions,
        (select count(*)::text from daily_attempts) as attempts
    `)
    const counts = verification.rows[0]

    await client.query("commit")
    console.log(`Restore drill succeeded from ${backupPath}`)
    console.log(
      `Verified counts: players=${counts?.players ?? "0"}, sessions=${counts?.sessions ?? "0"}, attempts=${counts?.attempts ?? "0"}`
    )
  } catch (error) {
    await client.query("rollback")
    throw error
  }
} finally {
  await client.end()
}
