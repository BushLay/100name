"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AdminAuditPayload = {
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
  identityEvents: {
    filters: {
      eventType: "claim_identity" | "recover_session" | "failed_recovery" | null
      handle: string | null
    }
    pagination: {
      limit: number
      offset: number
      returned: number
      total: number
      hasMore: boolean
    }
    items: Array<{
      id: string
      playerId: string | null
      eventType: "claim_identity" | "recover_session" | "failed_recovery"
      handle: string | null
      createdAt: string
      metadata: Record<string, unknown>
    }>
  }
  magicLinks: {
    filters: {
      mode: "link" | "login" | null
      email: string | null
    }
    pagination: {
      limit: number
      offset: number
      returned: number
      total: number
      hasMore: boolean
    }
    items: Array<{
      id: string
      playerId: string
      email: string
      mode: "link" | "login"
      expiresAt: string
      consumedAt: string | null
      createdAt: string
      delivery: {
        status:
          | "generated"
          | "queued"
          | "delivered"
          | "failed"
          | "bounced"
          | "complained"
          | null
        driver: "log" | "webhook" | null
        providerMessageId: string | null
        lastEventAt: string | null
        failureReason: string | null
      }
    }>
  }
  operationalReports: {
    filters: {
      reportType: "daily_report" | "incident_triage" | null
      sinceDays: 1 | 7 | 30 | 90 | null
      search: string | null
    }
    pagination: {
      limit: number
      offset: number
      returned: number
      total: number
      hasMore: boolean
    }
    items: Array<{
      id: string
      jobType: "operational_report"
      reportType: "daily_report" | "incident_triage"
      source: "admin" | "api" | "cron" | "unknown"
      reason: string | null
      requestedBy: string | null
      requestId: string | null
      driver: string
      summary: Record<string, unknown>
      actions: string[]
      timeline: Array<{
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
      }>
      createdAt: string
    }>
  }
  incidentHistory: {
    filters: {
      category:
        | "operational_alert"
        | "readiness_probe"
        | "retention_cleanup"
        | "leaderboard_recompute"
        | "abuse_restriction"
        | null
      sinceDays: 1 | 7 | 30 | 90 | null
      search: string | null
    }
    pagination: {
      limit: number
      offset: number
      returned: number
      total: number
      hasMore: boolean
    }
    items: Array<{
      id: string
      category:
        | "operational_alert"
        | "readiness_probe"
        | "retention_cleanup"
        | "leaderboard_recompute"
        | "abuse_restriction"
      at: string
      source: "admin" | "api" | "cron" | "unknown"
      title: string
      detail: string
      severity: "warn" | "error" | null
      requestId: string | null
    }>
  }
  suspiciousActivity: {
    totalFlags: number
    activeRestrictionsOnFlaggedPlayers: number
    items: Array<{
      id: string
      signalType: "accepted_guess_burst" | "invalid_guess_burst" | "failed_recovery_burst"
      severity: "medium" | "high"
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
    }>
  }
  operationalAlertSummary: {
    last24Hours: {
      totalAlerts: number
      sentAlerts: number
      suppressedAlerts: number
      failedAlerts: number
      warnAlerts: number
      errorAlerts: number
    }
    latestDispatchStatus: "sent" | "suppressed" | "failed" | "unknown"
    latestRecoveryAlertAt: string | null
    topEvents: Array<{
      event: string
      count: number
    }>
  }
  recentOperationalAlerts: Array<{
    id: string
    jobType: "operational_alert"
    source: "admin" | "api" | "cron" | "unknown"
    requestId: string | null
    route: string | null
    driver: string
    event: string
    severity: "warn" | "error"
    message: string
    metadata: Record<string, unknown>
    dedupKey: string | null
    dispatchStatus: "sent" | "suppressed" | "failed"
    suppressionReason: "webhook_unconfigured" | "below_threshold" | "deduplicated" | null
    errorMessage: string | null
    createdAt: string
  }>
  readinessProbeSummary: {
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
  recurringJobFreshnessSummary: {
    warningJobs: number
    errorJobs: number
    items: Array<{
      jobType: "readiness_probe" | "retention_cleanup" | "daily_report"
      label: string
      expectedIntervalHours: number
      warningAfterHours: number
      errorAfterHours: number
      latestRunAt: string | null
      latestSource: "admin" | "api" | "cron" | "unknown" | null
      latestRequestedBy: string | null
      ageHours: number | null
      status: "healthy" | "warning" | "error"
      message: string
    }>
  }
  recentReadinessProbeRuns: Array<{
    id: string
    jobType: "readiness_probe"
    source: "admin" | "api" | "cron" | "unknown"
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
  }>
  recentCleanupRuns: Array<{
    id: string
    jobType: "retention_cleanup"
    source: "admin" | "api" | "cron" | "unknown"
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
  }>
  recentLeaderboardRecomputeRuns: Array<{
    id: string
    jobType: "leaderboard_recompute"
    source: "admin" | "api" | "cron" | "unknown"
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
  }>
  recentAbuseRestrictions: Array<{
    id: string
    targetType: "player"
    targetValue: string
    reason: string | null
    source: "admin" | "api" | "cron" | "unknown"
    requestedBy: string | null
    requestId: string | null
    active: boolean
    createdAt: string
    liftedAt: string | null
    liftedReason: string | null
  }>
}

type CleanupResult = {
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

type LeaderboardRecomputeResult = {
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

type AbuseRestrictionResult = {
  ok: true
  driver: string
  generatedAt: string
  restriction: AdminAuditPayload["recentAbuseRestrictions"][number]
}

type AuditQueryState = {
  identityEventType: "" | "claim_identity" | "recover_session" | "failed_recovery"
  identityHandle: string
  identityLimit: number
  identityOffset: number
  magicLinkMode: "" | "link" | "login"
  magicLinkEmail: string
  magicLinkLimit: number
  magicLinkOffset: number
  operationalReportType: "" | "daily_report" | "incident_triage"
  operationalReportLimit: number
  operationalReportOffset: number
  operationalReportSinceDays: "" | "1" | "7" | "30" | "90"
  operationalReportSearch: string
  incidentHistoryCategory: "" | IncidentTimelineItem["category"]
  incidentHistoryLimit: number
  incidentHistoryOffset: number
  incidentHistorySinceDays: "" | "1" | "7" | "30" | "90"
  incidentHistorySearch: string
}

type IncidentTimelineItem = {
  at: string
  category:
    | "operational_alert"
    | "readiness_probe"
    | "retention_cleanup"
    | "leaderboard_recompute"
    | "abuse_restriction"
  title: string
  detail: string
  badgeLabel: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success"
}

const DEFAULT_QUERY: AuditQueryState = {
  identityEventType: "",
  identityHandle: "",
  identityLimit: 20,
  identityOffset: 0,
  magicLinkMode: "",
  magicLinkEmail: "",
  magicLinkLimit: 20,
  magicLinkOffset: 0,
  operationalReportType: "",
  operationalReportLimit: 10,
  operationalReportOffset: 0,
  operationalReportSinceDays: "",
  operationalReportSearch: "",
  incidentHistoryCategory: "",
  incidentHistoryLimit: 20,
  incidentHistoryOffset: 0,
  incidentHistorySinceDays: "",
  incidentHistorySearch: "",
}

function buildAuditUrl(query: AuditQueryState) {
  const params = new URLSearchParams()

  if (query.identityEventType) {
    params.set("identityEventType", query.identityEventType)
  }

  if (query.identityHandle.trim()) {
    params.set("identityHandle", query.identityHandle.trim())
  }

  if (query.identityLimit !== DEFAULT_QUERY.identityLimit) {
    params.set("identityLimit", String(query.identityLimit))
  }

  if (query.identityOffset !== 0) {
    params.set("identityOffset", String(query.identityOffset))
  }

  if (query.magicLinkMode) {
    params.set("magicLinkMode", query.magicLinkMode)
  }

  if (query.magicLinkEmail.trim()) {
    params.set("magicLinkEmail", query.magicLinkEmail.trim())
  }

  if (query.magicLinkLimit !== DEFAULT_QUERY.magicLinkLimit) {
    params.set("magicLinkLimit", String(query.magicLinkLimit))
  }

  if (query.magicLinkOffset !== 0) {
    params.set("magicLinkOffset", String(query.magicLinkOffset))
  }

  if (query.operationalReportType) {
    params.set("operationalReportType", query.operationalReportType)
  }

  if (query.operationalReportLimit !== DEFAULT_QUERY.operationalReportLimit) {
    params.set("operationalReportLimit", String(query.operationalReportLimit))
  }

  if (query.operationalReportOffset !== 0) {
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

  if (query.incidentHistoryLimit !== DEFAULT_QUERY.incidentHistoryLimit) {
    params.set("incidentHistoryLimit", String(query.incidentHistoryLimit))
  }

  if (query.incidentHistoryOffset !== 0) {
    params.set("incidentHistoryOffset", String(query.incidentHistoryOffset))
  }

  if (query.incidentHistorySinceDays) {
    params.set("incidentHistorySinceDays", query.incidentHistorySinceDays)
  }

  if (query.incidentHistorySearch.trim()) {
    params.set("incidentHistorySearch", query.incidentHistorySearch.trim())
  }

  const serialized = params.toString()
  return serialized ? `/api/internal/audit?${serialized}` : "/api/internal/audit"
}

function getEventBadgeVariant(eventType: AdminAuditPayload["identityEvents"]["items"][number]["eventType"]) {
  if (eventType === "failed_recovery") {
    return "destructive"
  }

  if (eventType === "recover_session") {
    return "secondary"
  }

  return "success"
}

function getDeliveryBadgeVariant(
  status: AdminAuditPayload["magicLinks"]["items"][number]["delivery"]["status"]
) {
  if (status === "failed" || status === "bounced" || status === "complained") {
    return "destructive"
  }

  if (status === "delivered") {
    return "success"
  }

  return "outline"
}

function getSuspiciousSignalLabel(
  signalType: AdminAuditPayload["suspiciousActivity"]["items"][number]["signalType"]
) {
  if (signalType === "accepted_guess_burst") {
    return "accepted burst"
  }

  if (signalType === "invalid_guess_burst") {
    return "invalid burst"
  }

  return "failed recovery"
}

function getSuspiciousSeverityVariant(
  severity: AdminAuditPayload["suspiciousActivity"]["items"][number]["severity"]
) {
  return severity === "high" ? "destructive" : "secondary"
}

function getReadinessEscalationVariant(
  escalationLevel: AdminAuditPayload["readinessProbeSummary"]["latestEscalationLevel"]
) {
  if (escalationLevel === "critical" || escalationLevel === "error") {
    return "destructive"
  }

  if (escalationLevel === "warning") {
    return "secondary"
  }

  return "outline"
}

function getOperationalAlertDispatchVariant(
  dispatchStatus: AdminAuditPayload["operationalAlertSummary"]["latestDispatchStatus"]
) {
  if (dispatchStatus === "failed") {
    return "destructive"
  }

  if (dispatchStatus === "sent") {
    return "success"
  }

  if (dispatchStatus === "suppressed") {
    return "secondary"
  }

  return "outline"
}

function getRecurringJobFreshnessVariant(
  status: AdminAuditPayload["recurringJobFreshnessSummary"]["items"][number]["status"]
) {
  if (status === "error") {
    return "destructive"
  }

  if (status === "warning") {
    return "secondary"
  }

  return "success"
}

function getIncidentHistoryBadgeVariant(
  item: AdminAuditPayload["incidentHistory"]["items"][number]
): IncidentTimelineItem["badgeVariant"] {
  if (item.category === "operational_alert") {
    return item.severity === "error" ? "destructive" : "secondary"
  }

  if (item.category === "readiness_probe") {
    return item.severity === "error" ? "destructive" : "success"
  }

  if (item.category === "abuse_restriction") {
    return item.title.includes("active") ? "destructive" : "outline"
  }

  return "outline"
}

function getIncidentHistoryBadgeLabel(item: AdminAuditPayload["incidentHistory"]["items"][number]) {
  if (item.category === "operational_alert") {
    return item.severity ?? "event"
  }

  if (item.category === "readiness_probe") {
    return item.severity === "error" ? "failing" : "passing"
  }

  if (item.category === "retention_cleanup" || item.category === "leaderboard_recompute") {
    return item.title.includes("dry run") ? "dry run" : "applied"
  }

  if (item.category === "abuse_restriction") {
    return item.title.includes("active") ? "active" : "lifted"
  }

  return "event"
}

export function AdminAuditBoard() {
  const [secret, setSecret] = useState("")
  const [audit, setAudit] = useState<AdminAuditPayload | null>(null)
  const [query, setQuery] = useState<AuditQueryState>(DEFAULT_QUERY)
  const [loading, setLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState<"dry-run" | "apply" | null>(null)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [cleanupReason, setCleanupReason] = useState("")
  const [recomputeLoading, setRecomputeLoading] = useState<"dry-run" | "apply" | null>(null)
  const [recomputeResult, setRecomputeResult] = useState<LeaderboardRecomputeResult | null>(null)
  const [recomputeDate, setRecomputeDate] = useState("")
  const [recomputeDays, setRecomputeDays] = useState("1")
  const [recomputeReason, setRecomputeReason] = useState("")
  const [restrictionLoading, setRestrictionLoading] = useState<string | null>(null)
  const [restrictionPlayerId, setRestrictionPlayerId] = useState("")
  const [restrictionReason, setRestrictionReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [exportState, setExportState] = useState<"idle" | "copied" | "failed">("idle")
  const [reportExportState, setReportExportState] = useState<"idle" | "copied" | "failed">("idle")
  const [timelineExportState, setTimelineExportState] = useState<"idle" | "copied" | "failed">("idle")

  async function loadAudit(nextQuery = query) {
    setLoading(true)
    setError(null)
    setExportState("idle")
    setReportExportState("idle")
    setTimelineExportState("idle")

    try {
      const response = await fetch(buildAuditUrl(nextQuery), {
        headers: {
          "x-name100-admin-secret": secret,
        },
      })
      const result = (await response.json()) as AdminAuditPayload & { message?: string }

      if (
        !response.ok ||
        !("totals" in result) ||
        !("deliverySummary" in result) ||
        !("suspiciousActivity" in result) ||
        !("operationalAlertSummary" in result) ||
        !("recentOperationalAlerts" in result) ||
        !("incidentHistory" in result) ||
        !("operationalReports" in result) ||
        !("readinessProbeSummary" in result) ||
        !("recurringJobFreshnessSummary" in result) ||
        !("recentReadinessProbeRuns" in result) ||
        !("recentCleanupRuns" in result) ||
        !("recentLeaderboardRecomputeRuns" in result) ||
        !("recentAbuseRestrictions" in result)
      ) {
        throw new Error(result.message ?? "Failed to load admin audit.")
      }

      setQuery(nextQuery)
      setAudit(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin audit.")
      setAudit(null)
    } finally {
      setLoading(false)
    }
  }

  async function runLeaderboardRecompute(dryRun: boolean) {
    setRecomputeLoading(dryRun ? "dry-run" : "apply")
    setError(null)

    try {
      const response = await fetch("/api/internal/recompute-leaderboards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-name100-admin-secret": secret,
          "x-name100-operator": "admin-dashboard",
        },
        body: JSON.stringify({
          dryRun,
          source: "admin",
          date: recomputeDate.trim() || undefined,
          days: Number(recomputeDays),
          reason: recomputeReason.trim() || null,
          requestedBy: "admin-dashboard",
        }),
      })
      const result = (await response.json()) as LeaderboardRecomputeResult & { message?: string }

      if (!response.ok || !("snapshots" in result)) {
        throw new Error(result.message ?? "Failed to recompute leaderboard snapshots.")
      }

      setRecomputeResult(result)
      await loadAudit(query)
    } catch (recomputeError) {
      setError(
        recomputeError instanceof Error
          ? recomputeError.message
          : "Failed to recompute leaderboard snapshots."
      )
    } finally {
      setRecomputeLoading(null)
    }
  }

  async function handleLoad(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadAudit({
      ...query,
      identityOffset: 0,
      magicLinkOffset: 0,
    })
  }

  async function handleCopyExport() {
    if (!audit) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(audit, null, 2))
      setExportState("copied")
    } catch {
      setExportState("failed")
    }
  }

  async function handleCopyReportArchive() {
    if (!audit) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(audit.operationalReports.items, null, 2))
      setReportExportState("copied")
    } catch {
      setReportExportState("failed")
    }
  }

  async function handleCopyTimelineExport() {
    if (!audit) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(audit.incidentHistory.items, null, 2))
      setTimelineExportState("copied")
    } catch {
      setTimelineExportState("failed")
    }
  }

  async function runCleanup(dryRun: boolean) {
    setCleanupLoading(dryRun ? "dry-run" : "apply")
    setError(null)

    try {
      const response = await fetch("/api/internal/cleanup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-name100-admin-secret": secret,
          "x-name100-operator": "admin-dashboard",
        },
        body: JSON.stringify({
          dryRun,
          source: "admin",
          reason: cleanupReason.trim() || null,
          requestedBy: "admin-dashboard",
        }),
      })
      const result = (await response.json()) as CleanupResult & { message?: string }

      if (!response.ok || !("deleted" in result)) {
        throw new Error(result.message ?? "Failed to run cleanup.")
      }

      setCleanupResult(result)

      if (!dryRun) {
        await loadAudit(query)
      }
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Failed to run cleanup.")
    } finally {
      setCleanupLoading(null)
    }
  }

  async function activateRestriction() {
    setRestrictionLoading("activate")
    setError(null)

    try {
      const response = await fetch("/api/internal/abuse-restrictions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-name100-admin-secret": secret,
          "x-name100-operator": "admin-dashboard",
        },
        body: JSON.stringify({
          action: "activate",
          source: "admin",
          targetType: "player",
          targetValue: restrictionPlayerId.trim(),
          reason: restrictionReason.trim() || null,
          requestedBy: "admin-dashboard",
        }),
      })
      const result = (await response.json()) as AbuseRestrictionResult & { message?: string }

      if (!response.ok || !("restriction" in result)) {
        throw new Error(result.message ?? "Failed to activate restriction.")
      }

      await loadAudit(query)
      setRestrictionPlayerId("")
      setRestrictionReason("")
    } catch (restrictionError) {
      setError(
        restrictionError instanceof Error ? restrictionError.message : "Failed to activate restriction."
      )
    } finally {
      setRestrictionLoading(null)
    }
  }

  async function liftRestriction(restrictionId: string) {
    setRestrictionLoading(restrictionId)
    setError(null)

    try {
      const response = await fetch("/api/internal/abuse-restrictions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-name100-admin-secret": secret,
          "x-name100-operator": "admin-dashboard",
        },
        body: JSON.stringify({
          action: "lift",
          restrictionId,
          source: "admin",
          reason: "lifted from admin dashboard",
          requestedBy: "admin-dashboard",
        }),
      })
      const result = (await response.json()) as AbuseRestrictionResult & { message?: string }

      if (!response.ok || !("restriction" in result)) {
        throw new Error(result.message ?? "Failed to lift restriction.")
      }

      await loadAudit(query)
    } catch (restrictionError) {
      setError(restrictionError instanceof Error ? restrictionError.message : "Failed to lift restriction.")
    } finally {
      setRestrictionLoading(null)
    }
  }

  function prefillRestriction(flag: AdminAuditPayload["suspiciousActivity"]["items"][number]) {
    if (!flag.playerId) {
      return
    }

    setRestrictionPlayerId(flag.playerId)
    setRestrictionReason(`Flagged by ${getSuspiciousSignalLabel(flag.signalType)} review`)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <CardHeader>
          <CardTitle>Operations audit</CardTitle>
          <CardDescription>
            View filtered identity activity, magic-link delivery health, and retention cleanup with
            the admin secret.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleLoad}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                autoComplete="off"
                disabled={loading || cleanupLoading !== null}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Enter NAME100_ADMIN_SECRET"
                type="password"
                value={secret}
              />
              <Button
                disabled={loading || cleanupLoading !== null || secret.trim().length === 0}
                type="submit"
              >
                {loading ? "Loading..." : "Load audit"}
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Identity event filters</p>
                    <p className="text-sm text-muted-foreground">
                      Search handle activity and recovery incidents.
                    </p>
                  </div>
                  <Badge variant="outline">Offset {query.identityOffset}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Event type</span>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={loading || cleanupLoading !== null}
                      onChange={(event) =>
                        setQuery((current) => ({
                          ...current,
                          identityEventType: event.target.value as AuditQueryState["identityEventType"],
                        }))
                      }
                      value={query.identityEventType}
                    >
                      <option value="">All events</option>
                      <option value="claim_identity">claim_identity</option>
                      <option value="recover_session">recover_session</option>
                      <option value="failed_recovery">failed_recovery</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Page size</span>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={loading || cleanupLoading !== null}
                      onChange={(event) =>
                        setQuery((current) => ({
                          ...current,
                          identityLimit: Number(event.target.value),
                        }))
                      }
                      value={String(query.identityLimit)}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </label>
                </div>
                <Input
                  autoComplete="off"
                  disabled={loading || cleanupLoading !== null}
                  onChange={(event) =>
                    setQuery((current) => ({
                      ...current,
                      identityHandle: event.target.value,
                    }))
                  }
                  placeholder="Filter handle contains..."
                  value={query.identityHandle}
                />
              </div>

              <div className="space-y-3 rounded-3xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Magic link filters</p>
                    <p className="text-sm text-muted-foreground">
                      Search login and email-link traffic.
                    </p>
                  </div>
                  <Badge variant="outline">Offset {query.magicLinkOffset}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Mode</span>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={loading || cleanupLoading !== null}
                      onChange={(event) =>
                        setQuery((current) => ({
                          ...current,
                          magicLinkMode: event.target.value as AuditQueryState["magicLinkMode"],
                        }))
                      }
                      value={query.magicLinkMode}
                    >
                      <option value="">All modes</option>
                      <option value="link">link</option>
                      <option value="login">login</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Page size</span>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={loading || cleanupLoading !== null}
                      onChange={(event) =>
                        setQuery((current) => ({
                          ...current,
                          magicLinkLimit: Number(event.target.value),
                        }))
                      }
                      value={String(query.magicLinkLimit)}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </label>
                </div>
                <Input
                  autoComplete="off"
                  disabled={loading || cleanupLoading !== null}
                  onChange={(event) =>
                    setQuery((current) => ({
                      ...current,
                      magicLinkEmail: event.target.value,
                    }))
                  }
                  placeholder="Filter email contains..."
                  value={query.magicLinkEmail}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={loading || cleanupLoading !== null || secret.trim().length === 0}
                type="submit"
              >
                {loading ? "Refreshing..." : "Apply filters"}
              </Button>
              <Button
                disabled={loading || cleanupLoading !== null}
                onClick={() => {
                  setQuery(DEFAULT_QUERY)
                  setAudit(null)
                  setCleanupResult(null)
                  setError(null)
                  setExportState("idle")
                }}
                type="button"
                variant="outline"
              >
                Reset local filters
              </Button>
              <Button disabled={!audit} onClick={handleCopyExport} type="button" variant="outline">
                Copy JSON export
              </Button>
              {exportState === "copied" ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Audit JSON copied.</p>
              ) : null}
              {exportState === "failed" ? (
                <p className="text-sm text-red-600 dark:text-red-400">Clipboard export failed.</p>
              ) : null}
            </div>
          </form>
          {error ? (
            <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      {audit ? (
        <>
          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle>System totals</CardTitle>
              <CardDescription>
                Driver `{audit.driver}` generated at {new Date(audit.generatedAt).toLocaleString()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Players</p>
                <p className="mt-2 text-3xl font-semibold">{audit.totals.players}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Claimed</p>
                <p className="mt-2 text-3xl font-semibold">{audit.totals.claimedPlayers}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Verified emails
                </p>
                <p className="mt-2 text-3xl font-semibold">{audit.totals.verifiedEmails}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Sessions 7d
                </p>
                <p className="mt-2 text-3xl font-semibold">{audit.totals.activeSessions7d}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Failed recovery 24h
                </p>
                <p className="mt-2 text-3xl font-semibold">{audit.totals.failedRecoveries24h}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle>Incident timeline</CardTitle>
              <CardDescription>
                Unified operator chronology across alerts, readiness probes, cleanup, recomputes, and restrictions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Search</span>
                  <Input
                    autoComplete="off"
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistorySearch: event.target.value,
                        incidentHistoryOffset: 0,
                      }))
                    }
                    placeholder="event, detail, request id..."
                    value={query.incidentHistorySearch}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistoryCategory:
                          event.target.value as AuditQueryState["incidentHistoryCategory"],
                        incidentHistoryOffset: 0,
                      }))
                    }
                    value={query.incidentHistoryCategory}
                  >
                    <option value="">All categories</option>
                    <option value="operational_alert">operational_alert</option>
                    <option value="readiness_probe">readiness_probe</option>
                    <option value="retention_cleanup">retention_cleanup</option>
                    <option value="leaderboard_recompute">leaderboard_recompute</option>
                    <option value="abuse_restriction">abuse_restriction</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Time range</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistorySinceDays:
                          event.target.value as AuditQueryState["incidentHistorySinceDays"],
                        incidentHistoryOffset: 0,
                      }))
                    }
                    value={query.incidentHistorySinceDays}
                  >
                    <option value="">All time</option>
                    <option value="1">24h</option>
                    <option value="7">7d</option>
                    <option value="30">30d</option>
                    <option value="90">90d</option>
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <Button
                    disabled={loading || secret.trim().length === 0}
                    onClick={() => void loadAudit({ ...query })}
                    type="button"
                    variant="secondary"
                  >
                    Apply
                  </Button>
                  <Button onClick={handleCopyTimelineExport} type="button" variant="outline">
                    Export filtered
                  </Button>
                </div>
              </div>

              {timelineExportState === "copied" ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Filtered incident timeline copied as JSON.
                </p>
              ) : null}
              {timelineExportState === "failed" ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to copy filtered incident timeline.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {audit.incidentHistory.pagination.returned} of{" "}
                  {audit.incidentHistory.pagination.total} history events
                </Badge>
                <Badge variant={getOperationalAlertDispatchVariant(audit.operationalAlertSummary.latestDispatchStatus)}>
                  latest alert {audit.operationalAlertSummary.latestDispatchStatus}
                </Badge>
                <Badge
                  variant={getReadinessEscalationVariant(
                    audit.readinessProbeSummary.latestEscalationLevel
                  )}
                >
                  readiness {audit.readinessProbeSummary.latestEscalationLevel}
                </Badge>
              </div>

              {audit.incidentHistory.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No incident timeline events match the current filters. Adjust the category or time range to broaden the view.
                </p>
              ) : (
                audit.incidentHistory.items.map((item) => (
                  <div className="rounded-2xl border border-border/60 p-4" key={`${item.category}-${item.at}-${item.title}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getIncidentHistoryBadgeVariant(item)}>
                        {getIncidentHistoryBadgeLabel(item)}
                      </Badge>
                      <Badge variant="secondary">{item.category}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(item.at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">{item.detail}</p>
                  </div>
                ))
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || query.incidentHistoryOffset === 0}
                  onClick={() =>
                    void loadAudit({
                      ...query,
                      incidentHistoryOffset: Math.max(
                        0,
                        query.incidentHistoryOffset - query.incidentHistoryLimit
                      ),
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  Previous page
                </Button>
                <Button
                  disabled={loading || !audit.incidentHistory.pagination.hasMore}
                  onClick={() =>
                    void loadAudit({
                      ...query,
                      incidentHistoryOffset: query.incidentHistoryOffset + query.incidentHistoryLimit,
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  Next page
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle>Ops report archive</CardTitle>
              <CardDescription>
                Recently archived daily reports and incident triage snapshots for handoff and post-incident review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_160px_auto]">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Search</span>
                  <Input
                    autoComplete="off"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        operationalReportSearch: event.target.value,
                        operationalReportOffset: 0,
                      }))
                    }
                    placeholder="reason, operator, action..."
                    value={query.operationalReportSearch}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Report type</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        operationalReportType: event.target.value as AuditQueryState["operationalReportType"],
                        operationalReportOffset: 0,
                      }))
                    }
                    value={query.operationalReportType}
                  >
                    <option value="">All archived reports</option>
                    <option value="daily_report">daily_report</option>
                    <option value="incident_triage">incident_triage</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Archive limit</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        operationalReportLimit: Number(event.target.value),
                        operationalReportOffset: 0,
                      }))
                    }
                    value={String(query.operationalReportLimit)}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Time range</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        operationalReportSinceDays:
                          event.target.value as AuditQueryState["operationalReportSinceDays"],
                        operationalReportOffset: 0,
                      }))
                    }
                    value={query.operationalReportSinceDays}
                  >
                    <option value="">All time</option>
                    <option value="1">24h</option>
                    <option value="7">7d</option>
                    <option value="30">30d</option>
                    <option value="90">90d</option>
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <Button
                    disabled={loading || secret.trim().length === 0}
                    onClick={() => void loadAudit({ ...query })}
                    type="button"
                    variant="secondary"
                  >
                    Apply
                  </Button>
                  <Button disabled={!audit} onClick={handleCopyReportArchive} type="button" variant="outline">
                    Export filtered
                  </Button>
                </div>
              </div>

              {reportExportState === "copied" ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Filtered archived reports copied as JSON.
                </p>
              ) : null}
              {reportExportState === "failed" ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to copy filtered archived reports.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {audit.operationalReports.pagination.returned} of{" "}
                  {audit.operationalReports.pagination.total} archived reports
                </Badge>
                <Badge variant="secondary">
                  offset {audit.operationalReports.pagination.offset}
                </Badge>
              </div>

              {audit.operationalReports.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No archived ops reports yet. Run the daily report or incident triage scripts to start building history.
                </p>
              ) : (
                audit.operationalReports.items.map((report) => (
                  <div className="rounded-2xl border border-border/60 p-4" key={report.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{report.reportType}</Badge>
                      <Badge variant="outline">{report.source}</Badge>
                      <Badge variant="outline">{report.driver}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">
                      {report.actions.length} action(s), {report.timeline.length} timeline event(s)
                    </p>
                    {report.reason ? (
                      <p className="mt-2 text-xs text-muted-foreground">reason: {report.reason}</p>
                    ) : null}
                    {report.requestedBy ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        requested by: {report.requestedBy}
                      </p>
                    ) : null}
                    {report.actions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {report.actions.slice(0, 4).map((action) => (
                          <Badge key={`${report.id}-${action}`} variant="outline">
                            {action}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || query.operationalReportOffset === 0}
                  onClick={() =>
                    void loadAudit({
                      ...query,
                      operationalReportOffset: Math.max(
                        0,
                        query.operationalReportOffset - query.operationalReportLimit
                      ),
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  Previous page
                </Button>
                <Button
                  disabled={loading || !audit.operationalReports.pagination.hasMore}
                  onClick={() =>
                    void loadAudit({
                      ...query,
                      operationalReportOffset:
                        query.operationalReportOffset + query.operationalReportLimit,
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  Next page
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Magic link delivery summary</CardTitle>
                <CardDescription>
                  Snapshot of pending, delivered, failed, bounced, complained, and consumed email
                  traffic.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.totalMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.pendingMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Delivered</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.deliveredMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Consumed</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.consumedMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Failed</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.failedMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bounced</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.bouncedMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Complained</p>
                  <p className="mt-2 text-3xl font-semibold">{audit.deliverySummary.complainedMagicLinks}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Expired pending
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {audit.deliverySummary.expiredUnconsumedMagicLinks}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Retention cleanup</CardTitle>
                <CardDescription>
                  Preview cleanup impact first, then apply it from this operator panel when the
                  retention windows look correct.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  autoComplete="off"
                  disabled={secret.trim().length === 0 || cleanupLoading !== null || loading}
                  onChange={(event) => setCleanupReason(event.target.value)}
                  placeholder="Optional reason, e.g. daily retention review"
                  value={cleanupReason}
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={secret.trim().length === 0 || cleanupLoading !== null || loading}
                    onClick={() => runCleanup(true)}
                    type="button"
                    variant="outline"
                  >
                    {cleanupLoading === "dry-run" ? "Previewing..." : "Preview cleanup"}
                  </Button>
                  <Button
                    disabled={secret.trim().length === 0 || cleanupLoading !== null || loading}
                    onClick={() => runCleanup(false)}
                    type="button"
                    variant="destructive"
                  >
                    {cleanupLoading === "apply" ? "Cleaning..." : "Run cleanup"}
                  </Button>
                </div>

                {cleanupResult ? (
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={cleanupResult.dryRun ? "outline" : "destructive"}>
                        {cleanupResult.dryRun ? "dry run" : "applied"}
                      </Badge>
                      <Badge variant="secondary">{cleanupResult.driver}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Generated {new Date(cleanupResult.generatedAt).toLocaleString()}
                    </p>
                    <p className="mt-3 text-sm">
                      Deletes {cleanupResult.deleted.magicLinkTokens} stale magic-link tokens and{" "}
                      {cleanupResult.deleted.deliveryEvents} delivery events.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Retention windows: magic links {cleanupResult.retention.magicLinkDays} days,
                      delivery events {cleanupResult.retention.deliveryEventDays} days.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Remaining after {cleanupResult.dryRun ? "preview" : "cleanup"}:{" "}
                      {cleanupResult.remaining.magicLinkTokens} tokens,{" "}
                      {cleanupResult.remaining.deliveryEvents} delivery events.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No cleanup run yet. Start with a preview so we can confirm retention impact
                    before deleting anything.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle>Recent cleanup runs</CardTitle>
              <CardDescription>
                Auditable retention job history for manual and scheduled operations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {audit.recentCleanupRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No cleanup history yet. The first preview or cleanup run will appear here.
                </p>
              ) : (
                audit.recentCleanupRuns.map((run) => (
                  <div className="rounded-2xl border border-border/60 p-4" key={run.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={run.dryRun ? "outline" : "destructive"}>
                        {run.dryRun ? "dry run" : "applied"}
                      </Badge>
                      <Badge variant="secondary">{run.source}</Badge>
                      <Badge variant="outline">{run.driver}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">
                      Deleted {run.deleted.magicLinkTokens} tokens, {run.deleted.deliveryEvents}{" "}
                      delivery events, and {run.deleted.operationalReports} archived ops reports.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Remaining {run.remaining.magicLinkTokens} tokens, {run.remaining.deliveryEvents}{" "}
                      delivery events, {run.remaining.operationalReports} archived ops reports.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Retention {run.retention.magicLinkDays}d tokens /{" "}
                      {run.retention.deliveryEventDays}d delivery events /{" "}
                      {run.retention.operationalReportDays}d ops reports.
                    </p>
                    {run.reason ? (
                      <p className="mt-2 text-xs text-muted-foreground">reason: {run.reason}</p>
                    ) : null}
                    {run.requestedBy ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        requested by: {run.requestedBy}
                      </p>
                    ) : null}
                    {run.requestId ? (
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        request id: {run.requestId}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle>Scheduled job freshness</CardTitle>
              <CardDescription>
                Shows whether recurring readiness, cleanup, and daily handoff jobs are still arriving on schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    audit.recurringJobFreshnessSummary.errorJobs > 0
                      ? "destructive"
                      : audit.recurringJobFreshnessSummary.warningJobs > 0
                        ? "secondary"
                        : "success"
                  }
                >
                  {audit.recurringJobFreshnessSummary.errorJobs} error /{" "}
                  {audit.recurringJobFreshnessSummary.warningJobs} warning
                </Badge>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {audit.recurringJobFreshnessSummary.items.map((item) => (
                  <div className="rounded-2xl border border-border/60 p-4" key={item.jobType}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getRecurringJobFreshnessVariant(item.status)}>
                        {item.status}
                      </Badge>
                      <Badge variant="outline">{item.jobType}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      cadence {item.expectedIntervalHours}h / warn {item.warningAfterHours}h / error{" "}
                      {item.errorAfterHours}h
                    </p>
                    {item.latestRunAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        last run {new Date(item.latestRunAt).toLocaleString()} via{" "}
                        {item.latestSource ?? "unknown"}
                        {item.latestRequestedBy ? ` (${item.latestRequestedBy})` : ""}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Operational alerts</CardTitle>
                <CardDescription>
                  Recent outbound alert attempts, suppressions, and failures for long-term incident tracking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Alerts 24h
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.operationalAlertSummary.last24Hours.totalAlerts}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Failed sends
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.operationalAlertSummary.last24Hours.failedAlerts}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Suppressed
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.operationalAlertSummary.last24Hours.suppressedAlerts}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={getOperationalAlertDispatchVariant(
                      audit.operationalAlertSummary.latestDispatchStatus
                    )}
                  >
                    latest {audit.operationalAlertSummary.latestDispatchStatus}
                  </Badge>
                  <Badge variant="outline">
                    {audit.operationalAlertSummary.last24Hours.errorAlerts} error
                  </Badge>
                  <Badge variant="outline">
                    {audit.operationalAlertSummary.last24Hours.warnAlerts} warn
                  </Badge>
                </div>

                {audit.operationalAlertSummary.latestRecoveryAlertAt ? (
                  <p className="text-sm text-muted-foreground">
                    Latest recovery alert:{" "}
                    {new Date(audit.operationalAlertSummary.latestRecoveryAlertAt).toLocaleString()}
                  </p>
                ) : null}

                {audit.operationalAlertSummary.topEvents.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {audit.operationalAlertSummary.topEvents.map((item) => (
                      <Badge key={item.event} variant="outline">
                        {item.event} x {item.count}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {audit.recentOperationalAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No operational alert history yet. Trigger a protected warning or readiness run to record it.
                  </p>
                ) : (
                  audit.recentOperationalAlerts.map((alert) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={alert.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={alert.severity === "error" ? "destructive" : "secondary"}
                        >
                          {alert.severity}
                        </Badge>
                        <Badge variant={getOperationalAlertDispatchVariant(alert.dispatchStatus)}>
                          {alert.dispatchStatus}
                        </Badge>
                        <Badge variant="secondary">{alert.source}</Badge>
                        <Badge variant="outline">{alert.driver}</Badge>
                      </div>
                      <p className="mt-2 break-all text-sm font-medium">{alert.event}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm">{alert.message}</p>
                      {alert.suppressionReason ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          suppression: {alert.suppressionReason}
                        </p>
                      ) : null}
                      {alert.errorMessage ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          dispatch error: {alert.errorMessage}
                        </p>
                      ) : null}
                      {alert.route ? (
                        <p className="mt-2 text-xs text-muted-foreground">route: {alert.route}</p>
                      ) : null}
                      {alert.requestId ? (
                        <p className="mt-2 break-all text-xs text-muted-foreground">
                          request id: {alert.requestId}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Recent readiness probes</CardTitle>
                <CardDescription>
                  Scheduled operational-readiness runs with failing and warning check counts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Runs 24h
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.readinessProbeSummary.last24Hours.totalRuns}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Failing 24h
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.readinessProbeSummary.last24Hours.failingRuns}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Consecutive fails
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.readinessProbeSummary.consecutiveFailingRuns}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Latest
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {audit.readinessProbeSummary.latestStatus}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={getReadinessEscalationVariant(
                      audit.readinessProbeSummary.latestEscalationLevel
                    )}
                  >
                    escalation {audit.readinessProbeSummary.latestEscalationLevel}
                  </Badge>
                  {audit.readinessProbeSummary.recoveredSincePreviousFailingRun ? (
                    <Badge variant="success">recently recovered</Badge>
                  ) : null}
                </div>

                {audit.readinessProbeSummary.recoveredSincePreviousFailingRun ? (
                  <p className="text-sm text-muted-foreground">
                    The latest recorded readiness probe recovered after an earlier failing run.
                  </p>
                ) : null}

                {audit.readinessProbeSummary.topFailingChecks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {audit.readinessProbeSummary.topFailingChecks.map((check) => (
                      <Badge key={check.name} variant="outline">
                        {check.name} × {check.count}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {audit.recentReadinessProbeRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No readiness probe history yet. Run the scheduled readiness checker to start recording it.
                  </p>
                ) : (
                  audit.recentReadinessProbeRuns.map((run) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={run.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={run.ok ? "success" : "destructive"}>
                          {run.ok ? "passing" : "failing"}
                        </Badge>
                        <Badge variant="secondary">{run.source}</Badge>
                        <Badge variant="outline">{run.driver}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm">
                        {run.failedChecks} failed check(s), {run.warningChecks} warning check(s).
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {run.checks
                          .filter((check) => !check.ok)
                          .slice(0, 4)
                          .map((check) => (
                            <Badge
                              key={`${run.id}-${check.name}`}
                              variant={check.severity === "error" ? "destructive" : "outline"}
                            >
                              {check.name}
                            </Badge>
                          ))}
                      </div>
                      {run.reason ? (
                        <p className="mt-2 text-xs text-muted-foreground">reason: {run.reason}</p>
                      ) : null}
                      {run.requestedBy ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          requested by: {run.requestedBy}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Suspicious activity</CardTitle>
                <CardDescription>
                  Heuristic alerts from guess and recovery traffic so operators can review likely
                  abuse before applying a restriction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{audit.suspiciousActivity.totalFlags} flags</Badge>
                  <Badge variant="secondary">
                    {audit.suspiciousActivity.activeRestrictionsOnFlaggedPlayers} already restricted
                  </Badge>
                </div>

                {audit.suspiciousActivity.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No suspicious activity signals crossed the current thresholds.
                  </p>
                ) : (
                  audit.suspiciousActivity.items.map((flag) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={flag.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getSuspiciousSeverityVariant(flag.severity)}>
                          {flag.severity}
                        </Badge>
                        <Badge variant="outline">{getSuspiciousSignalLabel(flag.signalType)}</Badge>
                        {flag.activeRestriction ? (
                          <Badge variant="destructive">restricted</Badge>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm">{flag.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        detected {new Date(flag.detectedAt).toLocaleString()}
                      </p>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        player: {flag.playerId ?? "n/a"}
                        {flag.handle ? ` · handle: @${flag.handle}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {flag.evidence.eventCount} events in {flag.evidence.windowSeconds} seconds
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {flag.evidence.firstEventAt
                          ? `window ${new Date(flag.evidence.firstEventAt).toLocaleString()} to ${new Date(flag.evidence.lastEventAt ?? flag.evidence.firstEventAt).toLocaleString()}`
                          : "No detailed event window available."}
                      </p>
                      {flag.playerId && !flag.activeRestriction ? (
                        <Button
                          className="mt-3"
                          disabled={restrictionLoading !== null || loading}
                          onClick={() => prefillRestriction(flag)}
                          type="button"
                          variant="outline"
                        >
                          Use in restriction form
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Abuse controls</CardTitle>
                <CardDescription>
                  Restrict a player from write actions such as guessing, claiming identity, and requesting magic links.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  autoComplete="off"
                  disabled={secret.trim().length === 0 || restrictionLoading !== null || loading}
                  onChange={(event) => setRestrictionPlayerId(event.target.value)}
                  placeholder="Player ID to restrict"
                  value={restrictionPlayerId}
                />
                <Input
                  autoComplete="off"
                  disabled={secret.trim().length === 0 || restrictionLoading !== null || loading}
                  onChange={(event) => setRestrictionReason(event.target.value)}
                  placeholder="Optional reason"
                  value={restrictionReason}
                />
                <Button
                  disabled={
                    secret.trim().length === 0 ||
                    restrictionLoading !== null ||
                    loading ||
                    restrictionPlayerId.trim().length === 0
                  }
                  onClick={activateRestriction}
                  type="button"
                  variant="destructive"
                >
                  {restrictionLoading === "activate" ? "Restricting..." : "Restrict player"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Recent abuse restrictions</CardTitle>
                <CardDescription>
                  Latest operator-issued restrictions and lifts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {audit.recentAbuseRestrictions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No abuse restrictions recorded yet.</p>
                ) : (
                  audit.recentAbuseRestrictions.map((restriction) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={restriction.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={restriction.active ? "destructive" : "outline"}>
                          {restriction.active ? "active" : "lifted"}
                        </Badge>
                        <Badge variant="secondary">{restriction.targetType}</Badge>
                      </div>
                      <p className="mt-2 break-all text-sm">{restriction.targetValue}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        created {new Date(restriction.createdAt).toLocaleString()}
                      </p>
                      {restriction.reason ? (
                        <p className="mt-2 text-xs text-muted-foreground">reason: {restriction.reason}</p>
                      ) : null}
                      {restriction.active ? (
                        <Button
                          className="mt-3"
                          disabled={restrictionLoading !== null || loading}
                          onClick={() => liftRestriction(restriction.id)}
                          type="button"
                          variant="outline"
                        >
                          {restrictionLoading === restriction.id ? "Lifting..." : "Lift restriction"}
                        </Button>
                      ) : null}
                      {restriction.liftedAt ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          lifted {new Date(restriction.liftedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Leaderboard snapshot recompute</CardTitle>
                <CardDescription>
                  Rebuild precomputed daily leaderboard snapshots for one date or a short rolling
                  window.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    autoComplete="off"
                    disabled={secret.trim().length === 0 || recomputeLoading !== null || loading}
                    onChange={(event) => setRecomputeDate(event.target.value)}
                    placeholder="Anchor date (YYYY-MM-DD)"
                    value={recomputeDate}
                  />
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Days back</span>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={secret.trim().length === 0 || recomputeLoading !== null || loading}
                      onChange={(event) => setRecomputeDays(event.target.value)}
                      value={recomputeDays}
                    >
                      <option value="1">1 day</option>
                      <option value="3">3 days</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                    </select>
                  </label>
                </div>
                <Input
                  autoComplete="off"
                  disabled={secret.trim().length === 0 || recomputeLoading !== null || loading}
                  onChange={(event) => setRecomputeReason(event.target.value)}
                  placeholder="Optional reason, e.g. after rules fix"
                  value={recomputeReason}
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={secret.trim().length === 0 || recomputeLoading !== null || loading}
                    onClick={() => runLeaderboardRecompute(true)}
                    type="button"
                    variant="outline"
                  >
                    {recomputeLoading === "dry-run" ? "Previewing..." : "Preview recompute"}
                  </Button>
                  <Button
                    disabled={secret.trim().length === 0 || recomputeLoading !== null || loading}
                    onClick={() => runLeaderboardRecompute(false)}
                    type="button"
                  >
                    {recomputeLoading === "apply" ? "Recomputing..." : "Run recompute"}
                  </Button>
                </div>
                {recomputeResult ? (
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={recomputeResult.dryRun ? "outline" : "success"}>
                        {recomputeResult.dryRun ? "dry run" : "applied"}
                      </Badge>
                      <Badge variant="secondary">{recomputeResult.driver}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Generated {new Date(recomputeResult.generatedAt).toLocaleString()}
                    </p>
                    <p className="mt-3 text-sm">
                      {recomputeResult.totalDates} date(s), {recomputeResult.snapshots.deletedRows}{" "}
                      rows replaced, {recomputeResult.snapshots.insertedRows} rows inserted.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Dates: {recomputeResult.dates.join(", ")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recompute run yet. Start with a preview to validate the affected dates.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Recent leaderboard recomputes</CardTitle>
                <CardDescription>
                  Snapshot rebuild history for manual fixes and scheduled maintenance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {audit.recentLeaderboardRecomputeRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No leaderboard recompute history yet.
                  </p>
                ) : (
                  audit.recentLeaderboardRecomputeRuns.map((run) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={run.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={run.dryRun ? "outline" : "success"}>
                          {run.dryRun ? "dry run" : "applied"}
                        </Badge>
                        <Badge variant="secondary">{run.source}</Badge>
                        <Badge variant="outline">{run.driver}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm">
                        {run.totalDates} date(s), {run.snapshots.deletedRows} rows replaced,{" "}
                        {run.snapshots.insertedRows} rows inserted.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Dates: {run.dates.join(", ")}
                      </p>
                      {run.reason ? (
                        <p className="mt-2 text-xs text-muted-foreground">reason: {run.reason}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Identity events</CardTitle>
                <CardDescription>
                  Filtered identity activity with pagination for claim, recovery, and failed
                  recovery events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {audit.identityEvents.pagination.returned} / {audit.identityEvents.pagination.total}{" "}
                    shown
                  </Badge>
                  {audit.identityEvents.filters.eventType ? (
                    <Badge variant="secondary">{audit.identityEvents.filters.eventType}</Badge>
                  ) : null}
                  {audit.identityEvents.filters.handle ? (
                    <Badge variant="secondary">
                      handle contains {audit.identityEvents.filters.handle}
                    </Badge>
                  ) : null}
                </div>

                {audit.identityEvents.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No identity events recorded yet.</p>
                ) : (
                  audit.identityEvents.items.map((event) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={event.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getEventBadgeVariant(event.eventType)}>{event.eventType}</Badge>
                        {event.handle ? <Badge variant="outline">@{event.handle}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        player: {event.playerId ?? "n/a"}
                      </p>
                      {Object.keys(event.metadata).length > 0 ? (
                        <pre className="mt-3 overflow-x-auto rounded-xl bg-black/5 p-3 text-xs text-muted-foreground dark:bg-white/5">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))
                )}

                <div className="flex gap-3">
                  <Button
                    disabled={loading || cleanupLoading !== null || audit.identityEvents.pagination.offset === 0}
                    onClick={() =>
                      loadAudit({
                        ...query,
                        identityOffset: Math.max(0, query.identityOffset - query.identityLimit),
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={loading || cleanupLoading !== null || !audit.identityEvents.pagination.hasMore}
                    onClick={() =>
                      loadAudit({
                        ...query,
                        identityOffset: query.identityOffset + query.identityLimit,
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
              <CardHeader>
                <CardTitle>Magic links</CardTitle>
                <CardDescription>
                  Filtered email-link and login token activity with pagination for operator review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {audit.magicLinks.pagination.returned} / {audit.magicLinks.pagination.total} shown
                  </Badge>
                  {audit.magicLinks.filters.mode ? (
                    <Badge variant="secondary">{audit.magicLinks.filters.mode}</Badge>
                  ) : null}
                  {audit.magicLinks.filters.email ? (
                    <Badge variant="secondary">
                      email contains {audit.magicLinks.filters.email}
                    </Badge>
                  ) : null}
                </div>

                {audit.magicLinks.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No magic-link requests recorded yet.</p>
                ) : (
                  audit.magicLinks.items.map((token) => (
                    <div className="rounded-2xl border border-border/60 p-4" key={token.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{token.email}</p>
                        <Badge variant="secondary">{token.mode}</Badge>
                        <Badge variant={token.consumedAt ? "success" : "outline"}>
                          {token.consumedAt ? "consumed" : "pending"}
                        </Badge>
                        <Badge variant={getDeliveryBadgeVariant(token.delivery.status)}>
                          {token.delivery.status ?? "unknown"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        created {new Date(token.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {token.consumedAt
                          ? `Consumed ${new Date(token.consumedAt).toLocaleString()}`
                          : `Expires ${new Date(token.expiresAt).toLocaleString()}`}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {token.delivery.lastEventAt
                          ? `Delivery event ${new Date(token.delivery.lastEventAt).toLocaleString()}`
                          : "No provider callback recorded yet."}
                      </p>
                      {token.delivery.driver ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          driver: {token.delivery.driver}
                          {token.delivery.providerMessageId
                            ? ` · provider message ${token.delivery.providerMessageId}`
                            : ""}
                        </p>
                      ) : null}
                      {token.delivery.failureReason ? (
                        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                          {token.delivery.failureReason}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}

                <div className="flex gap-3">
                  <Button
                    disabled={loading || cleanupLoading !== null || audit.magicLinks.pagination.offset === 0}
                    onClick={() =>
                      loadAudit({
                        ...query,
                        magicLinkOffset: Math.max(0, query.magicLinkOffset - query.magicLinkLimit),
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={loading || cleanupLoading !== null || !audit.magicLinks.pagination.hasMore}
                    onClick={() =>
                      loadAudit({
                        ...query,
                        magicLinkOffset: query.magicLinkOffset + query.magicLinkLimit,
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
