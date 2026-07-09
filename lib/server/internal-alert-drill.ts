import type { CleanupRunSource } from "@/lib/server/store-types"

const VALID_SOURCES = ["admin", "api", "cron", "unknown"] as const
const VALID_SEVERITIES = ["warn", "error"] as const

export type InternalAlertDrillInput = {
  severity: "warn" | "error"
  source: CleanupRunSource
  message: string
  reason: string | null
  requestedBy: string | null
  requestId: string | null
}

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

function parseSource(value: unknown): CleanupRunSource {
  if (typeof value === "undefined" || value === null) {
    return "unknown"
  }

  if (typeof value !== "string") {
    throw new Error("source must be a string.")
  }

  const normalized = value.trim().toLowerCase()

  if (!VALID_SOURCES.includes(normalized as CleanupRunSource)) {
    throw new Error(`source must be one of: ${VALID_SOURCES.join(", ")}.`)
  }

  return normalized as CleanupRunSource
}

function parseSeverity(value: unknown): "warn" | "error" {
  if (typeof value === "undefined" || value === null) {
    return "warn"
  }

  if (typeof value !== "string") {
    throw new Error("severity must be a string.")
  }

  const normalized = value.trim().toLowerCase()

  if (!VALID_SEVERITIES.includes(normalized as "warn" | "error")) {
    throw new Error(`severity must be one of: ${VALID_SEVERITIES.join(", ")}.`)
  }

  return normalized as "warn" | "error"
}

export function parseInternalAlertDrillInput(body: unknown): InternalAlertDrillInput {
  if (typeof body === "undefined" || body === null) {
    return {
      severity: "warn",
      source: "unknown",
      message: "Operator-triggered alert drill.",
      reason: null,
      requestedBy: null,
      requestId: null,
    }
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Alert drill body must be a JSON object.")
  }

  const candidate = body as {
    severity?: unknown
    source?: unknown
    message?: unknown
    reason?: unknown
    requestedBy?: unknown
    requestId?: unknown
  }

  const message = parseOptionalString(candidate.message, "message") ?? "Operator-triggered alert drill."

  return {
    severity: parseSeverity(candidate.severity),
    source: parseSource(candidate.source),
    message,
    reason: parseOptionalString(candidate.reason, "reason"),
    requestedBy: parseOptionalString(candidate.requestedBy, "requestedBy"),
    requestId: parseOptionalString(candidate.requestId, "requestId"),
  }
}
