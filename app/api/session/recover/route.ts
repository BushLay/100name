import type { NextRequest } from "next/server"

import type { RecoverSessionRequest } from "@/lib/backend-contracts"
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
import { getSessionCookieName, recoverSession } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/session/recover")

  try {
    const body = (await request.json()) as RecoverSessionRequest
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "session-recover",
        body.handle,
        requestContext.ipAddress,
      ]),
      limit: 8,
      windowMs: 15 * 60 * 1000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "session.recover.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
        attemptedHandle: body.handle,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many recovery attempts. Please wait before trying again.",
        requestContext.requestId
      )
    }

    const response = await recoverSession({
      request: body,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse(response, {
      requestId: requestContext.requestId,
    })

    return withRateLimitHeaders(
      setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to recover player session."
    const status = message.match(/invalid handle or recovery code/i) ? 401 : 400

    logRequestError(requestContext, "session.recover.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
