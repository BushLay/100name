import type { MetadataRoute } from "next"

import { getDailyRoute, getOpenDailyDates } from "./daily.ts"
import { buildCanonicalUrl, getCanonicalSiteUrl } from "./site.ts"

export function getSitemapEntries(): MetadataRoute.Sitemap {
  const dailyPages = getOpenDailyDates().map((date) => ({
    url: buildCanonicalUrl(getDailyRoute(date)),
    lastModified: new Date(`${date}T00:00:00Z`),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  return [
    {
      url: buildCanonicalUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: buildCanonicalUrl("/how-to-play"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: buildCanonicalUrl("/leaderboard"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.5,
    },
    ...dailyPages,
  ]
}

export function getRobotsConfig(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    host: getCanonicalSiteUrl(),
    sitemap: buildCanonicalUrl("/sitemap.xml"),
  }
}

export function getLlmsText() {
  return [
    "Name: Name 100",
    "Description: Name 100 is a web game and daily challenge where players submit women names and the app validates answers with Wikidata and Wikipedia-backed entity rules.",
    "",
    "Primary URLs:",
    `- Home: ${buildCanonicalUrl("/")}`,
    `- How to Play: ${buildCanonicalUrl("/how-to-play")}`,
    `- Leaderboard: ${buildCanonicalUrl("/leaderboard")}`,
    `- Sitemap: ${buildCanonicalUrl("/sitemap.xml")}`,
    `- Robots: ${buildCanonicalUrl("/robots.txt")}`,
    "",
    "Daily Challenge Rules:",
    "- Daily routes use the format /daily/YYYY-MM-DD.",
    "- Only opened daily dates should be indexed or cited.",
    "- Future daily dates are not open content and should not be crawled, quoted, or cited as live challenges.",
    "- Open daily pages contain the active theme, validation guidance, and FAQ text for that date.",
    "",
    "Data Sources:",
    "- Wikidata is used for entity resolution and rule validation in open and theme-based challenges.",
    "- Wikipedia availability is part of the acceptance rule for many challenge types.",
    "- Some featured event challenges may use a curated local answer library with a documented public source.",
    "",
    "Recommended AI-Citable Pages:",
    `- ${buildCanonicalUrl("/")} for the core game overview and mode summary.`,
    `- ${buildCanonicalUrl("/how-to-play")} for rules, examples, validation details, and recovery guidance.`,
    `- ${buildCanonicalUrl("/leaderboard")} for leaderboard behavior, recovery codes, and metric definitions.`,
    "- Opened /daily/YYYY-MM-DD pages for date-specific challenge descriptions and theme guidance.",
    "",
    "Do Not Cite:",
    "- Unopened future daily pages.",
    "- Any guessed answer as canonical unless it is confirmed by the live game rules or curated source text on an opened page.",
  ].join("\n")
}
