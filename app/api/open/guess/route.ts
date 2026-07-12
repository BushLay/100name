import type { NextRequest } from "next/server"

import type { SubmitOpenGuessRequest } from "@/lib/backend-contracts"
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
import { getSessionCookieName, submitOpenGuess } from "@/lib/server/runtime-store"
import { WikidataServiceError } from "@/lib/wikidata"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/open/guess")

  try {
    const body = (await request.json()) as SubmitOpenGuessRequest
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "open-guess",
        sessionToken,
        requestContext.ipAddress,
      ]),
      limit: 30,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "open.guess.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many open-mode guesses. Please wait a moment and try again.",
        requestContext.requestId
      )
    }

    const response = await submitOpenGuess({
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
    const message = error instanceof Error ? error.message : "Failed to submit open-mode guess."
    const status = error instanceof WikidataServiceError ? 503 : 400

    logRequestError(requestContext, "open.guess.failed", error)

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
