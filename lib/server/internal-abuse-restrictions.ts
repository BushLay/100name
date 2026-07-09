import type { SetAbuseRestrictionInput } from "./store-types.ts"

const VALID_TARGET_TYPES = ["player"] as const
const VALID_ACTIONS = ["activate", "lift"] as const
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

export function parseInternalAbuseRestrictionInput(body: unknown): SetAbuseRestrictionInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Abuse restriction body must be a JSON object.")
  }

  const candidate = body as {
    action?: unknown
    restrictionId?: unknown
    targetType?: unknown
    targetValue?: unknown
    reason?: unknown
    source?: unknown
    requestedBy?: unknown
    requestId?: unknown
  }

  if (typeof candidate.action !== "string" || !VALID_ACTIONS.includes(candidate.action as never)) {
    throw new Error("action must be one of: activate, lift.")
  }

  const source = parseOptionalString(candidate.source, "source") ?? "unknown"

  if (!VALID_SOURCES.includes(source as never)) {
    throw new Error("source must be one of: admin, api, cron, unknown.")
  }

  if (candidate.action === "activate") {
    const targetType = parseOptionalString(candidate.targetType, "targetType")
    const targetValue = parseOptionalString(candidate.targetValue, "targetValue")

    if (!targetType || !VALID_TARGET_TYPES.includes(targetType as never)) {
      throw new Error("targetType must be one of: player.")
    }

    if (!targetValue) {
      throw new Error("targetValue is required when activating a restriction.")
    }

    return {
      action: "activate",
      targetType: targetType as "player",
      targetValue,
      reason: parseOptionalString(candidate.reason, "reason"),
      source: source as SetAbuseRestrictionInput["source"],
      requestedBy: parseOptionalString(candidate.requestedBy, "requestedBy"),
      requestId: parseOptionalString(candidate.requestId, "requestId"),
    }
  }

  const restrictionId = parseOptionalString(candidate.restrictionId, "restrictionId")

  if (!restrictionId) {
    throw new Error("restrictionId is required when lifting a restriction.")
  }

  return {
    action: "lift",
    restrictionId,
    reason: parseOptionalString(candidate.reason, "reason"),
    source: source as SetAbuseRestrictionInput["source"],
    requestedBy: parseOptionalString(candidate.requestedBy, "requestedBy"),
    requestId: parseOptionalString(candidate.requestId, "requestId"),
  }
}
