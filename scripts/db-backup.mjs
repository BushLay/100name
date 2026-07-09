import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import { Client } from "pg"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required to create a backup.")
  process.exit(1)
}

const backupDirectory =
  process.env.NAME100_BACKUP_DIR?.trim() ||
  path.join(process.cwd(), ".data", "backups")

const timestamp = new Date().toISOString().replaceAll(":", "-")
const backupPath = path.join(backupDirectory, `name100-backup-${timestamp}.json`)

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

const client = new Client({ connectionString: databaseUrl })

try {
  await client.connect()

  const payload = {
    format: "name100-postgres-json-v1",
    generatedAt: new Date().toISOString(),
    sourceDatabaseUrlRedacted: true,
    tables: {},
  }

  for (const tableName of tableOrder) {
    const result = await client.query(`select row_to_json(t) as row from ${tableName} t`)
    payload.tables[tableName] = result.rows.map((row) => row.row)
  }

  await mkdir(backupDirectory, { recursive: true })
  await writeFile(backupPath, JSON.stringify(payload, null, 2))

  console.log(`Backup written to ${backupPath}`)
  console.log(`Captured ${tableOrder.length} table(s).`)
} finally {
  await client.end()
}
