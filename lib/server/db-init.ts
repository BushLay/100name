import "server-only"

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const schemaPath = path.join(/* turbopackIgnore: true */ process.cwd(), "db", "schema.sql")
const migrationsPath = path.join(/* turbopackIgnore: true */ process.cwd(), "db", "migrations")

export async function loadDatabaseSchemaSql() {
  return readFile(schemaPath, "utf8")
}

export type DatabaseMigration = {
  version: string
  name: string
  sql: string
}

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export async function loadDatabaseMigrations(): Promise<DatabaseMigration[]> {
  const entries = await readdir(migrationsPath, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  return Promise.all(
    files.map(async (name) => ({
      version: name.replace(/\.sql$/, ""),
      name,
      sql: await readFile(path.join(migrationsPath, name), "utf8"),
    }))
  )
}

export async function runDatabaseMigrations(executor: Queryable) {
  await executor.query(`
    create table if not exists schema_migrations (
      version varchar(255) primary key,
      name varchar(255) not null,
      applied_at timestamptz not null default now()
    )
  `)

  const migrations = await loadDatabaseMigrations()
  const appliedResult = await executor.query("select version from schema_migrations")
  const appliedVersions = new Set(appliedResult.rows.map((row) => String(row.version)))
  const pendingMigrations = migrations.filter((migration) => !appliedVersions.has(migration.version))

  for (const migration of pendingMigrations) {
    await executor.query("begin")

    try {
      await executor.query(migration.sql)
      await executor.query(
        `
          insert into schema_migrations (version, name)
          values ($1, $2)
        `,
        [migration.version, migration.name]
      )
      await executor.query("commit")
    } catch (error) {
      await executor.query("rollback")
      throw error
    }
  }

  return {
    totalMigrations: migrations.length,
    appliedMigrations: pendingMigrations.map((migration) => migration.version),
    pendingCount: 0,
  }
}
