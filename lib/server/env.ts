import "server-only"

import {
  getAlertDedupWindowMsFromEnv,
  getAlertLevelFromEnv,
  getAlertWebhookUrlFromEnv,
  getEmailDeliveryDriverFromEnv,
  getEmailEventWebhookSecretFromEnv,
  getEmailDeliveryEventRetentionDaysFromEnv,
  getEmailFromAddressFromEnv,
  getEmailWebhookUrlFromEnv,
  getMagicLinkRetentionDaysFromEnv,
  getMagicLinkTtlMinutesFromEnv,
  getOperationalReportRetentionDaysFromEnv,
  getRateLimitDriverFromEnv,
  getStoreDriverFromEnv,
  type AlertLevel,
  type EmailDeliveryDriver,
  isProductionEnvironmentFromEnv,
  type RateLimitDriver,
  type StoreDriver,
} from "@/lib/server-config"

export type { RateLimitDriver, StoreDriver }
export type { AlertLevel, EmailDeliveryDriver }

export function getStoreDriver(): StoreDriver {
  return getStoreDriverFromEnv(process.env)
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || null
}

export function requireDatabaseUrl() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when using the PostgreSQL store.")
  }

  return databaseUrl
}

export function getAdminSecret() {
  return process.env.NAME100_ADMIN_SECRET?.trim() || null
}

export function getCronSecret() {
  return process.env.CRON_SECRET?.trim() || null
}

export function isProductionEnvironment() {
  return isProductionEnvironmentFromEnv(process.env)
}

export function getRateLimitDriver(): RateLimitDriver {
  return getRateLimitDriverFromEnv(process.env)
}

export function getAlertWebhookUrl() {
  return getAlertWebhookUrlFromEnv(process.env)
}

export function getAlertLevel(): AlertLevel {
  return getAlertLevelFromEnv(process.env)
}

export function getAlertDedupWindowMs() {
  return getAlertDedupWindowMsFromEnv(process.env)
}

export function getEmailDeliveryDriver() {
  return getEmailDeliveryDriverFromEnv(process.env)
}

export function getEmailWebhookUrl() {
  return getEmailWebhookUrlFromEnv(process.env)
}

export function getEmailEventWebhookSecret() {
  return getEmailEventWebhookSecretFromEnv(process.env)
}

export function getEmailFromAddress() {
  return getEmailFromAddressFromEnv(process.env)
}

export function getMagicLinkTtlMinutes() {
  return getMagicLinkTtlMinutesFromEnv(process.env)
}

export function getMagicLinkRetentionDays() {
  return getMagicLinkRetentionDaysFromEnv(process.env)
}

export function getEmailDeliveryEventRetentionDays() {
  return getEmailDeliveryEventRetentionDaysFromEnv(process.env)
}

export function getOperationalReportRetentionDays() {
  return getOperationalReportRetentionDaysFromEnv(process.env)
}
