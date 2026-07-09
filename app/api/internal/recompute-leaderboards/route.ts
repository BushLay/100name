import type { NextRequest } from "next/server"

import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import { parseInternalLeaderboardRecomputeInput } from "@/lib/server/internal-leaderboard-recompute"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { recomputeLeaderboardSnapshots } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/recompute-leaderboards")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey(["internal-recompute-leaderboards", requestContext.ipAddress]),
      limit: 10,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.recompute_leaderboards.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many leaderboard recompute requests. Please wait before trying again.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)

    const rawBody = await request.text()
    const parsedBody = rawBody.trim().length > 0 ? (JSON.parse(rawBody) as unknown) : undefined
    const parsedInput = parseInternalLeaderboardRecomputeInput(parsedBody)
    const recomputeInput = {
      ...parsedInput,
      source: parsedInput.source === "unknown" ? "api" : parsedInput.source,
      requestId: parsedInput.requestId ?? requestContext.requestId,
      requestedBy:
        parsedInput.requestedBy ??
        request.headers.get("x-name100-operator")?.trim() ??
        requestContext.userAgent,
    }
    const result = await recomputeLeaderboardSnapshots(recomputeInput)

    logServerEvent("info", "internal.recompute_leaderboards.completed", {
      requestId: requestContext.requestId,
      route: requestContext.route,
      source: recomputeInput.source,
      dryRun: result.dryRun,
      driver: result.driver,
      totalDates: result.totalDates,
      insertedRows: result.snapshots.insertedRows,
      deletedRows: result.snapshots.deletedRows,
    })

    return withRateLimitHeaders(
      createApiJsonResponse(result, {
        requestId: requestContext.requestId,
      }),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leaderboard recompute failed."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/leaderboard recompute body|dryRun|date|days|source|json/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.recompute_leaderboards.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
