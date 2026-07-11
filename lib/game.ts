import {
  getEntityData,
  searchEntity,
  validateFemaleHuman,
  type GuessCandidate,
  type WikidataEntity,
} from "./wikidata.ts"

export const WINNING_SCORE = 100

export type GameValidationResult =
  | {
      valid: true
      qid: string
      name: string
      score: number
      won: boolean
      message: string
    }
  | {
      valid: false
      qid: string
      name: string
      score: number
      won: boolean
      message: string
    }

type SearchEntity = typeof searchEntity
type GetEntityData = typeof getEntityData
type ValidateFemaleHuman = typeof validateFemaleHuman

type ValidationDependencies = {
  searchEntity: SearchEntity
  getEntityData: GetEntityData
  validateFemaleHuman: ValidateFemaleHuman
}

type GuessRuleValidator = (entity: WikidataEntity | null) => GuessCandidate
type GuessQueryValidator = (query: string) => GuessCandidate

type GuessValidationOptions = {
  targetScore?: number
  validateEntity?: GuessRuleValidator
  validateQuery?: GuessQueryValidator
  invalidEntityMessage?: string
  successMessage?: string
}

const defaultDependencies: ValidationDependencies = {
  searchEntity,
  getEntityData,
  validateFemaleHuman,
}

export function checkDuplicate(qid: string, guessedQIDs: string[]) {
  return guessedQIDs.includes(qid)
}

export function updateScore(score: number) {
  return score + 1
}

export function checkWinCondition(score: number) {
  return score >= WINNING_SCORE
}

export async function validateGuessWithRules(
  name: string,
  guessedQIDs: string[],
  score = 0,
  dependencies: ValidationDependencies = defaultDependencies,
  {
    targetScore = WINNING_SCORE,
    validateEntity = dependencies.validateFemaleHuman,
    validateQuery,
    invalidEntityMessage = "That entry must be a female human with a Wikipedia page.",
    successMessage = "Correct guess added to your list.",
  }: GuessValidationOptions = {}
): Promise<GameValidationResult> {
  const hasWon = (value: number) => value >= targetScore
  const query = name.trim()

  if (!query) {
    return {
      valid: false,
      qid: "",
      name: "",
      score,
      won: hasWon(score),
      message: "Please enter a full name.",
    }
  }

  if (validateQuery) {
    const validated = validateQuery(query)

    if (!validated.valid) {
      return {
        valid: false,
        qid: validated.qid,
        name: validated.name || query,
        score,
        won: hasWon(score),
        message: invalidEntityMessage,
      }
    }

    if (checkDuplicate(validated.qid, guessedQIDs)) {
      return {
        valid: false,
        qid: validated.qid,
        name: validated.name,
        score,
        won: hasWon(score),
        message: "That person has already been guessed.",
      }
    }

    const nextScore = updateScore(score)

    return {
      valid: true,
      qid: validated.qid,
      name: validated.name,
      score: nextScore,
      won: hasWon(nextScore),
      message: successMessage,
    }
  }

  const match = await dependencies.searchEntity(query)

  if (!match.valid || !match.qid) {
    return {
      valid: false,
      qid: "",
      name: query,
      score,
      won: hasWon(score),
      message: "No matching person was found on Wikidata.",
    }
  }

  if (checkDuplicate(match.qid, guessedQIDs)) {
    return {
      valid: false,
      qid: match.qid,
      name: match.name,
      score,
      won: hasWon(score),
      message: "That person has already been guessed.",
    }
  }

  const entity = await dependencies.getEntityData(match.qid)
  const validated = validateEntity(entity)

  if (!validated.valid) {
    return {
      valid: false,
      qid: validated.qid,
      name: validated.name || match.name,
      score,
      won: hasWon(score),
      message: invalidEntityMessage,
    }
  }

  const nextScore = updateScore(score)

  return {
    valid: true,
    qid: validated.qid,
    name: validated.name,
    score: nextScore,
    won: hasWon(nextScore),
    message: successMessage,
  }
}

export async function validateGuess(
  name: string,
  guessedQIDs: string[],
  score = 0,
  dependencies: ValidationDependencies = defaultDependencies
): Promise<GameValidationResult> {
  return validateGuessWithRules(name, guessedQIDs, score, dependencies)
}

export type {
  GuessCandidate,
  GuessRuleValidator,
  GuessQueryValidator,
  GuessValidationOptions,
  ValidationDependencies,
  WikidataEntity,
}
