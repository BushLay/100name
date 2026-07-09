import type { NextRequest } from "next/server"

import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import { parseInternalAbuseRestrictionInput } from "@/lib/server/internal-abuse-restrictions"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { setAbuseRestriction } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/abuse-restrictions")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey(["internal-abuse-restrictions", requestContext.ipAddress]),
      limit: 20,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.abuse_restrictions.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many abuse restriction requests. Please wait before trying again.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)

    const rawBody = await request.text()
    const parsedInput = parseInternalAbuseRestrictionInput(JSON.parse(rawBody) as unknown)
    const actionInput = {
      ...parsedInput,
      source: parsedInput.source === "unknown" ? "api" : parsedInput.source,
      requestId: parsedInput.requestId ?? requestContext.requestId,
      requestedBy:
        parsedInput.requestedBy ??
        request.headers.get("x-name100-operator")?.trim() ??
        requestContext.userAgent,
    }
    const result = await setAbuseRestriction(actionInput)

    logServerEvent("warn", "internal.abuse_restrictions.updated", {
      requestId: requestContext.requestId,
      route: requestContext.route,
      action: actionInput.action,
      targetType: result.restriction.targetType,
      targetValue: result.restriction.targetValue,
      restrictionId: result.restriction.id,
      active: result.restriction.active,
    })

    return withRateLimitHeaders(
      createApiJsonResponse(result, {
        requestId: requestContext.requestId,
      }),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update abuse restriction."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/action|restrictionId|targetType|targetValue|source|json/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.abuse_restrictions.failed", error, { status })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
