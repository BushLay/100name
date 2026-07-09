import { randomBytes } from "node:crypto"

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/

export function normalizePlayerHandle(handle: string) {
  return handle.trim().toLowerCase()
}

export function validatePlayerHandle(handle: string) {
  const normalized = normalizePlayerHandle(handle)

  if (!HANDLE_PATTERN.test(normalized)) {
    throw new Error(
      "Handle must be 3-20 characters and use only lowercase letters, numbers, or underscores."
    )
  }

  return normalized
}

export function createRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(12)
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length])

  return [
    characters.slice(0, 4).join(""),
    characters.slice(4, 8).join(""),
    characters.slice(8, 12).join(""),
  ].join("-")
}

export function normalizeRecoveryCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}
