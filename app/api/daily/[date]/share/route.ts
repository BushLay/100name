import type { NextRequest } from "next/server"

import type { TrackShareRequest } from "@/lib/backend-contracts"
import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  setSessionCookie,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { getSessionCookieName, trackShare } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, context: RouteContext<"/api/daily/[date]/share">) {
  const requestContext = createRequestContext(request, "/api/daily/[date]/share")

  try {
    const body = (await request.json()) as TrackShareRequest
    const { date } = await context.params
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "daily-share",
        date,
        sessionToken,
        requestContext.ipAddress,
      ]),
      limit: 20,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "daily.share.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
        date,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many share events. Please wait a moment and try again.",
        requestContext.requestId
      )
    }

    const response = await trackShare({
      date,
      request: body,
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse(response, {
      requestId: requestContext.requestId,
    })
    setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)

    return withRateLimitHeaders(nextResponse, rateLimit)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to track share."

    logRequestError(requestContext, "daily.share.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}
