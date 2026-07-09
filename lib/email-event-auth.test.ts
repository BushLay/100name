import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { verifyEmailEventWebhookSignature } from "./server/email-event-auth.ts"

function createRequest(headers: Record<string, string | null>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null
      },
    },
  } as never
}

test("verifyEmailEventWebhookSignature skips verification when secret is unset", () => {
  const original = process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET
  delete process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET

  try {
    assert.deepEqual(
      verifyEmailEventWebhookSignature(createRequest({}), '{"ok":true}'),
      {
        verified: false,
        enforced: false,
      }
    )
  } finally {
    if (typeof original === "string") {
      process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET = original
    }
  }
})

test("verifyEmailEventWebhookSignature accepts a valid signature", () => {
  const original = process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET
  process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET = "secret-123"

  try {
    const rawBody = '{"eventType":"delivered"}'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac("sha256", "secret-123")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")

    assert.deepEqual(
      verifyEmailEventWebhookSignature(
        createRequest({
          "x-name100-timestamp": timestamp,
          "x-name100-signature": `sha256=${signature}`,
        }),
        rawBody
      ),
      {
        verified: true,
        enforced: true,
      }
    )
  } finally {
    if (typeof original === "string") {
      process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET = original
    } else {
      delete process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET
    }
  }
})

test("verifyEmailEventWebhookSignature rejects a bad signature", () => {
  const original = process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET
  process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET = "secret-123"

  try {
    assert.throws(
      () =>
        verifyEmailEventWebhookSignature(
          createRequest({
            "x-name100-timestamp": String(Math.floor(Date.now() / 1000)),
            "x-name100-signature": "sha256=deadbeef",
          }),
          '{"eventType":"failed"}'
        ),
      /signature is invalid/i
    )
  } finally {
    if (typeof original === "string") {
      process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET = original
    } else {
      delete process.env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET
    }
  }
})
