import type { Metadata } from "next"
import Link from "next/link"

import { DailyChallengeCta } from "@/components/DailyChallengeCta"
import { GameBoard } from "@/components/GameBoard"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Women Name Game Daily Challenge",
  description:
    "Play an open Wikidata women name game plus a daily themed challenge like actresses, characters, directors, or singers.",
}

export default function Page() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <GameBoard />

        <Card className="overflow-hidden border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Daily Challenge</Badge>
              <Badge variant="outline">SEO ready</Badge>
              <Badge variant="outline">Shareable</Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-2xl leading-tight sm:text-3xl">
                Come back tomorrow for a new daily theme.
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                The base mode accepts any real woman who passes Wikidata. The daily mode
                switches to one themed rule each day, such as female actors or fictional
                characters, so players can compare results and share the route.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Discover
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Static metadata, daily routes, and searchable text make the challenge
                  indexable.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Retain
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Local history tracks played dates, themed completions, streaks, and best
                  times.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Share
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Finished themed runs generate ready-to-copy text for Twitter, Reddit, and
                  Discord.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row">
              <DailyChallengeCta />
              <Link
                className={buttonVariants({ className: "rounded-xl", variant: "outline" })}
                href="/how-to-play"
              >
                How to play
              </Link>
              <Link
                className={buttonVariants({ className: "rounded-xl", variant: "outline" })}
                href="/leaderboard"
              >
                Local leaderboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
