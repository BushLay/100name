const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php"
const ENTITY_DATA_BASE_URL = "https://www.wikidata.org/wiki/Special:EntityData"

const HUMAN_QID = "Q5"
const FEMALE_QID = "Q6581072"
const ACTOR_QID = "Q33999"
const FILM_DIRECTOR_QID = "Q2526255"
const SINGER_QID = "Q177220"
const FICTIONAL_CHARACTER_QID = "Q95074"
const FICTIONAL_HUMAN_QID = "Q15632617"
const searchCache = new Map<string, Promise<GuessCandidate>>()
const entityCache = new Map<string, Promise<WikidataEntity | null>>()

const NON_WIKIPEDIA_SITELINKS = new Set([
  "commonswiki",
  "mediawikiwiki",
  "metawiki",
  "specieswiki",
  "wikibooks",
  "wikidatawiki",
  "wikifunctionswiki",
  "wikinews",
  "wikiquote",
  "wikisource",
  "wikiversity",
  "wikivoyage",
  "wiktionary",
])

export type GuessCandidate = {
  valid: boolean
  qid: string
  name: string
}

type WikidataSearchItem = {
  id?: string
  label?: string
}

type WikidataClaimValue = {
  mainsnak?: {
    datavalue?: {
      value?: {
        id?: string
      }
    }
  }
}

export type WikidataEntity = {
  id: string
  labels?: Record<string, { value: string }>
  claims?: Record<string, WikidataClaimValue[]>
  sitelinks?: Record<string, { title: string }>
}

type SearchResponse = {
  search?: WikidataSearchItem[]
}

type EntityResponse = {
  entities?: Record<string, WikidataEntity>
}

export function getClaimIds(entity: WikidataEntity, property: string) {
  return (
    entity.claims?.[property]
      ?.map((claim) => claim.mainsnak?.datavalue?.value?.id)
      .filter((value): value is string => Boolean(value)) ?? []
  )
}

export function hasWikipediaSitelink(entity: WikidataEntity) {
  return Object.keys(entity.sitelinks ?? {}).some((key) => {
    return key.endsWith("wiki") && !NON_WIKIPEDIA_SITELINKS.has(key)
  })
}

export function getDisplayName(entity: WikidataEntity) {
  return (
    entity.labels?.en?.value ??
    Object.values(entity.labels ?? {})[0]?.value ??
    entity.id
  )
}

export async function searchEntity(name: string): Promise<GuessCandidate> {
  const query = name.trim()

  if (!query) {
    return {
      valid: false,
      qid: "",
      name: "",
    }
  }

  const cacheKey = query.toLowerCase()
  const cached = searchCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const request = (async () => {
    try {
      const params = new URLSearchParams({
        action: "wbsearchentities",
        format: "json",
        language: "en",
        limit: "1",
        origin: "*",
        search: query,
        type: "item",
      })

      const response = await fetch(`${WIKIDATA_API_URL}?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to search Wikidata")
      }

      const data = (await response.json()) as SearchResponse
      const match = data.search?.[0]

      if (!match?.id) {
        return {
          valid: false,
          qid: "",
          name: query,
        }
      }

      return {
        valid: true,
        qid: match.id,
        name: match.label ?? query,
      }
    } catch (error) {
      searchCache.delete(cacheKey)
      throw error
    }
  })()

  searchCache.set(cacheKey, request)

  return request
}

export async function getEntityData(qid: string): Promise<WikidataEntity | null> {
  const cached = entityCache.get(qid)

  if (cached) {
    return cached
  }

  const request = (async () => {
    try {
      const response = await fetch(
        `${ENTITY_DATA_BASE_URL}/${qid}.json?origin=*`
      )

      if (!response.ok) {
        throw new Error("Failed to load Wikidata entity")
      }

      const data = (await response.json()) as EntityResponse

      return data.entities?.[qid] ?? null
    } catch (error) {
      entityCache.delete(qid)
      throw error
    }
  })()

  entityCache.set(qid, request)

  return request
}

export function validateFemaleHuman(entity: WikidataEntity | null): GuessCandidate {
  if (!entity) {
    return {
      valid: false,
      qid: "",
      name: "",
    }
  }

  const isHuman = getClaimIds(entity, "P31").includes(HUMAN_QID)
  const isFemale = getClaimIds(entity, "P21").includes(FEMALE_QID)
  const hasWikipedia = hasWikipediaSitelink(entity)

  return {
    valid: isHuman && isFemale && hasWikipedia,
    qid: entity.id,
    name: getDisplayName(entity),
  }
}

function validateFemaleOccupation(
  entity: WikidataEntity | null,
  occupationIds: string[]
): GuessCandidate {
  if (!entity) {
    return {
      valid: false,
      qid: "",
      name: "",
    }
  }

  const base = validateFemaleHuman(entity)
  const occupations = getClaimIds(entity, "P106")

  return {
    valid: base.valid && occupationIds.some((occupationId) => occupations.includes(occupationId)),
    qid: entity.id,
    name: getDisplayName(entity),
  }
}

export function validateFemaleActor(entity: WikidataEntity | null): GuessCandidate {
  return validateFemaleOccupation(entity, [ACTOR_QID])
}

export function validateFemaleDirector(entity: WikidataEntity | null): GuessCandidate {
  return validateFemaleOccupation(entity, [FILM_DIRECTOR_QID])
}

export function validateFemaleSinger(entity: WikidataEntity | null): GuessCandidate {
  return validateFemaleOccupation(entity, [SINGER_QID])
}

export function validateFemaleFictionalCharacter(entity: WikidataEntity | null): GuessCandidate {
  if (!entity) {
    return {
      valid: false,
      qid: "",
      name: "",
    }
  }

  const instanceOf = getClaimIds(entity, "P31")
  const isFemale = getClaimIds(entity, "P21").includes(FEMALE_QID)
  const hasWikipedia = hasWikipediaSitelink(entity)
  const isFictional =
    instanceOf.includes(FICTIONAL_CHARACTER_QID) || instanceOf.includes(FICTIONAL_HUMAN_QID)

  return {
    valid: isFemale && hasWikipedia && isFictional,
    qid: entity.id,
    name: getDisplayName(entity),
  }
}
