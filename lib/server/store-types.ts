import "server-only"

import type {
  ClaimIdentityRequest,
  ClaimIdentityResponse,
  IdentityStatusResponse,
  LeaderboardSummaryResponse,
  OpenGameState,
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  RecoverSessionRequest,
  RecoverSessionResponse,
  SessionBootstrapResponse,
  SubmitGuessRequest,
  SubmitGuessResponse,
  SubmitOpenGuessRequest,
  SubmitOpenGuessResponse,
  TrackShareRequest,
  TrackShareResponse,
  VerifyMagicLinkResponse,
} from "@/lib/backend-contracts"

export type SessionContextInput = {
  sessionToken: string | null
  userAgent: string | null
  ipAddress: string | null
}

export type BootstrapSessionResult = SessionBootstrapResponse & {
  sessionToken: string
  created: boolean
}

export type OpenGameStateResult = {
  state: OpenGameState
  sessionToken: string
  created: boolean
}

export type DailyStateResult = {
  state: import("@/lib/backend-contracts").DailyChallengeState
  overview: import("@/lib/backend-contracts").OverviewAnalytics
  sessionToken: string
  created: boolean
}

export type SubmitGuessResult = SubmitGuessResponse & {
  sessionToken: string
  created: boolean
}

export type SubmitOpenGuessResult = SubmitOpenGuessResponse & {
  sessionToken: string
  created: boolean
}

export type TrackShareResult = TrackShareResponse & {
  sessionToken: string
  created: boolean
}

export type LeaderboardSummaryResult = LeaderboardSummaryResponse & {
  sessionToken: string
  created: boolean
}

export type IdentityStatusResult = IdentityStatusResponse & {
  sessionToken: string
  created: boolean
}

export type ClaimIdentityResult = ClaimIdentityResponse & {
  sessionToken: string
  created: boolean
}

export type RecoverSessionResult = RecoverSessionResponse & {
  sessionToken: string
  created: boolean
}

export type RequestMagicLinkResult = RequestMagicLinkResponse & {
  sessionToken: string
  created: boolean
}

export type VerifyMagicLinkResult = VerifyMagicLinkResponse & {
  sessionToken: string
  created: boolean
}

export type DailyLeaderboardResult = {
  entries: import("@/lib/backend-contracts").DailyLeaderboardEntry[]
  sessionToken: string
  created: boolean
}

export type HealthStatus = {
  ok: boolean
  driver: string
  mode: string
  environment: string
  timestamp: string
  uptimeSeconds: number
  adminSecretConfigured: boolean
  rateLimitMode: "memory" | "postgres"
  databaseUrlConfigured?: boolean
  checks: Array<{
    name: string
    ok: boolean
    message: string
    latencyMs?: number
  }>
  message?: string
}

export type InitializeDatabaseResult = {
  ok: boolean
  driver: string
  initialized: boolean
  message: string
  totalMigrations?: number
  appliedMigrations?: string[]
}

export type AdminAuditIdentityEvent = {
  id: string
  playerId: string | null
  eventType: "claim_identity" | "recover_session" | "failed_recovery"
  handle: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

export type EmailDeliveryStatus =
  | "generated"
  | "queued"
  | "delivered"
  | "failed"
  | "bounced"
  | "complained"

export type AdminAuditMagicLink = {
  id: string
  playerId: string
  email: string
  mode: "link" | "login"
  expiresAt: string
  consumedAt: string | null
  createdAt: string
  delivery: {
    status: EmailDeliveryStatus | null
    driver: "log" | "webhook" | null
    providerMessageId: string | null
    lastEventAt: string | null
    failureReason: string | null
  }
}

export type AdminAuditPage<TItem, TFilters> = {
  filters: TFilters
  pagination: {
    limit: number
    offset: number
    returned: number
    total: number
    hasMore: boolean
  }
  items: TItem[]
}

export type GetAdminAuditInput = {
  identity: {
    eventType: AdminAuditIdentityEvent["eventType"] | null
    handle: string | null
    limit: number
    offset: number
  }
  magicLinks: {
    mode: AdminAuditMagicLink["mode"] | null
    email: string | null
    limit: number
    offset: number
  }
  operationalReports: {
    reportType: OperationalReportType | null
    limit: number
    offset: number
    sinceDays: 1 | 7 | 30 | 90 | null
    search: string | null
  }
  incidentHistory: {
    category:
      | "operational_alert"
      | "readiness_probe"
      | "retention_cleanup"
      | "leaderboard_recompute"
      | "abuse_restriction"
      | null
    limit: number
    offset: number
    sinceDays: 1 | 7 | 30 | 90 | null
    search: string | null
  }
}

export type RecordEmailDeliveryEventInput = {
  eventType: Exclude<EmailDeliveryStatus, "generated">
  tokenId: string | null
  providerMessageId: string | null
  providerEventId: string | null
  occurredAt: string | null
  failureReason: string | null
  payload: Record<string, unknown>
}

export type RecordEmailDeliveryEventResult = {
  ok: true
  matched: boolean
  deduplicated: boolean
  eventId: string | null
  tokenId: string | null
}

export type RunRetentionCleanupResult = {
  ok: true
  driver: string
  dryRun: boolean
  generatedAt: string
  retention: {
    magicLinkDays: number
    deliveryEventDays: number
    operationalReportDays: number
  }
  deleted: {
    magicLinkTokens: number
    deliveryEvents: number
    operationalReports: number
  }
  remaining: {
    magicLinkTokens: number
    deliveryEvents: number
    operationalReports: number
  }
}

export type CleanupRunSource = "admin" | "api" | "cron" | "unknown"

export type RunRetentionCleanupInput = {
  dryRun: boolean
  source?: CleanupRunSource
  reason?: string | null
  requestedBy?: string | null
  requestId?: string | null
}

export type AdminCleanupRun = {
  id: string
  jobType: "retention_cleanup"
  source: CleanupRunSource
  reason: string | null
  requestedBy: string | null
  requestId: string | null
  dryRun: boolean
  driver: string
  deleted: {
    magicLinkTokens: number
    deliveryEvents: number
    operationalReports: number
  }
  remaining: {
    magicLinkTokens: number
    deliveryEvents: number
    operationalReports: number
  }
  retention: {
    magicLinkDays: number
    deliveryEventDays: number
    operationalReportDays: number
  }
  createdAt: string
}

export type RecomputeLeaderboardSnapshotsInput = {
  dryRun: boolean
  date?: string | null
  days?: number | null
  source?: CleanupRunSource
  reason?: string | null
  requestedBy?: string | null
  requestId?: string | null
}

export type RecomputeLeaderboardSnapshotsResult = {
  ok: true
  driver: string
  dryRun: boolean
  generatedAt: string
  dates: string[]
  totalDates: number
  snapshots: {
    deletedRows: number
    insertedRows: number
  }
}

export type AdminLeaderboardRecomputeRun = {
  id: string
  jobType: "leaderboard_recompute"
  source: CleanupRunSource
  reason: string | null
  requestedBy: string | null
  requestId: string | null
  dryRun: boolean
  driver: string
  dates: string[]
  totalDates: number
  snapshots: {
    deletedRows: number
    insertedRows: number
  }
  createdAt: string
}

export type ReadinessProbeInput = {
  source?: CleanupRunSource
  reason?: string | null
  requestedBy?: string | null
  requestId?: string | null
}

export type OperationalAlertSeverity = "warn" | "error"
export type OperationalAlertDispatchStatus = "sent" | "suppressed" | "failed"
export type OperationalAlertSuppressionReason =
  | "webhook_unconfigured"
  | "below_threshold"
  | "deduplicated"

export type RecordOperationalAlertInput = {
  source?: CleanupRunSource
  requestId?: string | null
  route?: string | null
  event: string
  severity: OperationalAlertSeverity
  message: string
  metadata?: Record<string, unknown>
  dedupKey?: string | null
  dispatchStatus: OperationalAlertDispatchStatus
  suppressionReason?: OperationalAlertSuppressionReason | null
  errorMessage?: string | null
}

export type AdminOperationalAlertRun = {
  id: string
  jobType: "operational_alert"
  source: CleanupRunSource
  requestId: string | null
  route: string | null
  driver: string
  event: string
  severity: OperationalAlertSeverity
  message: string
  metadata: Record<string, unknown>
  dedupKey: string | null
  dispatchStatus: OperationalAlertDispatchStatus
  suppressionReason: OperationalAlertSuppressionReason | null
  errorMessage: string | null
  createdAt: string
}

export type AdminOperationalAlertSummary = {
  last24Hours: {
    totalAlerts: number
    sentAlerts: number
    suppressedAlerts: number
    failedAlerts: number
    warnAlerts: number
    errorAlerts: number
  }
  latestDispatchStatus: OperationalAlertDispatchStatus | "unknown"
  latestRecoveryAlertAt: string | null
  topEvents: Array<{
    event: string
    count: number
  }>
}

export type RecordOperationalAlertResult = {
  ok: true
  driver: string
  generatedAt: string
  alert: AdminOperationalAlertRun
}

export type OperationalReportType = "daily_report" | "incident_triage"

export type OperationalReportTimelineItem = {
  at: string
  category:
    | "operational_alert"
    | "readiness_probe"
    | "retention_cleanup"
    | "leaderboard_recompute"
    | "abuse_restriction"
  title: string
  detail: string
  severity: "warn" | "error" | null
}

export type RecordOperationalReportInput = {
  reportType: OperationalReportType
  source?: CleanupRunSource
  reason?: string | null
  requestedBy?: string | null
  requestId?: string | null
  summary: Record<string, unknown>
  actions: string[]
  timeline: OperationalReportTimelineItem[]
}

export type AdminOperationalReportRun = {
  id: string
  jobType: "operational_report"
  reportType: OperationalReportType
  source: CleanupRunSource
  reason: string | null
  requestedBy: string | null
  requestId: string | null
  driver: string
  summary: Record<string, unknown>
  actions: string[]
  timeline: OperationalReportTimelineItem[]
  createdAt: string
}

export type RecordOperationalReportResult = {
  ok: true
  driver: string
  generatedAt: string
  report: AdminOperationalReportRun
}

export type AdminReadinessProbeRun = {
  id: string
  jobType: "readiness_probe"
  source: CleanupRunSource
  reason: string | null
  requestedBy: string | null
  requestId: string | null
  driver: string
  ok: boolean
  failedChecks: number
  warningChecks: number
  checks: Array<{
    name: string
    ok: boolean
    severity: "info" | "warn" | "error"
    message: string
  }>
  createdAt: string
}

export type AdminReadinessProbeSummary = {
  last24Hours: {
    totalRuns: number
    failingRuns: number
    warningRuns: number
  }
  latestStatus: "passing" | "failing" | "unknown"
  latestEscalationLevel: "none" | "warning" | "error" | "critical"
  recoveredSincePreviousFailingRun: boolean
  consecutiveFailingRuns: number
  topFailingChecks: Array<{
    name: string
    count: number
  }>
}

export type AdminRecurringJobFreshnessJobType =
  | "readiness_probe"
  | "retention_cleanup"
  | "daily_report"

export type AdminRecurringJobFreshnessStatus = "healthy" | "warning" | "error"

export type AdminRecurringJobFreshnessItem = {
  jobType: AdminRecurringJobFreshnessJobType
  label: string
  expectedIntervalHours: number
  warningAfterHours: number
  errorAfterHours: number
  latestRunAt: string | null
  latestSource: CleanupRunSource | null
  latestRequestedBy: string | null
  ageHours: number | null
  status: AdminRecurringJobFreshnessStatus
  message: string
}

export type AdminRecurringJobFreshnessSummary = {
  warningJobs: number
  errorJobs: number
  items: AdminRecurringJobFreshnessItem[]
}

export type RecordReadinessProbeResult = {
  ok: true
  driver: string
  generatedAt: string
  run: AdminReadinessProbeRun
}

export type AbuseRestrictionTargetType = "player"

export type SetAbuseRestrictionInput = {
  action: "activate" | "lift"
  restrictionId?: string | null
  targetType?: AbuseRestrictionTargetType | null
  targetValue?: string | null
  reason?: string | null
  source?: CleanupRunSource
  requestedBy?: string | null
  requestId?: string | null
}

export type AdminAbuseRestriction = {
  id: string
  targetType: AbuseRestrictionTargetType
  targetValue: string
  reason: string | null
  source: CleanupRunSource
  requestedBy: string | null
  requestId: string | null
  active: boolean
  createdAt: string
  liftedAt: string | null
  liftedReason: string | null
}

export type SetAbuseRestrictionResult = {
  ok: true
  driver: string
  generatedAt: string
  restriction: AdminAbuseRestriction
}

export type AdminSuspiciousActivitySignalType =
  | "accepted_guess_burst"
  | "invalid_guess_burst"
  | "failed_recovery_burst"

export type AdminSuspiciousActivitySeverity = "medium" | "high"

export type AdminSuspiciousActivityFlag = {
  id: string
  signalType: AdminSuspiciousActivitySignalType
  severity: AdminSuspiciousActivitySeverity
  playerId: string | null
  handle: string | null
  summary: string
  detectedAt: string
  activeRestriction: boolean
  evidence: {
    eventCount: number
    windowSeconds: number
    firstEventAt: string | null
    lastEventAt: string | null
  }
}

export type AdminIncidentHistoryCategory =
  | "operational_alert"
  | "readiness_probe"
  | "retention_cleanup"
  | "leaderboard_recompute"
  | "abuse_restriction"

export type AdminIncidentHistoryItem = {
  id: string
  category: AdminIncidentHistoryCategory
  at: string
  source: CleanupRunSource
  title: string
  detail: string
  severity: "warn" | "error" | null
  requestId: string | null
}

export type AdminAuditResult = {
  driver: string
  generatedAt: string
  totals: {
    players: number
    claimedPlayers: number
    verifiedEmails: number
    activeSessions7d: number
    failedRecoveries24h: number
  }
  deliverySummary: {
    totalMagicLinks: number
    pendingMagicLinks: number
    deliveredMagicLinks: number
    failedMagicLinks: number
    bouncedMagicLinks: number
    complainedMagicLinks: number
    consumedMagicLinks: number
    expiredUnconsumedMagicLinks: number
  }
  identityEvents: AdminAuditPage<
    AdminAuditIdentityEvent,
    {
      eventType: AdminAuditIdentityEvent["eventType"] | null
      handle: string | null
    }
  >
  magicLinks: AdminAuditPage<
    AdminAuditMagicLink,
    {
      mode: AdminAuditMagicLink["mode"] | null
      email: string | null
    }
  >
  operationalReports: AdminAuditPage<
    AdminOperationalReportRun,
    {
      reportType: OperationalReportType | null
      sinceDays: 1 | 7 | 30 | 90 | null
      search: string | null
    }
  >
  incidentHistory: AdminAuditPage<
    AdminIncidentHistoryItem,
    {
      category: AdminIncidentHistoryCategory | null
      sinceDays: 1 | 7 | 30 | 90 | null
      search: string | null
    }
  >
  suspiciousActivity: {
    totalFlags: number
    activeRestrictionsOnFlaggedPlayers: number
    items: AdminSuspiciousActivityFlag[]
  }
  operationalAlertSummary: AdminOperationalAlertSummary
  recentOperationalAlerts: AdminOperationalAlertRun[]
  readinessProbeSummary: AdminReadinessProbeSummary
  recurringJobFreshnessSummary: AdminRecurringJobFreshnessSummary
  recentReadinessProbeRuns: AdminReadinessProbeRun[]
  recentCleanupRuns: AdminCleanupRun[]
  recentLeaderboardRecomputeRuns: AdminLeaderboardRecomputeRun[]
  recentAbuseRestrictions: AdminAbuseRestriction[]
}

export type RuntimeStore = {
  getSessionCookieName: () => string
  getHealthStatus: () => Promise<HealthStatus>
  initializeDatabase: () => Promise<InitializeDatabaseResult>
  bootstrapSession: (input: SessionContextInput) => Promise<BootstrapSessionResult>
  getOpenGameState: (input: SessionContextInput) => Promise<OpenGameStateResult>
  submitOpenGuess: (input: {
    request: SubmitOpenGuessRequest
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<SubmitOpenGuessResult>
  getDailyState: (input: {
    date: string
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<DailyStateResult>
  submitGuess: (input: {
    date: string
    request: SubmitGuessRequest
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<SubmitGuessResult>
  trackShare: (input: {
    date: string
    request: TrackShareRequest
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<TrackShareResult>
  getLeaderboardSummary: (input: {
    date: string
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<LeaderboardSummaryResult>
  getIdentityStatus: (input: SessionContextInput) => Promise<IdentityStatusResult>
  claimIdentity: (input: {
    request: ClaimIdentityRequest
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<ClaimIdentityResult>
  recoverSession: (input: {
    request: RecoverSessionRequest
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<RecoverSessionResult>
  requestMagicLink: (input: {
    request: RequestMagicLinkRequest
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<RequestMagicLinkResult>
  verifyMagicLink: (input: {
    token: string
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<VerifyMagicLinkResult>
  getAdminAudit: (input: GetAdminAuditInput) => Promise<AdminAuditResult>
  recordEmailDeliveryEvent: (
    input: RecordEmailDeliveryEventInput
  ) => Promise<RecordEmailDeliveryEventResult>
  recordReadinessProbe: (
    input: ReadinessProbeInput & {
      readiness: {
        ok: boolean
        summary: {
          failedChecks: number
          warningChecks: number
        }
        checks: Array<{
          name: string
          ok: boolean
          severity: "info" | "warn" | "error"
          message: string
        }>
      }
    }
  ) => Promise<RecordReadinessProbeResult>
  recordOperationalAlert: (
    input: RecordOperationalAlertInput
  ) => Promise<RecordOperationalAlertResult>
  recordOperationalReport: (
    input: RecordOperationalReportInput
  ) => Promise<RecordOperationalReportResult>
  runRetentionCleanup: (input: RunRetentionCleanupInput) => Promise<RunRetentionCleanupResult>
  recomputeLeaderboardSnapshots: (
    input: RecomputeLeaderboardSnapshotsInput
  ) => Promise<RecomputeLeaderboardSnapshotsResult>
  setAbuseRestriction: (
    input: SetAbuseRestrictionInput
  ) => Promise<SetAbuseRestrictionResult>
  getDailyLeaderboard: (input: {
    date: string
    sessionToken: string | null
    userAgent: string | null
    ipAddress: string | null
  }) => Promise<DailyLeaderboardResult>
}
