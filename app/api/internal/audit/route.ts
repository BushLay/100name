import type { NextRequest } from "next/server"

import { parseAdminAuditInput } from "@/lib/server/admin-audit"
import { createApiErrorResponse, createApiJsonResponse } from "@/lib/server/api-response"
import { assertInternalApiAccess } from "@/lib/server/internal-auth"
import { createRequestContext, logRequestError } from "@/lib/server/observability"
import { getAdminAudit } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/internal/audit")

  try {
    assertInternalApiAccess(request)

    const audit = await getAdminAudit(parseAdminAuditInput(request.nextUrl.searchParams))

    return createApiJsonResponse(audit, {
      requestId: requestContext.requestId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load admin audit."
    const status = message.match(/invalid internal api secret|required/i)
      ? 401
      : message.match(/identity(eventtype|handle|limit|offset)|magiclink(mode|email|limit|offset)/i)
        ? 400
        : 500

    logRequestError(requestContext, "internal.audit.failed", error, {
      status,
    })

    return createApiErrorResponse({
      message,
      status,
      requestId: requestContext.requestId,
    })
  }
}
