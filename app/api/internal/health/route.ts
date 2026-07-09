import type { NextRequest } from "next/server"

import { createApiErrorResponse, createApiJsonResponse } from "@/lib/server/api-response"
import {
  createRequestContext,
  logHealthDegradation,
  logRequestError,
} from "@/lib/server/observability"
import { getHealthStatus } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/health")

  try {
    const health = await getHealthStatus()

    if (!health.ok || health.checks.some((check) => !check.ok)) {
      logHealthDegradation(requestContext, {
        ok: health.ok,
        driver: health.driver,
        checks: health.checks,
      })
    }

    return createApiJsonResponse(health, {
      requestId: requestContext.requestId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed."

    logRequestError(requestContext, "internal.health.failed", error)

    return createApiErrorResponse({
      message,
      status: 500,
      requestId: requestContext.requestId,
    })
  }
}
