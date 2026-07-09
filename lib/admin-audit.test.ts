import assert from "node:assert/strict"
import test from "node:test"

import {
  ADMIN_AUDIT_DEFAULT_LIMIT,
  ADMIN_AUDIT_MAX_LIMIT,
  parseAdminAuditInput,
} from "./server/admin-audit.ts"

test("parseAdminAuditInput returns defaults for an empty query string", () => {
  const result = parseAdminAuditInput(new URLSearchParams())

  assert.deepEqual(result, {
    identity: {
      eventType: null,
      handle: null,
      limit: ADMIN_AUDIT_DEFAULT_LIMIT,
      offset: 0,
    },
    magicLinks: {
      mode: null,
      email: null,
      limit: ADMIN_AUDIT_DEFAULT_LIMIT,
      offset: 0,
    },
    operationalReports: {
      reportType: null,
      limit: ADMIN_AUDIT_DEFAULT_LIMIT,
      offset: 0,
      sinceDays: null,
      search: null,
    },
    incidentHistory: {
      category: null,
      limit: ADMIN_AUDIT_DEFAULT_LIMIT,
      offset: 0,
      sinceDays: null,
      search: null,
    },
  })
})

test("parseAdminAuditInput trims values and clamps limit", () => {
  const result = parseAdminAuditInput(
    new URLSearchParams({
      identityEventType: "failed_recovery",
      identityHandle: "  alice  ",
      identityLimit: "999",
      identityOffset: "40",
      magicLinkMode: "login",
      magicLinkEmail: "  ops@example.com  ",
      magicLinkLimit: "50",
      magicLinkOffset: "10",
      operationalReportType: "incident_triage",
      operationalReportLimit: "15",
      operationalReportOffset: "5",
      operationalReportSinceDays: "30",
      operationalReportSearch: " handoff ",
      incidentHistoryCategory: "readiness_probe",
      incidentHistoryLimit: "25",
      incidentHistoryOffset: "10",
      incidentHistorySinceDays: "7",
      incidentHistorySearch: " degraded ",
    })
  )

  assert.deepEqual(result, {
    identity: {
      eventType: "failed_recovery",
      handle: "alice",
      limit: ADMIN_AUDIT_MAX_LIMIT,
      offset: 40,
    },
    magicLinks: {
      mode: "login",
      email: "ops@example.com",
      limit: 50,
      offset: 10,
    },
    operationalReports: {
      reportType: "incident_triage",
      limit: 15,
      offset: 5,
      sinceDays: 30,
      search: "handoff",
    },
    incidentHistory: {
      category: "readiness_probe",
      limit: 25,
      offset: 10,
      sinceDays: 7,
      search: "degraded",
    },
  })
})

test("parseAdminAuditInput rejects invalid enum values", () => {
  assert.throws(
    () =>
      parseAdminAuditInput(
        new URLSearchParams({
          magicLinkMode: "password",
        })
      ),
    /magicLinkMode must be one of/
  )
})

test("parseAdminAuditInput rejects invalid pagination values", () => {
  assert.throws(
    () =>
      parseAdminAuditInput(
        new URLSearchParams({
          identityOffset: "-1",
        })
      ),
    /identityOffset must be a non-negative integer/
  )
})
