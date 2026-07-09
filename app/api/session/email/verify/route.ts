import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { setSessionCookie, withApiHeaders } from "@/lib/server/api-response"
import { createRequestContext, logRequestError } from "@/lib/server/observability"
import { getSessionCookieName, verifyMagicLink } from "@/lib/server/runtime-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request, "/api/session/email/verify")
  const token = request.nextUrl.searchParams.get("token")?.trim()

  if (!token) {
    return NextResponse.redirect(new URL("/leaderboard?auth=missing-token", request.url))
  }

  try {
    const response = await verifyMagicLink({
      token,
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestContext.ipAddress,
    })
    const redirectUrl = new URL("/leaderboard?auth=email-linked", request.url)
    const nextResponse = withApiHeaders(NextResponse.redirect(redirectUrl), {
      requestId: requestContext.requestId,
    })

    return setSessionCookie(nextResponse, getSessionCookieName(), response.sessionToken)
  } catch (error) {
    logRequestError(requestContext, "session.email_verify.failed", error)
    return NextResponse.redirect(new URL("/leaderboard?auth=email-invalid", request.url))
  }
}
