export type AlertSeverity = "warn" | "error"

export type OperationalAlertPayload = {
  event: string
  severity: AlertSeverity
  message: string
  metadata?: Record<string, unknown>
  dedupKey?: string
  bypassSeverityThreshold?: boolean
}

const SEVERITY_ORDER = {
  warn: 30,
  error: 40,
} as const

export function shouldDispatchOperationalAlert(
  severity: AlertSeverity,
  minimumSeverity: AlertSeverity,
  bypassSeverityThreshold = false
) {
  if (bypassSeverityThreshold) {
    return true
  }

  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[minimumSeverity]
}

export function buildOperationalAlertKey(payload: OperationalAlertPayload) {
  if (payload.dedupKey?.trim()) {
    return payload.dedupKey.trim()
  }

  const route = typeof payload.metadata?.route === "string" ? payload.metadata.route : "no-route"
  const status = typeof payload.metadata?.status === "number" ? payload.metadata.status : "no-status"

  return `${payload.event}:${payload.severity}:${route}:${status}:${payload.message}`
}

export type OperationalAlertDispatchStatus = "sent" | "suppressed" | "failed"

export type OperationalAlertRunLike = {
  event: string
  severity: AlertSeverity
  dispatchStatus: OperationalAlertDispatchStatus
  createdAt: string
}

export function summarizeOperationalAlertRuns(runs: OperationalAlertRunLike[]) {
  const now = Date.now()
  const last24HoursRuns = runs.filter(
    (run) => new Date(run.createdAt).getTime() >= now - 24 * 60 * 60 * 1000
  )
  const topEventCounts = new Map<string, number>()

  for (const run of last24HoursRuns) {
    topEventCounts.set(run.event, (topEventCounts.get(run.event) ?? 0) + 1)
  }

  return {
    last24Hours: {
      totalAlerts: last24HoursRuns.length,
      sentAlerts: last24HoursRuns.filter((run) => run.dispatchStatus === "sent").length,
      suppressedAlerts: last24HoursRuns.filter((run) => run.dispatchStatus === "suppressed").length,
      failedAlerts: last24HoursRuns.filter((run) => run.dispatchStatus === "failed").length,
      warnAlerts: last24HoursRuns.filter((run) => run.severity === "warn").length,
      errorAlerts: last24HoursRuns.filter((run) => run.severity === "error").length,
    },
    latestDispatchStatus: runs[0]?.dispatchStatus ?? "unknown",
    latestRecoveryAlertAt:
      runs.find((run) => run.event === "internal.readiness.recovered")?.createdAt ?? null,
    topEvents: [...topEventCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([event, count]) => ({
        event,
        count,
      })),
  }
}
