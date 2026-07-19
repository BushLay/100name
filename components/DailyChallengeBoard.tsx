"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import type {
  DailyChallengeState,
  OverviewAnalytics,
  SubmitGuessResponse,
  TrackShareResponse,
} from "@/lib/backend-contracts"
import { GameInput } from "@/components/GameInput"
import { GuessList } from "@/components/GuessList"
import { ScoreBoard } from "@/components/ScoreBoard"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { readApiResponse } from "@/lib/client-api"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { formatDuration, type DailyChallenge } from "@/lib/daily"
import {
  buildDailyResultDownloadPath,
  buildDailyResultPath,
  type DailyResultShareData,
} from "@/lib/daily-result-share"

type Feedback = {
  tone: "success" | "error" | "warning"
  text: string
} | null

type DailyChallengeBoardProps = {
  challenge: DailyChallenge
}

function createFallbackState(challenge: DailyChallenge): DailyChallengeState {
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
    attempt: {
      id: `fallback-${challenge.date}`,
      playerId: "local-fallback",
      sessionId: "fallback-session",
      date: challenge.date,
      theme: {
        themeId: challenge.themeId,
        title: challenge.shareTitle,
        categoryLabel: challenge.categoryLabel,
        targetScore: challenge.targetScore,
      },
      status: "in_progress",
      score: 0,
      attempts: 0,
      guessesSubmitted: 0,
      startedAt: now,
      completedAt: null,
      bestTimeMs: null,
      streakAtCompletion: 0,
      shareText: "",
      createdAt: now,
      updatedAt: now,
    },
    acceptedGuesses: [],
    analytics: {
      date: challenge.date,
      attempts: 0,
      guessesSubmitted: 0,
      shareClicks: 0,
      completed: false,
      completionTimeMs: null,
    },
    leaderboardPreview: [],
  }
}

function createFallbackOverview(): OverviewAnalytics {
  return {
    activePlayers7d: 0,
    activePlayers30d: 0,
    sessionsStarted7d: 0,
    sessionsCompleted7d: 0,
    averageGuessesPerAttempt: 0,
    shareRate: 0,
  }
}

async function bootstrapSession() {
  await fetch("/api/session/bootstrap", {
    method: "POST",
    credentials: "include",
  })
}

async function fetchDailyState(date: string) {
  const response = await fetch(`/api/daily/${date}`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Failed to load the daily challenge.")
  }

  return await readApiResponse<{
    state: DailyChallengeState
    overview: OverviewAnalytics
  }>(response, "Failed to load the daily challenge.")
}

export function DailyChallengeBoard({ challenge }: DailyChallengeBoardProps) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!isReady) {
    return <div className="mx-auto w-full max-w-5xl" />
  }

  return <DailyChallengeBoardClient challenge={challenge} />
}

function DailyChallengeBoardClient({ challenge }: DailyChallengeBoardProps) {
  const [dailyState, setDailyState] = useState<DailyChallengeState>(() =>
    createFallbackState(challenge)
  )
  const [overview, setOverview] = useState<OverviewAnalytics>(createFallbackOverview)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [resultLinkCopied, setResultLinkCopied] = useState(false)
  const [shareBounce, setShareBounce] = useState(false)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [submissionHistory, setSubmissionHistory] = useState<
    Array<{
      id: string
      name: string
      accepted: boolean
      message: string
      tone?: "success" | "error" | "warning"
    }>
  >([])
  const lastCompletedState = useRef(false)

  const currentAttempt = dailyState.attempt
  const progress = Math.min(
    (dailyState.acceptedGuesses.length / challenge.targetScore) * 100,
    100
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setInitializing(true)

      try {
        await bootstrapSession()
        const response = await fetchDailyState(challenge.date)

        if (cancelled) {
          return
        }

        setDailyState(response.state)
        setOverview(response.overview)
        setSubmissionHistory(
          response.state.acceptedGuesses.map((guess, index) => ({
            id: `accepted-${guess.qid}-${index}`,
            name: guess.name,
            accepted: true,
            message: "Previously accepted on this challenge.",
            tone: "success" as const,
          }))
        )
      } catch {
        if (cancelled) {
          return
        }

        setFeedback({
          tone: "error",
          text: "Server sync is unavailable right now. Daily progress may be delayed.",
        })
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [challenge.date])

  useEffect(() => {
    if (currentAttempt.status === "completed" && !lastCompletedState.current) {
      setShowResultDialog(true)
      setShareBounce(true)
    }

    lastCompletedState.current = currentAttempt.status === "completed"
  }, [currentAttempt.status])

  useEffect(() => {
    if (!shareBounce) {
      return
    }

    const timeout = window.setTimeout(() => setShareBounce(false), 1400)

    return () => window.clearTimeout(timeout)
  }, [shareBounce])

  function getFeedbackTone(accepted: boolean, message: string): NonNullable<Feedback>["tone"] {
    if (accepted) {
      return "success"
    }

    if (message.match(/already been guessed/i)) {
      return "warning"
    }

    return "error"
  }

  async function handleSubmit(name: string) {
    setLoading(true)
    setResultLinkCopied(false)

    try {
      const response = await fetch(`/api/daily/${challenge.date}/guess`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: challenge.date,
          name,
          clientAttemptId: currentAttempt.id,
        }),
      })

      const result = await readApiResponse<SubmitGuessResponse | { message?: string }>(
        response,
        "Failed to submit guess."
      )

      if (!("state" in result)) {
        throw new Error(result.message ?? "Failed to submit guess.")
      }

      if (result.accepted) {
        setSubmissionHistory((current) => [
          ...current,
          {
            id: "guess" in result && result.guess?.id ? result.guess.id : crypto.randomUUID(),
            name,
            accepted: true,
            message: result.message,
            tone: getFeedbackTone(result.accepted, result.message),
          },
        ])
      }
      setFeedback({
        tone: getFeedbackTone(result.accepted, result.message),
        text: result.message,
      })
      setDailyState(result.state)
      return result.accepted
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error && error.message.trim()
            ? error.message
            : "The server could not verify this guess right now. Please try again.",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  async function trackShareClick(destination: "copy" | "system_share") {
    try {
      const response = await fetch(`/api/daily/${challenge.date}/share`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: challenge.date,
          attemptId: currentAttempt.id,
          destination,
        }),
      })

      if (!response.ok) {
        return
      }

      const result = await readApiResponse<TrackShareResponse>(
        response,
        "Failed to track share."
      )

      setDailyState((current) => ({
        ...current,
        analytics: {
          ...current.analytics,
          shareClicks: result.shareClicks,
        },
      }))
    } catch {
      // Sharing should remain available even if analytics tracking fails.
    }
  }

  function buildResultShareData(): DailyResultShareData {
    return {
      score: currentAttempt.score,
      targetScore: challenge.targetScore,
      durationMs: currentAttempt.bestTimeMs ?? dailyState.analytics.completionTimeMs ?? 0,
      streak: currentAttempt.streakAtCompletion || dailyState.stats.currentStreak,
    }
  }

  function getPublicResultUrl() {
    const origin = window.location.origin
    return `${origin}${buildDailyResultPath(challenge.date, buildResultShareData())}`
  }

  async function handleShareResultLink() {
    const publicResultUrl = getPublicResultUrl()

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${challenge.shareTitle} Result`,
          text: `I scored ${currentAttempt.score}/${challenge.targetScore} on ${challenge.shareTitle}.`,
          url: publicResultUrl,
        })
        setResultLinkCopied(false)
        await trackShareClick("system_share")
        return
      }

      await navigator.clipboard.writeText(publicResultUrl)
      setResultLinkCopied(true)
      await trackShareClick("copy")
    } catch {
      setResultLinkCopied(false)
    }
  }

  const resultShareData = buildResultShareData()
  const resultPath = buildDailyResultPath(challenge.date, resultShareData)
  const resultDownloadPath = buildDailyResultDownloadPath(challenge.date, resultShareData)
  const completionRate = dailyState.stats.successRate
  const averageGuessCount = dailyState.stats.averageGuessCount
  const averageCompletionTime = dailyState.stats.averageCompletionTimeMs
  const isCompleted = currentAttempt.status === "completed"

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <GameInput
          description={`Today's rule: every answer must match the ${challenge.categoryLabel.toLowerCase()} theme and pass Wikidata validation for ${challenge.date}.`}
          disabled={isCompleted || initializing}
          feedback={feedback}
          loading={loading || initializing}
          onSubmit={handleSubmit}
          score={currentAttempt.score}
          submissions={submissionHistory}
          targetScore={challenge.targetScore}
          title={challenge.title}
        />

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden bg-white dark:bg-[#30261e]">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Daily Challenge</Badge>
                <Badge variant="outline">{challenge.date}</Badge>
                <Badge variant="outline">{challenge.categoryLabel}</Badge>
                <Badge variant="success">Streak {dailyState.stats.currentStreak}</Badge>
                <Badge variant="outline">Best {dailyState.stats.maxStreak}</Badge>
              </div>
              <div className="space-y-3">
                <CardTitle className="text-3xl font-black sm:text-4xl">{challenge.headline}</CardTitle>
                <CardDescription className="max-w-2xl text-base leading-7">
                  {challenge.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Progress
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {dailyState.acceptedGuesses.length}/{challenge.targetScore}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Attempts
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{currentAttempt.attempts}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Best Time
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {currentAttempt.bestTimeMs ? formatDuration(currentAttempt.bestTimeMs) : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Share clicks
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{dailyState.analytics.shareClicks}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Completion rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{completionRate}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Avg guesses
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{averageGuessCount}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Daily progress indicator</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>

          <ScoreBoard
            description={`Reach ${challenge.targetScore}/${challenge.targetScore} for today's ${challenge.shareLabel} theme.`}
            score={currentAttempt.score}
            targetScore={challenge.targetScore}
            title="Today"
            won={isCompleted}
          />
        </section>

        <GuessList guesses={dailyState.acceptedGuesses} />

        {isCompleted ? (
          <Card className="bg-[#ffe01b] text-[#241c15] dark:bg-[#ffe01b] dark:text-[#241c15]">
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Completed</Badge>
                <Badge variant="outline">{dailyState.stats.currentStreak} day streak</Badge>
                <Badge variant="outline">Max {dailyState.stats.maxStreak}</Badge>
              </div>
              <CardTitle>Celebration screen</CardTitle>
              <CardDescription>
                You cleared today&apos;s {challenge.shareLabel} challenge. Turn it into a social
                post and come back tomorrow for a new theme.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <a
                className={buttonVariants({
                  className: shareBounce
                    ? "animate-pulse rounded-full shadow-[0_0_0_8px_rgba(255,77,116,0.16)]"
                    : "rounded-full",
                })}
                href={resultDownloadPath}
              >
                Download image
              </a>
              <Button
                className="rounded-full"
                onClick={handleShareResultLink}
                type="button"
                variant="outline"
              >
                {resultLinkCopied ? "Copied result link" : "Share result link"}
              </Button>
              <Button
                className="rounded-full"
                onClick={() => setShowResultDialog(true)}
                type="button"
                variant="outline"
              >
                Open result summary
              </Button>
              <Link
                className={buttonVariants({ className: "rounded-full", variant: "outline" })}
                href={resultPath}
              >
                Open public result
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card className="bg-[#fbefe3] dark:bg-[#30261e]">
          <CardHeader>
            <CardTitle>Server analytics snapshot</CardTitle>
            <CardDescription>
              This view now reflects the backend attempt state and is ready to be backed by a
              real database next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Completed
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {dailyState.analytics.completed ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Guesses
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {dailyState.analytics.guessesSubmitted}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Attempts
                </p>
                <p className="mt-2 text-2xl font-semibold">{dailyState.analytics.attempts}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Average time
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {averageCompletionTime ? formatDuration(averageCompletionTime) : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Share rate
                </p>
                <p className="mt-2 text-2xl font-semibold">{overview.shareRate}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Active players 7d
                </p>
                <p className="mt-2 text-2xl font-semibold">{overview.activePlayers7d}</p>
              </div>
            </div>
            <div className="rounded-lg border-2 border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                API-ready payload
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {JSON.stringify(dailyState.analytics)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog onOpenChange={setShowResultDialog} open={showResultDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Result summary modal</Badge>
              <Badge variant="outline">{challenge.date}</Badge>
              <Badge variant="outline">{challenge.categoryLabel}</Badge>
            </div>
            <DialogTitle>Women Guess Game {challenge.date}</DialogTitle>
            <DialogDescription>
              This is the share-ready result card for today&apos;s themed daily challenge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Score
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {currentAttempt.score}/{challenge.targetScore}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Time
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {currentAttempt.bestTimeMs ? formatDuration(currentAttempt.bestTimeMs) : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Streak
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {dailyState.stats.currentStreak} days
                </p>
              </div>
            </div>
            <Separator />
            <div className="rounded-lg border-2 border-border bg-background p-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {currentAttempt.shareText}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <a
              className={buttonVariants({
                className: shareBounce ? "animate-pulse rounded-full" : "rounded-full",
              })}
              href={resultDownloadPath}
            >
              Download image
            </a>
            <Button
              className="rounded-full"
              onClick={handleShareResultLink}
              type="button"
              variant="outline"
            >
              {resultLinkCopied ? "Copied result link" : "Share result link"}
            </Button>
            <Link
              className={buttonVariants({ className: "rounded-full", variant: "outline" })}
              href={resultPath}
            >
              Public result
            </Link>
            <Link
              className={buttonVariants({ className: "rounded-full", variant: "outline" })}
              href="/leaderboard"
            >
              View leaderboard
            </Link>
            <Button
              className="rounded-full"
              onClick={() => setShowResultDialog(false)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
