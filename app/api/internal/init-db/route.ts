import type { NextRequest } from "next/server"

import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { initializeDatabase } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/init-db")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey([
        "internal-init-db",
        requestContext.ipAddress,
      ]),
      limit: 3,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.init_db.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many database initialization attempts. Please wait and try again.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)

    const result = await initializeDatabase()
    logServerEvent("info", "internal.init_db.completed", {
      requestId: requestContext.requestId,
      route: requestContext.route,
      initialized: result.initialized,
      driver: result.driver,
    })

    return withRateLimitHeaders(
      createApiJsonResponse(result, {
        requestId: requestContext.requestId,
      }),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database initialization failed."
    const status = message.match(/Invalid internal API secret|required/i) ? 401 : 500

    logRequestError(requestContext, "internal.init_db.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
