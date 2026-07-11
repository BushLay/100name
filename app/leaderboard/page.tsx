import type { Metadata } from "next"

import { JsonLd } from "@/components/JsonLd"
import { LeaderboardBoard } from "@/components/LeaderboardBoard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { buildLeaderboardStructuredData } from "@/lib/seo"
import { buildCanonicalUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "Name 100 Leaderboard",
  description:
    "Review Name 100 leaderboard stats, daily rankings, recovery code guidance, streaks, and server-backed player history.",
  alternates: {
    canonical: buildCanonicalUrl("/leaderboard"),
  },
}

export default function LeaderboardPage() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <JsonLd data={buildLeaderboardStructuredData()} id="leaderboard-structured-data" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Leaderboard Guide</Badge>
              <Badge variant="outline">Recovery</Badge>
              <Badge variant="outline">Server stats</Badge>
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Name 100 Leaderboard</h1>
            <CardDescription className="max-w-3xl text-base leading-7">
              The leaderboard page is where Name 100 turns single runs into long-term
              progress. It combines today&apos;s ranking, fastest completions, streak
              tracking, player history, and recovery-code identity so you can keep a stable
              profile even if you change browser sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-7 text-muted-foreground">
            <p>
              There are two layers of ranking to understand. The first is the player-facing
              daily leaderboard, which compares completed runs for one challenge date. This
              is the most social view because everyone on that date is solving the same theme
              and target. The second layer is the broader summary area, which looks across
              sessions to show fastest clears, streak leaders, average completion time, and
              other recurring performance metrics. Together they let casual players see today
              at a glance and let repeat players track improvement over time.
            </p>
            <p>
              The stats here are also meant to be readable. <strong>Fastest today</strong>
              shows the best completion time recorded for the active date. <strong>Average
              completion</strong> summarizes completed runs for the current player.
              <strong> Success rate</strong> describes how often the player finishes started
              challenges. <strong>Average guesses</strong> helps you judge efficiency, while
              <strong> active players 7d</strong> gives a sense of how many recent players are
              showing up on the server-backed system. These numbers are not just decorative;
              they help explain whether someone is consistent, fast, experimental, or still
              learning the rules.
            </p>
            <p>
              Name 100 currently uses a lightweight account model built around a public
              handle and a recovery code instead of mandatory email login. That is why the
              identity panel is such a central part of this page. If you save a handle, it
              becomes the public name shown on rankings. If you store the recovery code, you
              can restore that same player on another device or after clearing cookies. The
              recovery code is effectively the bridge between a casual web session and a
              longer-running competitive identity, so it should be stored somewhere safe if
              you care about streaks and historical stats.
            </p>
            <p>
              This page also explains the difference between local-looking gameplay and
              server-backed summaries. Open mode and daily challenges feel immediate in the
              UI, but the leaderboard layer records accepted guesses, completion state,
              ranking order, and history so the site can support long-term operation. That
              matters for a web game because players want continuity. A daily puzzle is more
              compelling when it remembers who you are, what you solved yesterday, how fast
              you were, and whether today extended or broke a streak.
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">What the leaderboard areas mean</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Use these sections as a quick glossary for the metrics and recovery flow on
              the live board below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm leading-7 text-muted-foreground md:grid-cols-2">
            <div>
              <p className="font-medium text-foreground">Today ranking</p>
              <p className="mt-2">
                Shows the best completed runs for the current challenge date. This is the
                most direct way to compare yourself with other players on the same board.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Top fastest players</p>
              <p className="mt-2">
                Highlights players with the strongest completion times across recorded runs,
                which is useful if you care about speed more than raw participation.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Top streak players</p>
              <p className="mt-2">
                Rewards consistency instead of one-off pace. A long streak means a player has
                been showing up and completing daily boards on consecutive dates.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Played dates history</p>
              <p className="mt-2">
                Lists recent daily attempts tied to the active player so you can revisit past
                performance and reopen the associated challenge routes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <LeaderboardBoard />
      </div>
    </main>
  )
}
