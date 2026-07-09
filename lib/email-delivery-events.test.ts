import assert from "node:assert/strict"
import test from "node:test"

import {
  isDuplicateEmailDeliveryEventCandidate,
  parseEmailDeliveryEventInput,
} from "./server/email-delivery-events.ts"

test("parseEmailDeliveryEventInput normalizes a valid payload", () => {
  const result = parseEmailDeliveryEventInput({
    eventType: "delivered",
    tokenId: " token-123 ",
    providerMessageId: " msg-123 ",
    providerEventId: " evt-123 ",
    occurredAt: "2026-07-08T10:20:30.000Z",
    failureReason: " ignored ",
    payload: {
      provider: "postmark",
    },
  })

  assert.deepEqual(result, {
    eventType: "delivered",
    tokenId: "token-123",
    providerMessageId: "msg-123",
    providerEventId: "evt-123",
    occurredAt: "2026-07-08T10:20:30.000Z",
    failureReason: "ignored",
    payload: {
      provider: "postmark",
    },
  })
})

test("parseEmailDeliveryEventInput rejects unknown event types", () => {
  assert.throws(
    () =>
      parseEmailDeliveryEventInput({
        eventType: "opened",
        tokenId: "token-123",
      }),
    /eventType must be one of/
  )
})

test("parseEmailDeliveryEventInput requires an identifier", () => {
  assert.throws(
    () =>
      parseEmailDeliveryEventInput({
        eventType: "failed",
      }),
    /Either tokenId or providerMessageId is required/
  )
})

test("isDuplicateEmailDeliveryEventCandidate prefers provider event ids", () => {
  assert.equal(
    isDuplicateEmailDeliveryEventCandidate(
      {
        tokenId: "token-1",
        eventType: "delivered",
        providerMessageId: "msg-1",
        providerEventId: "evt-1",
        occurredAt: "2026-07-08T10:20:30.000Z",
        failureReason: null,
      },
      {
        tokenId: "token-1",
        eventType: "failed",
        providerMessageId: "msg-1",
        providerEventId: "evt-1",
        occurredAt: "2026-07-08T10:21:30.000Z",
        failureReason: "ignored",
      }
    ),
    true
  )
})
