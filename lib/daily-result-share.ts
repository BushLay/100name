import { formatDuration, getDailyRoute } from "./daily.ts"

export type DailyResultShareData = {
  score: number
  targetScore: number
  durationMs: number
  streak: number
}

const DEFAULT_RESULT: DailyResultShareData = {
  score: 0,
  targetScore: 20,
  durationMs: 0,
  streak: 0,
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export function parseDailyResultShareData(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): DailyResultShareData {
  const readValue = (key: string) => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined
    }

    const value = searchParams[key]
    return Array.isArray(value) ? value[0] : value
  }

  const targetScore = clampInteger(readValue("t"), DEFAULT_RESULT.targetScore, 1, 100)

  return {
    score: clampInteger(readValue("s"), DEFAULT_RESULT.score, 0, targetScore),
    targetScore,
    durationMs: clampInteger(readValue("ms"), DEFAULT_RESULT.durationMs, 0, 24 * 60 * 60 * 1000),
    streak: clampInteger(readValue("st"), DEFAULT_RESULT.streak, 0, 9999),
  }
}

export function buildDailyResultQuery(result: DailyResultShareData) {
  const query = new URLSearchParams({
    s: `${result.score}`,
    t: `${result.targetScore}`,
    ms: `${Math.max(0, Math.round(result.durationMs))}`,
    st: `${Math.max(0, Math.round(result.streak))}`,
  })

  return query.toString()
}

export function buildDailyResultPath(date: string, result: DailyResultShareData) {
  return `${getDailyRoute(date)}/result?${buildDailyResultQuery(result)}`
}

export function buildDailyResultImagePath(date: string, result: DailyResultShareData) {
  return `${getDailyRoute(date)}/result-image?${buildDailyResultQuery(result)}`
}

export function buildDailyResultDownloadPath(date: string, result: DailyResultShareData) {
  return `${buildDailyResultImagePath(date, result)}&download=1`
}

export function buildDailyResultAltText({
  date,
  title,
  result,
}: {
  date: string
  title: string
  result: DailyResultShareData
}) {
  return `Name 100 result for ${date}: ${title}, ${result.score}/${result.targetScore} in ${formatDuration(result.durationMs)}, streak ${result.streak}.`
}
