import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { JsonLd } from "@/components/JsonLd"
import { DailyChallengeBoard } from "@/components/DailyChallengeBoard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  getDailyChallenge,
  getDailyRoute,
  getOpenDailyDates,
  getTodayDateString,
  isDailyChallengeOpen,
  isValidChallengeDate,
  type DailyChallenge,
  type DailyThemeId,
} from "@/lib/daily"
import { buildDailyStructuredData } from "@/lib/seo"
import { buildCanonicalUrl } from "@/lib/site"

type DailyPageProps = {
  params: Promise<{ date: string }>
}

type DailyThemeCopy = {
  inputType: string
  validationRule: string
  exampleHint: string
  challengeAngle: string
  uniquenessNote: string
}

const DAILY_THEME_COPY: Record<DailyThemeId, DailyThemeCopy> = {
  "female-actors": {
    inputType: "Enter actresses and women performers who are represented in Wikidata as actors.",
    validationRule:
      "The answer must resolve to a female human with a Wikipedia page and actor occupation data that satisfies the actress theme.",
    exampleHint:
      "Think across film history, television leads, international cinema, voice acting, and award-season regulars without repeating a previous answer.",
    challengeAngle:
      "Actor days tend to reward broad entertainment recall, but the strongest runs come from mixing classic and modern names instead of clustering around one franchise.",
    uniquenessNote:
      "A singer who has acted may count only if the underlying Wikidata entity also carries the actor occupation expected by the board.",
  },
  "female-fictional-characters": {
    inputType:
      "Enter female fictional characters from books, film, television, comics, or games rather than the performer behind the role.",
    validationRule:
      "The answer must resolve to a fictional female character entity with the right Wikidata classification and an accessible Wikipedia page.",
    exampleHint:
      "Think about protagonists, supporting characters, literary icons, animated leads, and game heroines, but enter the character name itself instead of the actor.",
    challengeAngle:
      "Character days feel different from biography-based boards because players need to think in terms of narrative entities instead of celebrity names.",
    uniquenessNote:
      "This is the easiest theme to fail by entering a real actor when the challenge expects the fictional person they portray.",
  },
  "female-directors": {
    inputType:
      "Enter women directors from cinema, television, documentary, or animation whose public record includes director work.",
    validationRule:
      "The answer must resolve to a female human with a Wikipedia page and director occupation data recognized by the challenge validator.",
    exampleHint:
      "Think about studio filmmakers, independent directors, international auteurs, showrunners with director credits, and documentary leaders.",
    challengeAngle:
      "Director days reward players who know work behind the camera, which makes the board feel more editorial and less celebrity-driven than actor days.",
    uniquenessNote:
      "Some creative figures write or produce extensively, but they only count on this board when the director occupation is part of the verified entity data.",
  },
  "female-singers": {
    inputType:
      "Enter women singers, vocalists, and recording artists who are represented as people rather than bands or groups.",
    validationRule:
      "The answer must resolve to a female human with a Wikipedia page and singer occupation data that passes the theme-specific rule.",
    exampleHint:
      "Think across pop, classical, regional music, hip-hop, jazz, country, and legacy catalog artists instead of staying in one era.",
    challengeAngle:
      "Singer days usually start fast because many players know obvious names, but the later part of the board rewards depth and genre range.",
    uniquenessNote:
      "Bands do not count, and songwriters only count when the entity is also identified as a singer in the data used by the validator.",
  },
  "silo-season-3-cast": {
    inputType:
      "Enter credited cast members from the curated Silo Season 3 answer set, one person name at a time.",
    validationRule:
      "This special board validates against a local curated cast library rather than a fully open occupation search, so only names in the featured source list count.",
    exampleHint:
      "Think about lead cast, recurring supporting roles, and the names shown on the official cast-and-crew source, but do not expect the page to reveal the full list.",
    challengeAngle:
      "Curated event boards turn the daily route into a compact fandom challenge where precision matters more than broad knowledge discovery.",
    uniquenessNote:
      "Special-event days can use accepted aliases and stage names, but the answer still has to belong to the configured cast library for the featured date.",
  },
}

export async function generateStaticParams() {
  return getOpenDailyDates().map((date) => ({ date }))
}

export async function generateMetadata({
  params,
}: DailyPageProps): Promise<Metadata> {
  const { date } = await params

  if (!isValidChallengeDate(date)) {
    return {
      title: "Daily Challenge",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  if (!isDailyChallengeOpen(date)) {
    return {
      title: `Daily challenge not open for ${date}`,
      description: `The Name 100 daily challenge for ${date} has not opened yet.`,
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const challenge = getDailyChallenge(date)
  const canonicalUrl = buildCanonicalUrl(getDailyRoute(date))

  return {
    title: `${challenge.title} for ${date}`,
    description:
      `Play the ${challenge.shareLabel} challenge for ${date}. Find ${challenge.targetScore} valid answers verified through the Name 100 rules and share your result.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${challenge.title} for ${date}`,
      description: challenge.description,
      type: "website",
      url: canonicalUrl,
      images: [`/daily/${date}/opengraph-image`],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

function buildThemeSections(challenge: DailyChallenge) {
  return DAILY_THEME_COPY[challenge.themeId]
}

function buildDailyIntro(challenge: DailyChallenge) {
  const themeCopy = buildThemeSections(challenge)

  return [
    `The Name 100 daily challenge for ${challenge.date} uses the "${challenge.categoryLabel}" theme, so every player who opens this route today is solving the same board. That is what makes the page useful both as a game screen and as a shareable archive page. A finished run is not just a score. It is a score tied to a specific date, a specific validation rule, and a specific set of comparable inputs that other players can try on the same route.`,
    `${themeCopy.inputType} Unlike the homepage open mode, where any verified woman can push your streak forward, the daily board asks you to think within a narrower lane. That structure makes the challenge more puzzle-like and gives the leaderboard real context, because a fast result on this page means something different from a fast result on another date with another theme.`,
    `${themeCopy.validationRule} In practical terms, that means the game is checking more than spelling. It is checking what kind of entity the answer resolves to, whether the answer belongs to the expected group for the day, and whether you have already used that person earlier in the run. Duplicate answers never help, even when punctuation or display names vary.`,
    `${themeCopy.exampleHint} The best strategy is to treat the board as a knowledge map instead of a speed-only typing exercise. Start with obvious names to build momentum, then widen your search to older eras, different regions, adjacent media, or lesser-used corners of the category. That is usually where late-board progress comes from.`,
    `${themeCopy.challengeAngle} ${themeCopy.uniquenessNote} When you complete the target of ${challenge.targetScore} accepted answers, the page can generate share text and preserve the run for later comparison, so the daily route becomes both a playable challenge and a record of what the site featured on this date.`,
  ]
}

export default async function DailyPage({ params }: DailyPageProps) {
  const { date } = await params

  if (!isValidChallengeDate(date) || !isDailyChallengeOpen(date)) {
    notFound()
  }

  const challenge = getDailyChallenge(date)
  const themeCopy = buildThemeSections(challenge)
  const introParagraphs = buildDailyIntro(challenge)
  const today = getTodayDateString()

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <JsonLd
        data={buildDailyStructuredData(challenge)}
        id={`daily-structured-data-${challenge.date}`}
      />
      <div className="mx-auto mb-6 flex w-full max-w-5xl flex-col gap-6">
        <Card className="border-white/60 bg-white/88 backdrop-blur dark:border-white/10 dark:bg-black/25">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Daily Challenge</Badge>
              <Badge variant="outline">{date}</Badge>
              <Badge variant="outline">{challenge.categoryLabel}</Badge>
              <Badge variant={date === today ? "success" : "outline"}>
                {date === today ? "Today" : "Archive"}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              {challenge.title} for {date}
            </h1>
            <CardDescription className="max-w-3xl text-base leading-7">
              {challenge.description} This route is indexable because the challenge is already
              open, tied to a stable date, and supported by descriptive rules that explain
              what players should enter without exposing the full answer set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            {introParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">How this date-specific challenge works</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              The sections below summarize the input type, the validation logic, and the
              kind of thinking this board rewards.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm leading-7 text-muted-foreground md:grid-cols-2">
            <div>
              <p className="font-medium text-foreground">What to enter</p>
              <p className="mt-2">{themeCopy.inputType}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">How answers are validated</p>
              <p className="mt-2">{themeCopy.validationRule}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Example hint</p>
              <p className="mt-2">{themeCopy.exampleHint}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Why this board feels different</p>
              <p className="mt-2">{themeCopy.challengeAngle}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DailyChallengeBoard challenge={challenge} />

      <div className="mx-auto mt-6 flex w-full max-w-5xl flex-col gap-6">
        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">Daily strategy and sharing notes</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Name 100 daily pages are built to be played, shared, and revisited later as an
              archive of what the site featured on each date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              If you are aiming for a strong leaderboard result, use the early part of the
              run to establish momentum and the middle of the run to widen your category
              search. Daily boards usually slow down when players stay too close to obvious
              answers, so the better strategy is to branch across eras, franchises, or
              subgenres within the same theme. This is especially true on singer and actor
              days, where everyone knows the first tier of names but fewer players sustain a
              complete board from memory alone.
            </p>
            <p>
              If you are playing casually, the daily route still works as a discovery page.
              You can use the rule explanation here to understand what kind of names count,
              explore related people after the run, and compare how the category changes from
              one date to the next. Because this page keeps the challenge tied to {date},
              it is also safe to share publicly without confusing new players about which
              board they are opening.
            </p>
            <p>
              When you complete the challenge, the site can generate share text with the date
              and score, and the leaderboard can preserve the result for recovery-code-backed
              player profiles. That long-term loop is part of the design: the board should be
              fun for one session, but it should also become part of a longer streak,
              comparison history, and daily return habit over time.
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">FAQ</Badge>
              <Badge variant="outline">Daily help</Badge>
            </div>
            <CardTitle>{challenge.title} FAQ for {date}</CardTitle>
            <CardDescription>
              Quick clarifications for the current theme, without leaking the complete
              answer list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-7 text-muted-foreground">
            {challenge.faq.map((item, index) => (
              <div key={item.question}>
                <p className="font-medium text-foreground">{item.question}</p>
                <p className="mt-2">{item.answer}</p>
                {index < challenge.faq.length - 1 ? <Separator className="mt-5" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
