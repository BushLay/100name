"use client"

import { Check, CircleX, CornerDownLeft, Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type SubmissionEntry = {
  id: string
  name: string
  accepted: boolean
  message: string
  tone?: "success" | "error" | "warning"
}

type GameInputProps = {
  disabled?: boolean
  loading?: boolean
  onSubmit: (name: string) => Promise<boolean> | boolean
  title?: string
  description?: string
  feedback?: {
    tone: "success" | "error" | "warning"
    text: string
  } | null
  score: number
  targetScore: number
  submissions: SubmissionEntry[]
  boardSlotCount?: number
  boardColumns?: 2 | 4
}

function getSubmissionTone(entry: SubmissionEntry) {
  if (entry.tone) {
    return entry.tone
  }

  return entry.accepted ? "success" : "error"
}

export function GameInput({
  disabled = false,
  loading = false,
  onSubmit,
  title = "Name 100",
  description = "Fill the board one name at a time. Press Enter to validate the current slot and move to the next one.",
  feedback = null,
  score,
  targetScore,
  submissions,
  boardSlotCount,
  boardColumns = 2,
}: GameInputProps) {
  const [draftValue, setDraftValue] = useState("")
  const activeInputRef = useRef<HTMLInputElement | null>(null)

  const activeSlotIndex = submissions.length
  const visibleSlotCount = Math.max(
    boardSlotCount ?? Math.min(targetScore, 20),
    activeSlotIndex + 1
  )
  const progress = Math.min((score / targetScore) * 100, 100)
  const gridClassName =
    boardColumns === 4
      ? "grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-4"
      : "grid gap-x-6 gap-y-4 md:grid-cols-2"

  useEffect(() => {
    if (disabled || loading) {
      return
    }

    activeInputRef.current?.focus()
  }, [activeSlotIndex, disabled, loading])

  const latestStatusLabel = useMemo(() => {
    if (!feedback) {
      return "Waiting"
    }

    if (feedback.tone === "success") {
      return "Correct"
    }

    if (feedback.tone === "warning") {
      return "Duplicate"
    }

    return "Incorrect"
  }, [feedback])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = draftValue.trim()
    const accepted = await onSubmit(trimmed)

    if (accepted) {
      setDraftValue("")
      return
    }

    setDraftValue(trimmed)
  }

  return (
    <Card className="overflow-hidden border-[rgba(255,200,174,0.34)] bg-[linear-gradient(180deg,#2a1634_0%,#351d45_45%,#291735_100%)] text-amber-50 shadow-[0_34px_120px_rgba(42,22,52,0.42)]">
      <CardHeader className="gap-5 border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,194,152,0.12),transparent_36%)] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/10 bg-white/10 text-amber-50 hover:bg-white/10">
                Answer Board
              </Badge>
              <Badge className="border-[#f0c3a7]/25 bg-[#f0c3a7]/10 text-[#ffd7b2] hover:bg-[#f0c3a7]/10">
                Press Enter To Check
              </Badge>
            </div>
            <CardTitle className="text-3xl tracking-tight text-[#ffd3b4] sm:text-4xl">
              {title}
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-7 text-[#f5d6c0]/78">
              {description}
            </CardDescription>
          </div>
          <div className="min-w-[9rem] rounded-3xl border border-[#f0c3a7]/18 bg-white/6 px-5 py-4 text-right shadow-inner">
            <p className="text-xs uppercase tracking-[0.28em] text-[#d8b6a1]/78">Progress</p>
            <p className="mt-2 text-3xl font-black text-[#ffd3b4]">
              {score}/{targetScore}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-[#f4d0ba]">
            <span>{loading ? "Checking current slot..." : "Board status"}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/8">
            <div
              aria-hidden="true"
              className="h-full rounded-full bg-[linear-gradient(90deg,#f3c0aa_0%,#dc8dc0_55%,#8cf4b6_100%)] transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/6 px-4 py-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#d8b6a1]/78">
              Latest Result
            </p>
            <p className="text-sm leading-6 text-[#ffe1cb]">
              {feedback?.text ?? "Start typing in the next empty slot and press Enter to validate."}
            </p>
          </div>
          <Badge
            className={
              feedback?.tone === "success"
                ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                : feedback?.tone === "warning"
                  ? "border-amber-300/30 bg-amber-300/14 text-amber-100"
                  : feedback?.tone === "error"
                    ? "border-rose-300/30 bg-rose-400/15 text-rose-100"
                    : "border-white/10 bg-white/8 text-[#ffd3b4]"
            }
          >
            {latestStatusLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <form onSubmit={handleSubmit}>
          <div className={gridClassName}>
            {Array.from({ length: visibleSlotCount }, (_, index) => {
              const submittedEntry = submissions[index]
              const isActiveSlot = !submittedEntry && index === activeSlotIndex && !disabled
              const activeTone = isActiveSlot && feedback && draftValue.trim() ? feedback.tone : null
              const tone = submittedEntry ? getSubmissionTone(submittedEntry) : null
              const slotClassName =
                tone === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_0_0_2px_rgba(74,222,128,0.2)]"
                  : tone === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-950 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]"
                    : tone === "error"
                      ? "border-rose-300 bg-rose-50 text-rose-950 shadow-[0_0_0_2px_rgba(251,113,133,0.18)]"
                      : activeTone === "success"
                        ? "border-emerald-300 bg-white text-slate-900 shadow-[0_0_0_2px_rgba(74,222,128,0.18)]"
                        : activeTone === "warning"
                          ? "border-amber-300 bg-white text-slate-900 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]"
                          : activeTone === "error"
                            ? "border-rose-300 bg-white text-slate-900 shadow-[0_0_0_2px_rgba(251,113,133,0.18)]"
                        : isActiveSlot
                          ? "border-[#f4c4a7] bg-white text-slate-900 shadow-[0_0_0_2px_rgba(244,196,167,0.22)]"
                          : "border-[#c89cae] bg-white/92 text-slate-500"

              return (
                <div className="flex items-start gap-3" key={submittedEntry?.id ?? `slot-${index}`}>
                  <div className="flex h-[3.35rem] w-7 items-center justify-center text-lg font-black text-[#ffd3b4]">
                    {submittedEntry ? (
                      tone === "success" ? (
                        <Check className="h-5 w-5 text-emerald-300" />
                      ) : tone === "warning" ? (
                        <CornerDownLeft className="h-5 w-5 text-amber-300" />
                      ) : (
                        <CircleX className="h-5 w-5 text-rose-300" />
                      )
                    ) : (
                      <span>{index + 1}.</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {isActiveSlot ? (
                      <>
                        <Input
                          autoComplete="off"
                          autoCorrect="off"
                          className={`h-[3.35rem] rounded-2xl border-2 px-4 text-base font-medium ${slotClassName}`}
                          disabled={loading}
                          onChange={(event) => setDraftValue(event.target.value)}
                          placeholder={loading ? "Checking..." : `Answer ${index + 1}`}
                          ref={activeInputRef}
                          spellCheck={false}
                          value={draftValue}
                        />
                        <p className="pl-1 text-xs text-[#d8b6a1]/78">
                          Press <span className="font-semibold text-[#ffd3b4]">Enter</span> to
                          validate this name. The next slot unlocks only after a correct answer.
                        </p>
                      </>
                    ) : submittedEntry ? (
                      <>
                        <div
                          className={`flex min-h-[3.35rem] items-center rounded-2xl border-2 px-4 text-base font-medium ${slotClassName}`}
                        >
                          <span className="truncate">{submittedEntry.name || "Empty submission"}</span>
                        </div>
                        <p className="pl-1 text-xs text-[#d8b6a1]/78">{submittedEntry.message}</p>
                      </>
                    ) : (
                      <>
                        <div
                          className={`flex min-h-[3.35rem] items-center rounded-2xl border-2 px-4 text-base font-medium ${slotClassName}`}
                        >
                          <span className="opacity-65">
                            {disabled ? "Locked" : `Waiting for slot ${index + 1}`}
                          </span>
                        </div>
                        <p className="pl-1 text-xs text-[#d8b6a1]/55">
                          {disabled
                            ? "The board is currently locked."
                            : "This slot will activate after the previous submission."}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </form>

        {loading ? (
          <div className="mt-5 flex items-center gap-3 rounded-3xl border border-white/8 bg-white/6 px-4 py-3 text-sm text-[#ffe1cb]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking the current guess against the live game rules.</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
