"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"

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
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  buildDailyShareText,
  formatDuration,
  getDailyRoute,
  getDailyThemeMessages,
  getDailyThemeValidator,
  type DailyChallenge,
} from "@/lib/daily"
import {
  createEmptyGrowthStorage,
  getAverageCompletionTime,
  getAverageGuessCount,
  getDailyCompletionRate,
  getOrCreateDailyRecord,
  incrementShareClicks,
  recordDailyCompletion,
  sanitizeGrowthStorage,
  toAnalyticsPayload,
  type DailyRecord,
  type GrowthStorage,
  GROWTH_STORAGE_KEY,
  upsertAnalyticsAttempt,
} from "@/lib/growth"
import { validateGuessWithRules } from "@/lib/game"

type Feedback = {
  tone: "success" | "error"
  text: string
} | null

type DailyChallengeBoardProps = {
  challenge: DailyChallenge
  shareBaseUrl: string
}

const DAILY_CHALLENGE_CACHE_PREFIX = "name100-daily-challenge:"

function readGrowthStorage() {
  if (typeof window === "undefined") {
    return createEmptyGrowthStorage()
  }

  const raw = window.localStorage.getItem(GROWTH_STORAGE_KEY)

  if (!raw) {
    return createEmptyGrowthStorage()
  }

  try {
    return sanitizeGrowthStorage(JSON.parse(raw))
  } catch {
    window.localStorage.removeItem(GROWTH_STORAGE_KEY)
    return createEmptyGrowthStorage()
  }
}

function getTimestamp() {
  return Date.now()
}

function getDailyUrl(shareBaseUrl: string, date: string) {
  return `${shareBaseUrl}${getDailyRoute(date)}`
}

export function DailyChallengeBoard({
  challenge,
  shareBaseUrl,
}: DailyChallengeBoardProps) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!isReady) {
    return <div className="mx-auto w-full max-w-5xl" />
  }

  return <DailyChallengeBoardClient challenge={challenge} shareBaseUrl={shareBaseUrl} />
}

function DailyChallengeBoardClient({
  challenge,
  shareBaseUrl,
}: DailyChallengeBoardProps) {
  const [storage, setStorage] = useState<GrowthStorage>(readGrowthStorage)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareBounce, setShareBounce] = useState(false)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const lastCompletedState = useRef(false)

  const currentRecord = getOrCreateDailyRecord(storage, challenge.date)
  const dailyUrl = getDailyUrl(shareBaseUrl, challenge.date)
  const progress = Math.min((currentRecord.guessedNames.length / challenge.targetScore) * 100, 100)
  const analyticsPayload = toAnalyticsPayload(storage, challenge.date)
  const averageCompletionTime = getAverageCompletionTime(storage)
  const averageGuessCount = getAverageGuessCount(storage)
  const completionRate = getDailyCompletionRate(storage)
  const themeValidator = getDailyThemeValidator(challenge.themeId)
  const themeMessages = getDailyThemeMessages(challenge.themeId)

  useEffect(() => {
    window.localStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(storage))
  }, [storage])

  useEffect(() => {
    window.localStorage.setItem(
      `${DAILY_CHALLENGE_CACHE_PREFIX}${challenge.date}`,
      JSON.stringify(challenge)
    )
  }, [challenge])

  useEffect(() => {
    if (currentRecord.completed && !lastCompletedState.current) {
      setShowResultDialog(true)
      setShareBounce(true)
    }

    lastCompletedState.current = currentRecord.completed
  }, [currentRecord.completed])

  useEffect(() => {
    if (!shareBounce) {
      return
    }

    const timeout = window.setTimeout(() => setShareBounce(false), 1400)

    return () => window.clearTimeout(timeout)
  }, [shareBounce])

  function commitStorage(nextStorage: GrowthStorage, nextRecord: DailyRecord) {
    setStorage({
      ...nextStorage,
      lastPlayedDate: challenge.date,
      playedDatesHistory: nextStorage.playedDatesHistory.includes(challenge.date)
        ? nextStorage.playedDatesHistory
        : [challenge.date, ...nextStorage.playedDatesHistory],
      dailyRecords: {
        ...nextStorage.dailyRecords,
        [challenge.date]: nextRecord,
      },
    })
  }

  async function handleSubmit(name: string) {
    setLoading(true)
    setCopied(false)

    try {
      const current = getOrCreateDailyRecord(storage, challenge.date)
      const nextAttempts = current.attempts + 1
      const startedAt = current.startedAt ?? getTimestamp()
      const guessesSubmitted = current.guessedNames.length + 1
      let nextStorage = upsertAnalyticsAttempt(storage, challenge.date, {
        attempts: nextAttempts,
        guessesSubmitted,
      })

      const result = await validateGuessWithRules(
        name,
        current.guessedQIDs,
        current.score,
        undefined,
        {
          targetScore: challenge.targetScore,
          validateEntity: themeValidator,
          invalidEntityMessage: themeMessages.invalidEntityMessage,
          successMessage: themeMessages.successMessage,
        }
      )

      if (!result.valid) {
        setFeedback({
          tone: "error",
          text: result.message,
        })

        commitStorage(nextStorage, {
          ...getOrCreateDailyRecord(nextStorage, challenge.date),
          attempts: nextAttempts,
          targetScore: challenge.targetScore,
          themeLabel: challenge.categoryLabel,
          startedAt,
          lastPlayedAt: getTimestamp(),
          dailyDataset: [challenge.themeId],
        })
        return
      }

      const finishedNow = result.score >= challenge.targetScore
      const completedAt = finishedNow ? getTimestamp() : current.completedAt
      const durationMs =
        finishedNow && completedAt ? completedAt - startedAt : current.bestTimeMs ?? 0

      if (finishedNow && durationMs > 0) {
        nextStorage = recordDailyCompletion(nextStorage, challenge.date, durationMs)
      }

      const streakAtCompletion = finishedNow
        ? nextStorage.currentStreak
        : current.streakAtCompletion
      const bestTimeMs =
        finishedNow && durationMs > 0
          ? current.bestTimeMs === null
            ? durationMs
            : Math.min(current.bestTimeMs, durationMs)
          : current.bestTimeMs
      const shareText =
        finishedNow && bestTimeMs
          ? buildDailyShareText({
              date: challenge.date,
              score: result.score,
              targetScore: challenge.targetScore,
              durationMs: bestTimeMs,
              streak: streakAtCompletion,
              shareTitle: challenge.shareTitle,
              shareLabel: challenge.shareLabel,
              url: dailyUrl,
            })
          : current.shareText

      setFeedback({
        tone: "success",
        text: finishedNow
          ? "Challenge complete. Your themed share card is ready."
          : result.message,
      })

      commitStorage(nextStorage, {
        ...getOrCreateDailyRecord(nextStorage, challenge.date),
        score: result.score,
        targetScore: challenge.targetScore,
        themeLabel: challenge.categoryLabel,
        guessedQIDs: [...current.guessedQIDs, result.qid],
        guessedNames: [...current.guessedNames, { qid: result.qid, name: result.name }],
        attempts: nextAttempts,
        startedAt,
        completedAt,
        bestTimeMs,
        completed: finishedNow,
        shareText,
        lastPlayedAt: getTimestamp(),
        streakAtCompletion,
        dailyDataset: [challenge.themeId],
      })

      if (finishedNow) {
        setShareBounce(true)
      }
    } catch {
      setFeedback({
        tone: "error",
        text: "Wikidata is unavailable right now. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyShare() {
    if (!currentRecord.shareText) {
      return
    }

    try {
      await navigator.clipboard.writeText(currentRecord.shareText)
      setCopied(true)
      setStorage((currentStorage) => incrementShareClicks(currentStorage, challenge.date))
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <GameInput
          buttonLabel={challenge.promptLabel}
          description={`Today's rule: every answer must match the ${challenge.categoryLabel.toLowerCase()} theme and pass Wikidata validation for ${challenge.date}.`}
          disabled={currentRecord.completed}
          loading={loading}
          onSubmit={handleSubmit}
          title={challenge.title}
        />

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Daily Challenge</Badge>
                <Badge variant="outline">{challenge.date}</Badge>
                <Badge variant="outline">{challenge.categoryLabel}</Badge>
                <Badge variant="success">Streak {storage.currentStreak}</Badge>
                <Badge variant="outline">Best {storage.maxStreak}</Badge>
              </div>
              <div className="space-y-3">
                <CardTitle className="text-3xl sm:text-4xl">{challenge.headline}</CardTitle>
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
                    {currentRecord.guessedNames.length}/{challenge.targetScore}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Attempts
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{currentRecord.attempts}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Best Time
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {currentRecord.bestTimeMs ? formatDuration(currentRecord.bestTimeMs) : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Share clicks
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{analyticsPayload.shareClicks}</p>
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
            score={currentRecord.score}
            targetScore={challenge.targetScore}
            title="Today"
            won={currentRecord.completed}
          />
        </section>

        <GuessList guesses={currentRecord.guessedNames} />

        {feedback ? (
          <Card
            className={
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/30"
                : "border-red-200 bg-red-50/90 dark:border-red-900 dark:bg-red-950/30"
            }
          >
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="text-sm font-medium">{feedback.text}</p>
              <Badge variant={feedback.tone === "success" ? "success" : "destructive"}>
                {feedback.tone === "success" ? "Accepted" : "Rejected"}
              </Badge>
            </CardContent>
          </Card>
        ) : null}

        {currentRecord.completed ? (
          <Card className="border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/30">
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Completed</Badge>
                <Badge variant="outline">{storage.currentStreak} day streak</Badge>
                <Badge variant="outline">Max {storage.maxStreak}</Badge>
              </div>
              <CardTitle>Celebration screen</CardTitle>
              <CardDescription>
                You cleared today&apos;s {challenge.shareLabel} challenge. Turn it into a social
                post and come back tomorrow for a new theme.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button
                className={
                  shareBounce
                    ? "rounded-xl animate-pulse shadow-[0_0_0_8px_rgba(251,191,36,0.15)]"
                    : "rounded-xl"
                }
                onClick={handleCopyShare}
                type="button"
              >
                {copied ? "Copied share card" : "Copy themed share card"}
              </Button>
              <Button
                className="rounded-xl"
                onClick={() => setShowResultDialog(true)}
                type="button"
                variant="outline"
              >
                Open result summary
              </Button>
              <Link
                className={buttonVariants({ className: "rounded-xl", variant: "outline" })}
                href={`${getDailyRoute(challenge.date)}/share-preview`}
              >
                Open share preview
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Front-end analytics snapshot</CardTitle>
            <CardDescription>
              Local-only MVP metrics with an API-ready shape for future backend wiring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Completed
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {analyticsPayload.completed ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Guesses
                </p>
                <p className="mt-2 text-2xl font-semibold">{analyticsPayload.guessesSubmitted}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Attempts
                </p>
                <p className="mt-2 text-2xl font-semibold">{analyticsPayload.attempts}</p>
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
                  Share clicks
                </p>
                <p className="mt-2 text-2xl font-semibold">{analyticsPayload.shareClicks}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Last played
                </p>
                <p className="mt-2 text-2xl font-semibold">{storage.lastPlayedDate ?? "--"}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                API-ready payload
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {JSON.stringify(analyticsPayload)}
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
              This is the copy-ready result card for today&apos;s themed daily challenge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Score
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {currentRecord.score}/{challenge.targetScore}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Time
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {currentRecord.bestTimeMs ? formatDuration(currentRecord.bestTimeMs) : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Streak
                </p>
                <p className="mt-2 text-2xl font-semibold">{storage.currentStreak} days</p>
              </div>
            </div>
            <Separator />
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {currentRecord.shareText}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button
              className={shareBounce ? "animate-pulse rounded-xl" : "rounded-xl"}
              onClick={handleCopyShare}
              type="button"
            >
              {copied ? "Copied share card" : "Copy share card"}
            </Button>
            <Link
              className={buttonVariants({ className: "rounded-xl", variant: "outline" })}
              href="/leaderboard"
            >
              View leaderboard
            </Link>
            <Button
              className="rounded-xl"
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
