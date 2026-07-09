import "server-only"

import { NextResponse } from "next/server"

import type { RateLimitResult } from "@/lib/server/rate-limit"

type ApiJsonResponseOptions = {
  status?: number
  requestId?: string
}

export function withApiHeaders(
  response: NextResponse,
  options: {
    requestId?: string
  } = {}
) {
  response.headers.set("Cache-Control", "no-store")

  if (options.requestId) {
    response.headers.set("X-Request-Id", options.requestId)
  }

  return response
}

export function createApiJsonResponse(
  body: unknown,
  { status = 200, requestId }: ApiJsonResponseOptions = {}
) {
  return withApiHeaders(NextResponse.json(body, { status }), { requestId })
}

export function createApiErrorResponse(input: {
  message: string
  status: number
  requestId?: string
}) {
  return createApiJsonResponse(
    {
      ok: false,
      message: input.message,
    },
    {
      status: input.status,
      requestId: input.requestId,
    }
  )
}

export function withRateLimitHeaders(response: NextResponse, result: RateLimitResult) {
  response.headers.set("X-RateLimit-Limit", `${result.limit}`)
  response.headers.set("X-RateLimit-Remaining", `${result.remaining}`)
  response.headers.set("X-RateLimit-Reset", `${Math.ceil(result.resetAt / 1000)}`)
  return response
}

export function createRateLimitErrorResponse(
  result: RateLimitResult,
  message: string,
  requestId?: string
) {
  return withRateLimitHeaders(
    createApiErrorResponse({
      message,
      status: 429,
      requestId,
    }),
    result
  )
}

export function setSessionCookie(response: NextResponse, name: string, value: string) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  })

  return response
}
