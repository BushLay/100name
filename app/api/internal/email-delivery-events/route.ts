import type { NextRequest } from "next/server"

import { createApiErrorResponse, createApiJsonResponse, createRateLimitErrorResponse, withRateLimitHeaders } from "@/lib/server/api-response"
import { parseEmailDeliveryEventInput } from "@/lib/server/email-delivery-events"
import { verifyEmailEventWebhookSignature } from "@/lib/server/email-event-auth"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import { createRequestContext, logRequestError, logServerEvent } from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { recordEmailDeliveryEvent } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/email-delivery-events")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey(["internal-email-delivery-events", requestContext.ipAddress]),
      limit: 60,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.email_delivery_events.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many email delivery event requests. Please wait before retrying.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)
    const rawBody = await request.text()
    const signature = verifyEmailEventWebhookSignature(request, rawBody)

    const result = await recordEmailDeliveryEvent(
      parseEmailDeliveryEventInput(JSON.parse(rawBody) as unknown)
    )

    logServerEvent(result.matched ? "info" : "warn", "internal.email_delivery_events.recorded", {
      requestId: requestContext.requestId,
      route: requestContext.route,
      matched: result.matched,
      deduplicated: result.deduplicated,
      signatureVerified: signature.verified,
      signatureEnforced: signature.enforced,
      tokenId: result.tokenId,
      eventId: result.eventId,
    })

    return withRateLimitHeaders(
      createApiJsonResponse(result, {
        requestId: requestContext.requestId,
      }),
      rateLimit
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record email delivery event."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/signature|timestamp/i)
        ? 401
        : message.match(/eventType|tokenId|providerMessageId|occurredAt|body|json/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.email_delivery_events.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
