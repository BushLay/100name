export type HistoryQueryState = {
  operationalReportType: "" | "daily_report" | "incident_triage"
  operationalReportLimit: number
  operationalReportOffset: number
  operationalReportSinceDays: "" | "1" | "7" | "30" | "90"
  operationalReportSearch: string
  incidentHistoryCategory:
    | ""
    | "operational_alert"
    | "readiness_probe"
    | "retention_cleanup"
    | "leaderboard_recompute"
    | "abuse_restriction"
  incidentHistoryLimit: number
  incidentHistoryOffset: number
  incidentHistorySinceDays: "" | "1" | "7" | "30" | "90"
  incidentHistorySearch: string
}

export const DEFAULT_HISTORY_QUERY: HistoryQueryState = {
  operationalReportType: "",
  operationalReportLimit: 20,
  operationalReportOffset: 0,
  operationalReportSinceDays: "",
  operationalReportSearch: "",
  incidentHistoryCategory: "",
  incidentHistoryLimit: 25,
  incidentHistoryOffset: 0,
  incidentHistorySinceDays: "",
  incidentHistorySearch: "",
}

const REPORT_TYPES = new Set(["daily_report", "incident_triage"])
const HISTORY_CATEGORIES = new Set([
  "operational_alert",
  "readiness_probe",
  "retention_cleanup",
  "leaderboard_recompute",
  "abuse_restriction",
])
const SINCE_DAYS = new Set(["1", "7", "30", "90"])

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function parseLimit(value: string | null, fallback: number) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

function parseStringEnum<TValue extends string>(
  value: string | null,
  validValues: Set<string>
): TValue | "" {
  const normalized = value?.trim() ?? ""

  if (!normalized || !validValues.has(normalized)) {
    return ""
  }

  return normalized as TValue
}

export function parseHistoryQueryFromSearchParams(
  searchParams: URLSearchParams,
  defaults: HistoryQueryState = DEFAULT_HISTORY_QUERY
): HistoryQueryState {
  return {
    operationalReportType: parseStringEnum<
      HistoryQueryState["operationalReportType"]
    >(searchParams.get("operationalReportType"), REPORT_TYPES),
    operationalReportLimit: parseLimit(
      searchParams.get("operationalReportLimit"),
      defaults.operationalReportLimit
    ),
    operationalReportOffset: parsePositiveInt(
      searchParams.get("operationalReportOffset"),
      defaults.operationalReportOffset
    ),
    operationalReportSinceDays: parseStringEnum<
      HistoryQueryState["operationalReportSinceDays"]
    >(searchParams.get("operationalReportSinceDays"), SINCE_DAYS),
    operationalReportSearch: searchParams.get("operationalReportSearch")?.trim() ?? "",
    incidentHistoryCategory: parseStringEnum<
      HistoryQueryState["incidentHistoryCategory"]
    >(searchParams.get("incidentHistoryCategory"), HISTORY_CATEGORIES),
    incidentHistoryLimit: parseLimit(
      searchParams.get("incidentHistoryLimit"),
      defaults.incidentHistoryLimit
    ),
    incidentHistoryOffset: parsePositiveInt(
      searchParams.get("incidentHistoryOffset"),
      defaults.incidentHistoryOffset
    ),
    incidentHistorySinceDays: parseStringEnum<
      HistoryQueryState["incidentHistorySinceDays"]
    >(searchParams.get("incidentHistorySinceDays"), SINCE_DAYS),
    incidentHistorySearch: searchParams.get("incidentHistorySearch")?.trim() ?? "",
  }
}

export function buildHistorySearchParams(
  query: HistoryQueryState,
  defaults: HistoryQueryState = DEFAULT_HISTORY_QUERY
) {
  const params = new URLSearchParams()

  if (query.operationalReportType) {
    params.set("operationalReportType", query.operationalReportType)
  }

  if (query.operationalReportLimit !== defaults.operationalReportLimit) {
    params.set("operationalReportLimit", String(query.operationalReportLimit))
  }

  if (query.operationalReportOffset !== defaults.operationalReportOffset) {
    params.set("operationalReportOffset", String(query.operationalReportOffset))
  }

  if (query.operationalReportSinceDays) {
    params.set("operationalReportSinceDays", query.operationalReportSinceDays)
  }

  if (query.operationalReportSearch.trim()) {
    params.set("operationalReportSearch", query.operationalReportSearch.trim())
  }

  if (query.incidentHistoryCategory) {
    params.set("incidentHistoryCategory", query.incidentHistoryCategory)
  }

  if (query.incidentHistoryLimit !== defaults.incidentHistoryLimit) {
    params.set("incidentHistoryLimit", String(query.incidentHistoryLimit))
  }

  if (query.incidentHistoryOffset !== defaults.incidentHistoryOffset) {
    params.set("incidentHistoryOffset", String(query.incidentHistoryOffset))
  }

  if (query.incidentHistorySinceDays) {
    params.set("incidentHistorySinceDays", query.incidentHistorySinceDays)
  }

  if (query.incidentHistorySearch.trim()) {
    params.set("incidentHistorySearch", query.incidentHistorySearch.trim())
  }

  return params
}
