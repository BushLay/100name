import { readdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import { Client } from "pg"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required to inspect migration status.")
  process.exit(1)
}

const migrationsDir = path.join(process.cwd(), "db", "migrations")

async function loadMigrationVersions() {
  const entries = await readdir(migrationsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name.replace(/\.sql$/, ""))
    .sort((left, right) => left.localeCompare(right))
}

const client = new Client({ connectionString: databaseUrl })

try {
  await client.connect()

  const versions = await loadMigrationVersions()
  const migrationsTableResult = await client.query<{ exists: string | null }>(`
    select to_regclass('public.schema_migrations')::text as exists
  `)
  const hasMigrationsTable = Boolean(migrationsTableResult.rows[0]?.exists)

  const appliedVersions = hasMigrationsTable
    ? new Set(
        (
          await client.query<{ version: string }>(
            "select version from schema_migrations order by version asc"
          )
        ).rows.map((row) => row.version)
      )
    : new Set()

  const pendingVersions = versions.filter((version) => !appliedVersions.has(version))

  console.log(`Known migrations: ${versions.length}`)
  console.log(`Applied migrations: ${appliedVersions.size}`)
  console.log(`Pending migrations: ${pendingVersions.length}`)

  if (pendingVersions.length > 0) {
    console.log("Pending:")
    for (const version of pendingVersions) {
      console.log(`- ${version}`)
    }
  }
} finally {
  await client.end()
}
