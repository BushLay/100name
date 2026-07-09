import "server-only"

import { Pool } from "pg"

import { getRateLimitDriver, requireDatabaseUrl, type RateLimitDriver } from "@/lib/server/env"

type RateLimitConfig = {
  key: string
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
  driver: RateLimitDriver
}

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

let pool: Pool | null = null
let cleanupRoll = 0

function now() {
  return Date.now()
}

function getPool() {
  if (pool) {
    return pool
  }

  pool = new Pool({
    connectionString: requireDatabaseUrl(),
  })

  return pool
}

function pruneExpiredBuckets(currentTime: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= currentTime) {
      buckets.delete(key)
    }
  }
}

function applyMemoryRateLimit({ key, limit, windowMs }: RateLimitConfig): RateLimitResult {
  const currentTime = now()
  pruneExpiredBuckets(currentTime)

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= currentTime) {
    const nextBucket = {
      count: 1,
      resetAt: currentTime + windowMs,
    }
    buckets.set(key, nextBucket)

    return {
      ok: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetAt: nextBucket.resetAt,
      driver: "memory",
    }
  }

  existing.count += 1

  return {
    ok: existing.count <= limit,
    limit,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
    driver: "memory",
  }
}

async function maybeCleanupPostgresBuckets() {
  cleanupRoll = (cleanupRoll + 1) % 50

  if (cleanupRoll !== 0) {
    return
  }

  await getPool().query(`
    delete from rate_limit_buckets
    where reset_at < now() - interval '1 day'
  `)
}

async function applyPostgresRateLimit({ key, limit, windowMs }: RateLimitConfig): Promise<RateLimitResult> {
  const resetAt = now() + windowMs
  const result = await getPool().query<{
    count: number
    reset_at_ms: string
  }>(
    `
      insert into rate_limit_buckets (bucket_key, count, reset_at)
      values ($1, 1, to_timestamp($2 / 1000.0))
      on conflict (bucket_key)
      do update
      set
        count = case
          when rate_limit_buckets.reset_at <= now() then 1
          else rate_limit_buckets.count + 1
        end,
        reset_at = case
          when rate_limit_buckets.reset_at <= now() then to_timestamp($2 / 1000.0)
          else rate_limit_buckets.reset_at
        end,
        updated_at = now()
      returning
        count,
        floor(extract(epoch from reset_at) * 1000)::bigint::text as reset_at_ms
    `,
    [key, resetAt]
  )

  void maybeCleanupPostgresBuckets()

  const count = result.rows[0]?.count ?? 1
  const resolvedResetAt = Number(result.rows[0]?.reset_at_ms ?? resetAt)

  return {
    ok: count <= limit,
    limit,
    remaining: Math.max(limit - count, 0),
    resetAt: resolvedResetAt,
    driver: "postgres",
  }
}

export function buildRateLimitKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim() || "anonymous").join(":")
}

export async function applyRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  return getRateLimitDriver() === "postgres"
    ? applyPostgresRateLimit(config)
    : applyMemoryRateLimit(config)
}
