import type { NextRequest } from "next/server"

import type { SubmitGuessRequest } from "@/lib/backend-contracts"
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
import { getSessionCookieName, submitGuess } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, context: RouteContext<"/api/daily/[date]/guess">) {
  const requestContext = createRequestContext(request, "/api/daily/[date]/guess")

  try {
    const body = (await request.json()) as SubmitGuessRequest
    const { date } = await context.params
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "daily-guess",
        date,
        sessionToken,
        requestContext.ipAddress,
      ]),
      limit: 30,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "daily.guess.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
        date,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many daily guesses. Please wait a moment and try again.",
        requestContext.requestId
      )
    }

    const response = await submitGuess({
      date,
      request: body,
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse({
      accepted: response.accepted,
      message: response.message,
      state: response.state,
      guess: response.guess,
    }, {
      requestId: requestContext.requestId,
    })

    setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)

    return withRateLimitHeaders(nextResponse, rateLimit)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit guess."

    logRequestError(requestContext, "daily.guess.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}
