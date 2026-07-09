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
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_24%),radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.14),transparent_18%),linear-gradient(180deg,#f0f9ff_0%,#e0f2fe_24%,#ecfeff_52%,#f8fafc_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.08),transparent_18%),linear-gradient(180deg,#08152a_0%,#082f49_32%,#0f172a_100%)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <GameBoard />

        <Card className="overflow-hidden border-sky-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(224,242,254,0.92)_40%,rgba(236,253,245,0.92)_100%)] backdrop-blur dark:border-sky-300/15 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(12,74,110,0.88)_40%,rgba(4,47,46,0.86)_100%)]">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Daily Challenge</Badge>
              <Badge variant="outline">Score Chase</Badge>
              <Badge variant="outline">Share Run</Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-2xl leading-tight sm:text-3xl">
                Clear today, then come back for tomorrow&apos;s remix.
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                The base mode accepts any real woman who passes Wikidata. The daily mode
                swaps in a themed ruleset each day, like actors or fictional characters,
                so every run feels like a new board with its own bragging rights.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Mode Shift
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  A fresh daily ruleset pushes players out of memorized comfort picks.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Progress
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Local history tracks played dates, themed clears, streaks, and best times.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Bragging Rights
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Finished runs generate ready-to-post results for Twitter, Reddit, and Discord.
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
