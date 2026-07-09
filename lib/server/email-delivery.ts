import "server-only"

import {
  getEmailDeliveryDriver,
  getEmailFromAddress,
  getEmailWebhookUrl,
} from "@/lib/server/env"
import { logServerEvent } from "@/lib/server/observability"

type DeliverMagicLinkInput = {
  email: string
  magicLinkUrl: string
  tokenId: string
  playerId: string
  mode: "link" | "login"
  handle: string | null
}

function extractProviderMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }

  const candidate = payload as Record<string, unknown>

  if (typeof candidate.providerMessageId === "string" && candidate.providerMessageId.trim()) {
    return candidate.providerMessageId.trim()
  }

  if (typeof candidate.messageId === "string" && candidate.messageId.trim()) {
    return candidate.messageId.trim()
  }

  if (typeof candidate.id === "string" && candidate.id.trim()) {
    return candidate.id.trim()
  }

  return null
}

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

  if (!contentType.includes("application/json")) {
    return null
  }

  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function deliverMagicLink(input: DeliverMagicLinkInput) {
  const driver = getEmailDeliveryDriver()
  const from = getEmailFromAddress()
  const attemptedAt = new Date().toISOString()

  if (driver === "webhook") {
    const webhookUrl = getEmailWebhookUrl()

    if (!webhookUrl) {
      throw new Error("NAME100_EMAIL_WEBHOOK_URL is required for webhook email delivery.")
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        service: "name100",
        from,
        to: input.email,
        subject:
          input.mode === "login"
            ? "Sign in to your Name 100 account"
            : "Confirm email access for your Name 100 player",
        template: "magic_link",
        payload: {
          handle: input.handle,
          mode: input.mode,
          magicLinkUrl: input.magicLinkUrl,
        },
        metadata: {
          playerId: input.playerId,
          tokenId: input.tokenId,
          email: input.email,
          mode: input.mode,
        },
      }),
      signal: AbortSignal.timeout(5_000),
    })

    const responsePayload = await readJsonSafely(response)

    if (!response.ok) {
      throw new Error(`Email webhook returned ${response.status}.`)
    }

    return {
      previewUrl: null,
      driver,
      providerMessageId: extractProviderMessageId(responsePayload),
      attemptedAt,
      responsePayload,
    }
  }

  logServerEvent("info", "email.magic_link.generated", {
    email: input.email,
    mode: input.mode,
    handle: input.handle,
    magicLinkUrl: input.magicLinkUrl,
    from,
  })

  return {
    previewUrl: input.magicLinkUrl,
    driver,
    providerMessageId: null,
    attemptedAt,
    responsePayload: null,
  }
}
