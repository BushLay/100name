import type { GuessCandidate, GuessRuleValidator, WikidataEntity } from "@/lib/game"

export type CuratedAnswerEntry = {
  canonicalName: string
  acceptedNames: string[]
  characterName?: string
  notes?: string
}

export type CuratedAnswerLibrary = {
  id: string
  title: string
  sourceLabel: string
  sourceUrl: string
  answerType: "person"
  entries: CuratedAnswerEntry[]
}

export const SILO_SEASON_3_CAST_LIBRARY: CuratedAnswerLibrary = {
  id: "silo-season-3-cast",
  title: "Silo Season 3 Cast",
  sourceLabel: "Rotten Tomatoes cast and crew page",
  sourceUrl: "https://www.rottentomatoes.com/tv/silo/s03/cast-and-crew",
  answerType: "person",
  entries: [
    {
      canonicalName: "David Oyelowo",
      acceptedNames: ["David Oyelowo"],
      characterName: "Holston",
    },
    {
      canonicalName: "Rashida Jones",
      acceptedNames: ["Rashida Jones"],
      characterName: "Allison",
    },
    {
      canonicalName: "Rebecca Ferguson",
      acceptedNames: ["Rebecca Ferguson"],
      characterName: "Juliette",
    },
    {
      canonicalName: "Common",
      acceptedNames: ["Common", "Lonnie Rashid Lynn", "Lonnie Rashid Lynn Jr."],
      characterName: "Robert Sims",
      notes: "Common is listed by stage name on Rotten Tomatoes.",
    },
    {
      canonicalName: "Harriet Walter",
      acceptedNames: ["Harriet Walter", "Dame Harriet Walter"],
      characterName: "Martha Walker",
    },
    {
      canonicalName: "Avi Nash",
      acceptedNames: ["Avi Nash"],
      characterName: "Lukas",
    },
    {
      canonicalName: "Rick Gomez",
      acceptedNames: ["Rick Gomez", "Richard Gomez"],
      characterName: "Patrick Kennedy",
    },
    {
      canonicalName: "Chinaza Uche",
      acceptedNames: ["Chinaza Uche"],
      characterName: "Billings",
    },
    {
      canonicalName: "Tim Robbins",
      acceptedNames: ["Tim Robbins", "Timothy Robbins"],
      characterName: "Bernard Holland",
    },
  ],
}

export const CURATED_ANSWER_LIBRARIES: Record<string, CuratedAnswerLibrary> = {
  [SILO_SEASON_3_CAST_LIBRARY.id]: SILO_SEASON_3_CAST_LIBRARY,
}

function normalizeAnswerName(value: string) {
  return value
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getEntityCandidateNames(entity: WikidataEntity | null) {
  if (!entity) {
    return []
  }

  const names = new Set<string>()

  for (const label of Object.values(entity.labels ?? {})) {
    if (label?.value) {
      names.add(normalizeAnswerName(label.value))
    }
  }

  return [...names]
}

export function buildCuratedPersonValidator(
  library: CuratedAnswerLibrary
): GuessRuleValidator {
  const acceptedEntries = library.entries.map((entry) => ({
    ...entry,
    normalizedAcceptedNames: entry.acceptedNames.map(normalizeAnswerName),
  }))

  return (entity: WikidataEntity | null): GuessCandidate => {
    if (!entity) {
      return {
        valid: false,
        qid: "",
        name: "",
      }
    }

    const candidateNames = getEntityCandidateNames(entity)
    const match = acceptedEntries.find((entry) =>
      entry.normalizedAcceptedNames.some((acceptedName) =>
        candidateNames.includes(acceptedName)
      )
    )

    return {
      valid: Boolean(match),
      qid: entity.id,
      name: match?.canonicalName ?? entity.labels?.en?.value ?? entity.id,
    }
  }
}
