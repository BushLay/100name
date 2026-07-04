"use client"

import { useMemo, useSyncExternalStore } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  formatDuration,
  getDailyRoute,
} from "@/lib/daily"
import {
  createEmptyGrowthStorage,
  getAverageCompletionTime,
  getAverageGuessCount,
  getDailyCompletionRate,
  getFastestLeaderboard,
  getOrCreateDailyRecord,
  getSuccessRate,
  getStreakLeaderboard,
  getTodayRanking,
  sanitizeGrowthStorage,
  GROWTH_STORAGE_KEY,
} from "@/lib/growth"

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
    return createEmptyGrowthStorage()
  }
}

export function LeaderboardBoard() {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const storage = useMemo(() => (isReady ? readGrowthStorage() : createEmptyGrowthStorage()), [isReady])
  const today = isReady ? new Date().toISOString().slice(0, 10) : "2026-07-02"
  const todayRecord = getOrCreateDailyRecord(storage, today)
  const averageTime = getAverageCompletionTime(storage)
  const successRate = getSuccessRate(storage)
  const averageGuessCount = getAverageGuessCount(storage)
  const dailyCompletionRate = getDailyCompletionRate(storage)
  const fastest = getFastestLeaderboard(storage)
  const streaks = getStreakLeaderboard(storage)
  const todayRanking = getTodayRanking(storage, today)
  const history = storage.playedDatesHistory.slice(0, 10)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Local Leaderboard</Badge>
            <Badge variant="outline">Today {today}</Badge>
          </div>
          <CardTitle>Retention snapshot on this device</CardTitle>
          <CardDescription>
            This lightweight leaderboard uses localStorage only. It is enough for growth
            loops without adding accounts or a backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Fastest today
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {todayRecord.bestTimeMs ? formatDuration(todayRecord.bestTimeMs) : "--"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Average completion
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {averageTime ? formatDuration(averageTime) : "--"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Success rate
            </p>
            <p className="mt-2 text-3xl font-semibold">{successRate}%</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Avg guesses
            </p>
            <p className="mt-2 text-3xl font-semibold">{averageGuessCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Last played
            </p>
            <p className="mt-2 text-3xl font-semibold">{storage.lastPlayedDate ?? "--"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Top fastest players</CardTitle>
            <CardDescription>
              Local simulated ranking by best completion time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fastest.length === 0 ? (
              <p className="text-sm text-muted-foreground">Finish a challenge to appear here.</p>
            ) : (
              fastest.map((entry, index) => (
                <div className="space-y-2" key={`${entry.date}-${index}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        #{index + 1} {entry.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.date} - {entry.score}/{entry.targetScore ?? 20}
                      </p>
                    </div>
                    <Badge variant="success">
                      {entry.durationMs ? formatDuration(entry.durationMs) : "--"}
                    </Badge>
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Top streak players</CardTitle>
            <CardDescription>
              Streak length is the retention scoreboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {streaks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Complete consecutive days to rank.</p>
            ) : (
              streaks.map((entry, index) => (
                <div className="space-y-2" key={`${entry.date}-${index}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        #{index + 1} {entry.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.date} - {entry.themeLabel || "daily theme"} completed
                      </p>
                    </div>
                    <Badge variant="secondary">{entry.streak} days</Badge>
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle>Today ranking</CardTitle>
            <CardDescription>
              Lightweight competitive snapshot for the current daily route.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayRanking.map((entry) => (
              <div className="space-y-3" key={entry.date}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Score {entry.score}/{entry.targetScore ?? 20} - attempts {entry.attempts}
                    </p>
                  </div>
                  <Badge variant={entry.completed ? "success" : "outline"}>
                    {entry.completed ? "Completed" : "In progress"}
                  </Badge>
                </div>
                <Link
                  className={buttonVariants({ className: "rounded-xl", variant: "outline" })}
                  href={getDailyRoute(today)}
                >
                  Open today&apos;s challenge
                </Link>
              </div>
            ))}
            <Separator />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Daily completion rate
              </p>
              <p className="mt-2 text-2xl font-semibold">{dailyCompletionRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
        <CardHeader>
          <CardTitle>Played dates history</CardTitle>
          <CardDescription>
            Returning players can revisit any daily route directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No daily sessions stored yet. Finish a challenge and come back here.
            </p>
          ) : (
            history.map((date) => {
              const record = getOrCreateDailyRecord(storage, date)

              return (
                <div className="space-y-3" key={date}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{date}</p>
                      <p className="text-sm text-muted-foreground">
                        Score {record.score}/{record.targetScore ?? 20}, attempts {record.attempts}, streak {record.streakAtCompletion}
                      </p>
                    </div>
                    <Badge variant={record.completed ? "success" : "outline"}>
                      {record.completed ? "Completed" : "In progress"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Route: {getDailyRoute(date)}
                  </div>
                  <Separator />
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
