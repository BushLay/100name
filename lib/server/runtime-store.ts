import "server-only"

import * as postgresStore from "@/lib/server/postgres-store"
import { getStoreDriver, isProductionEnvironment } from "@/lib/server/env"
import type { RuntimeStore } from "@/lib/server/store-types"

const SESSION_COOKIE_NAME = "name100_session"

const dynamicImport = new Function(
  "modulePath",
  "return import(modulePath)"
) as <TModule>(modulePath: string) => Promise<TModule>

let developmentStorePromise: Promise<RuntimeStore> | null = null

async function loadDevelopmentStore(): Promise<RuntimeStore> {
  if (!developmentStorePromise) {
    developmentStorePromise = dynamicImport<typeof import("@/lib/server/backend-store")>(
      "@/lib/server/backend-store"
    ) as Promise<RuntimeStore>
  }

  return developmentStorePromise
}

async function resolveStore(): Promise<RuntimeStore> {
  const driver = getStoreDriver()

  if (driver === "postgres") {
    return postgresStore satisfies RuntimeStore
  }

  if (isProductionEnvironment()) {
    throw new Error("Development file store cannot be loaded in production.")
  }

  return loadDevelopmentStore()
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
}

export async function bootstrapSession(...args: Parameters<RuntimeStore["bootstrapSession"]>) {
  const store = await resolveStore()
  return store.bootstrapSession(...args)
}

export async function getOpenGameState(...args: Parameters<RuntimeStore["getOpenGameState"]>) {
  const store = await resolveStore()
  return store.getOpenGameState(...args)
}

export async function submitOpenGuess(...args: Parameters<RuntimeStore["submitOpenGuess"]>) {
  const store = await resolveStore()
  return store.submitOpenGuess(...args)
}

export async function getHealthStatus(...args: Parameters<RuntimeStore["getHealthStatus"]>) {
  const store = await resolveStore()
  return store.getHealthStatus(...args)
}

export async function initializeDatabase(...args: Parameters<RuntimeStore["initializeDatabase"]>) {
  const store = await resolveStore()
  return store.initializeDatabase(...args)
}

export async function getDailyState(...args: Parameters<RuntimeStore["getDailyState"]>) {
  const store = await resolveStore()
  return store.getDailyState(...args)
}

export async function submitGuess(...args: Parameters<RuntimeStore["submitGuess"]>) {
  const store = await resolveStore()
  return store.submitGuess(...args)
}

export async function trackShare(...args: Parameters<RuntimeStore["trackShare"]>) {
  const store = await resolveStore()
  return store.trackShare(...args)
}

export async function getLeaderboardSummary(
  ...args: Parameters<RuntimeStore["getLeaderboardSummary"]>
) {
  const store = await resolveStore()
  return store.getLeaderboardSummary(...args)
}

export async function getIdentityStatus(...args: Parameters<RuntimeStore["getIdentityStatus"]>) {
  const store = await resolveStore()
  return store.getIdentityStatus(...args)
}

export async function claimIdentity(...args: Parameters<RuntimeStore["claimIdentity"]>) {
  const store = await resolveStore()
  return store.claimIdentity(...args)
}

export async function recoverSession(...args: Parameters<RuntimeStore["recoverSession"]>) {
  const store = await resolveStore()
  return store.recoverSession(...args)
}

export async function requestMagicLink(...args: Parameters<RuntimeStore["requestMagicLink"]>) {
  const store = await resolveStore()
  return store.requestMagicLink(...args)
}

export async function verifyMagicLink(...args: Parameters<RuntimeStore["verifyMagicLink"]>) {
  const store = await resolveStore()
  return store.verifyMagicLink(...args)
}

export async function getAdminAudit(...args: Parameters<RuntimeStore["getAdminAudit"]>) {
  const store = await resolveStore()
  return store.getAdminAudit(...args)
}

export async function recordEmailDeliveryEvent(
  ...args: Parameters<RuntimeStore["recordEmailDeliveryEvent"]>
) {
  const store = await resolveStore()
  return store.recordEmailDeliveryEvent(...args)
}

export async function recordReadinessProbe(
  ...args: Parameters<RuntimeStore["recordReadinessProbe"]>
) {
  const store = await resolveStore()
  return store.recordReadinessProbe(...args)
}

export async function recordOperationalAlert(
  ...args: Parameters<RuntimeStore["recordOperationalAlert"]>
) {
  const store = await resolveStore()
  return store.recordOperationalAlert(...args)
}

export async function recordOperationalReport(
  ...args: Parameters<RuntimeStore["recordOperationalReport"]>
) {
  const store = await resolveStore()
  return store.recordOperationalReport(...args)
}

export async function runRetentionCleanup(
  ...args: Parameters<RuntimeStore["runRetentionCleanup"]>
) {
  const store = await resolveStore()
  return store.runRetentionCleanup(...args)
}

export async function recomputeLeaderboardSnapshots(
  ...args: Parameters<RuntimeStore["recomputeLeaderboardSnapshots"]>
) {
  const store = await resolveStore()
  return store.recomputeLeaderboardSnapshots(...args)
}

export async function setAbuseRestriction(
  ...args: Parameters<RuntimeStore["setAbuseRestriction"]>
) {
  const store = await resolveStore()
  return store.setAbuseRestriction(...args)
}

export async function getDailyLeaderboard(
  ...args: Parameters<RuntimeStore["getDailyLeaderboard"]>
) {
  const store = await resolveStore()
  return store.getDailyLeaderboard(...args)
}
