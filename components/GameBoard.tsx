"use client"

import Image from "next/image"
import { useEffect, useState, useSyncExternalStore } from "react"

import type { OpenGameState, SubmitOpenGuessResponse } from "@/lib/backend-contracts"
import { GameInput } from "@/components/GameInput"
import { GuessList } from "@/components/GuessList"
import { ScoreBoard } from "@/components/ScoreBoard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { readApiResponse } from "@/lib/client-api"
import { WINNING_SCORE, checkWinCondition } from "@/lib/game"

type Feedback = {
  tone: "success" | "error" | "warning"
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
  const [submissionHistory, setSubmissionHistory] = useState<
    Array<{
      id: string
      name: string
      accepted: boolean
      message: string
      tone?: "success" | "error" | "warning"
    }>
  >([])

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

        const payload = await readApiResponse<{ state: OpenGameState }>(
          response,
          "Failed to load open game state."
        )

        if (!cancelled) {
          setGameState(payload.state)
          setSubmissionHistory(
            payload.state.acceptedGuesses.map((guess, index) => ({
              id: `accepted-${guess.qid}-${index}`,
              name: guess.name,
              accepted: true,
              message: "Previously accepted in this run.",
              tone: "success" as const,
            }))
          )
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

    try {
      const response = await fetch("/api/open/guess", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      })

      const result = await readApiResponse<SubmitOpenGuessResponse | { message?: string }>(
        response,
        "Failed to submit open-mode guess."
      )

      if (!("state" in result)) {
        throw new Error(result.message ?? "Failed to submit open-mode guess.")
      }

      if (result.accepted) {
        setSubmissionHistory((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
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
      setGameState(result.state)
      return result.accepted
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Wikidata is unavailable right now. Please try again.",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const won = checkWinCondition(gameState.score)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <GameInput
        disabled={won || initializing}
        feedback={feedback}
        loading={loading || initializing}
        onSubmit={handleSubmit}
        boardColumns={4}
        boardSlotCount={100}
        score={gameState.score}
        submissions={submissionHistory}
        targetScore={gameState.targetScore}
      />

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden bg-white dark:bg-[#30261e]">
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
                <h1 className="doodle-underline max-w-2xl text-4xl font-black sm:text-5xl">
                  How many remarkable women can you name?
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Type a full name. We&apos;ll check Wikidata. You bring the memory; we&apos;ll keep the score.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border-2 border-[#241c15] bg-[#fbefe3] p-3 text-sm dark:border-[#fffaf1] dark:bg-[#4a3c31]">
                  <p className="text-xs font-bold text-muted-foreground">Rule 01</p>
                  <p className="mt-2 font-medium">Human only</p>
                </div>
                <div className="rounded-lg border-2 border-[#241c15] bg-[#ffe01b] p-3 text-sm dark:border-[#fffaf1] dark:text-[#241c15]">
                  <p className="text-xs font-bold text-[#6f6a64]">Rule 02</p>
                  <p className="mt-2 font-medium">Female only</p>
                </div>
                <div className="rounded-lg border-2 border-[#241c15] bg-[#fbefe3] p-3 text-sm dark:border-[#fffaf1] dark:bg-[#4a3c31]">
                  <p className="text-xs font-bold text-muted-foreground">Rule 03</p>
                  <p className="mt-2 font-medium">Wikipedia required</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ScoreBoard score={gameState.score} won={won} />
      </section>

      <GuessList guesses={gameState.acceptedGuesses} />

      {won ? (
        <Card className="bg-[#ffe01b] text-[#241c15] dark:bg-[#ffe01b] dark:text-[#241c15]">
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
