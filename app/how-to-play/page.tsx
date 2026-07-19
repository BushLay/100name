import type { Metadata } from "next"
import Link from "next/link"

import { JsonLd } from "@/components/JsonLd"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { buildHowToPlayStructuredData } from "@/lib/seo"
import { buildCanonicalUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "How to Play Name 100",
  description:
    "Learn the rules, validation logic, answer examples, and recovery flow for Name 100 daily challenges and open mode.",
  alternates: {
    canonical: buildCanonicalUrl("/how-to-play"),
  },
}

export default function HowToPlayPage() {
  return (
    <main className="min-h-svh bg-[#fffdf8] px-4 py-8 text-foreground dark:bg-[#241c15] sm:px-6 lg:px-8">
      <JsonLd data={buildHowToPlayStructuredData()} id="how-to-play-structured-data" />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="bg-[#fbefe3] dark:bg-[#30261e]">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">How To Play</Badge>
              <Badge variant="outline">Rules</Badge>
              <Badge variant="outline">Validation</Badge>
            </div>
            <h1 className="doodle-underline text-4xl font-black sm:text-5xl">How to Play Name 100</h1>
            <CardDescription className="max-w-3xl text-base leading-7">
              Name 100 is a women-name challenge built around verified public entities. You
              can play it two ways: open mode on the homepage for a long-form 100-name run,
              or the daily route for a date-specific themed board that every player shares.
              This guide explains the rules, the validation logic, examples of good and bad
              answers, and how to protect your progress with a recovery code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-7 text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">1. Choose a mode</h2>
              <p>
                Open mode lives on the homepage and asks you to build a 100-name streak. It
                is ideal for practice, endurance runs, and broad category recall because it
                accepts any real woman who satisfies the base verification rule. Daily mode
                lives on a route like <code>/daily/2026-07-11</code>. Each date points to a
                shared challenge theme, which means every player sees the same target and can
                compare their result more fairly.
              </p>
              <p>
                The difference matters. If you want a free-form experience, play open mode.
                If you want a puzzle-like board that everyone is discussing on the same day,
                play the daily challenge. Both modes preserve the core input loop, but the
                daily board adds an extra rule about what kind of person counts.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">2. Submit full names</h2>
              <p>
                Name 100 works best when you enter a complete person name instead of a loose
                fragment. The app searches for a matching entity in Wikidata, inspects the
                public metadata attached to that entity, and checks whether it meets the rule
                of the current board. A successful answer is stored by entity identifier so
                the same person cannot be counted twice under small spelling variations.
              </p>
              <p>
                Good examples in open mode include names like <em>Ada Lovelace</em>,
                <em> Rihanna</em>, or <em>Greta Gerwig</em>, provided the underlying entity
                is a real woman with a Wikipedia page. Bad examples include partial names,
                fictional groups, repeated entries, and people who do not satisfy the theme.
                For example, a male singer might resolve in Wikidata correctly, but the guess
                would still fail because the board is about women.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">3. Understand the validation rule</h2>
              <p>
                The site uses Wikidata as the primary verification source and relies on
                Wikipedia availability for many of the public-rule boards. In open mode, a
                valid answer must resolve to a female human with a qualifying Wikipedia page.
                In daily mode, the same base person may need to pass an additional rule, such
                as being a singer, director, actor, fictional character, or a member of a
                curated cast list.
              </p>
              <p>
                This is why some guesses are rejected even when they look reasonable at first
                glance. A person can exist in Wikidata but fail the board because the wrong
                occupation is attached, because the entry is a duplicate, or because the
                themed challenge is narrower than the general open mode. Featured curated
                boards can also use a local answer library when the challenge is based on a
                fixed cast list rather than a free-form occupation category.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">4. Know what counts and what does not</h2>
              <p>
                A valid answer is usually a real person entity that matches the game rule and
                has the right public knowledge footprint. An invalid answer can fail for
                several reasons: it may be empty, too vague, already used, the wrong gender,
                the wrong occupation, not a person, or missing the required Wikipedia/Wikidata
                qualities for the active board. A daily character challenge may also reject a
                real actor because the board expects the fictional character entity instead.
              </p>
              <p>
                When in doubt, think about the board literally. If the theme says female
                singers, enter singers. If it says a curated cast challenge, enter credited
                cast members from that answer set. If the site says the name has already been
                guessed, treat it as a duplicate warning rather than a full mistake. The app
                now highlights these states separately so you can tell the difference between
                wrong, correct, and repeated answers.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. Finish the board and share the result</h2>
              <p>
                Each completed daily run can produce a share-friendly summary with the date,
                score, and route. That makes it easy to challenge a friend with the exact same
                board instead of describing the rules manually. The leaderboard page tracks
                completion time, average guesses, streak progress, and recent history, so
                returning players can see whether they are improving over time.
              </p>
              <p>
                If you want your progress to survive a new browser or device, claim a public
                handle and store the recovery code shown on the leaderboard page. This site
                currently uses a lightweight recovery-code model instead of a mandatory email
                account system, which keeps the onboarding simple while still giving dedicated
                players a path to persistent identity.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Frequently useful reminders</h2>
              <ul className="space-y-2">
                <li>Use full names whenever possible so the entity search has clear intent.</li>
                <li>Open mode accepts broad women-name knowledge; daily mode is stricter.</li>
                <li>Duplicates do not score, even if the spelling or punctuation changes.</li>
                <li>Curated special boards can validate against a local answer library.</li>
                <li>Save your recovery code if you care about streaks and leaderboard identity.</li>
              </ul>
            </section>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link className={buttonVariants({ className: "rounded-full" })} href="/">
                Back to home
              </Link>
              <Link
                className={buttonVariants({ className: "rounded-full", variant: "outline" })}
                href="/leaderboard"
              >
                Open leaderboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
