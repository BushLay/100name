import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import { Client } from "pg"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run database migrations.")
  process.exit(1)
}

const migrationsDir = path.join(process.cwd(), "db", "migrations")

async function loadMigrations() {
  const entries = await readdir(migrationsDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  return Promise.all(
    files.map(async (name) => ({
      version: name.replace(/\.sql$/, ""),
      name,
      sql: await readFile(path.join(migrationsDir, name), "utf8"),
    }))
  )
}

const client = new Client({ connectionString: databaseUrl })

try {
  await client.connect()
  await client.query(`
    create table if not exists schema_migrations (
      version varchar(255) primary key,
      name varchar(255) not null,
      applied_at timestamptz not null default now()
    )
  `)

  const migrations = await loadMigrations()
  const appliedResult = await client.query("select version from schema_migrations")
  const appliedVersions = new Set(appliedResult.rows.map((row) => row.version))
  const pendingMigrations = migrations.filter((migration) => !appliedVersions.has(migration.version))

  for (const migration of pendingMigrations) {
    await client.query("begin")

    try {
      await client.query(migration.sql)
      await client.query(
        `
          insert into schema_migrations (version, name)
          values ($1, $2)
        `,
        [migration.version, migration.name]
      )
      await client.query("commit")
      console.log(`Applied migration ${migration.version}`)
    } catch (error) {
      await client.query("rollback")
      throw error
    }
  }

  if (pendingMigrations.length === 0) {
    console.log("No pending migrations.")
  } else {
    console.log(`Applied ${pendingMigrations.length} migration(s).`)
  }
} finally {
  await client.end()
}
