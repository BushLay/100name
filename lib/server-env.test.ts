import assert from "node:assert/strict"
import test from "node:test"

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
} from "./server-config.ts"

test("getStoreDriver defaults to file in development and postgres in production", () => {
  assert.equal(
    getStoreDriverFromEnv({
      NODE_ENV: "development",
      NAME100_STORE_DRIVER: undefined,
    }),
    "file"
  )

  assert.equal(
    getStoreDriverFromEnv({
      NODE_ENV: "production",
      NAME100_STORE_DRIVER: undefined,
    }),
    "postgres"
  )
})

test("getRateLimitDriver follows store defaults and blocks production memory mode", () => {
  assert.equal(
    getRateLimitDriverFromEnv({
      NODE_ENV: "development",
      NAME100_STORE_DRIVER: "file",
      NAME100_RATE_LIMIT_DRIVER: undefined,
    }),
    "memory"
  )

  assert.equal(
    getRateLimitDriverFromEnv({
      NODE_ENV: "production",
      NAME100_STORE_DRIVER: "postgres",
      NAME100_RATE_LIMIT_DRIVER: undefined,
    }),
    "postgres"
  )

  assert.throws(
    () =>
      getRateLimitDriverFromEnv({
        NODE_ENV: "production",
        NAME100_STORE_DRIVER: "postgres",
        NAME100_RATE_LIMIT_DRIVER: "memory",
      }),
    /not allowed in production/i
  )
})

test("alert config helpers provide safe defaults", () => {
  assert.equal(
    getAlertWebhookUrlFromEnv({
      NAME100_ALERT_WEBHOOK_URL: " https://example.com/hook ",
    }),
    "https://example.com/hook"
  )
  assert.equal(getAlertWebhookUrlFromEnv({}), null)
  assert.equal(getAlertLevelFromEnv({}), "error")
  assert.equal(getAlertLevelFromEnv({ NAME100_ALERT_LEVEL: "warn" }), "warn")
  assert.equal(getAlertDedupWindowMsFromEnv({}), 300000)
  assert.equal(
    getAlertDedupWindowMsFromEnv({ NAME100_ALERT_DEDUP_WINDOW_MS: "120000" }),
    120000
  )
})

test("email auth config helpers provide safe defaults", () => {
  assert.equal(getEmailDeliveryDriverFromEnv({}), "log")
  assert.equal(getEmailDeliveryDriverFromEnv({ NAME100_EMAIL_DELIVERY_DRIVER: "webhook" }), "webhook")
  assert.equal(getEmailWebhookUrlFromEnv({ NAME100_EMAIL_WEBHOOK_URL: " https://example.com/mail " }), "https://example.com/mail")
  assert.equal(getEmailWebhookUrlFromEnv({}), null)
  assert.equal(
    getEmailEventWebhookSecretFromEnv({
      NAME100_EMAIL_EVENT_WEBHOOK_SECRET: " super-secret ",
    }),
    "super-secret"
  )
  assert.equal(getEmailEventWebhookSecretFromEnv({}), null)
  assert.equal(getEmailFromAddressFromEnv({}), "noreply@name100.local")
  assert.equal(getMagicLinkTtlMinutesFromEnv({}), 15)
  assert.equal(getMagicLinkTtlMinutesFromEnv({ NAME100_MAGIC_LINK_TTL_MINUTES: "30" }), 30)
  assert.equal(getMagicLinkRetentionDaysFromEnv({}), 30)
  assert.equal(
    getMagicLinkRetentionDaysFromEnv({ NAME100_MAGIC_LINK_RETENTION_DAYS: "45" }),
    45
  )
  assert.equal(getEmailDeliveryEventRetentionDaysFromEnv({}), 90)
  assert.equal(
    getEmailDeliveryEventRetentionDaysFromEnv({
      NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS: "120",
    }),
    120
  )
  assert.equal(getOperationalReportRetentionDaysFromEnv({}), 180)
  assert.equal(
    getOperationalReportRetentionDaysFromEnv({
      NAME100_OPERATIONAL_REPORT_RETENTION_DAYS: "365",
    }),
    365
  )
})
