import type { NextRequest } from "next/server"

import { createApiErrorResponse, createApiJsonResponse, setSessionCookie } from "@/lib/server/api-response"
import { createRequestContext, logRequestError } from "@/lib/server/observability"
import { getDailyLeaderboard, getSessionCookieName } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/leaderboards/daily/[date]">
) {
  const requestContext = createRequestContext(request, "/api/leaderboards/daily/[date]")

  try {
    const { date } = await context.params
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const response = await getDailyLeaderboard({
      date,
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse(
      { entries: response.entries },
      { requestId: requestContext.requestId }
    )

    return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leaderboard."

    logRequestError(requestContext, "leaderboard.daily.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}
