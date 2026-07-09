import { getTodayDateString, isValidChallengeDate } from "../daily.ts"
import type { RecomputeLeaderboardSnapshotsInput } from "./store-types.ts"

const VALID_SOURCES = ["admin", "api", "cron", "unknown"] as const

function parseOptionalString(value: unknown, label: string) {
  if (typeof value === "undefined" || value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`)
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseOptionalPositiveInteger(value: unknown, label: string) {
  if (typeof value === "undefined" || value === null) {
    return null
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 90) {
    throw new Error(`${label} must be an integer between 1 and 90.`)
  }

  return value
}

export function parseInternalLeaderboardRecomputeInput(
  body: unknown
): RecomputeLeaderboardSnapshotsInput {
  if (typeof body === "undefined" || body === null) {
    return {
      dryRun: true,
      date: getTodayDateString(),
      days: 1,
      source: "unknown",
      reason: null,
      requestedBy: null,
      requestId: null,
    }
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Leaderboard recompute body must be a JSON object.")
  }

  const candidate = body as {
    dryRun?: unknown
    date?: unknown
    days?: unknown
    source?: unknown
    reason?: unknown
    requestedBy?: unknown
    requestId?: unknown
  }

  const date = parseOptionalString(candidate.date, "date")
  const days = parseOptionalPositiveInteger(candidate.days, "days")

  if (date && !isValidChallengeDate(date)) {
    throw new Error("date must be a valid challenge date.")
  }

  if (typeof candidate.dryRun !== "boolean" && typeof candidate.dryRun !== "undefined") {
    throw new Error("dryRun must be a boolean.")
  }

  if (candidate.source && typeof candidate.source !== "string") {
    throw new Error("source must be a string.")
  }

  const normalizedSource = typeof candidate.source === "string" ? candidate.source.trim() : null

  if (normalizedSource && !VALID_SOURCES.includes(normalizedSource as (typeof VALID_SOURCES)[number])) {
    throw new Error("source must be one of: admin, api, cron, unknown.")
  }

  return {
    dryRun: candidate.dryRun ?? true,
    date: date ?? getTodayDateString(),
    days: days ?? 1,
    source: (normalizedSource as RecomputeLeaderboardSnapshotsInput["source"]) ?? "unknown",
    reason: parseOptionalString(candidate.reason, "reason"),
    requestedBy: parseOptionalString(candidate.requestedBy, "requestedBy"),
    requestId: parseOptionalString(candidate.requestId, "requestId"),
  }
}
