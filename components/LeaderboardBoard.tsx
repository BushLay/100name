"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import type {
  ClaimIdentityResponse,
  DailyLeaderboardEntry,
  LeaderboardSummaryResponse,
  PlayerHistoryEntry,
  RequestMagicLinkResponse,
  RecoverSessionResponse,
} from "@/lib/backend-contracts"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { formatDuration, getDailyRoute, getTodayDateString } from "@/lib/daily"

type LeaderboardSummaryState = LeaderboardSummaryResponse

function createFallbackSummary(date: string): LeaderboardSummaryState {
  const now = new Date().toISOString()

  return {
    player: {
      id: "local-fallback",
      handle: null,
      isGuest: true,
      recoveryConfigured: false,
      createdAt: now,
      updatedAt: now,
    },
    stats: {
      currentStreak: 0,
      maxStreak: 0,
      completedDays: 0,
      averageCompletionTimeMs: null,
      averageGuessCount: 0,
      successRate: 0,
    },
    today: {
      date,
      entry: null,
    },
    fastest: [],
    streaks: [],
    history: [],
    overview: {
      activePlayers7d: 0,
      activePlayers30d: 0,
      sessionsStarted7d: 0,
      sessionsCompleted7d: 0,
      averageGuessesPerAttempt: 0,
      shareRate: 0,
    },
    emailAuth: {
      email: null,
      verified: false,
    },
  }
}

function renderLeaderboardList({
  entries,
  emptyMessage,
  badgeVariant,
}: {
  entries: DailyLeaderboardEntry[]
  emptyMessage: string
  badgeVariant: "success" | "secondary"
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return entries.map((entry) => (
    <div className="space-y-2" key={`${entry.playerId}-${entry.date}-${entry.rank}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            #{entry.rank} {entry.handle}
          </p>
          <p className="text-sm text-muted-foreground">
            {entry.date} - {entry.score}/{entry.targetScore}
          </p>
        </div>
        <Badge variant={badgeVariant}>
          {badgeVariant === "success"
            ? entry.completionTimeMs
              ? formatDuration(entry.completionTimeMs)
              : "--"
            : `${entry.streakAtCompletion} days`}
        </Badge>
      </div>
      <Separator />
    </div>
  ))
}

function renderHistoryItem(date: string, item: PlayerHistoryEntry) {
  return (
    <div className="space-y-3" key={date}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{item.date}</p>
          <p className="text-sm text-muted-foreground">
            Score {item.score}/{item.targetScore}, attempts {item.attempts}, streak{" "}
            {item.streakAtCompletion}
          </p>
        </div>
        <Badge variant={item.completed ? "success" : "outline"}>
          {item.completed ? "Completed" : "In progress"}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">Route: {getDailyRoute(item.date)}</div>
      <Separator />
    </div>
  )
}

function getInitialAuthStatus() {
  if (typeof window === "undefined") {
    return null
  }

  return new URLSearchParams(window.location.search).get("auth")
}

export function LeaderboardBoard() {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const today = isReady ? getTodayDateString() : "2026-07-02"
  const [summary, setSummary] = useState<LeaderboardSummaryState>(() =>
    createFallbackSummary(today)
  )
  const [dailyEntries, setDailyEntries] = useState<DailyLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(() => {
    const authStatus = getInitialAuthStatus()

    if (authStatus === "email-invalid") {
      return "Email magic link is invalid or expired."
    }

    if (authStatus === "missing-token") {
      return "Email magic link is missing its token."
    }

    return null
  })
  const [identitySuccess, setIdentitySuccess] = useState<string | null>(() => {
    return getInitialAuthStatus() === "email-linked"
      ? "Email magic link verified and session restored."
      : null
  })
  const [handleInput, setHandleInput] = useState("")
  const [recoverHandleInput, setRecoverHandleInput] = useState("")
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("")
  const [latestRecoveryCode, setLatestRecoveryCode] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState("")
  const [magicLinkPreviewUrl, setMagicLinkPreviewUrl] = useState<string | null>(null)

  async function loadLeaderboardData(date: string) {
    const [summaryResponse, dailyResponse] = await Promise.all([
      fetch("/api/me/leaderboard-summary", {
        credentials: "include",
      }),
      fetch(`/api/leaderboards/daily/${date}`, {
        credentials: "include",
      }),
    ])

    if (!summaryResponse.ok || !dailyResponse.ok) {
      throw new Error("Failed to load leaderboard data.")
    }

    const nextSummary = (await summaryResponse.json()) as LeaderboardSummaryResponse
    const nextDaily = (await dailyResponse.json()) as { entries: DailyLeaderboardEntry[] }

    return {
      summary: nextSummary,
      dailyEntries: nextDaily.entries,
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextState = await loadLeaderboardData(today)

        if (cancelled) {
          return
        }

        setSummary(nextState.summary)
        setDailyEntries(nextState.dailyEntries)
        setHandleInput(nextState.summary.player.handle ?? "")
        setRecoverHandleInput(nextState.summary.player.handle ?? "")
        setEmailInput(nextState.summary.emailAuth.email ?? "")
      } catch {
        if (!cancelled) {
          setError("Leaderboard sync is temporarily unavailable.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [today])

  async function handleClaimIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIdentityLoading(true)
    setIdentityError(null)
    setIdentitySuccess(null)

    try {
      const response = await fetch("/api/me/identity", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ handle: handleInput }),
      })
      const result = (await response.json()) as ClaimIdentityResponse & { message?: string }

      if (!response.ok || !("recoveryCode" in result)) {
        throw new Error(result.message ?? "Failed to claim identity.")
      }

      setLatestRecoveryCode(result.recoveryCode)
      setIdentitySuccess(
        "Identity saved. Store the recovery code now so this player can be restored later."
      )

      const nextState = await loadLeaderboardData(today)
      setSummary(nextState.summary)
      setDailyEntries(nextState.dailyEntries)
      setHandleInput(nextState.summary.player.handle ?? "")
      setRecoverHandleInput(nextState.summary.player.handle ?? "")
      setEmailInput(nextState.summary.emailAuth.email ?? "")
    } catch (claimError) {
      setIdentityError(
        claimError instanceof Error ? claimError.message : "Failed to claim identity."
      )
    } finally {
      setIdentityLoading(false)
    }
  }

  async function handleRecoverSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIdentityLoading(true)
    setIdentityError(null)
    setIdentitySuccess(null)

    try {
      const response = await fetch("/api/session/recover", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: recoverHandleInput,
          recoveryCode: recoveryCodeInput,
        }),
      })
      const result = (await response.json()) as RecoverSessionResponse & { message?: string }

      if (!response.ok || !("sessionId" in result)) {
        throw new Error(result.message ?? "Failed to recover session.")
      }

      setLatestRecoveryCode(null)
      setRecoveryCodeInput("")
      setIdentitySuccess(`Recovered player @${result.player.handle ?? "player"}.`)

      const nextState = await loadLeaderboardData(today)
      setSummary(nextState.summary)
      setDailyEntries(nextState.dailyEntries)
      setHandleInput(nextState.summary.player.handle ?? "")
      setRecoverHandleInput(nextState.summary.player.handle ?? "")
      setEmailInput(nextState.summary.emailAuth.email ?? "")
    } catch (recoverError) {
      setIdentityError(
        recoverError instanceof Error ? recoverError.message : "Failed to recover session."
      )
    } finally {
      setIdentityLoading(false)
    }
  }

  async function handleRequestMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIdentityLoading(true)
    setIdentityError(null)
    setIdentitySuccess(null)

    try {
      const response = await fetch("/api/session/email/request", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailInput,
        }),
      })
      const result = (await response.json()) as RequestMagicLinkResponse & { message?: string }

      if (!response.ok || !("expiresAt" in result)) {
        throw new Error(result.message ?? "Failed to request magic link.")
      }

      setMagicLinkPreviewUrl(result.previewUrl)
      setIdentitySuccess(
        result.mode === "login"
          ? "Magic link sent for sign-in. Check your inbox."
          : "Magic link sent. Open it to verify this email for the current player."
      )

      const nextState = await loadLeaderboardData(today)
      setSummary(nextState.summary)
      setDailyEntries(nextState.dailyEntries)
      setHandleInput(nextState.summary.player.handle ?? "")
      setRecoverHandleInput(nextState.summary.player.handle ?? "")
      setEmailInput(nextState.summary.emailAuth.email ?? "")
    } catch (magicLinkError) {
      setIdentityError(
        magicLinkError instanceof Error ? magicLinkError.message : "Failed to request magic link."
      )
    } finally {
      setIdentityLoading(false)
    }
  }

  const todayEntry = summary.today.entry

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Server Leaderboard</Badge>
            <Badge variant="outline">Today {today}</Badge>
            <Badge variant={summary.player.isGuest ? "outline" : "success"}>
              {summary.player.isGuest
                ? "Guest session"
                : summary.player.handle
                  ? `@${summary.player.handle}`
                  : "Claimed player"}
            </Badge>
          </div>
          <CardTitle>Retention snapshot across player sessions</CardTitle>
          <CardDescription>
            This leaderboard now reads backend-backed summaries and is ready to migrate from
            the temporary file store to Postgres.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Fastest today
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {todayEntry?.completionTimeMs ? formatDuration(todayEntry.completionTimeMs) : "--"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Average completion
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {summary.stats.averageCompletionTimeMs
                ? formatDuration(summary.stats.averageCompletionTimeMs)
                : "--"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Success rate
            </p>
            <p className="mt-2 text-3xl font-semibold">{summary.stats.successRate}%</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Avg guesses
            </p>
            <p className="mt-2 text-3xl font-semibold">{summary.stats.averageGuessCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Active players 7d
            </p>
            <p className="mt-2 text-3xl font-semibold">{summary.overview.activePlayers7d}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
        <CardHeader>
          <CardTitle>Identity and recovery</CardTitle>
          <CardDescription>
            Claim a permanent handle and keep a recovery code so this player history can move
            across browsers and devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <form className="space-y-4" onSubmit={handleClaimIdentity}>
            <div className="space-y-2">
              <p className="text-sm font-medium">Claim or rotate your identity</p>
              <Input
                autoComplete="username"
                disabled={identityLoading}
                onChange={(event) => setHandleInput(event.target.value)}
                placeholder="your_handle"
                value={handleInput}
              />
              <p className="text-xs text-muted-foreground">
                Use 3-20 lowercase letters, numbers, or underscores.
              </p>
            </div>
            <Button disabled={identityLoading} type="submit">
              {identityLoading ? "Saving..." : "Save handle and issue recovery code"}
            </Button>
            {summary.player.recoveryConfigured ? (
              <p className="text-xs text-muted-foreground">
                Saving again will rotate the recovery code for the current player.
              </p>
            ) : null}
          </form>

          <form className="space-y-4" onSubmit={handleRecoverSession}>
            <div className="space-y-2">
              <p className="text-sm font-medium">Recover an existing player</p>
              <Input
                autoComplete="username"
                disabled={identityLoading}
                onChange={(event) => setRecoverHandleInput(event.target.value)}
                placeholder="your_handle"
                value={recoverHandleInput}
              />
              <Input
                autoComplete="one-time-code"
                disabled={identityLoading}
                onChange={(event) => setRecoveryCodeInput(event.target.value)}
                placeholder="ABCD-EFGH-JKLM"
                value={recoveryCodeInput}
              />
            </div>
            <Button disabled={identityLoading} type="submit" variant="outline">
              {identityLoading ? "Recovering..." : "Recover player"}
            </Button>
          </form>

          <form className="space-y-4" onSubmit={handleRequestMagicLink}>
            <div className="space-y-2">
              <p className="text-sm font-medium">Email magic link</p>
              <Input
                autoComplete="email"
                disabled={identityLoading}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="you@example.com"
                value={emailInput}
              />
              <p className="text-xs text-muted-foreground">
                Link an email to this player or request sign-in for an existing email-based
                player.
              </p>
            </div>
            <Button disabled={identityLoading} type="submit" variant="secondary">
              {identityLoading ? "Sending..." : "Send magic link"}
            </Button>
            {summary.emailAuth.email ? (
              <p className="text-xs text-muted-foreground">
                Current email: {summary.emailAuth.email}
                {summary.emailAuth.verified ? " (verified)" : " (awaiting verification)"}
              </p>
            ) : null}
          </form>

          {latestRecoveryCode ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/20 lg:col-span-2">
              <p className="font-medium">Recovery code</p>
              <p className="mt-2 font-mono text-lg tracking-[0.18em]">{latestRecoveryCode}</p>
              <p className="mt-2 text-muted-foreground">
                This is only shown when it is issued. Store it outside the browser before
                leaving this page.
              </p>
            </div>
          ) : null}

          {magicLinkPreviewUrl ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/20 lg:col-span-3">
              <p className="font-medium">Local preview link</p>
              <a className="mt-2 block break-all text-sky-700 underline dark:text-sky-300" href={magicLinkPreviewUrl}>
                {magicLinkPreviewUrl}
              </a>
              <p className="mt-2 text-muted-foreground">
                This preview is shown only when email delivery runs in local log mode.
              </p>
            </div>
          ) : null}

          {identityError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-medium dark:border-red-900 dark:bg-red-950/20 lg:col-span-3">
              {identityError}
            </div>
          ) : null}

          {identitySuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm font-medium dark:border-emerald-900 dark:bg-emerald-950/20 lg:col-span-3">
              {identitySuccess}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50/90 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4 text-sm font-medium">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Top fastest players</CardTitle>
            <CardDescription>Server-ranked best completion times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading
              ? <p className="text-sm text-muted-foreground">Loading fastest leaderboard...</p>
              : renderLeaderboardList({
                  entries: summary.fastest,
                  emptyMessage: "Finish a challenge to appear here.",
                  badgeVariant: "success",
                })}
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Top streak players</CardTitle>
            <CardDescription>Streak length is now server-computed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading
              ? <p className="text-sm text-muted-foreground">Loading streak leaderboard...</p>
              : renderLeaderboardList({
                  entries: summary.streaks,
                  emptyMessage: "Complete consecutive days to rank.",
                  badgeVariant: "secondary",
                })}
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Today ranking</CardTitle>
            <CardDescription>Current daily leaderboard snapshot for {today}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading today&apos;s ranking...</p>
            ) : dailyEntries.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No completed runs yet for today. Be the first to post a time.
                </p>
                <Link
                  className={buttonVariants({ className: "rounded-xl", variant: "outline" })}
                  href={getDailyRoute(today)}
                >
                  Open today&apos;s challenge
                </Link>
              </div>
            ) : (
              <>
                {dailyEntries.slice(0, 5).map((entry) => (
                  <div className="space-y-3" key={`${entry.playerId}-${entry.rank}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          #{entry.rank} {entry.handle}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Score {entry.score}/{entry.targetScore}
                          {entry.completionTimeMs
                            ? ` - ${formatDuration(entry.completionTimeMs)}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="success">Completed</Badge>
                    </div>
                  </div>
                ))}
                <Separator />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Daily completion rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{summary.stats.successRate}%</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
        <CardHeader>
          <CardTitle>Played dates history</CardTitle>
          <CardDescription>
            Recent server-backed daily attempts for the active player session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading history...</p>
          ) : summary.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No daily sessions stored yet. Finish a challenge and come back here.
            </p>
          ) : (
            summary.history.map((item) => renderHistoryItem(item.date, item))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
