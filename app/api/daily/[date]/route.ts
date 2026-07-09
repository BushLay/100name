import type { NextRequest } from "next/server"

import { createApiErrorResponse, createApiJsonResponse, setSessionCookie } from "@/lib/server/api-response"
import { createRequestContext, logRequestError } from "@/lib/server/observability"
import { getDailyState, getSessionCookieName } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: RouteContext<"/api/daily/[date]">) {
  const requestContext = createRequestContext(request, "/api/daily/[date]")

  try {
    const { date } = await context.params
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const response = await getDailyState({
      date,
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse({
      state: response.state,
      overview: response.overview,
    }, {
      requestId: requestContext.requestId,
    })

    return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load daily state."

    logRequestError(requestContext, "daily.state.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}
