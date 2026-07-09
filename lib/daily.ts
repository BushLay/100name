import type { GuessRuleValidator } from "./game.ts"
import {
  validateFemaleActor,
  validateFemaleDirector,
  validateFemaleFictionalCharacter,
  validateFemaleSinger,
} from "./wikidata.ts"

export type DailyThemeId =
  | "female-actors"
  | "female-fictional-characters"
  | "female-directors"
  | "female-singers"

export type DailyFaqItem = {
  question: string
  answer: string
}

type DailyThemeDefinition = {
  id: DailyThemeId
  title: string
  headline: string
  description: string
  categoryLabel: string
  promptLabel: string
  shareLabel: string
  shareTitle: string
  targetScore: number
  invalidEntityMessage: string
  successMessage: string
  faq: DailyFaqItem[]
  validator: GuessRuleValidator
}

export type DailyChallenge = {
  date: string
  seed: number
  themeId: DailyThemeId
  title: string
  headline: string
  description: string
  categoryLabel: string
  promptLabel: string
  shareLabel: string
  shareTitle: string
  targetScore: number
  faq: DailyFaqItem[]
}

const DAILY_THEMES: DailyThemeDefinition[] = [
  {
    id: "female-actors",
    title: "Female Actors Challenge",
    headline: "Name actresses who pass Wikidata verification.",
    description:
      "Today every player gets the same theme: female actors. Enter actresses one by one, let Wikidata verify them, and reach twenty correct answers.",
    categoryLabel: "Female actors",
    promptLabel: "Submit an actress name",
    shareLabel: "female actors",
    shareTitle: "Female actors challenge",
    targetScore: 20,
    invalidEntityMessage:
      "That entry must be a female actor with a Wikipedia page.",
    successMessage: "Correct actress added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "The person must be a female actor in Wikidata and have a Wikipedia page.",
      },
      {
        question: "Can singers or directors count?",
        answer:
          "Not today. Even if they are valid female people, they must match the actress theme.",
      },
      {
        question: "Why is this fair?",
        answer:
          "The theme is derived from a deterministic date seed, so everyone plays the same category on the same day.",
      },
    ],
    validator: validateFemaleActor,
  },
  {
    id: "female-fictional-characters",
    title: "Female Fictional Characters Challenge",
    headline: "Name female characters from film, television, books, and games.",
    description:
      "Today's challenge is all about fictional women. Enter female characters that Wikidata recognizes as fictional characters and finish the twenty-name board.",
    categoryLabel: "Female characters",
    promptLabel: "Submit a character name",
    shareLabel: "female fictional characters",
    shareTitle: "Female fictional characters challenge",
    targetScore: 20,
    invalidEntityMessage:
      "That entry must be a female fictional character with a Wikipedia page.",
    successMessage: "Correct character added to today's board.",
    faq: [
      {
        question: "Do real actresses count on character day?",
        answer:
          "No. The entry has to be the character entity itself, not the performer behind the role.",
      },
      {
        question: "Can book characters count too?",
        answer:
          "Yes, as long as Wikidata marks them as female fictional characters with a Wikipedia page.",
      },
      {
        question: "Why is this still comparable?",
        answer:
          "Because every player sees the same date-linked theme and the same target count.",
      },
    ],
    validator: validateFemaleFictionalCharacter,
  },
  {
    id: "female-directors",
    title: "Female Directors Challenge",
    headline: "Find women whose Wikidata occupation is director.",
    description:
      "Today's route challenges players to name female directors. Each correct answer must satisfy the director rule in Wikidata and help you reach twenty out of twenty.",
    categoryLabel: "Female directors",
    promptLabel: "Submit a director name",
    shareLabel: "female directors",
    shareTitle: "Female directors challenge",
    targetScore: 20,
    invalidEntityMessage:
      "That entry must be a female director with a Wikipedia page.",
    successMessage: "Correct director added to today's board.",
    faq: [
      {
        question: "Can actors count if they also direct?",
        answer:
          "Yes, but only if Wikidata marks them with the director occupation as well.",
      },
      {
        question: "Why not use a fixed whitelist?",
        answer:
          "This version is theme-based: any valid female director can count, which keeps the round open-ended but still rule-based.",
      },
      {
        question: "How many answers do I need?",
        answer: "You need twenty verified female directors to complete today's challenge.",
      },
    ],
    validator: validateFemaleDirector,
  },
  {
    id: "female-singers",
    title: "Female Singers Challenge",
    headline: "Name singers who satisfy today's Wikidata rule.",
    description:
      "Today's category is female singers. Keep entering singers who pass Wikidata checks until you fill the twenty-answer daily board.",
    categoryLabel: "Female singers",
    promptLabel: "Submit a singer name",
    shareLabel: "female singers",
    shareTitle: "Female singers challenge",
    targetScore: 20,
    invalidEntityMessage:
      "That entry must be a female singer with a Wikipedia page.",
    successMessage: "Correct singer added to today's board.",
    faq: [
      {
        question: "Can bands count?",
        answer:
          "No. The challenge only accepts female people, not groups or band entities.",
      },
      {
        question: "Do songwriters count automatically?",
        answer:
          "Not unless Wikidata also marks them with the singer occupation.",
      },
      {
        question: "What keeps players coming back?",
        answer:
          "The theme rotates by date, so tomorrow can be a completely different category.",
      },
    ],
    validator: validateFemaleSinger,
  },
]

export function isValidChallengeDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

export function generateDailySeed(date: string) {
  let hash = 2166136261

  for (let index = 0; index < date.length; index += 1) {
    hash ^= date.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function getDailyRoute(date: string) {
  return `/daily/${date}`
}

export function getTodayDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function fetchDailyDataset(seed: number) {
  return DAILY_THEMES[seed % DAILY_THEMES.length]
}

export function getDailyThemeDefinition(themeId: DailyThemeId) {
  return DAILY_THEMES.find((theme) => theme.id === themeId) ?? DAILY_THEMES[0]
}

export function getDailyThemeValidator(themeId: DailyThemeId) {
  return getDailyThemeDefinition(themeId).validator
}

export function getDailyThemeMessages(themeId: DailyThemeId) {
  const theme = getDailyThemeDefinition(themeId)

  return {
    invalidEntityMessage: theme.invalidEntityMessage,
    successMessage: theme.successMessage,
  }
}

export function getDailyChallenge(date: string): DailyChallenge {
  const seed = generateDailySeed(date)
  const theme = fetchDailyDataset(seed)

  return {
    date,
    seed,
    themeId: theme.id,
    title: theme.title,
    headline: theme.headline,
    description: theme.description,
    categoryLabel: theme.categoryLabel,
    promptLabel: theme.promptLabel,
    shareLabel: theme.shareLabel,
    shareTitle: theme.shareTitle,
    targetScore: theme.targetScore,
    faq: theme.faq,
  }
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
}

function buildShareBar(score: number, targetScore: number) {
  const filled = Math.max(0, Math.min(5, Math.ceil((score / targetScore) * 5)))
  return `${"🟩".repeat(filled)}${"⬜".repeat(5 - filled)}`
}

export function buildDailyShareText({
  date,
  score,
  targetScore,
  durationMs,
  url,
  streak = 0,
  shareTitle,
  shareLabel,
}: {
  date: string
  score: number
  targetScore: number
  durationMs: number
  url: string
  streak?: number
  shareTitle: string
  shareLabel: string
}) {
  return [
    `Women Guess Game ${date}`,
    shareTitle,
    "",
    `${buildShareBar(score, targetScore)} ${score}/${targetScore}`,
    `⏱ ${formatDuration(durationMs)}`,
    `🔥 Streak: ${streak} days`,
    "",
    `I found ${score}/${targetScore} ${shareLabel} today.`,
    `Play: ${url || getDailyRoute(date)}`,
  ].join("\n")
}

export function getIndexableDailyDates(centerDate = "2026-07-02", radius = 180) {
  const baseDate = new Date(`${centerDate}T00:00:00Z`)

  return Array.from({ length: radius * 2 + 1 }, (_, offset) => {
    const date = new Date(baseDate)
    date.setUTCDate(baseDate.getUTCDate() + offset - radius)
    return date.toISOString().slice(0, 10)
  })
}
