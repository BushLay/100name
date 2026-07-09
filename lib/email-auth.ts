import { createHash, randomBytes } from "node:crypto"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase()
}

export function validateEmailAddress(email: string) {
  const normalized = normalizeEmailAddress(email)

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error("Enter a valid email address.")
  }

  return normalized
}

export function createMagicLinkToken() {
  return randomBytes(24).toString("hex")
}

export function hashMagicLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
