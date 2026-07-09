import type { NextRequest } from "next/server"

import { parseAdminAuditInput } from "@/lib/server/admin-audit"
import { createApiErrorResponse, createApiJsonResponse } from "@/lib/server/api-response"
import { buildIncidentTimeline, summarizeAudit } from "@/lib/ops-reporting.mjs"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { getAdminAudit, recordOperationalReport } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/cron/daily-report")

  try {
    assertInternalApiAccess(request)

    const audit = await getAdminAudit(parseAdminAuditInput(new URLSearchParams()))
    const report = {
      generatedAt: new Date().toISOString(),
      summary: summarizeAudit(audit),
      incidentTimeline: buildIncidentTimeline(audit),
    }

    const result = await recordOperationalReport({
      reportType: "daily_report",
      source: "cron",
      reason: "vercel scheduled daily report",
      requestedBy: request.headers.get("user-agent")?.trim() ?? "vercel-cron",
      requestId: requestContext.requestId,
      summary: report.summary ?? {},
      actions: [],
      timeline: report.incidentTimeline.map((item) => ({
        at: item.at,
        category: item.category,
        title: item.title,
        detail: item.detail,
        severity: item.severity ?? null,
      })),
    })

    logServerEvent(
      "info",
      "internal.cron.daily_report.recorded",
      {
        requestId: requestContext.requestId,
        route: requestContext.route,
        timelineCount: report.incidentTimeline.length,
        requestedBy: request.headers.get("user-agent")?.trim() ?? "vercel-cron",
      },
      { alert: false }
    )

    return createApiJsonResponse(
      {
        ok: true,
        generatedAt: report.generatedAt,
        summary: report.summary,
        incidentTimeline: report.incidentTimeline,
        archivedReport: result.report,
      },
      {
        requestId: requestContext.requestId,
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron daily report failed."
    const status = message.match(/invalid internal api secret|required/i) ? 401 : 500

    logRequestError(requestContext, "internal.cron.daily_report.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
