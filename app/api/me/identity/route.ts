import type { NextRequest } from "next/server"

import type { ClaimIdentityRequest } from "@/lib/backend-contracts"
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
import {
  claimIdentity,
  getIdentityStatus,
  getSessionCookieName,
} from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/me/identity")

  try {
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const response = await getIdentityStatus({
      sessionToken,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const nextResponse = createApiJsonResponse(
      {
        player: response.player,
        stats: response.stats,
        emailAuth: response.emailAuth,
      },
      {
        requestId: requestContext.requestId,
      }
    )

    return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load identity status."

    logRequestError(requestContext, "identity.status.failed", error)

    return createApiErrorResponse({
      message,
      status: 400,
      requestId: requestContext.requestId,
    })
  }
}

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/me/identity")

  try {
    const body = (await request.json()) as ClaimIdentityRequest
    const sessionToken = request.cookies.get(getSessionCookieName())?.value ?? null
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "identity-claim",
        sessionToken,
        requestContext.ipAddress,
      ]),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "identity.claim.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many identity changes. Please wait before trying again.",
        requestContext.requestId
      )
    }

    const response = await claimIdentity({
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
    const message = error instanceof Error ? error.message : "Failed to claim player identity."
    const status = message.match(/already in use/i) ? 409 : 400

    logRequestError(requestContext, "identity.claim.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
