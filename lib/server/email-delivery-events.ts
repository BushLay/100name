import type {
  EmailDeliveryStatus,
  RecordEmailDeliveryEventInput,
} from "@/lib/server/store-types"

export const EMAIL_DELIVERY_EVENT_TYPES = [
  "queued",
  "delivered",
  "failed",
  "bounced",
  "complained",
] as const satisfies ReadonlyArray<Exclude<EmailDeliveryStatus, "generated">>

function parseOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized ? normalized : null
}

function parseOccurredAt(value: unknown) {
  const normalized = parseOptionalString(value)

  if (!normalized) {
    return null
  }

  const timestamp = new Date(normalized)

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("occurredAt must be a valid ISO timestamp.")
  }

  return timestamp.toISOString()
}

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function parseEmailDeliveryEventInput(body: unknown): RecordEmailDeliveryEventInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Email delivery event body must be a JSON object.")
  }

  const candidate = body as Record<string, unknown>
  const eventType = parseOptionalString(candidate.eventType)

  if (!eventType || !EMAIL_DELIVERY_EVENT_TYPES.includes(eventType as never)) {
    throw new Error(`eventType must be one of: ${EMAIL_DELIVERY_EVENT_TYPES.join(", ")}.`)
  }

  const tokenId = parseOptionalString(candidate.tokenId)
  const providerMessageId = parseOptionalString(candidate.providerMessageId)

  if (!tokenId && !providerMessageId) {
    throw new Error("Either tokenId or providerMessageId is required.")
  }

  return {
    eventType: eventType as Exclude<EmailDeliveryStatus, "generated">,
    tokenId,
    providerMessageId,
    providerEventId: parseOptionalString(candidate.providerEventId),
    occurredAt: parseOccurredAt(candidate.occurredAt),
    failureReason: parseOptionalString(candidate.failureReason),
    payload: parsePayload(candidate.payload),
  }
}

export function isDuplicateEmailDeliveryEventCandidate(
  left: {
    tokenId: string
    eventType: Exclude<EmailDeliveryStatus, "generated">
    providerMessageId: string | null
    providerEventId: string | null
    occurredAt: string | null
    failureReason: string | null
  },
  right: {
    tokenId: string
    eventType: Exclude<EmailDeliveryStatus, "generated">
    providerMessageId: string | null
    providerEventId: string | null
    occurredAt: string | null
    failureReason: string | null
  }
) {
  if (left.providerEventId && right.providerEventId) {
    return left.providerEventId === right.providerEventId
  }

  return (
    left.tokenId === right.tokenId &&
    left.eventType === right.eventType &&
    left.providerMessageId === right.providerMessageId &&
    left.occurredAt === right.occurredAt &&
    left.failureReason === right.failureReason
  )
}
