import { createHmac, timingSafeEqual } from "node:crypto"

import type { NextRequest } from "next/server"

import { getEmailEventWebhookSecretFromEnv } from "../server-config.ts"

function parseSignatureHeader(value: string | null) {
  const normalized = value?.trim()

  if (!normalized) {
    return null
  }

  const prefixed = normalized.match(/^sha256=(.+)$/i)
  return (prefixed?.[1] ?? normalized).trim().toLowerCase()
}

function isValidTimestamp(value: string | null) {
  if (!value?.trim()) {
    return false
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return false
  }

  return Math.abs(Date.now() - parsed * 1000) <= 5 * 60 * 1000
}

function compareSignatures(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "hex")
  const receivedBuffer = Buffer.from(received, "hex")

  if (expectedBuffer.length === 0 || expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function verifyEmailEventWebhookSignature(request: NextRequest, rawBody: string) {
  const secret = getEmailEventWebhookSecretFromEnv(process.env)

  if (!secret) {
    return {
      verified: false,
      enforced: false,
    }
  }

  const timestamp = request.headers.get("x-name100-timestamp")?.trim() ?? null
  const signature = parseSignatureHeader(request.headers.get("x-name100-signature"))

  if (!isValidTimestamp(timestamp)) {
    throw new Error("Email event webhook timestamp is missing, invalid, or expired.")
  }

  if (!signature) {
    throw new Error("Email event webhook signature is required.")
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")

  if (!compareSignatures(expected, signature)) {
    throw new Error("Email event webhook signature is invalid.")
  }

  return {
    verified: true,
    enforced: true,
  }
}
