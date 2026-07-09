"use client"

import { useState } from "react"

import {
  buildHistorySearchParams,
  DEFAULT_HISTORY_QUERY,
  parseHistoryQueryFromSearchParams,
  type HistoryQueryState,
} from "@/lib/admin-history-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type HistoryPayload = {
  driver: string
  generatedAt: string
  operationalAlertSummary: {
    latestDispatchStatus: "sent" | "suppressed" | "failed" | "unknown"
    latestRecoveryAlertAt: string | null
    last24Hours: {
      totalAlerts: number
      failedAlerts: number
      suppressedAlerts: number
    }
  }
  readinessProbeSummary: {
    latestEscalationLevel: "none" | "warning" | "error" | "critical"
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
      reportType: "daily_report" | "incident_triage"
      source: "admin" | "api" | "cron" | "unknown"
      reason: string | null
      requestedBy: string | null
      summary: Record<string, unknown>
      actions: string[]
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
}

type SavedHistoryView = {
  id: string
  label: string
  query: HistoryQueryState
}

const SAVED_HISTORY_VIEWS_STORAGE_KEY = "name100_admin_history_saved_views"

const HISTORY_PRESETS: SavedHistoryView[] = [
  {
    id: "recent_incidents",
    label: "Recent incidents",
    query: {
      ...DEFAULT_HISTORY_QUERY,
      incidentHistorySinceDays: "7",
      incidentHistoryLimit: 25,
    },
  },
  {
    id: "alert_failures",
    label: "Alert failures",
    query: {
      ...DEFAULT_HISTORY_QUERY,
      incidentHistoryCategory: "operational_alert",
      incidentHistorySinceDays: "30",
      incidentHistorySearch: "failed",
      incidentHistoryLimit: 25,
    },
  },
  {
    id: "triage_reports",
    label: "Triage reports",
    query: {
      ...DEFAULT_HISTORY_QUERY,
      operationalReportType: "incident_triage",
      operationalReportSinceDays: "30",
      operationalReportLimit: 20,
    },
  },
  {
    id: "daily_handoffs",
    label: "Daily handoffs",
    query: {
      ...DEFAULT_HISTORY_QUERY,
      operationalReportType: "daily_report",
      operationalReportSinceDays: "30",
      operationalReportLimit: 20,
    },
  },
]

function loadSavedHistoryViews() {
  if (typeof window === "undefined") {
    return [] as SavedHistoryView[]
  }

  try {
    const raw = window.localStorage.getItem(SAVED_HISTORY_VIEWS_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as SavedHistoryView[]

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.query === "object"
    )
  } catch {
    return []
  }
}

function buildHistoryUrl(query: HistoryQueryState) {
  const serialized = buildHistorySearchParams(query, DEFAULT_HISTORY_QUERY).toString()
  return serialized ? `/api/internal/audit?${serialized}` : "/api/internal/audit"
}

function isDefaultHistoryQuery(query: HistoryQueryState) {
  return buildHistorySearchParams(query, DEFAULT_HISTORY_QUERY).toString().length === 0
}

function buildActiveHistoryFilterLabels(query: HistoryQueryState) {
  const labels: string[] = []

  if (query.incidentHistorySearch.trim()) {
    labels.push(`incident search: ${query.incidentHistorySearch.trim()}`)
  }

  if (query.incidentHistoryCategory) {
    labels.push(`incident category: ${query.incidentHistoryCategory}`)
  }

  if (query.incidentHistorySinceDays) {
    labels.push(`incident window: ${query.incidentHistorySinceDays}d`)
  }

  if (query.incidentHistoryLimit !== DEFAULT_HISTORY_QUERY.incidentHistoryLimit) {
    labels.push(`incident page size: ${query.incidentHistoryLimit}`)
  }

  if (query.incidentHistoryOffset !== DEFAULT_HISTORY_QUERY.incidentHistoryOffset) {
    labels.push(`incident offset: ${query.incidentHistoryOffset}`)
  }

  if (query.operationalReportSearch.trim()) {
    labels.push(`report search: ${query.operationalReportSearch.trim()}`)
  }

  if (query.operationalReportType) {
    labels.push(`report type: ${query.operationalReportType}`)
  }

  if (query.operationalReportSinceDays) {
    labels.push(`report window: ${query.operationalReportSinceDays}d`)
  }

  if (query.operationalReportLimit !== DEFAULT_HISTORY_QUERY.operationalReportLimit) {
    labels.push(`report page size: ${query.operationalReportLimit}`)
  }

  if (query.operationalReportOffset !== DEFAULT_HISTORY_QUERY.operationalReportOffset) {
    labels.push(`report offset: ${query.operationalReportOffset}`)
  }

  return labels
}

function getDispatchVariant(status: HistoryPayload["operationalAlertSummary"]["latestDispatchStatus"]) {
  if (status === "failed") {
    return "destructive"
  }

  if (status === "sent") {
    return "success"
  }

  if (status === "suppressed") {
    return "secondary"
  }

  return "outline"
}

function getSeverityVariant(severity: "warn" | "error" | null) {
  if (severity === "error") {
    return "destructive"
  }

  if (severity === "warn") {
    return "secondary"
  }

  return "outline"
}

export function AdminHistoryBoard() {
  const [secret, setSecret] = useState("")
  const [query, setQuery] = useState<HistoryQueryState>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_HISTORY_QUERY
    }

    return parseHistoryQueryFromSearchParams(
      new URLSearchParams(window.location.search),
      DEFAULT_HISTORY_QUERY
    )
  })
  const [history, setHistory] = useState<HistoryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportExportState, setReportExportState] = useState<"idle" | "copied" | "failed">("idle")
  const [timelineExportState, setTimelineExportState] = useState<"idle" | "copied" | "failed">("idle")
  const [shareLinkState, setShareLinkState] = useState<"idle" | "copied" | "failed">("idle")
  const [savedViews, setSavedViews] = useState<SavedHistoryView[]>(() => loadSavedHistoryViews())
  const [savedViewLabel, setSavedViewLabel] = useState("")
  const activeFilterLabels = buildActiveHistoryFilterLabels(query)
  const hasActiveFilters = !isDefaultHistoryQuery(query)

  function replaceHistoryUrl(nextQuery: HistoryQueryState) {
    if (typeof window === "undefined") {
      return
    }

    const serialized = buildHistorySearchParams(nextQuery, DEFAULT_HISTORY_QUERY).toString()
    const nextUrl = serialized ? `${window.location.pathname}?${serialized}` : window.location.pathname
    window.history.replaceState(null, "", nextUrl)
  }

  function persistSavedViews(nextViews: SavedHistoryView[]) {
    setSavedViews(nextViews)

    try {
      window.localStorage.setItem(SAVED_HISTORY_VIEWS_STORAGE_KEY, JSON.stringify(nextViews))
    } catch {
      // Best-effort persistence only.
    }
  }

  async function applyHistoryView(nextQuery: HistoryQueryState) {
    setQuery(nextQuery)
    replaceHistoryUrl(nextQuery)

    if (secret.trim()) {
      await loadHistory(nextQuery)
    }
  }

  async function saveCurrentView() {
    const label = savedViewLabel.trim()

    if (!label) {
      setError("Enter a label before saving a history view.")
      return
    }

    const nextViews = [
      {
        id: `${Date.now()}`,
        label,
        query,
      },
      ...savedViews,
    ].slice(0, 8)

    persistSavedViews(nextViews)
    setSavedViewLabel("")
    setError(null)
  }

  function removeSavedView(id: string) {
    persistSavedViews(savedViews.filter((view) => view.id !== id))
  }

  async function resetFilters() {
    await applyHistoryView({ ...DEFAULT_HISTORY_QUERY })
  }

  async function loadHistory(nextQuery = query) {
    setLoading(true)
    setError(null)
    setReportExportState("idle")
    setTimelineExportState("idle")
    setShareLinkState("idle")

    try {
      const response = await fetch(buildHistoryUrl(nextQuery), {
        headers: {
          "x-name100-admin-secret": secret,
        },
      })
      const result = (await response.json()) as HistoryPayload & { message?: string }

      if (
        !response.ok ||
        !("operationalReports" in result) ||
        !("incidentHistory" in result) ||
        !("operationalAlertSummary" in result) ||
        !("readinessProbeSummary" in result)
      ) {
        throw new Error(result.message ?? "Failed to load admin history.")
      }

      setQuery(nextQuery)
      replaceHistoryUrl(nextQuery)
      setHistory(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin history.")
      setHistory(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoad(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadHistory({
      ...query,
      operationalReportOffset: 0,
      incidentHistoryOffset: 0,
    })
  }

  async function copyReports() {
    if (!history) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(history.operationalReports.items, null, 2))
      setReportExportState("copied")
    } catch {
      setReportExportState("failed")
    }
  }

  async function copyTimeline() {
    if (!history) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(history.incidentHistory.items, null, 2))
      setTimelineExportState("copied")
    } catch {
      setTimelineExportState("failed")
    }
  }

  async function copyShareLink() {
    if (typeof window === "undefined") {
      return
    }

    try {
      const serialized = buildHistorySearchParams(query, DEFAULT_HISTORY_QUERY).toString()
      const shareUrl = serialized
        ? `${window.location.origin}${window.location.pathname}?${serialized}`
        : `${window.location.origin}${window.location.pathname}`
      await navigator.clipboard.writeText(shareUrl)
      setShareLinkState("copied")
    } catch {
      setShareLinkState("failed")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <CardHeader>
          <CardTitle>History Filters</CardTitle>
          <CardDescription>
            Load paginated incident history and archived operational reports with server-side filters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleLoad}>
            <div className="space-y-3 rounded-3xl border border-border/60 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-medium">Saved views</p>
                  <p className="text-sm text-muted-foreground">
                    Jump into common incident and archive queries without rebuilding filters each time.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    autoComplete="off"
                    disabled={loading}
                    onChange={(event) => setSavedViewLabel(event.target.value)}
                    placeholder="Label this filter set"
                    value={savedViewLabel}
                  />
                  <Button onClick={() => void saveCurrentView()} type="button" variant="secondary">
                    Save current view
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {HISTORY_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    onClick={() => void applyHistoryView({ ...preset.query })}
                    type="button"
                    variant="outline"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {savedViews.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {savedViews.map((view) => (
                    <div
                      className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm"
                      key={view.id}
                    >
                      <button
                        className="font-medium text-foreground"
                        onClick={() => void applyHistoryView({ ...view.query })}
                        type="button"
                      >
                        {view.label}
                      </button>
                      <button
                        className="text-muted-foreground"
                        onClick={() => removeSavedView(view.id)}
                        type="button"
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={copyShareLink} type="button" variant="outline">
                  Copy share link
                </Button>
                <Button
                  disabled={!hasActiveFilters || loading}
                  onClick={() => void resetFilters()}
                  type="button"
                  variant="ghost"
                >
                  Reset filters
                </Button>
                {shareLinkState === "copied" ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Shareable history link copied.
                  </p>
                ) : null}
                {shareLinkState === "failed" ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Failed to copy shareable history link.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Current filter summary</p>
                {activeFilterLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeFilterLabels.map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active filters. The current view will load the default incident and archive windows.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                autoComplete="off"
                disabled={loading}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Enter NAME100_ADMIN_SECRET"
                type="password"
                value={secret}
              />
              <Button disabled={loading || secret.trim().length === 0} type="submit">
                {loading ? "Loading..." : "Load history"}
              </Button>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border/60 p-4">
                <p className="font-medium">Incident history query</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    autoComplete="off"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistorySearch: event.target.value,
                        incidentHistoryOffset: 0,
                      }))
                    }
                    placeholder="Search title, detail, request id"
                    value={query.incidentHistorySearch}
                  />
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistoryCategory:
                          event.target.value as HistoryQueryState["incidentHistoryCategory"],
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
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistorySinceDays:
                          event.target.value as HistoryQueryState["incidentHistorySinceDays"],
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
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        incidentHistoryLimit: Number(event.target.value),
                        incidentHistoryOffset: 0,
                      }))
                    }
                    value={String(query.incidentHistoryLimit)}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-border/60 p-4">
                <p className="font-medium">Ops report query</p>
                <div className="grid gap-3 sm:grid-cols-2">
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
                    placeholder="Search reason, operator, action"
                    value={query.operationalReportSearch}
                  />
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        operationalReportType:
                          event.target.value as HistoryQueryState["operationalReportType"],
                        operationalReportOffset: 0,
                      }))
                    }
                    value={query.operationalReportType}
                  >
                    <option value="">All report types</option>
                    <option value="daily_report">daily_report</option>
                    <option value="incident_triage">incident_triage</option>
                  </select>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        operationalReportSinceDays:
                          event.target.value as HistoryQueryState["operationalReportSinceDays"],
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
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>
          </form>
          {error ? <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        </CardContent>
      </Card>

      {history ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle>Incident History</CardTitle>
              <CardDescription>
                {history.incidentHistory.pagination.returned} of {history.incidentHistory.pagination.total} filtered history events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={getDispatchVariant(history.operationalAlertSummary.latestDispatchStatus)}>
                  latest alert {history.operationalAlertSummary.latestDispatchStatus}
                </Badge>
                <Badge variant="outline">driver {history.driver}</Badge>
                <Button onClick={copyTimeline} type="button" variant="outline">
                  Export current page
                </Button>
              </div>
              {timelineExportState === "copied" ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Incident history page copied as JSON.
                </p>
              ) : null}
              {history.incidentHistory.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incident history events match the current query.</p>
              ) : (
                history.incidentHistory.items.map((item) => (
                  <div className="rounded-2xl border border-border/60 p-4" key={item.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getSeverityVariant(item.severity)}>
                        {item.severity ?? "event"}
                      </Badge>
                      <Badge variant="secondary">{item.category}</Badge>
                      <Badge variant="outline">{item.source}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(item.at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">{item.detail}</p>
                    {item.requestId ? (
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        request id: {item.requestId}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || query.incidentHistoryOffset === 0}
                  onClick={() =>
                    void loadHistory({
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
                  disabled={loading || !history.incidentHistory.pagination.hasMore}
                  onClick={() =>
                    void loadHistory({
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
              <CardTitle>Ops Report Archive</CardTitle>
              <CardDescription>
                {history.operationalReports.pagination.returned} of {history.operationalReports.pagination.total} filtered archived reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  recovery alert {history.operationalAlertSummary.latestRecoveryAlertAt ? "seen" : "none"}
                </Badge>
                <Badge variant="secondary">
                  readiness {history.readinessProbeSummary.latestEscalationLevel}
                </Badge>
                <Button onClick={copyReports} type="button" variant="outline">
                  Export current page
                </Button>
              </div>
              {reportExportState === "copied" ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Archived reports page copied as JSON.
                </p>
              ) : null}
              {history.operationalReports.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No archived reports match the current query.</p>
              ) : (
                history.operationalReports.items.map((report) => (
                  <div className="rounded-2xl border border-border/60 p-4" key={report.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{report.reportType}</Badge>
                      <Badge variant="outline">{report.source}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">
                      {report.actions.length} action(s) and {Object.keys(report.summary).length} summary section(s)
                    </p>
                    {report.reason ? (
                      <p className="mt-2 text-xs text-muted-foreground">reason: {report.reason}</p>
                    ) : null}
                    {report.requestedBy ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        requested by: {report.requestedBy}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || query.operationalReportOffset === 0}
                  onClick={() =>
                    void loadHistory({
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
                  disabled={loading || !history.operationalReports.pagination.hasMore}
                  onClick={() =>
                    void loadHistory({
                      ...query,
                      operationalReportOffset: query.operationalReportOffset + query.operationalReportLimit,
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
        </div>
      ) : null}
    </div>
  )
}
