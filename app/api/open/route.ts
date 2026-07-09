import type { NextRequest } from "next/server"

import { createApiErrorResponse, createApiJsonResponse, setSessionCookie } from "@/lib/server/api-response"
import { createRequestContext, logRequestError } from "@/lib/server/observability"
import { getOpenGameState, getSessionCookieName } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/open")

  try {
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const response = await getOpenGameState({
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse({
      state: response.state,
    }, {
      requestId: requestContext.requestId,
    })

    return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load open game state."

    logRequestError(requestContext, "open.state.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}
