import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  getLlmsText,
  getRobotsConfig,
  getSitemapEntries,
} from "./seo-routes.ts"
import {
  buildDailyStructuredData,
  buildHomeStructuredData,
  buildHowToPlayStructuredData,
  buildLeaderboardStructuredData,
} from "./seo.ts"
import { buildCanonicalUrl } from "./site.ts"

const projectRoot = process.cwd()

async function readProjectFile(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf8")
}

test("sitemap excludes future daily routes and keeps canonical core pages", () => {
  const entries = getSitemapEntries("2026-07-11")
  const urls = entries.map((entry) => entry.url)

  assert.equal(urls.includes(buildCanonicalUrl("/")), true)
  assert.equal(urls.includes(buildCanonicalUrl("/how-to-play")), true)
  assert.equal(urls.includes(buildCanonicalUrl("/leaderboard")), true)
  assert.equal(urls.some((url) => url.includes("/daily/2026-07-11")), true)
  assert.equal(urls.some((url) => url.includes("/daily/2026-07-12")), false)
})

test("robots points at the canonical sitemap", () => {
  const result = getRobotsConfig()

  assert.equal(result.host, "https://www.100names.top")
  assert.equal(result.sitemap, buildCanonicalUrl("/sitemap.xml"))
})

test("llms text includes crawler guidance", () => {
  const body = getLlmsText()

  assert.match(body, /Name 100/)
  assert.match(body, /Do Not Cite:/)
})

test("llms route source returns status 200", async () => {
  const source = await readProjectFile("app/llms.txt/route.ts")

  assert.match(source, /status:\s*200/)
})

test("structured data helpers serialize as valid JSON", () => {
  for (const payload of [
    buildHomeStructuredData(),
    buildHowToPlayStructuredData(),
    buildLeaderboardStructuredData(),
    buildDailyStructuredData({
      date: "2026-07-11",
      seed: 1,
      themeId: "female-singers",
      title: "Female Singers Challenge",
      headline: "Name singers who satisfy today's Wikidata rule.",
      description: "Today's category is female singers.",
      categoryLabel: "Female singers",
      promptLabel: "Submit a singer name",
      shareLabel: "female singers",
      shareTitle: "Female singers challenge",
      targetScore: 20,
      faq: [
        {
          question: "What counts today?",
          answer: "A valid female singer with the required public entity data.",
        },
      ],
    }),
  ]) {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(payload)))
  }
})

test("core pages include h1 tags and canonical metadata definitions", async () => {
  const pagesWithOwnH1 = [
    "app/how-to-play/page.tsx",
    "app/leaderboard/page.tsx",
    "app/daily/[date]/page.tsx",
  ]

  for (const file of pagesWithOwnH1) {
    const source = await readProjectFile(file)
    assert.match(source, /<h1[\s>]/)
    assert.match(source, /canonical:/)
  }

  const homePageSource = await readProjectFile("app/page.tsx")
  const homeHeroSource = await readProjectFile("components/GameBoard.tsx")

  assert.match(homePageSource, /canonical:/)
  assert.match(homeHeroSource, /<h1[\s>]/)
})

test("daily page source contains future-date index control", async () => {
  const source = await readProjectFile("app/daily/[date]/page.tsx")

  assert.match(source, /isDailyChallengeOpen/)
  assert.match(source, /index:\s*false/)
  assert.match(source, /notFound\(\)/)
})
