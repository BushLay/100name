"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import type { OpenGameState, SubmitOpenGuessResponse } from "@/lib/backend-contracts"
import { GameInput } from "@/components/GameInput"
import { GuessList } from "@/components/GuessList"
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
        <Card className="overflow-hidden border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <Badge className="w-fit" variant="secondary">
                Wikidata Open Mode
              </Badge>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Name 100 real women.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Submit a full name, let Wikidata verify the person, and race to 100
                  points without repeating a QID.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">Human only</Badge>
                <Badge variant="outline">Female only</Badge>
                <Badge variant="outline">Wikipedia required</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <ScoreBoard score={gameState.score} won={won} />
      </section>

      <GuessList guesses={gameState.acceptedGuesses} />

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

      {won ? (
        <Card className="border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-2 p-5">
            <p className="text-lg font-semibold">You reached 100 points.</p>
            <p className="text-sm text-muted-foreground">
              Your open-mode progress is now backed by the active server store.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
