import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "How To Play",
  description:
    "Learn how the open Wikidata mode and the daily themed challenge work, and how to share your result.",
}

export default function HowToPlayPage() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">How To Play</Badge>
              <Badge variant="outline">SEO page</Badge>
            </div>
            <CardTitle className="text-3xl">Daily rules and sharing loop</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              The base game accepts any real woman who passes Wikidata. The daily game uses
              a date-based seed to assign one shared theme, and your completion summary is
              designed to be copied into social posts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">1. Open a daily URL</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Visit a route like <code>/daily/2026-07-01</code>. That date controls the
                deterministic seed, so every player sees the same theme that day.
              </p>
            </div>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold">2. Enter full names</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Each guess is searched in Wikidata, then verified as a female human with a
                Wikipedia page. Duplicate QIDs never count twice in either mode.
              </p>
            </div>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold">3. Match today&apos;s theme</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                In daily mode, a valid female person still has to satisfy the theme rule,
                such as actress, singer, director, or fictional character. That is what
                keeps the challenge consistent and comparable across users.
              </p>
            </div>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold">4. Finish and share</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Once you complete the themed target, the game builds a share card with your
                score, time, theme, and the exact daily URL so other players can try the same
                board.
              </p>
            </div>
            <div className="pt-2">
              <Link className={buttonVariants({ className: "rounded-xl" })} href="/">
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
