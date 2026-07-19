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
  isDailyChallengeOpen,
  isValidChallengeDate,
} from "@/lib/daily"

type SharePreviewPageProps = {
  params: Promise<{ date: string }>
}

export async function generateMetadata({
  params,
}: SharePreviewPageProps): Promise<Metadata> {
  const { date } = await params

  if (!isValidChallengeDate(date) || !isDailyChallengeOpen(date)) {
    return {
      title: "Share Preview",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

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

  if (!isValidChallengeDate(date) || !isDailyChallengeOpen(date)) {
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
    <main className="min-h-svh bg-[#fffdf8] px-4 py-8 text-foreground dark:bg-[#241c15] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="bg-[#ffe01b] text-[#241c15] dark:bg-[#ffe01b] dark:text-[#241c15]">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Share Preview</Badge>
              <Badge variant="outline">{date}</Badge>
              <Badge variant="outline">{challenge.categoryLabel}</Badge>
            </div>
            <CardTitle className="text-3xl font-black sm:text-4xl">Women Guess Game {date}</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              This page is used for share preview context and mirrors the social message
              structure: theme, score, time, streak, and the daily route.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-[#241c15] bg-white p-6 text-[#241c15] shadow-[4px_4px_0_#241c15]">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {previewShareText}
              </pre>
            </div>
            <Link
              className={buttonVariants({ className: "rounded-full" })}
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
