import type { NextRequest } from "next/server"

import type { RequestMagicLinkRequest } from "@/lib/backend-contracts"
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
import { getSessionCookieName, requestMagicLink } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/session/email/request")

  try {
    const body = (await request.json()) as RequestMagicLinkRequest
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "session-email-request",
        body.email,
        sessionToken,
        requestContext.ipAddress,
      ]),
      limit: 6,
      windowMs: 30 * 60 * 1000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "session.email_request.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
        attemptedEmail: body.email,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many magic link requests. Please wait before trying again.",
        requestContext.requestId
      )
    }

    const response = await requestMagicLink({
      request: body,
      sessionToken,
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
    const message = error instanceof Error ? error.message : "Failed to request magic link."
    const status = message.match(/already linked/i) ? 409 : 400

    logRequestError(requestContext, "session.email_request.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
