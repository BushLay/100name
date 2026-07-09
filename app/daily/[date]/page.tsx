import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DailyChallengeBoard } from "@/components/DailyChallengeBoard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDailyChallenge, getDailyRoute, getIndexableDailyDates, isValidChallengeDate } from "@/lib/daily"
import { getSiteUrl } from "@/lib/site"

type DailyPageProps = {
  params: Promise<{ date: string }>
}

export async function generateStaticParams() {
  return getIndexableDailyDates().map((date) => ({ date }))
}

export async function generateMetadata({
  params,
}: DailyPageProps): Promise<Metadata> {
  const { date } = await params

  if (!isValidChallengeDate(date)) {
    return {
      title: "Daily Challenge",
    }
  }

  const challenge = getDailyChallenge(date)
  const url = `${getSiteUrl()}${getDailyRoute(date)}`

  return {
    title: `${challenge.title} ${date}`,
    description:
      `Play the ${challenge.shareLabel} challenge for ${date}. Find ${challenge.targetScore} valid answers verified through Wikidata and share your result.`,
    alternates: {
      canonical: getDailyRoute(date),
    },
    openGraph: {
      title: `${challenge.title} ${date}`,
      description: challenge.description,
      type: "website",
      url,
      images: [`/daily/${date}/opengraph-image`],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function DailyPage({ params }: DailyPageProps) {
  const { date } = await params

  if (!isValidChallengeDate(date)) {
    notFound()
  }

  const challenge = getDailyChallenge(date)

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <div className="mx-auto mb-6 w-full max-w-5xl">
        <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Indexable daily route</Badge>
              <Badge variant="outline">{date}</Badge>
              <Badge variant="outline">{challenge.categoryLabel}</Badge>
            </div>
            <CardTitle>{challenge.title} for {date}</CardTitle>
            <CardDescription className="max-w-3xl leading-7">
              Search engines can index this page because it includes descriptive text,
              metadata, and a stable route. Human players get the interactive board below,
              while crawlers still see enough context to understand the challenge.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            On this date, every player receives the same theme derived from a deterministic
            seed. Enter names that satisfy today&apos;s Wikidata rule, reach
            {` ${challenge.targetScore} `}correct answers, and unlock your share summary.
          </CardContent>
        </Card>
      </div>

      <DailyChallengeBoard challenge={challenge} />

      <div className="mx-auto mt-6 w-full max-w-5xl">
        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">FAQ</Badge>
              <Badge variant="outline">SEO text block</Badge>
            </div>
            <CardTitle>{challenge.title} FAQ for {date}</CardTitle>
            <CardDescription>
              Search engines need stable text content, and players need quick clarity before
              they share the challenge onward.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-7 text-muted-foreground">
            {challenge.faq.map((item) => (
              <div key={item.question}>
                <p className="font-medium text-foreground">{item.question}</p>
                <p>{item.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
