import "server-only"

import { randomUUID } from "node:crypto"

import type { NextRequest } from "next/server"

import { sendOperationalAlert } from "@/lib/server/alerts"

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const

export type LogLevel = keyof typeof LOG_LEVELS

export type RequestContext = {
  requestId: string
  route: string
  method: string
  ipAddress: string | null
  userAgent: string | null
}

type LogMetadata = Record<string, unknown>
type AlertOptions = {
  severity?: "warn" | "error"
  message?: string
  metadata?: Record<string, unknown>
  dedupKey?: string
  bypassSeverityThreshold?: boolean
}

function getConfiguredLogLevel(): LogLevel {
  const configured = process.env.NAME100_LOG_LEVEL?.trim().toLowerCase()

  if (configured && configured in LOG_LEVELS) {
    return configured as LogLevel
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug"
}

function shouldLog(level: LogLevel) {
  return LOG_LEVELS[level] >= LOG_LEVELS[getConfiguredLogLevel()]
}

export function getRuntimeEnvironment() {
  return process.env.NODE_ENV?.trim() || "development"
}

export function getIpAddress(request: Pick<NextRequest, "headers">) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const forwardedIp = forwardedFor?.split(",")[0]?.trim()

  if (forwardedIp) {
    return forwardedIp
  }

  return request.headers.get("x-real-ip")?.trim() || null
}

export function createRequestContext(
  request: Pick<NextRequest, "headers" | "method">,
  route: string
): RequestContext {
  const forwardedRequestId = request.headers.get("x-request-id")?.trim()

  return {
    requestId: forwardedRequestId || randomUUID(),
    route,
    method: request.method,
    ipAddress: getIpAddress(request),
    userAgent: request.headers.get("user-agent")?.trim() || null,
  }
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  }
}

export function logServerEvent(
  level: LogLevel,
  event: string,
  metadata: LogMetadata = {},
  options?: {
    alert?: false | AlertOptions
  }
) {
  const alertConfig = options?.alert === false ? null : (options?.alert ?? null)
  const alertsEnabled = options?.alert !== false

  if (!shouldLog(level)) {
    return
  }

  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "name100",
    environment: getRuntimeEnvironment(),
    ...metadata,
  })

  if (level === "error") {
    console.error(payload)
    void sendOperationalAlert({
      event,
      severity: alertConfig?.severity ?? "error",
      message:
        alertConfig?.message ?? `Server error event: ${event}`,
      metadata: alertConfig ? { ...metadata, ...(alertConfig.metadata ?? {}) } : metadata,
      dedupKey: alertConfig?.dedupKey,
      bypassSeverityThreshold: alertConfig?.bypassSeverityThreshold,
    }).catch((error) => {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          event: "alert.dispatch.failed",
          service: "name100",
          environment: getRuntimeEnvironment(),
          error: serializeError(error),
          sourceEvent: event,
        })
      )
    })
    return
  }

  if (level === "warn") {
    console.warn(payload)
    if (alertsEnabled) {
      void sendOperationalAlert({
        event,
        severity: alertConfig?.severity ?? "warn",
        message: alertConfig?.message ?? `Server warning event: ${event}`,
        metadata: {
          ...metadata,
          ...(alertConfig?.metadata ?? {}),
        },
        dedupKey: alertConfig?.dedupKey,
        bypassSeverityThreshold: alertConfig?.bypassSeverityThreshold,
      }).catch((error) => {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            event: "alert.dispatch.failed",
            service: "name100",
            environment: getRuntimeEnvironment(),
            error: serializeError(error),
            sourceEvent: event,
          })
        )
      })
    }
    return
  }

  console.log(payload)
}

export function logRequestError(
  context: RequestContext,
  event: string,
  error: unknown,
  metadata: LogMetadata = {}
) {
  logServerEvent("error", event, {
    requestId: context.requestId,
    route: context.route,
    method: context.method,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    error: serializeError(error),
    ...metadata,
  })
}

export function logHealthDegradation(
  context: RequestContext,
  metadata: {
    ok: boolean
    driver: string
    checks: Array<{
      name: string
      ok: boolean
      message: string
      latencyMs?: number
    }>
  }
) {
  logServerEvent("warn", "internal.health.degraded", {
    requestId: context.requestId,
    route: context.route,
    method: context.method,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    ok: metadata.ok,
    driver: metadata.driver,
    failedChecks: metadata.checks.filter((check) => !check.ok),
  })
}
