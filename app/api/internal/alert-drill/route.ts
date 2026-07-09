import type { NextRequest } from "next/server"

import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import { sendOperationalAlert, type SendOperationalAlertResult } from "@/lib/server/alerts"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import { parseInternalAlertDrillInput } from "@/lib/server/internal-alert-drill"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/alert-drill")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey(["internal-alert-drill", requestContext.ipAddress]),
      limit: 10,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.alert_drill.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many alert drill requests. Please wait before trying again.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)

    const rawBody = await request.text()
    const parsedBody = rawBody.trim().length > 0 ? (JSON.parse(rawBody) as unknown) : undefined
    const parsedInput = parseInternalAlertDrillInput(parsedBody)
    const requestedBy =
      parsedInput.requestedBy ??
      request.headers.get("x-name100-operator")?.trim() ??
      requestContext.userAgent ??
      "ops-alert-drill"
    const requestId = parsedInput.requestId ?? requestContext.requestId

    let dispatch: SendOperationalAlertResult

    try {
      dispatch = await sendOperationalAlert({
        event: "internal.alert.drill",
        severity: parsedInput.severity,
        message: parsedInput.message,
        dedupKey: `internal.alert.drill:${requestId}`,
        bypassSeverityThreshold: true,
        metadata: {
          requestId,
          route: requestContext.route,
          source: parsedInput.source === "unknown" ? "api" : parsedInput.source,
          requestedBy,
          reason: parsedInput.reason,
          drill: true,
        },
      })
    } catch (error) {
      dispatch = (
        error as Error & {
          dispatchResult?: SendOperationalAlertResult
        }
      ).dispatchResult ?? {
        dispatchStatus: "failed",
        suppressionReason: null,
        errorMessage: error instanceof Error ? error.message : "Unknown alert drill failure.",
      }
    }

    logServerEvent(
      dispatch.dispatchStatus === "failed" ? "error" : "info",
      "internal.alert_drill.completed",
      {
        requestId,
        route: requestContext.route,
        source: parsedInput.source === "unknown" ? "api" : parsedInput.source,
        requestedBy,
        severity: parsedInput.severity,
        reason: parsedInput.reason,
        dispatchStatus: dispatch.dispatchStatus,
        suppressionReason: dispatch.suppressionReason ?? null,
        drill: true,
      },
      { alert: false }
    )

    return withRateLimitHeaders(
      createApiJsonResponse(
        {
          ok: dispatch.dispatchStatus !== "failed",
          generatedAt: new Date().toISOString(),
          requestId,
          drill: {
            severity: parsedInput.severity,
            message: parsedInput.message,
            reason: parsedInput.reason,
            requestedBy,
          },
          dispatch,
        },
        {
          status: dispatch.dispatchStatus === "failed" ? 502 : 200,
          requestId: requestContext.requestId,
        }
      ),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert drill failed."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/alert drill body|severity|source|message|json/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.alert_drill.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
