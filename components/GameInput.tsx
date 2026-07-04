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
}

export function GameInput({
  disabled = false,
  loading = false,
  onSubmit,
  title = "Guess A Real Woman",
  description = "Enter a full name. Each valid female human with a Wikipedia page earns one point.",
  buttonLabel = "Submit",
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

  return (
    <Card className="overflow-hidden border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,245,250,0.96)_42%,rgba(239,246,255,0.96)_100%)] shadow-[0_36px_120px_rgba(244,114,182,0.18)] ring-1 ring-white/80 backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.96),rgba(30,27,45,0.96)_42%,rgba(14,23,38,0.96)_100%)] dark:ring-white/10">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/70 to-transparent dark:via-sky-300/30" />
            <div className="absolute -left-16 top-10 h-36 w-36 rounded-full bg-rose-200/40 blur-3xl dark:bg-rose-500/10" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-sky-200/45 blur-3xl dark:bg-sky-500/10" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="inline-flex w-fit items-center rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Hero Input
                </div>
                <CardHeader className="space-y-3 p-0">
                  <CardTitle className="max-w-lg text-3xl leading-tight sm:text-4xl lg:text-[2.8rem]">
                    {title}
                  </CardTitle>
                  <CardDescription className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                    {description}
                  </CardDescription>
                </CardHeader>
              </div>
              <div className="flex flex-wrap gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  Full name
                </div>
                <div className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  Wikidata checked
                </div>
                <div className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  One tap submit
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/70 bg-white/55 px-6 py-7 dark:border-white/10 dark:bg-black/20 sm:px-8 sm:py-9 lg:border-l lg:border-t-0">
            <form className="flex h-full flex-col justify-center gap-4" onSubmit={handleSubmit}>
              <Input
                autoComplete="off"
                autoCorrect="off"
                className="h-20 rounded-[1.6rem] border-white/80 bg-white px-6 text-2xl font-medium shadow-[0_18px_60px_rgba(15,23,42,0.12)] placeholder:text-xl dark:border-white/10 dark:bg-black/35"
                disabled={disabled || loading}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Ada Lovelace"
                spellCheck={false}
                value={value}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-16 flex-1 rounded-[1.4rem] px-7 text-lg font-semibold shadow-[0_16px_48px_rgba(244,114,182,0.24)]"
                  disabled={disabled || loading}
                  size="lg"
                  type="submit"
                >
                  {loading ? "Checking..." : buttonLabel}
                </Button>
              </div>
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Enter one name at a time. Correct answers appear immediately in the saved list below.
              </p>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
