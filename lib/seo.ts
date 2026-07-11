import type { DailyChallenge } from "./daily.ts"
import { buildCanonicalUrl, CANONICAL_SITE_URL } from "./site.ts"

type BreadcrumbItem = {
  name: string
  path: string
}

function buildBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  }
}

export function buildHomeStructuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Name 100",
      url: CANONICAL_SITE_URL,
      description:
        "Name 100 is a daily women name challenge and open practice game powered by Wikidata and Wikipedia validation.",
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Name 100",
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      url: CANONICAL_SITE_URL,
      description:
        "A browser game where players submit women names, clear themed daily challenges, and share leaderboard-ready results.",
      isAccessibleForFree: true,
      genre: ["Trivia", "Word Game", "Knowledge Game"],
      publisher: {
        "@type": "Organization",
        name: "Name 100",
        url: CANONICAL_SITE_URL,
      },
    },
  ]
}

export function buildHowToPlayStructuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "How to Play Name 100",
      url: buildCanonicalUrl("/how-to-play"),
      description:
        "Rules, examples, validation notes, and recovery guidance for the Name 100 daily women name challenge.",
      isPartOf: {
        "@type": "WebSite",
        name: "Name 100",
        url: CANONICAL_SITE_URL,
      },
    },
    buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "How to Play", path: "/how-to-play" },
    ]),
  ]
}

export function buildLeaderboardStructuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Name 100 Leaderboard",
      url: buildCanonicalUrl("/leaderboard"),
      description:
        "Server-backed Name 100 leaderboard and player recovery guidance for streaks, times, and daily challenge stats.",
      isPartOf: {
        "@type": "WebSite",
        name: "Name 100",
        url: CANONICAL_SITE_URL,
      },
    },
    buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Leaderboard", path: "/leaderboard" },
    ]),
  ]
}

export function buildDailyStructuredData(challenge: DailyChallenge) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${challenge.title} for ${challenge.date}`,
      url: buildCanonicalUrl(`/daily/${challenge.date}`),
      description:
        `Play the ${challenge.shareLabel} daily challenge for ${challenge.date} and submit ${challenge.targetScore} verified names.`,
      isPartOf: {
        "@type": "WebSite",
        name: "Name 100",
        url: CANONICAL_SITE_URL,
      },
      about: {
        "@type": "Game",
        name: "Name 100 Daily Challenge",
        genre: "Knowledge Game",
      },
    },
    buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Daily Challenge", path: `/daily/${challenge.date}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: challenge.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ]
}
