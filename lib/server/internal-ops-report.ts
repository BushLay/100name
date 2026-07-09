import type {
  CleanupRunSource,
  OperationalReportTimelineItem,
  OperationalReportType,
  RecordOperationalReportInput,
} from "@/lib/server/store-types"

const VALID_SOURCES = new Set<CleanupRunSource>(["admin", "api", "cron", "unknown"])
const VALID_REPORT_TYPES = new Set<OperationalReportType>(["daily_report", "incident_triage"])
const VALID_TIMELINE_CATEGORIES = new Set<OperationalReportTimelineItem["category"]>([
  "operational_alert",
  "readiness_probe",
  "retention_cleanup",
  "leaderboard_recompute",
  "abuse_restriction",
])
const VALID_SEVERITIES = new Set<Exclude<OperationalReportTimelineItem["severity"], null>>([
  "warn",
  "error",
])

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function parseInternalOperationalReportInput(value: unknown): RecordOperationalReportInput {
  if (!isPlainObject(value)) {
    throw new Error("Operational report body must be a JSON object.")
  }

  if (typeof value.reportType !== "string" || !VALID_REPORT_TYPES.has(value.reportType as OperationalReportType)) {
    throw new Error("reportType must be one of daily_report or incident_triage.")
  }

  const source =
    typeof value.source === "string" && VALID_SOURCES.has(value.source as CleanupRunSource)
      ? (value.source as CleanupRunSource)
      : value.source === undefined
        ? "unknown"
        : null

  if (!source) {
    throw new Error("source must be one of admin, api, cron, or unknown.")
  }

  if (!isPlainObject(value.summary)) {
    throw new Error("summary must be a JSON object.")
  }

  if (!Array.isArray(value.actions) || value.actions.some((action) => typeof action !== "string")) {
    throw new Error("actions must be an array of strings.")
  }

  if (!Array.isArray(value.timeline)) {
    throw new Error("timeline must be an array.")
  }

  const timeline = value.timeline.map((item) => {
    if (!isPlainObject(item)) {
      throw new Error("timeline items must be JSON objects.")
    }

    if (typeof item.at !== "string" || item.at.trim().length === 0) {
      throw new Error("timeline item at must be a non-empty string.")
    }

    if (
      typeof item.category !== "string" ||
      !VALID_TIMELINE_CATEGORIES.has(item.category as OperationalReportTimelineItem["category"])
    ) {
      throw new Error("timeline item category is invalid.")
    }

    if (typeof item.title !== "string" || item.title.trim().length === 0) {
      throw new Error("timeline item title must be a non-empty string.")
    }

    if (typeof item.detail !== "string" || item.detail.trim().length === 0) {
      throw new Error("timeline item detail must be a non-empty string.")
    }

    if (
      item.severity !== null &&
      item.severity !== undefined &&
      (typeof item.severity !== "string" ||
        !VALID_SEVERITIES.has(item.severity as Exclude<OperationalReportTimelineItem["severity"], null>))
    ) {
      throw new Error("timeline item severity must be warn, error, or null.")
    }

    return {
      at: item.at.trim(),
      category: item.category as OperationalReportTimelineItem["category"],
      title: item.title.trim(),
      detail: item.detail.trim(),
      severity:
        item.severity === null || item.severity === undefined
          ? null
          : (item.severity as Exclude<OperationalReportTimelineItem["severity"], null>),
    }
  })

  return {
    reportType: value.reportType as OperationalReportType,
    source,
    reason: normalizeOptionalString(value.reason),
    requestedBy: normalizeOptionalString(value.requestedBy),
    requestId: normalizeOptionalString(value.requestId),
    summary: value.summary,
    actions: value.actions.map((action) => action.trim()).filter((action) => action.length > 0),
    timeline,
  }
}
