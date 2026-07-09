import type { NextRequest } from "next/server"

import {
  createApiErrorResponse,
  createApiJsonResponse,
  createRateLimitErrorResponse,
  withRateLimitHeaders,
} from "@/lib/server/api-response"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import { parseInternalOperationalReportInput } from "@/lib/server/internal-ops-report"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { applyRateLimit, buildRateLimitKey } from "@/lib/server/rate-limit"
import { recordOperationalReport } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/ops-reports")

  try {
    const rateLimit = await applyRateLimit({
      key: buildRateLimitKey(["internal-ops-reports", requestContext.ipAddress]),
      limit: 20,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      logServerEvent("warn", "internal.ops_reports.rate_limited", {
        requestId: requestContext.requestId,
        route: requestContext.route,
        ipAddress: requestContext.ipAddress,
      })

      return createRateLimitErrorResponse(
        rateLimit,
        "Too many operational report archive requests. Please wait before trying again.",
        requestContext.requestId
      )
    }

    assertInternalApiAccess(request)

    const rawBody = await request.text()
    const parsedBody = rawBody.trim().length > 0 ? (JSON.parse(rawBody) as unknown) : undefined
    const parsedInput = parseInternalOperationalReportInput(parsedBody)
    const reportInput = {
      ...parsedInput,
      source: parsedInput.source === "unknown" ? "api" : parsedInput.source,
      requestId: parsedInput.requestId ?? requestContext.requestId,
      requestedBy:
        parsedInput.requestedBy ??
        request.headers.get("x-name100-operator")?.trim() ??
        requestContext.userAgent,
    }
    const result = await recordOperationalReport(reportInput)

    logServerEvent("info", "internal.ops_reports.recorded", {
      requestId: requestContext.requestId,
      route: requestContext.route,
      reportType: reportInput.reportType,
      source: reportInput.source,
      requestedBy: reportInput.requestedBy,
      actionCount: reportInput.actions.length,
      timelineCount: reportInput.timeline.length,
    })

    return withRateLimitHeaders(
      createApiJsonResponse(result, {
        requestId: requestContext.requestId,
      }),
      rateLimit
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operational report archive failed."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/report body|json object|reportType|summary|actions|timeline|json/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.ops_reports.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
