# Incident Handbook

This handbook defines the first response playbook for Name 100 production incidents.
Use it with the [production deployment runbook](./production-deployment.md) and the protected `/admin` dashboard.

## Priorities

1. Protect player-facing availability.
2. Preserve data integrity and recovery paths.
3. Contain abuse or delivery drift before it spreads.
4. Leave an auditable operator trail.

## Severity Model

### `warning`

Use for early drift that is not yet a player-facing outage.

Examples:

- readiness escalation level is `warning`
- cleanup history is missing
- recompute history is missing
- scheduled cleanup or daily report freshness is drifting
- limited delivery failures below incident threshold

Expected action:

1. Review `/admin` the same working day.
2. Confirm whether the signal is expected or newly introduced.
3. Schedule remediation if the signal persists.

### `error`

Use for active degradation that can impact sign-in, gameplay, or trustworthiness.

Examples:

- readiness escalation level is `error`
- `health_ok` failed
- `postgres_rate_limit_mode` failed
- `magic_link_failures` crossed threshold
- `failed_recoveries_24h` crossed threshold

Expected action:

1. Acknowledge immediately.
2. Inspect `/api/internal/health`, `/api/internal/readiness`, and `/admin`.
3. Run `npm.cmd run ops:incident-triage` from a trusted shell for a first-pass snapshot.
3. Start mitigation within 15 minutes.

### `critical`

Use for repeated readiness failure or confirmed sustained outage.

Examples:

- readiness escalation level is `critical`
- 3 or more consecutive failing readiness probes
- sustained database unavailability
- broad sign-in or daily gameplay outage

Expected action:

1. Open an active incident.
2. Assign one incident lead and one mitigation operator.
3. Pause risky operator actions that could worsen state.
4. Post updates on a fixed cadence until recovery.

## Readiness Check Playbooks

### `health_ok`

Meaning:

- core health or dependency checks failed

Likely causes:

- PostgreSQL outage
- broken migration state
- crash loop after deploy

Operator steps:

1. Call `GET /api/internal/health`.
2. Inspect which sub-check failed.
3. If database connectivity failed, verify platform database status and connection pressure.
4. If migration tracking is missing, run `npm.cmd run db:status` from a trusted shell before any write repair.
5. If the app is crash-looping, review the latest deploy and roll back at the platform layer if needed.

### `admin_secret_configured`

Meaning:

- internal admin protection is missing or inconsistent

Likely causes:

- missing production secret
- environment rollout drift

Operator steps:

1. Verify `NAME100_ADMIN_SECRET` is set in the deployment platform.
2. Confirm all instances picked up the same value.
3. Rotate the secret if exposure is suspected.
4. Re-run `npm.cmd run release:readiness`.

### `postgres_rate_limit_mode`

Meaning:

- production is not using shared Postgres-backed rate limits

Likely causes:

- bad environment variable
- fallback non-production config

Operator steps:

1. Verify `NAME100_RATE_LIMIT_DRIVER=postgres` or unset it while using Postgres.
2. Redeploy after correction.
3. Watch suspicious activity growth after recovery.

### `failed_recoveries_24h`

Meaning:

- recovery-code failures are elevated

Likely causes:

- brute force recovery attempts
- user confusion after identity-flow changes

Operator steps:

1. Review `/admin` identity events filtered to `failed_recovery`.
2. Check whether one handle or cluster dominates.
3. If clearly abusive, consider a targeted restriction.
4. If legitimate users are affected, review recent identity UI and messaging changes.

### `magic_link_failures`

Meaning:

- delivery failures, bounces, or complaints are elevated

Likely causes:

- email bridge outage
- upstream provider incident
- sender or domain reputation issue

Operator steps:

1. Review `/admin` magic-link audit rows and latest delivery statuses.
2. Verify the outbound email bridge behind `NAME100_EMAIL_WEBHOOK_URL`.
3. Confirm callbacks are still reaching `/api/internal/email-delivery-events`.
4. If sign-in is broadly impacted, pause email-dependent releases and communicate degraded login capability.

### `suspicious_activity_flags`

Meaning:

- abnormal guessing or recovery patterns are elevated

Likely causes:

- automation
- brute force recovery attempts
- spammy invalid submissions

Operator steps:

1. Review `Suspicious activity` in `/admin`.
2. Identify repeated player IDs, handles, or windows.
3. Apply temporary player restrictions when evidence is strong.
4. Re-check whether flags stop growing after mitigation.

### `cleanup_job_history_present`

Meaning:

- retention cleanup has never run or history is missing

Operator steps:

1. Run a dry cleanup preview.
2. If the retention windows look correct, schedule or run cleanup from a trusted environment.
3. Confirm the run appears in `/admin`.

### `scheduled_readiness_probes_fresh`

Meaning:

- the expected recurring readiness checks have stopped arriving on schedule

Operator steps:

1. Confirm the trusted scheduler or monitor job is still running.
2. Re-run `npm.cmd run ops:readiness-check` manually from a trusted shell.
3. Review `/admin` for the latest recorded scheduled job freshness card and alert history.
4. Treat repeated misses as an operations incident even if player traffic still looks healthy.

### `scheduled_cleanup_fresh`

Meaning:

- retention cleanup has stopped running on the expected recurring cadence

Operator steps:

1. Confirm the nightly scheduler still invokes `npm.cmd run ops:cleanup` or `npm.cmd run ops:nightly-maintenance`.
2. Run a dry cleanup preview manually if the scheduler missed a window.
3. Verify the latest cleanup run appears in `/admin`.

### `scheduled_daily_reports_fresh`

Meaning:

- the recurring operator handoff report is missing or stale

Operator steps:

1. Confirm the nightly scheduler still invokes `npm.cmd run ops:daily-report` or `npm.cmd run ops:nightly-maintenance`.
2. Re-run the daily report manually from a trusted shell if handoff context is missing.
3. Verify the archived report appears in `/admin/history`.

### `leaderboard_recompute_history_present`

Meaning:

- no recompute history is recorded yet

Operator steps:

1. Usually treat as low urgency.
2. After any rules or data repair event, run a dry recompute preview and then apply if needed.

## Escalation Rules

- `none`: routine monitoring only
- `warning`: investigate during the same working day
- `error`: acknowledge immediately and begin mitigation within 15 minutes
- `critical`: open an active incident and post regular updates until stable

Readiness-specific escalation:

- first failing readiness probe: `error`
- 3 or more consecutive failing readiness probes: `critical`

## Incident Closure

Before closing an incident:

1. Confirm `npm.cmd run ops:readiness-check` returns success.
2. Confirm the latest readiness state in `/admin` is passing or intentionally warning-only.
3. Confirm any expected recovery alert (`internal.readiness.recovered`) reached the external incident intake path.
4. Confirm `/admin` shows the expected operational alert dispatch result for the incident and recovery path.
5. Confirm any temporary restrictions, cleanup runs, or recomputes are visible in `/admin`.
6. Record root cause, mitigation, and follow-up work in the team tracker.

## Semi-Automated Triage

Use the bundled incident triage script from a trusted operator shell:

```powershell
npm.cmd run ops:incident-triage
```

The triage output now includes an action list, operational alert-delivery signals, and a merged incident timeline so responders can see degraded alerts, recovery alerts, cleanup previews, and operator restrictions in one place.
Each triage run is also archived into the operations history so later responders can review the snapshot in `/admin`.
For longer investigations or shift handoff, open `/admin/history` and use its shareable filter links so the next responder lands on the same scoped incident timeline and archived report view.

Optional safe previews:

```powershell
npm.cmd run ops:incident-triage -- --with-cleanup-preview
npm.cmd run ops:incident-triage -- --with-recompute-preview
```

These preview flags only request `dryRun: true` internal operations. They do not apply cleanup or leaderboard recomputation.

## Routine Review

For non-incident daily review, use:

```powershell
npm.cmd run ops:daily-report
```

The daily report now includes operational alert-dispatch health and the same recent incident timeline for shift handoff and routine review.
Each daily report is also archived into the operations history for later handoff review in `/admin`.
If your team runs a nightly scheduler, `npm.cmd run ops:nightly-maintenance` can also bundle the readiness check, retention cleanup, and archived daily report into one trusted job.

This report is read-only. It is intended for routine operator cadence, not active mitigation.

## Follow-Up Expectations

Every `critical` incident should create at least one follow-up improvement, such as:

- threshold tuning
- stronger alert routing
- provider failover
- recovery UX fixes
- more automation around the affected operator path

## Alert Drill

Use the protected alert drill from a trusted shell when you need to prove the external responder path still works:

```powershell
npm.cmd run ops:alert-drill
```

Recommended checks:

1. Confirm the external webhook target received the drill event `internal.alert.drill`.
2. Confirm `/admin` records the drill as a sent, suppressed, or failed operational alert.
3. If the drill fails, treat that as an operations incident because real production alerts may also be blocked.
