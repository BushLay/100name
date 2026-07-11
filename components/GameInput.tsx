"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type GameInputProps = {
  disabled?: boolean
  loading?: boolean
  onSubmit: (name: string) => Promise<void> | void
  title?: string
  description?: string
  buttonLabel?: string
  feedback?: {
    tone: "success" | "error" | "warning"
    text: string
  } | null
}

export function GameInput({
  disabled = false,
  loading = false,
  onSubmit,
  title = "Drop Your Next Name",
  description = "Chain together valid women from Wikidata, avoid repeats, and keep your run alive until you hit 100.",
  buttonLabel = "Lock In",
  feedback = null,
}: GameInputProps) {
  const [value, setValue] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = value.trim()

    if (!trimmed) {
      await onSubmit("")
      return
    }

    await onSubmit(trimmed)
    setValue("")
  }

  const feedbackPanelClassName =
    feedback?.tone === "success"
      ? "border-emerald-300/40 bg-emerald-400/12 text-emerald-50"
      : feedback?.tone === "warning"
        ? "border-amber-300/40 bg-amber-300/12 text-amber-50"
        : feedback?.tone === "error"
          ? "border-rose-300/40 bg-rose-400/12 text-rose-50"
          : "border-white/12 bg-white/8 text-cyan-50/88"

  const feedbackBadgeLabel =
    feedback?.tone === "success"
      ? "Correct"
      : feedback?.tone === "warning"
        ? "Duplicate"
        : feedback?.tone === "error"
          ? "Incorrect"
          : "Status"

  return (
    <Card className="overflow-hidden border-sky-200/80 bg-[linear-gradient(135deg,rgba(6,23,49,0.98),rgba(17,58,92,0.96)_45%,rgba(8,26,59,0.98)_100%)] text-white shadow-[0_36px_120px_rgba(14,165,233,0.28)] ring-1 ring-cyan-200/40 dark:border-sky-400/20 dark:ring-sky-300/10">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.16),transparent_24%)]" />
            <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="inline-flex w-fit items-center rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 shadow-sm">
                  Live Run Console
                </div>
                <CardHeader className="space-y-3 p-0">
                  <CardTitle className="max-w-lg text-3xl leading-tight sm:text-4xl lg:text-[2.8rem]">
                    {title}
                  </CardTitle>
                  <CardDescription className="max-w-xl text-base leading-7 text-sky-50/78">
                    {description}
                  </CardDescription>
                </CardHeader>
              </div>
              <div className="grid gap-2 text-sm text-cyan-50/88 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2 shadow-sm">
                  Target: 100 names
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2 shadow-sm">
                  Rule: no repeats
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2 shadow-sm">
                  Judge: Wikidata
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] px-6 py-7 sm:px-8 sm:py-9 lg:border-l lg:border-t-0">
            <form className="flex h-full flex-col justify-center gap-4" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-cyan-100/70">
                <span>Input Channel</span>
                <span>{loading ? "Scanning" : "Ready"}</span>
              </div>
              <Input
                autoComplete="off"
                autoCorrect="off"
                className="h-20 rounded-[1.6rem] border-cyan-100/20 bg-slate-950/70 px-6 text-2xl font-medium text-white shadow-[0_18px_60px_rgba(2,12,27,0.42)] placeholder:text-xl placeholder:text-sky-100/38"
                disabled={disabled || loading}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Ada Lovelace"
                spellCheck={false}
                value={value}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-16 flex-1 rounded-[1.4rem] border border-cyan-200/40 bg-[linear-gradient(135deg,#22d3ee,#0ea5e9_48%,#2563eb)] px-7 text-lg font-semibold text-slate-950 shadow-[0_16px_48px_rgba(14,165,233,0.34)]"
                  disabled={disabled || loading}
                  size="lg"
                  type="submit"
                >
                  {loading ? "Checking..." : buttonLabel}
                </Button>
              </div>
              <div
                className={`rounded-[1.4rem] border px-4 py-3 shadow-[0_14px_40px_rgba(2,12,27,0.2)] transition ${feedbackPanelClassName}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                    {feedbackBadgeLabel}
                  </span>
                  <span className="text-xs uppercase tracking-[0.24em] text-white/70">
                    {loading ? "Waiting" : "Latest Result"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6">
                  {feedback?.text ?? "Submit a name to get an instant hit-or-miss result here."}
                </p>
              </div>
              <p className="text-sm leading-6 text-sky-50/70">
                One full name per turn. Valid hits are locked into your run instantly.
              </p>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
