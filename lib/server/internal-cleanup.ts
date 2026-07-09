import type { CleanupRunSource, RunRetentionCleanupInput } from "@/lib/server/store-types"

const VALID_CLEANUP_SOURCES = ["admin", "api", "cron", "unknown"] as const

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

function parseCleanupSource(value: unknown): CleanupRunSource {
  if (typeof value === "undefined" || value === null) {
    return "unknown"
  }

  if (typeof value !== "string") {
    throw new Error("source must be a string.")
  }

  const normalized = value.trim().toLowerCase()

  if (!VALID_CLEANUP_SOURCES.includes(normalized as CleanupRunSource)) {
    throw new Error(`source must be one of: ${VALID_CLEANUP_SOURCES.join(", ")}.`)
  }

  return normalized as CleanupRunSource
}

export function parseInternalCleanupInput(body: unknown): RunRetentionCleanupInput {
  if (typeof body === "undefined" || body === null) {
    return {
      dryRun: true,
      source: "unknown",
      reason: null,
      requestedBy: null,
      requestId: null,
    }
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Cleanup body must be a JSON object.")
  }

  const candidate = body as {
    dryRun?: unknown
    source?: unknown
    reason?: unknown
    requestedBy?: unknown
    requestId?: unknown
  }

  if (typeof candidate.dryRun === "undefined") {
    return {
      dryRun: true,
      source: parseCleanupSource(candidate.source),
      reason: parseOptionalString(candidate.reason, "reason"),
      requestedBy: parseOptionalString(candidate.requestedBy, "requestedBy"),
      requestId: parseOptionalString(candidate.requestId, "requestId"),
    }
  }

  if (typeof candidate.dryRun !== "boolean") {
    throw new Error("dryRun must be a boolean.")
  }

  return {
    dryRun: candidate.dryRun,
    source: parseCleanupSource(candidate.source),
    reason: parseOptionalString(candidate.reason, "reason"),
    requestedBy: parseOptionalString(candidate.requestedBy, "requestedBy"),
    requestId: parseOptionalString(candidate.requestId, "requestId"),
  }
}
