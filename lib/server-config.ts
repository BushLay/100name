export type StoreDriver = "file" | "postgres"
export type RateLimitDriver = "memory" | "postgres"
export type AlertLevel = "warn" | "error"
export type EmailDeliveryDriver = "log" | "webhook"

type EnvSource = {
  NODE_ENV?: string
  NAME100_STORE_DRIVER?: string
  NAME100_RATE_LIMIT_DRIVER?: string
  NAME100_ALERT_WEBHOOK_URL?: string
  NAME100_ALERT_LEVEL?: string
  NAME100_ALERT_DEDUP_WINDOW_MS?: string
  NAME100_EMAIL_DELIVERY_DRIVER?: string
  NAME100_EMAIL_WEBHOOK_URL?: string
  NAME100_EMAIL_EVENT_WEBHOOK_SECRET?: string
  NAME100_EMAIL_FROM?: string
  NAME100_MAGIC_LINK_TTL_MINUTES?: string
  NAME100_MAGIC_LINK_RETENTION_DAYS?: string
  NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS?: string
  NAME100_OPERATIONAL_REPORT_RETENTION_DAYS?: string
}

export function isProductionEnvironmentFromEnv(env: EnvSource) {
  return env.NODE_ENV === "production"
}

export function getStoreDriverFromEnv(env: EnvSource): StoreDriver {
  const configuredDriver = env.NAME100_STORE_DRIVER?.trim()

  if (configuredDriver === "postgres") {
    return "postgres"
  }

  if (configuredDriver === "file") {
    if (isProductionEnvironmentFromEnv(env)) {
      throw new Error("NAME100_STORE_DRIVER=file is not allowed in production.")
    }

    return "file"
  }

  return isProductionEnvironmentFromEnv(env) ? "postgres" : "file"
}

export function getRateLimitDriverFromEnv(env: EnvSource): RateLimitDriver {
  const configuredDriver = env.NAME100_RATE_LIMIT_DRIVER?.trim()

  if (configuredDriver === "postgres") {
    return "postgres"
  }

  if (configuredDriver === "memory") {
    if (isProductionEnvironmentFromEnv(env)) {
      throw new Error("NAME100_RATE_LIMIT_DRIVER=memory is not allowed in production.")
    }

    return "memory"
  }

  return getStoreDriverFromEnv(env) === "postgres" ? "postgres" : "memory"
}

export function getAlertWebhookUrlFromEnv(env: EnvSource) {
  return env.NAME100_ALERT_WEBHOOK_URL?.trim() || null
}

export function getAlertLevelFromEnv(env: EnvSource): AlertLevel {
  const configuredLevel = env.NAME100_ALERT_LEVEL?.trim().toLowerCase()

  if (configuredLevel === "warn") {
    return "warn"
  }

  return "error"
}

export function getAlertDedupWindowMsFromEnv(env: EnvSource) {
  const configuredValue = Number(env.NAME100_ALERT_DEDUP_WINDOW_MS?.trim())

  if (Number.isFinite(configuredValue) && configuredValue >= 1_000) {
    return configuredValue
  }

  return 5 * 60 * 1_000
}

export function getEmailDeliveryDriverFromEnv(env: EnvSource): EmailDeliveryDriver {
  const configuredDriver = env.NAME100_EMAIL_DELIVERY_DRIVER?.trim()

  if (configuredDriver === "webhook") {
    return "webhook"
  }

  return "log"
}

export function getEmailWebhookUrlFromEnv(env: EnvSource) {
  return env.NAME100_EMAIL_WEBHOOK_URL?.trim() || null
}

export function getEmailEventWebhookSecretFromEnv(env: EnvSource) {
  return env.NAME100_EMAIL_EVENT_WEBHOOK_SECRET?.trim() || null
}

export function getEmailFromAddressFromEnv(env: EnvSource) {
  return env.NAME100_EMAIL_FROM?.trim() || "noreply@name100.local"
}

export function getMagicLinkTtlMinutesFromEnv(env: EnvSource) {
  const configuredValue = Number(env.NAME100_MAGIC_LINK_TTL_MINUTES?.trim())

  if (Number.isFinite(configuredValue) && configuredValue >= 5 && configuredValue <= 120) {
    return configuredValue
  }

  return 15
}

function parseRetentionDays(value: string | undefined, defaultValue: number) {
  const configuredValue = Number(value?.trim())

  if (Number.isFinite(configuredValue) && configuredValue >= 1 && configuredValue <= 3650) {
    return Math.floor(configuredValue)
  }

  return defaultValue
}

export function getMagicLinkRetentionDaysFromEnv(env: EnvSource) {
  return parseRetentionDays(env.NAME100_MAGIC_LINK_RETENTION_DAYS, 30)
}

export function getEmailDeliveryEventRetentionDaysFromEnv(env: EnvSource) {
  return parseRetentionDays(env.NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS, 90)
}

export function getOperationalReportRetentionDaysFromEnv(env: EnvSource) {
  return parseRetentionDays(env.NAME100_OPERATIONAL_REPORT_RETENTION_DAYS, 180)
}
