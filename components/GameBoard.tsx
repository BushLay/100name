"use client"

import Image from "next/image"
import { useEffect, useState, useSyncExternalStore } from "react"

import type { OpenGameState, SubmitOpenGuessResponse } from "@/lib/backend-contracts"
import { GameInput } from "@/components/GameInput"
import { GuessList } from "@/components/GuessList"
import { RecentGuessHistory, type RecentGuessHistoryItem } from "@/components/RecentGuessHistory"
import { ScoreBoard } from "@/components/ScoreBoard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { WINNING_SCORE, checkWinCondition } from "@/lib/game"

type Feedback = {
  tone: "success" | "error"
  text: string
} | null

function createFallbackState(): OpenGameState {
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
    score: 0,
    targetScore: WINNING_SCORE,
    acceptedGuesses: [],
    completed: false,
    updatedAt: now,
  }
}

export function GameBoard() {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!isReady) {
    return <div className="mx-auto w-full max-w-5xl" />
  }

  return <GameBoardClient />
}

function GameBoardClient() {
  const [gameState, setGameState] = useState<OpenGameState>(createFallbackState)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [recentGuesses, setRecentGuesses] = useState<RecentGuessHistoryItem[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setInitializing(true)

      try {
        const response = await fetch("/api/open", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Failed to load open game state.")
        }

        const payload = (await response.json()) as { state: OpenGameState }

        if (!cancelled) {
          setGameState(payload.state)
        }
      } catch {
        if (!cancelled) {
          setFeedback({
            tone: "error",
            text: "Open mode sync is unavailable right now. Please try again.",
          })
        }
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
  }, [])

  async function handleSubmit(name: string) {
    setLoading(true)

    try {
      const response = await fetch("/api/open/guess", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      })

      const result = (await response.json()) as SubmitOpenGuessResponse | { message?: string }

      if (!response.ok || !("state" in result)) {
        throw new Error(result.message ?? "Failed to submit open-mode guess.")
      }

      setRecentGuesses((current) => [
        {
          id: crypto.randomUUID(),
          name,
          accepted: result.accepted,
          message: result.message,
        },
        ...current,
      ].slice(0, 8))
      setFeedback({
        tone: result.accepted ? "success" : "error",
        text: result.message,
      })
      setGameState(result.state)
    } catch {
      setFeedback({
        tone: "error",
        text: "Wikidata is unavailable right now. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const won = checkWinCondition(gameState.score)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <GameInput disabled={won || initializing} loading={loading || initializing} onSubmit={handleSubmit} />

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-sky-200/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(224,242,254,0.95)_48%,rgba(239,246,255,0.98)_100%)] shadow-[0_24px_80px_rgba(14,165,233,0.12)] backdrop-blur dark:border-sky-300/15 dark:bg-[linear-gradient(135deg,rgba(8,25,46,0.92),rgba(8,47,73,0.9)_48%,rgba(15,23,42,0.95)_100%)]">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="w-fit" variant="secondary">
                  Open Mode
                </Badge>
                <Badge className="w-fit" variant="outline">
                  Endless Arcade
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center">
                  <Image
                    alt="100name logo"
                    className="h-auto w-40"
                    height={160}
                    priority
                    src="/logo.png"
                    width={160}
                  />
                </div>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Build a 100-name streak.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Submit a full name, let Wikidata judge it live, and keep stacking verified women until you clear the board.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-3 text-sm shadow-sm dark:border-sky-300/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rule 01</p>
                  <p className="mt-2 font-medium">Human only</p>
                </div>
                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-3 text-sm shadow-sm dark:border-sky-300/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rule 02</p>
                  <p className="mt-2 font-medium">Female only</p>
                </div>
                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-3 text-sm shadow-sm dark:border-sky-300/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rule 03</p>
                  <p className="mt-2 font-medium">Wikipedia required</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ScoreBoard score={gameState.score} won={won} />
      </section>

      <GuessList guesses={gameState.acceptedGuesses} />
      <RecentGuessHistory items={recentGuesses} />

      {feedback ? (
        <Card
          className={
            feedback.tone === "success"
              ? "border-emerald-300 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(209,250,229,0.92))] dark:border-emerald-800 dark:bg-emerald-950/30"
              : "border-red-300 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(254,226,226,0.92))] dark:border-red-900 dark:bg-red-950/30"
          }
        >
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm font-medium">{feedback.text}</p>
            <Badge variant={feedback.tone === "success" ? "success" : "destructive"}>
              {feedback.tone === "success" ? "Hit" : "Miss"}
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      {won ? (
        <Card className="border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(254,240,138,0.35))] dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-2 p-5">
            <p className="text-lg font-semibold">Run cleared. You reached 100.</p>
            <p className="text-sm text-muted-foreground">
              Your open-mode victory is now saved in the active server store.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
