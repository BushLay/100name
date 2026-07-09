import type {
  AdminCleanupRun,
  AdminOperationalReportRun,
  AdminReadinessProbeRun,
  AdminRecurringJobFreshnessItem,
  AdminRecurringJobFreshnessJobType,
  AdminRecurringJobFreshnessStatus,
  AdminRecurringJobFreshnessSummary,
} from "./store-types.ts"

type RecurringJobDefinition = {
  jobType: AdminRecurringJobFreshnessJobType
  label: string
  expectedIntervalHours: number
  warningAfterHours: number
  errorAfterHours: number
  missingStatus: AdminRecurringJobFreshnessStatus
}

const RECURRING_JOB_DEFINITIONS: RecurringJobDefinition[] = [
  {
    jobType: "readiness_probe",
    label: "scheduled readiness probes",
    expectedIntervalHours: 1,
    warningAfterHours: 2,
    errorAfterHours: 6,
    missingStatus: "error",
  },
  {
    jobType: "retention_cleanup",
    label: "scheduled retention cleanup",
    expectedIntervalHours: 24,
    warningAfterHours: 30,
    errorAfterHours: 54,
    missingStatus: "warning",
  },
  {
    jobType: "daily_report",
    label: "scheduled daily reports",
    expectedIntervalHours: 24,
    warningAfterHours: 30,
    errorAfterHours: 54,
    missingStatus: "warning",
  },
]

function toRoundedHours(milliseconds: number) {
  return Math.round((milliseconds / (60 * 60 * 1000)) * 10) / 10
}

function buildFreshnessItem(
  definition: RecurringJobDefinition,
  latestRun:
    | Pick<AdminReadinessProbeRun, "createdAt" | "source" | "requestedBy">
    | Pick<AdminCleanupRun, "createdAt" | "source" | "requestedBy">
    | Pick<AdminOperationalReportRun, "createdAt" | "source" | "requestedBy">
    | null,
  now: number
): AdminRecurringJobFreshnessItem {
  if (!latestRun) {
    return {
      jobType: definition.jobType,
      label: definition.label,
      expectedIntervalHours: definition.expectedIntervalHours,
      warningAfterHours: definition.warningAfterHours,
      errorAfterHours: definition.errorAfterHours,
      latestRunAt: null,
      latestSource: null,
      latestRequestedBy: null,
      ageHours: null,
      status: definition.missingStatus,
      message: `No ${definition.label} have been recorded yet.`,
    }
  }

  const ageHours = toRoundedHours(now - new Date(latestRun.createdAt).getTime())
  const status: AdminRecurringJobFreshnessStatus =
    ageHours >= definition.errorAfterHours
      ? "error"
      : ageHours >= definition.warningAfterHours
        ? "warning"
        : "healthy"

  const message =
    status === "healthy"
      ? `${definition.label} last ran ${ageHours} hour(s) ago.`
      : `${definition.label} have not run for ${ageHours} hour(s).`

  return {
    jobType: definition.jobType,
    label: definition.label,
    expectedIntervalHours: definition.expectedIntervalHours,
    warningAfterHours: definition.warningAfterHours,
    errorAfterHours: definition.errorAfterHours,
    latestRunAt: latestRun.createdAt,
    latestSource: latestRun.source,
    latestRequestedBy: latestRun.requestedBy,
    ageHours,
    status,
    message,
  }
}

export function buildRecurringJobFreshnessSummary(input: {
  readinessProbeRuns: AdminReadinessProbeRun[]
  cleanupRuns: AdminCleanupRun[]
  operationalReports: AdminOperationalReportRun[]
  now?: number
}) {
  const now = input.now ?? Date.now()
  const latestReadinessProbe =
    input.readinessProbeRuns
      .filter((run) => run.source === "cron")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const latestCleanupRun =
    input.cleanupRuns
      .filter((run) => run.source === "cron")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const latestDailyReport =
    input.operationalReports
      .filter((report) => report.source === "cron" && report.reportType === "daily_report")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null

  const items = RECURRING_JOB_DEFINITIONS.map((definition) => {
    if (definition.jobType === "readiness_probe") {
      return buildFreshnessItem(definition, latestReadinessProbe, now)
    }

    if (definition.jobType === "retention_cleanup") {
      return buildFreshnessItem(definition, latestCleanupRun, now)
    }

    return buildFreshnessItem(definition, latestDailyReport, now)
  })

  return {
    warningJobs: items.filter((item) => item.status === "warning").length,
    errorJobs: items.filter((item) => item.status === "error").length,
    items,
  } satisfies AdminRecurringJobFreshnessSummary
}
