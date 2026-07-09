import type { NextRequest } from "next/server"

import { createApiJsonResponse, setSessionCookie } from "@/lib/server/api-response"
import { createRequestContext } from "@/lib/server/observability"
import { bootstrapSession, getSessionCookieName } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/session/bootstrap")
  const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
  const response = await bootstrapSession({
    sessionToken,
    userAgent: request.headers.get("user-agent"),
    ipAddress: requestContext.ipAddress,
  })
  const nextResponse = createApiJsonResponse({
    player: response.player,
    sessionId: response.sessionId,
    stats: response.stats,
  }, {
    requestId: requestContext.requestId,
  })

  return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
}
