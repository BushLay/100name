import type { NextRequest } from "next/server"

import { parseAdminAuditInput } from "@/lib/server/admin-audit"
import { createApiErrorResponse, createApiJsonResponse } from "@/lib/server/api-response"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import {
  createRequestContext,
  logRequestError,
  logServerEvent,
} from "@/lib/server/observability"
import { buildInternalReadiness } from "@/lib/server/readiness"
import { getAdminAudit, getHealthStatus, recordReadinessProbe } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/cron/readiness")

  try {
    assertInternalApiAccess(request)

    const [health, audit] = await Promise.all([
      getHealthStatus(),
      getAdminAudit(parseAdminAuditInput(new URLSearchParams())),
    ])
    const readiness = buildInternalReadiness({
      health,
      audit,
    })
    const previousReadinessStatus = audit.readinessProbeSummary.latestStatus
    const failingChecks = readiness.checks.filter((check) => !check.ok)

    await recordReadinessProbe({
      source: "cron",
      reason: "vercel cron readiness probe",
      requestId: requestContext.requestId,
      requestedBy: request.headers.get("user-agent")?.trim() ?? "vercel-cron",
      readiness,
    })

    if (!readiness.ok || readiness.summary.warningChecks > 0) {
      const logLevel =
        readiness.summary.escalationLevel === "critical" ||
        readiness.summary.escalationLevel === "error"
          ? "error"
          : "warn"

      logServerEvent(
        logLevel,
        "internal.readiness.degraded",
        {
          requestId: requestContext.requestId,
          route: requestContext.route,
          summary: readiness.summary,
          failingChecks,
          recorded: true,
          trigger: "vercel-cron",
        },
        {
          alert: {
            severity: logLevel,
            message:
              failingChecks.length > 0
                ? `Operational readiness degraded: ${failingChecks.map((check) => check.name).join(", ")}.`
                : `Operational readiness warning state with ${readiness.summary.warningChecks} warning checks.`,
            dedupKey: [
              "internal.readiness.degraded",
              readiness.summary.escalationLevel,
              failingChecks.map((check) => check.name).sort().join(",") ||
                `warning-${readiness.summary.warningChecks}`,
            ].join(":"),
            metadata: {
              previousStatus: previousReadinessStatus,
              currentStatus: readiness.ok ? "passing" : "failing",
              stateTransition:
                previousReadinessStatus === "failing"
                  ? "failing->failing"
                  : `${previousReadinessStatus}->degraded`,
            },
          },
        }
      )
    }

    if (readiness.summary.recoveredSincePreviousFailingRun) {
      logServerEvent(
        "warn",
        "internal.readiness.recovered",
        {
          requestId: requestContext.requestId,
          route: requestContext.route,
          summary: readiness.summary,
          recorded: true,
          trigger: "vercel-cron",
        },
        {
          alert: {
            message: "Operational readiness recovered after a previous failing probe.",
            dedupKey: "internal.readiness.recovered",
            bypassSeverityThreshold: true,
            metadata: {
              previousStatus: previousReadinessStatus,
              currentStatus: "passing",
              stateTransition: `${previousReadinessStatus}->passing`,
            },
          },
        }
      )
    }

    return createApiJsonResponse(readiness, {
      status: readiness.ok ? 200 : 503,
      requestId: requestContext.requestId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron readiness check failed."
    const status = message.match(/invalid internal api secret|required/i) ? 401 : 500

    logRequestError(requestContext, "internal.cron.readiness.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
