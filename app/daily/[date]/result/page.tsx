import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDuration, getDailyChallenge, getDailyRoute, isDailyChallengeOpen, isValidChallengeDate } from "@/lib/daily"
import {
  buildDailyResultAltText,
  buildDailyResultDownloadPath,
  buildDailyResultImagePath,
  parseDailyResultShareData,
} from "@/lib/daily-result-share"
import { buildCanonicalUrl } from "@/lib/site"

type DailyResultPageProps = {
  params: Promise<{ date: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
  searchParams,
}: DailyResultPageProps): Promise<Metadata> {
  const { date } = await params
  const rawSearchParams = await searchParams

  if (!isValidChallengeDate(date) || !isDailyChallengeOpen(date)) {
    return {
      title: "Result",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const challenge = getDailyChallenge(date)
  const result = parseDailyResultShareData(rawSearchParams)
  const imageUrl = buildCanonicalUrl(buildDailyResultImagePath(date, result))
  const pageUrl = buildCanonicalUrl(`${getDailyRoute(date)}/result`)
  const description = `I scored ${result.score}/${result.targetScore} on ${challenge.shareTitle} in ${formatDuration(result.durationMs)}.`

  return {
    title: `${challenge.shareTitle} Result ${date}`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${challenge.shareTitle} Result`,
      description,
      type: "website",
      url: pageUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: buildDailyResultAltText({
            date,
            title: challenge.shareTitle,
            result,
          }),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${challenge.shareTitle} Result`,
      description,
      images: [imageUrl],
    },
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default async function DailyResultPage({
  params,
  searchParams,
}: DailyResultPageProps) {
  const { date } = await params
  const rawSearchParams = await searchParams

  if (!isValidChallengeDate(date) || !isDailyChallengeOpen(date)) {
    notFound()
  }

  const challenge = getDailyChallenge(date)
  const result = parseDailyResultShareData(rawSearchParams)
  const imagePath = buildDailyResultImagePath(date, result)
  const downloadPath = buildDailyResultDownloadPath(date, result)

  return (
    <main className="min-h-svh bg-[#fffdf8] px-4 py-8 text-foreground dark:bg-[#241c15] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card className="bg-[#fbefe3] dark:bg-[#30261e]">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Shared Result</Badge>
              <Badge variant="outline">{date}</Badge>
              <Badge variant="outline">{challenge.categoryLabel}</Badge>
            </div>
            <CardTitle className="doodle-underline text-4xl font-black sm:text-5xl">
              {challenge.shareTitle}
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              A public Name 100 result card for this daily challenge. Share this page link
              on social platforms to show the generated image preview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="overflow-hidden rounded-lg border-2 border-[#241c15] bg-white shadow-[6px_6px_0_#241c15] dark:border-[#fffaf1] dark:shadow-[6px_6px_0_#fffaf1]">
              <Image
                alt={buildDailyResultAltText({
                  date,
                  title: challenge.shareTitle,
                  result,
                })}
                className="h-auto w-full"
                height={630}
                priority
                src={imagePath}
                width={1200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border-2 border-[#241c15] bg-[#ffe01b] p-4 text-[#241c15]">
                <p className="text-xs font-bold text-[#6f6a64]">Score</p>
                <p className="mt-2 text-2xl font-semibold">
                  {result.score}/{result.targetScore}
                </p>
              </div>
              <div className="rounded-lg border-2 border-[#241c15] bg-white p-4 text-[#241c15]">
                <p className="text-xs font-bold text-[#6f6a64]">Time</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatDuration(result.durationMs)}
                </p>
              </div>
              <div className="rounded-lg border-2 border-[#241c15] bg-white p-4 text-[#241c15]">
                <p className="text-xs font-bold text-[#6f6a64]">Streak</p>
                <p className="mt-2 text-2xl font-semibold">{result.streak}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ className: "rounded-full" })} href={getDailyRoute(date)}>
                Play this challenge
              </Link>
              <a
                className={buttonVariants({ className: "rounded-full", variant: "outline" })}
                href={downloadPath}
              >
                Download image
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
