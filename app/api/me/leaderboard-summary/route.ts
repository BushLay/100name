import type { NextRequest } from "next/server"

import { getTodayDateString } from "@/lib/daily"
import { createApiErrorResponse, createApiJsonResponse, setSessionCookie } from "@/lib/server/api-response"
import { createRequestContext, logRequestError } from "@/lib/server/observability"
import { getLeaderboardSummary, getSessionCookieName } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/me/leaderboard-summary")

  try {
    const date = getTodayDateString()
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const response = await getLeaderboardSummary({
      date,
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse({
      player: response.player,
      stats: response.stats,
      emailAuth: response.emailAuth,
      today: response.today,
      fastest: response.fastest,
      streaks: response.streaks,
      history: response.history,
      overview: response.overview,
    }, {
      requestId: requestContext.requestId,
    })

    return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player summary."

    logRequestError(requestContext, "player.summary.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}
