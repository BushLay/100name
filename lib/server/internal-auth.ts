import "server-only"

import type { NextRequest } from "next/server"

import { getAdminSecret, getCronSecret } from "@/lib/server/env"

export function assertInternalApiAccess(request: NextRequest) {
  const configuredSecret = getAdminSecret()
  const configuredCronSecret = getCronSecret()

  if (!configuredSecret && !configuredCronSecret) {
    throw new Error(
      "NAME100_ADMIN_SECRET or CRON_SECRET is required for internal API access."
    )
  }

  const receivedSecret = request.headers.get("x-name100-admin-secret")
  const authorizationHeader = request.headers.get("authorization")?.trim()

  if (configuredSecret && receivedSecret === configuredSecret) {
    return
  }

  if (configuredCronSecret && authorizationHeader === `Bearer ${configuredCronSecret}`) {
    return
  }

  throw new Error("Invalid internal API secret.")
}
