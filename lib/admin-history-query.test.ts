import assert from "node:assert/strict"
import test from "node:test"

import {
  buildHistorySearchParams,
  DEFAULT_HISTORY_QUERY,
  parseHistoryQueryFromSearchParams,
} from "./admin-history-query.ts"

test("parseHistoryQueryFromSearchParams returns defaults for empty params", () => {
  assert.deepEqual(parseHistoryQueryFromSearchParams(new URLSearchParams()), DEFAULT_HISTORY_QUERY)
})

test("parseHistoryQueryFromSearchParams normalizes valid values", () => {
  assert.deepEqual(
    parseHistoryQueryFromSearchParams(
      new URLSearchParams({
        operationalReportType: "incident_triage",
        operationalReportLimit: "50",
        operationalReportOffset: "20",
        operationalReportSinceDays: "30",
        operationalReportSearch: " handoff ",
        incidentHistoryCategory: "operational_alert",
        incidentHistoryLimit: "10",
        incidentHistoryOffset: "5",
        incidentHistorySinceDays: "7",
        incidentHistorySearch: " degraded ",
      })
    ),
    {
      operationalReportType: "incident_triage",
      operationalReportLimit: 50,
      operationalReportOffset: 20,
      operationalReportSinceDays: "30",
      operationalReportSearch: "handoff",
      incidentHistoryCategory: "operational_alert",
      incidentHistoryLimit: 10,
      incidentHistoryOffset: 5,
      incidentHistorySinceDays: "7",
      incidentHistorySearch: "degraded",
    }
  )
})

test("buildHistorySearchParams omits defaults and trims searches", () => {
  const params = buildHistorySearchParams({
    ...DEFAULT_HISTORY_QUERY,
    operationalReportType: "daily_report",
    operationalReportSearch: " handoff ",
    incidentHistoryCategory: "readiness_probe",
    incidentHistorySinceDays: "1",
  })

  assert.equal(
    params.toString(),
    "operationalReportType=daily_report&operationalReportSearch=handoff&incidentHistoryCategory=readiness_probe&incidentHistorySinceDays=1"
  )
})
