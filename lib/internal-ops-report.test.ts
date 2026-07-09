import assert from "node:assert/strict"
import test from "node:test"

import { parseInternalOperationalReportInput } from "./server/internal-ops-report.ts"

test("parseInternalOperationalReportInput normalizes a valid payload", () => {
  assert.deepEqual(
    parseInternalOperationalReportInput({
      reportType: "daily_report",
      source: "cron",
      reason: " daily handoff ",
      requestedBy: " scheduler ",
      requestId: " req-1 ",
      summary: {
        readiness: {
          latestStatus: "passing",
        },
      },
      actions: [" alert failures detected ", " "],
      timeline: [
        {
          at: "2026-07-09T00:00:00.000Z",
          category: "operational_alert",
          title: " failed error alert ",
          detail: " readiness degraded ",
          severity: "error",
        },
      ],
    }),
    {
      reportType: "daily_report",
      source: "cron",
      reason: "daily handoff",
      requestedBy: "scheduler",
      requestId: "req-1",
      summary: {
        readiness: {
          latestStatus: "passing",
        },
      },
      actions: ["alert failures detected"],
      timeline: [
        {
          at: "2026-07-09T00:00:00.000Z",
          category: "operational_alert",
          title: "failed error alert",
          detail: "readiness degraded",
          severity: "error",
        },
      ],
    }
  )
})

test("parseInternalOperationalReportInput rejects invalid payloads", () => {
  assert.throws(() => parseInternalOperationalReportInput("nope"), /json object/i)
  assert.throws(
    () => parseInternalOperationalReportInput({ reportType: "weekly_report", summary: {}, actions: [], timeline: [] }),
    /reportType must be one of/i
  )
  assert.throws(
    () => parseInternalOperationalReportInput({ reportType: "daily_report", summary: [], actions: [], timeline: [] }),
    /summary must be a JSON object/i
  )
  assert.throws(
    () =>
      parseInternalOperationalReportInput({
        reportType: "daily_report",
        summary: {},
        actions: [1],
        timeline: [],
      }),
    /actions must be an array of strings/i
  )
  assert.throws(
    () =>
      parseInternalOperationalReportInput({
        reportType: "daily_report",
        summary: {},
        actions: [],
        timeline: [{ at: "", category: "bad", title: "", detail: "", severity: "info" }],
      }),
    /timeline item at must be a non-empty string/i
  )
})
