import type { GetAdminAuditInput } from "@/lib/server/store-types"

export const ADMIN_AUDIT_DEFAULT_LIMIT = 20
export const ADMIN_AUDIT_MAX_LIMIT = 100

export const ADMIN_AUDIT_IDENTITY_EVENT_TYPES = [
  "claim_identity",
  "recover_session",
  "failed_recovery",
] as const

export const ADMIN_AUDIT_MAGIC_LINK_MODES = ["link", "login"] as const
export const ADMIN_AUDIT_OPERATIONAL_REPORT_TYPES = [
  "daily_report",
  "incident_triage",
] as const
export const ADMIN_AUDIT_OPERATIONAL_REPORT_SINCE_DAYS = [1, 7, 30, 90] as const
export const ADMIN_AUDIT_INCIDENT_HISTORY_CATEGORIES = [
  "operational_alert",
  "readiness_probe",
  "retention_cleanup",
  "leaderboard_recompute",
  "abuse_restriction",
] as const

type IdentityEventType = (typeof ADMIN_AUDIT_IDENTITY_EVENT_TYPES)[number]
type MagicLinkMode = (typeof ADMIN_AUDIT_MAGIC_LINK_MODES)[number]
type OperationalReportType = (typeof ADMIN_AUDIT_OPERATIONAL_REPORT_TYPES)[number]
type OperationalReportSinceDays = (typeof ADMIN_AUDIT_OPERATIONAL_REPORT_SINCE_DAYS)[number]
type IncidentHistoryCategory = (typeof ADMIN_AUDIT_INCIDENT_HISTORY_CATEGORIES)[number]

function parseOptionalString(value: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseLimit(value: string | null, label: string) {
  if (!value) {
    return ADMIN_AUDIT_DEFAULT_LIMIT
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`)
  }

  return Math.min(parsed, ADMIN_AUDIT_MAX_LIMIT)
}

function parseOffset(value: string | null, label: string) {
  if (!value) {
    return 0
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }

  return parsed
}

function parseEnumValue<TValue extends string>(
  value: string | null,
  validValues: readonly TValue[],
  label: string
) {
  const normalized = parseOptionalString(value)

  if (!normalized) {
    return null
  }

  if (!validValues.includes(normalized as TValue)) {
    throw new Error(`${label} must be one of: ${validValues.join(", ")}.`)
  }

  return normalized as TValue
}

function parseOptionalNumberEnum<TValue extends number>(
  value: string | null,
  validValues: readonly TValue[],
  label: string
) {
  if (!value) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || !validValues.includes(parsed as TValue)) {
    throw new Error(`${label} must be one of: ${validValues.join(", ")}.`)
  }

  return parsed as TValue
}

export function parseAdminAuditInput(searchParams: URLSearchParams): GetAdminAuditInput {
  return {
    identity: {
      eventType: parseEnumValue<IdentityEventType>(
        searchParams.get("identityEventType"),
        ADMIN_AUDIT_IDENTITY_EVENT_TYPES,
        "identityEventType"
      ),
      handle: parseOptionalString(searchParams.get("identityHandle")),
      limit: parseLimit(searchParams.get("identityLimit"), "identityLimit"),
      offset: parseOffset(searchParams.get("identityOffset"), "identityOffset"),
    },
    magicLinks: {
      mode: parseEnumValue<MagicLinkMode>(
        searchParams.get("magicLinkMode"),
        ADMIN_AUDIT_MAGIC_LINK_MODES,
        "magicLinkMode"
      ),
      email: parseOptionalString(searchParams.get("magicLinkEmail")),
      limit: parseLimit(searchParams.get("magicLinkLimit"), "magicLinkLimit"),
      offset: parseOffset(searchParams.get("magicLinkOffset"), "magicLinkOffset"),
    },
    operationalReports: {
      reportType: parseEnumValue<OperationalReportType>(
        searchParams.get("operationalReportType"),
        ADMIN_AUDIT_OPERATIONAL_REPORT_TYPES,
        "operationalReportType"
      ),
      limit: parseLimit(searchParams.get("operationalReportLimit"), "operationalReportLimit"),
      offset: parseOffset(searchParams.get("operationalReportOffset"), "operationalReportOffset"),
      sinceDays: parseOptionalNumberEnum<OperationalReportSinceDays>(
        searchParams.get("operationalReportSinceDays"),
        ADMIN_AUDIT_OPERATIONAL_REPORT_SINCE_DAYS,
        "operationalReportSinceDays"
      ),
      search: parseOptionalString(searchParams.get("operationalReportSearch")),
    },
    incidentHistory: {
      category: parseEnumValue<IncidentHistoryCategory>(
        searchParams.get("incidentHistoryCategory"),
        ADMIN_AUDIT_INCIDENT_HISTORY_CATEGORIES,
        "incidentHistoryCategory"
      ),
      limit: parseLimit(searchParams.get("incidentHistoryLimit"), "incidentHistoryLimit"),
      offset: parseOffset(searchParams.get("incidentHistoryOffset"), "incidentHistoryOffset"),
      sinceDays: parseOptionalNumberEnum<OperationalReportSinceDays>(
        searchParams.get("incidentHistorySinceDays"),
        ADMIN_AUDIT_OPERATIONAL_REPORT_SINCE_DAYS,
        "incidentHistorySinceDays"
      ),
      search: parseOptionalString(searchParams.get("incidentHistorySearch")),
    },
  }
}
