import type { Metadata } from "next"
import Link from "next/link"

import { JsonLd } from "@/components/JsonLd"
import { DailyChallengeCta } from "@/components/DailyChallengeCta"
import { GameBoard } from "@/components/GameBoard"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { buildHomeStructuredData } from "@/lib/seo"
import { buildCanonicalUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "Name 100: Daily Women Name Challenge",
  description:
    "Play Name 100, a daily women name challenge and open mode web game that verifies answers with Wikidata and Wikipedia.",
  alternates: {
    canonical: buildCanonicalUrl("/"),
  },
}

export default function Page() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_24%),radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.14),transparent_18%),linear-gradient(180deg,#f0f9ff_0%,#e0f2fe_24%,#ecfeff_52%,#f8fafc_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.08),transparent_18%),linear-gradient(180deg,#08152a_0%,#082f49_32%,#0f172a_100%)] sm:px-6 lg:px-8">
      <JsonLd data={buildHomeStructuredData()} id="home-structured-data" />
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

        <article className="grid gap-6">
          <Card className="border-white/60 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-black/25">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">What Is Name 100</Badge>
                <Badge variant="outline">Daily game</Badge>
                <Badge variant="outline">Open mode</Badge>
              </div>
              <CardTitle className="text-2xl sm:text-3xl">
                A women-name discovery game built around verified public knowledge.
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                Name 100 is a browser game where every run starts with a simple prompt:
                enter a real woman&apos;s name and see whether it survives live verification.
                The project combines a fast arcade input loop with a knowledge-game layer,
                because a valid answer is not just something that sounds familiar. It has
                to map to the right public entity, pass the current rule set, and avoid
                duplicates that would make the board too easy to brute force.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-7 text-muted-foreground">
              <p>
                The core idea is that Name 100 should feel approachable even if you have
                never played a name challenge before. On the homepage you can jump straight
                into open mode, where the goal is to build a 100-name streak by entering
                real women who have a matching Wikidata entity and a Wikipedia presence.
                This mode is intentionally broad. It rewards memory, curiosity, and
                category knowledge without forcing you into a single fandom or niche topic.
                If you want more structure, the daily challenge offers a shared prompt for
                everyone on the same date, so the run becomes comparable across players.
              </p>
              <p>
                The daily route adds a second layer of design. Instead of accepting every
                valid woman, it asks for a specific kind of answer such as female actors,
                singers, directors, fictional characters, or a curated cast list for a
                featured special challenge. That means the same player can have two
                different experiences on the same site: an endless practice board on the
                homepage, and a date-linked challenge board that feels closer to a daily
                puzzle. Because every daily page lives at a stable URL, players can share a
                specific board with friends and compare completion time, guess count, and
                streak progress.
              </p>
              <p>
                Verification matters because it keeps the game honest. Name 100 uses
                Wikidata as the main knowledge layer and relies on Wikipedia availability as
                part of the acceptance rule for the open, theme-based challenges. When you
                submit a guess, the app searches for the person entity, checks whether it is
                the correct type of person for the current board, and then records the
                entity identifier so repeats do not count twice. This is what makes the game
                more than a basic word list. The system is trying to validate public-entity
                identity, not just string similarity, and that creates a better challenge
                for players who care about fairness.
              </p>
              <p>
                Sharing and leaderboard features extend that loop beyond a single session.
                Finished daily runs can generate share text, which makes it easy to post a
                result without manually formatting the date, score, or route. The
                leaderboard page stores daily performance summaries, streaks, and recovery
                options so a player can keep coming back instead of losing progress when a
                browser session changes. For a long-running web game, that matters as much
                as the puzzle itself: people need a reason to return, a way to compare
                themselves to earlier runs, and a lightweight identity model that does not
                force account friction on day one.
              </p>
              <p>
                The project also has a deliberate editorial angle. Name 100 focuses on
                women names and public women figures because discovery in knowledge games is
                often shaped by whatever categories get repeated most often. By centering
                women across historical, fictional, musical, cinematic, and curated-source
                themes, the game becomes a small prompt for rediscovery. Some players will
                use it competitively, some will use it to test recall, and some will use it
                to find new people to read about after a run. That mix of play, memory, and
                exploration is the point of the site.
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <CardHeader>
              <CardTitle className="text-2xl">How the two main modes differ</CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                Open mode is for endurance and discovery. The daily challenge is for
                shared context, theme rules, and leaderboard comparison.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 text-sm leading-7 text-muted-foreground md:grid-cols-2">
              <div>
                <p className="font-medium text-foreground">Open mode</p>
                <p className="mt-2">
                  The homepage board asks you to reach 100 verified names. This is the best
                  place to learn the rhythm of the game, test broad recall, and push longer
                  sessions without waiting for a new date.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Daily challenge</p>
                <p className="mt-2">
                  The daily route gives everyone the same theme on the same date. The board
                  is easier to compare socially because the target, rule set, and URL are
                  identical for every player on that challenge.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Verification layer</p>
                <p className="mt-2">
                  Both modes care about entity accuracy. The open board uses a general women
                  rule, while daily pages can add a stricter theme validator or a curated
                  answer library for featured events.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Sharing and history</p>
                <p className="mt-2">
                  Daily clears feed sharing, streak tracking, and leaderboard comparison.
                  Recovery codes help you reconnect the same player identity across browser
                  changes without adding a full email-first login flow.
                </p>
              </div>
            </CardContent>
          </Card>
        </article>
      </div>
    </main>
  )
}
