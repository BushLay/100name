function extractMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }

  const candidate = payload as Record<string, unknown>

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim()
  }

  return null
}

function createNonJsonError(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

  if (contentType.includes("text/html")) {
    return new Error(`${fallbackMessage} The server returned an HTML error page instead of JSON.`)
  }

  if (contentType) {
    return new Error(
      `${fallbackMessage} The server returned ${contentType} instead of JSON.`
    )
  }

  return new Error(`${fallbackMessage} The server returned an empty or invalid response.`)
}

export async function readApiResponse<T>(response: Response, fallbackMessage: string) {
  const raw = await response.text()
  let payload: unknown = null

  if (raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw) as unknown
    } catch {
      throw createNonJsonError(response, fallbackMessage)
    }
  }

  if (!response.ok) {
    throw new Error(extractMessage(payload) ?? `${fallbackMessage} (HTTP ${response.status})`)
  }

  if (payload === null) {
    throw createNonJsonError(response, fallbackMessage)
  }

  return payload as T
}
