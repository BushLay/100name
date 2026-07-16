import type { GuessRuleValidator } from "./game.ts"
import {
  ELLE_CAST_LIBRARY,
  ENOLA_HOLMES_3_CAST_LIBRARY,
  LITTLE_HOUSE_ON_THE_PRAIRIE_CAST_LIBRARY,
  RENOVATION_RESORT_CAST_LIBRARY,
  SILO_CAST_LIBRARY,
  SILO_SEASON_3_CAST_LIBRARY,
  THE_FIVE_STAR_WEEKEND_CAST_LIBRARY,
  THE_TERROR_DEVIL_IN_SILVER_CAST_LIBRARY,
  WORST_NEIGHBOR_EVER_CAST_LIBRARY,
  buildCuratedPersonQueryValidator,
  buildCuratedPersonValidator,
} from "./curated-answer-libraries.ts"
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
  | "elle-cast"
  | "silo-season-3-cast"
  | "the-terror-devil-in-silver-cast"
  | "worst-neighbor-ever-cast"
  | "enola-holmes-3-cast"
  | "renovation-resort-cast"
  | "silo-cast"
  | "little-house-on-the-prairie-cast"
  | "the-five-star-weekend-cast"

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
  queryValidator?: (query: string) => { valid: boolean; qid: string; name: string }
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

export const DAILY_CHALLENGE_START_DATE = "2026-01-03"
export const DAILY_CHALLENGE_TIME_ZONE = "Asia/Shanghai"

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
  {
    id: "elle-cast",
    title: "Elle Cast Challenge",
    headline: "Name actors from the Elle cast list.",
    description:
      "Today's special challenge uses a curated cast list for Elle. Enter credited cast members one by one and clear twenty correct names, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "Elle cast",
    promptLabel: "Submit an Elle cast member",
    shareLabel: "Elle cast members",
    shareTitle: "Elle cast challenge",
    targetScore: Math.min(20, ELLE_CAST_LIBRARY.entries.length),
    invalidEntityMessage:
      "That answer is not in today's Elle cast list.",
    successMessage: "Correct Elle cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated Elle answer list count.",
      },
      {
        question: "Do I need the character name too?",
        answer:
          "No. Enter the actor's name, and the game will match it against today's cast list.",
      },
      {
        question: "Why is this a fixed-list challenge?",
        answer:
          "This is a featured TV cast board built from a specific public source, so only the selected credited names are valid answers.",
      },
      {
        question: "Do I need to find every actor?",
        answer:
          "No. If the cast list has twenty or more valid names, you only need any twenty to finish. If a featured cast list is shorter than twenty, then clearing the full list completes the board.",
      },
    ],
    validator: buildCuratedPersonValidator(ELLE_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(ELLE_CAST_LIBRARY),
  },
  {
    id: "silo-season-3-cast",
    title: "Silo Season 3 Cast Challenge",
    headline: "Name actors from the Silo Season 3 cast list.",
    description:
      "Today's special challenge uses a curated cast list for Silo Season 3. Enter one credited cast member at a time and clear all nine featured names.",
    categoryLabel: "Silo Season 3 cast",
    promptLabel: "Submit a Silo cast member",
    shareLabel: "Silo Season 3 cast members",
    shareTitle: "Silo Season 3 cast challenge",
    targetScore: SILO_SEASON_3_CAST_LIBRARY.entries.length,
    invalidEntityMessage:
      "That answer is not in today's Silo Season 3 cast list.",
    successMessage: "Correct Silo cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated Silo Season 3 answer list count.",
      },
      {
        question: "Do I need the character name too?",
        answer:
          "No. Enter the actor's name, and the game will match it against today's cast list.",
      },
      {
        question: "Why is the target lower today?",
        answer:
          "This is a fixed cast challenge built from a curated source, so the board size matches the answer list.",
      },
    ],
    validator: buildCuratedPersonValidator(SILO_SEASON_3_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(SILO_SEASON_3_CAST_LIBRARY),
  },
  {
    id: "the-terror-devil-in-silver-cast",
    title: "The Terror: Devil in Silver Cast Challenge",
    headline: "Name actors from The Terror: Devil in Silver.",
    description:
      "Today's special challenge uses the curated cast list for The Terror: Devil in Silver. Enter credited cast members one by one and clear twenty correct names, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "The Terror: Devil in Silver cast",
    promptLabel: "Submit a The Terror cast member",
    shareLabel: "The Terror: Devil in Silver cast members",
    shareTitle: "The Terror: Devil in Silver cast challenge",
    targetScore: Math.min(
      20,
      THE_TERROR_DEVIL_IN_SILVER_CAST_LIBRARY.entries.length
    ),
    invalidEntityMessage:
      "That answer is not in today's The Terror: Devil in Silver cast list.",
    successMessage:
      "Correct The Terror: Devil in Silver cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated The Terror: Devil in Silver answer list count.",
      },
      {
        question: "Do I need the character name too?",
        answer:
          "No. Enter the actor's name, and the game will match it against today's cast list.",
      },
      {
        question: "Do I need to find every actor?",
        answer:
          "No. If the cast list has twenty or more valid names, you only need any twenty to finish. If a featured cast list is shorter than twenty, then clearing the full list completes the board.",
      },
      {
        question: "Why is this a fixed-list challenge?",
        answer:
          "This is a featured TV cast board built from a specific public cast source, so only the selected credited names are valid answers.",
      },
    ],
    validator: buildCuratedPersonValidator(
      THE_TERROR_DEVIL_IN_SILVER_CAST_LIBRARY
    ),
    queryValidator: buildCuratedPersonQueryValidator(
      THE_TERROR_DEVIL_IN_SILVER_CAST_LIBRARY
    ),
  },
  {
    id: "worst-neighbor-ever-cast",
    title: "Worst Neighbor Ever Cast Challenge",
    headline: "Name people from the Worst Neighbor Ever cast list.",
    description:
      "Today's special challenge uses the curated cast list for Worst Neighbor Ever. Enter credited names one by one and clear twenty correct answers, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "Worst Neighbor Ever cast",
    promptLabel: "Submit a Worst Neighbor Ever cast member",
    shareLabel: "Worst Neighbor Ever cast members",
    shareTitle: "Worst Neighbor Ever cast challenge",
    targetScore: Math.min(20, WORST_NEIGHBOR_EVER_CAST_LIBRARY.entries.length),
    invalidEntityMessage:
      "That answer is not in today's Worst Neighbor Ever cast list.",
    successMessage:
      "Correct Worst Neighbor Ever cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited people from the curated Worst Neighbor Ever answer list count.",
      },
      {
        question: "Do I need a character or episode title too?",
        answer:
          "No. Enter the credited person's name, and the game will match it against today's cast list.",
      },
      {
        question: "Do I need to find every listed person?",
        answer:
          "No. Since this list has twenty or more names, any twenty accepted answers complete the board.",
      },
    ],
    validator: buildCuratedPersonValidator(WORST_NEIGHBOR_EVER_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(
      WORST_NEIGHBOR_EVER_CAST_LIBRARY
    ),
  },
  {
    id: "enola-holmes-3-cast",
    title: "Enola Holmes 3 Cast Challenge",
    headline: "Name actors from the Enola Holmes 3 cast list.",
    description:
      "Today's special challenge uses the curated cast list for Enola Holmes 3. Enter credited cast members one by one and clear twenty correct names, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "Enola Holmes 3 cast",
    promptLabel: "Submit an Enola Holmes 3 cast member",
    shareLabel: "Enola Holmes 3 cast members",
    shareTitle: "Enola Holmes 3 cast challenge",
    targetScore: Math.min(20, ENOLA_HOLMES_3_CAST_LIBRARY.entries.length),
    invalidEntityMessage:
      "That answer is not in today's Enola Holmes 3 cast list.",
    successMessage:
      "Correct Enola Holmes 3 cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated Enola Holmes 3 answer list count.",
      },
      {
        question: "Do I need the role name too?",
        answer:
          "No. Enter the actor's name, and the game will match it against today's cast list.",
      },
      {
        question: "Do I need to find every actor?",
        answer:
          "No. Since this list has twenty or more names, any twenty accepted answers complete the board.",
      },
    ],
    validator: buildCuratedPersonValidator(ENOLA_HOLMES_3_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(ENOLA_HOLMES_3_CAST_LIBRARY),
  },
  {
    id: "renovation-resort-cast",
    title: "Renovation Resort Cast Challenge",
    headline: "Name people from the Renovation Resort cast list.",
    description:
      "Today's special challenge uses the curated cast list for Renovation Resort. Enter credited names one by one and clear twenty correct answers, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "Renovation Resort cast",
    promptLabel: "Submit a Renovation Resort cast member",
    shareLabel: "Renovation Resort cast members",
    shareTitle: "Renovation Resort cast challenge",
    targetScore: Math.min(20, RENOVATION_RESORT_CAST_LIBRARY.entries.length),
    invalidEntityMessage:
      "That answer is not in today's Renovation Resort cast list.",
    successMessage:
      "Correct Renovation Resort cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited people from the curated Renovation Resort answer list count.",
      },
      {
        question: "Do I need the project or episode name too?",
        answer:
          "No. Enter the credited person's name, and the game will match it against today's cast list.",
      },
      {
        question: "Do I need to find every listed person?",
        answer:
          "No. Since this list has twenty or more names, any twenty accepted answers complete the board.",
      },
    ],
    validator: buildCuratedPersonValidator(RENOVATION_RESORT_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(RENOVATION_RESORT_CAST_LIBRARY),
  },
  {
    id: "silo-cast",
    title: "Silo Cast Challenge",
    headline: "Name actors from the Silo cast list.",
    description:
      "Today's special challenge uses the curated full-series cast list for Silo. Enter credited cast members one by one and clear twenty correct names, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "Silo cast",
    promptLabel: "Submit a Silo cast member",
    shareLabel: "Silo cast members",
    shareTitle: "Silo cast challenge",
    targetScore: Math.min(20, SILO_CAST_LIBRARY.entries.length),
    invalidEntityMessage:
      "That answer is not in today's Silo cast list.",
    successMessage: "Correct Silo cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated Silo IMDb cast section count.",
      },
      {
        question: "Is this the same as the earlier Silo Season 3 board?",
        answer:
          "No. This board uses the broader IMDb cast list for Silo, while the earlier Silo Season 3 board used a smaller featured source.",
      },
      {
        question: "Do I need to find every actor?",
        answer:
          "No. Since this list has twenty or more names, any twenty accepted answers complete the board.",
      },
    ],
    validator: buildCuratedPersonValidator(SILO_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(SILO_CAST_LIBRARY),
  },
  {
    id: "little-house-on-the-prairie-cast",
    title: "Little House on the Prairie Cast Challenge",
    headline: "Name actors from the Little House on the Prairie cast list.",
    description:
      "Today's special challenge uses the curated cast list for Little House on the Prairie. Enter credited cast members one by one and clear twenty correct names, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "Little House on the Prairie cast",
    promptLabel: "Submit a Little House cast member",
    shareLabel: "Little House on the Prairie cast members",
    shareTitle: "Little House on the Prairie cast challenge",
    targetScore: Math.min(
      20,
      LITTLE_HOUSE_ON_THE_PRAIRIE_CAST_LIBRARY.entries.length
    ),
    invalidEntityMessage:
      "That answer is not in today's Little House on the Prairie cast list.",
    successMessage:
      "Correct Little House on the Prairie cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated Little House on the Prairie answer list count.",
      },
      {
        question: "Do I need the role name too?",
        answer:
          "No. Enter the actor's name, and the game will match it against today's cast list.",
      },
      {
        question: "Do I need to find every actor?",
        answer:
          "No. Since this list has twenty or more names, any twenty accepted answers complete the board.",
      },
    ],
    validator: buildCuratedPersonValidator(
      LITTLE_HOUSE_ON_THE_PRAIRIE_CAST_LIBRARY
    ),
    queryValidator: buildCuratedPersonQueryValidator(
      LITTLE_HOUSE_ON_THE_PRAIRIE_CAST_LIBRARY
    ),
  },
  {
    id: "the-five-star-weekend-cast",
    title: "The Five-Star Weekend Cast Challenge",
    headline: "Name actors from The Five-Star Weekend cast list.",
    description:
      "Today's special challenge uses the curated cast list for The Five-Star Weekend. Enter credited cast members one by one and clear twenty correct names, or all available names if the cast list is smaller than twenty.",
    categoryLabel: "The Five-Star Weekend cast",
    promptLabel: "Submit a Five-Star Weekend cast member",
    shareLabel: "The Five-Star Weekend cast members",
    shareTitle: "The Five-Star Weekend cast challenge",
    targetScore: Math.min(20, THE_FIVE_STAR_WEEKEND_CAST_LIBRARY.entries.length),
    invalidEntityMessage:
      "That answer is not in today's The Five-Star Weekend cast list.",
    successMessage:
      "Correct The Five-Star Weekend cast member added to today's board.",
    faq: [
      {
        question: "What counts today?",
        answer:
          "Only credited cast members from the curated The Five-Star Weekend answer list count.",
      },
      {
        question: "Do I need the character name too?",
        answer:
          "No. Enter the actor's name, and the game will match it against today's cast list.",
      },
      {
        question: "Do I need to find every actor?",
        answer:
          "No. Since this list has twenty or more names, any twenty accepted answers complete the board.",
      },
    ],
    validator: buildCuratedPersonValidator(THE_FIVE_STAR_WEEKEND_CAST_LIBRARY),
    queryValidator: buildCuratedPersonQueryValidator(
      THE_FIVE_STAR_WEEKEND_CAST_LIBRARY
    ),
  },
]

const DAILY_THEME_OVERRIDES: Partial<Record<string, DailyThemeId>> = {
  "2026-07-14": "elle-cast",
  "2026-07-15": "the-terror-devil-in-silver-cast",
  "2026-07-16": "worst-neighbor-ever-cast",
  "2026-07-17": "enola-holmes-3-cast",
  "2026-07-18": "renovation-resort-cast",
  "2026-07-19": "silo-cast",
  "2026-07-20": "little-house-on-the-prairie-cast",
  "2026-07-21": "enola-holmes-3-cast",
  "2026-07-22": "elle-cast",
  "2026-07-23": "the-five-star-weekend-cast",
  "2026-07-11": "silo-season-3-cast",
}

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

export function getTodayDateString(
  date = new Date(),
  timeZone = DAILY_CHALLENGE_TIME_ZONE
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? "1970"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"

  return `${year}-${month}-${day}`
}

export function fetchDailyDataset(seed: number) {
  return DAILY_THEMES[seed % DAILY_THEMES.length]
}

export function getDailyThemeForDate(date: string) {
  const overrideThemeId = DAILY_THEME_OVERRIDES[date]

  if (overrideThemeId) {
    return getDailyThemeDefinition(overrideThemeId)
  }

  return fetchDailyDataset(generateDailySeed(date))
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

export function getDailyThemeQueryValidator(themeId: DailyThemeId) {
  return getDailyThemeDefinition(themeId).queryValidator
}

export function getDailyChallenge(date: string): DailyChallenge {
  const seed = generateDailySeed(date)
  const theme = getDailyThemeForDate(date)

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

export function compareChallengeDates(left: string, right: string) {
  return left.localeCompare(right)
}

export function isDailyChallengeOpen(date: string, today = getTodayDateString()) {
  if (!isValidChallengeDate(date)) {
    return false
  }

  return (
    compareChallengeDates(date, DAILY_CHALLENGE_START_DATE) >= 0 &&
    compareChallengeDates(date, today) <= 0
  )
}

export function getOpenDailyDates(
  today = getTodayDateString(),
  startDate = DAILY_CHALLENGE_START_DATE
) {
  if (compareChallengeDates(today, startDate) < 0) {
    return []
  }

  const dates: string[] = []
  const current = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${today}T00:00:00Z`)

  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}
