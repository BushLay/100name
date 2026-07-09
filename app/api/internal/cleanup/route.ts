import type { NextRequest } from "next/server"

import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import { parseInternalCleanupInput } from "@/lib/server/internal-cleanup"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { runRetentionCleanup } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/cleanup")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey(["internal-cleanup", requestContext.ipAddress]),
      limit: 10,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.cleanup.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many cleanup requests. Please wait before trying again.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)

    const rawBody = await request.text()
    const parsedBody = rawBody.trim().length > 0 ? (JSON.parse(rawBody) as unknown) : undefined
    const parsedInput = parseInternalCleanupInput(parsedBody)
    const cleanupInput = {
      ...parsedInput,
      source: parsedInput.source === "unknown" ? "api" : parsedInput.source,
      requestId: parsedInput.requestId ?? requestContext.requestId,
      requestedBy:
        parsedInput.requestedBy ??
        request.headers.get("x-name100-operator")?.trim() ??
        requestContext.userAgent,
    }
    const result = await runRetentionCleanup(cleanupInput)

    logServerEvent("info", "internal.cleanup.completed", {
      requestId: requestContext.requestId,
      route: requestContext.route,
      source: cleanupInput.source,
      dryRun: result.dryRun,
      driver: result.driver,
      reason: cleanupInput.reason,
      requestedBy: cleanupInput.requestedBy,
      deletedMagicLinkTokens: result.deleted.magicLinkTokens,
      deletedDeliveryEvents: result.deleted.deliveryEvents,
    })

    return withRateLimitHeaders(
      createApiJsonResponse(result, {
        requestId: requestContext.requestId,
      }),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/cleanup body|dryRun|json/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.cleanup.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
