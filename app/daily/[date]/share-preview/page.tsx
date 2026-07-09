import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  buildDailyShareText,
  getDailyChallenge,
  getDailyRoute,
  isValidChallengeDate,
} from "@/lib/daily"

type SharePreviewPageProps = {
  params: Promise<{ date: string }>
}

export async function generateMetadata({
  params,
}: SharePreviewPageProps): Promise<Metadata> {
  const { date } = await params
  const challenge = getDailyChallenge(date)

  return {
    title: `${challenge.title} Share Preview ${date}`,
    description: `Preview the social share card for the ${challenge.shareLabel} daily challenge on ${date}.`,
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default async function SharePreviewPage({ params }: SharePreviewPageProps) {
  const { date } = await params

  if (!isValidChallengeDate(date)) {
    notFound()
  }

  const challenge = getDailyChallenge(date)
  const previewShareText = buildDailyShareText({
    date,
    score: challenge.targetScore,
    targetScore: challenge.targetScore,
    durationMs: 133000,
    streak: 5,
    shareTitle: challenge.shareTitle,
    shareLabel: challenge.shareLabel,
    url: getDailyRoute(date),
  })

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Share Preview</Badge>
              <Badge variant="outline">{date}</Badge>
              <Badge variant="outline">{challenge.categoryLabel}</Badge>
            </div>
            <CardTitle>Women Guess Game {date}</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              This page is used for share preview context and mirrors the social message
              structure: theme, score, time, streak, and the daily route.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-6">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {previewShareText}
              </pre>
            </div>
            <Link
              className={buttonVariants({ className: "rounded-xl" })}
              href={getDailyRoute(date)}
            >
              Back to daily challenge
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
