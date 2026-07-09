import "server-only"

import {
  getAlertDedupWindowMs,
  getAlertLevel,
  getAlertWebhookUrl,
  getStoreDriver,
  getRateLimitDriver,
} from "@/lib/server/env"
import {
  buildOperationalAlertKey,
  shouldDispatchOperationalAlert,
  type OperationalAlertPayload,
} from "@/lib/operational-alerts"
import { recordOperationalAlert } from "@/lib/server/runtime-store"

const recentlySentAlerts = new Map<string, number>()

async function persistOperationalAlert(
  payload: OperationalAlertPayload,
  input: {
    dispatchStatus: "sent" | "suppressed" | "failed"
    suppressionReason?: "webhook_unconfigured" | "below_threshold" | "deduplicated" | null
    errorMessage?: string | null
  }
) {
  try {
    await recordOperationalAlert({
      source: "api",
      requestId:
        typeof payload.metadata?.requestId === "string" ? payload.metadata.requestId : null,
      route: typeof payload.metadata?.route === "string" ? payload.metadata.route : null,
      event: payload.event,
      severity: payload.severity,
      message: payload.message,
      metadata: payload.metadata,
      dedupKey: payload.dedupKey ?? null,
      dispatchStatus: input.dispatchStatus,
      suppressionReason: input.suppressionReason ?? null,
      errorMessage: input.errorMessage ?? null,
    })
  } catch {
    // Alert persistence is best-effort so alert delivery cannot be blocked by audit writes.
  }
}

export type SendOperationalAlertResult = {
  dispatchStatus: "sent" | "suppressed" | "failed"
  suppressionReason?: "webhook_unconfigured" | "below_threshold" | "deduplicated" | null
  errorMessage?: string | null
}

function pruneExpiredEntries(currentTime: number, windowMs: number) {
  for (const [key, sentAt] of recentlySentAlerts.entries()) {
    if (currentTime - sentAt >= windowMs) {
      recentlySentAlerts.delete(key)
    }
  }
}

export async function sendOperationalAlert(payload: OperationalAlertPayload) {
  const webhookUrl = getAlertWebhookUrl()
  const meetsThreshold = shouldDispatchOperationalAlert(
    payload.severity,
    getAlertLevel(),
    payload.bypassSeverityThreshold
  )

  if (!webhookUrl) {
    await persistOperationalAlert(payload, {
      dispatchStatus: "suppressed",
      suppressionReason: "webhook_unconfigured",
    })
    return {
      dispatchStatus: "suppressed",
      suppressionReason: "webhook_unconfigured",
      errorMessage: null,
    } satisfies SendOperationalAlertResult
  }

  if (!meetsThreshold) {
    await persistOperationalAlert(payload, {
      dispatchStatus: "suppressed",
      suppressionReason: "below_threshold",
    })
    return {
      dispatchStatus: "suppressed",
      suppressionReason: "below_threshold",
      errorMessage: null,
    } satisfies SendOperationalAlertResult
  }

  const currentTime = Date.now()
  const dedupWindowMs = getAlertDedupWindowMs()
  pruneExpiredEntries(currentTime, dedupWindowMs)

  const alertKey = buildOperationalAlertKey(payload)
  const previousSentAt = recentlySentAlerts.get(alertKey)

  if (previousSentAt && currentTime - previousSentAt < dedupWindowMs) {
    await persistOperationalAlert(payload, {
      dispatchStatus: "suppressed",
      suppressionReason: "deduplicated",
    })
    return {
      dispatchStatus: "suppressed",
      suppressionReason: "deduplicated",
      errorMessage: null,
    } satisfies SendOperationalAlertResult
  }

  recentlySentAlerts.set(alertKey, currentTime)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        service: "name100",
        event: payload.event,
        severity: payload.severity,
        message: payload.message,
        environment: process.env.NODE_ENV || "development",
        storeDriver: getStoreDriver(),
        rateLimitDriver: getRateLimitDriver(),
        timestamp: new Date().toISOString(),
        metadata: payload.metadata ?? {},
      }),
      signal: AbortSignal.timeout(5_000),
    })

    if (!response.ok) {
      throw new Error(`Alert webhook returned ${response.status}.`)
    }

    await persistOperationalAlert(payload, {
      dispatchStatus: "sent",
    })
    return {
      dispatchStatus: "sent",
      suppressionReason: null,
      errorMessage: null,
    } satisfies SendOperationalAlertResult
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown alert dispatch failure."
    await persistOperationalAlert(payload, {
      dispatchStatus: "failed",
      errorMessage,
    })
    const dispatchError =
      error instanceof Error ? error : new Error("Unknown alert dispatch failure.")
    ;(
      dispatchError as Error & {
        dispatchResult?: SendOperationalAlertResult
      }
    ).dispatchResult = {
      dispatchStatus: "failed",
      suppressionReason: null,
      errorMessage,
    }
    throw dispatchError
  }
}

export function resetOperationalAlertStateForTests() {
  recentlySentAlerts.clear()
}
