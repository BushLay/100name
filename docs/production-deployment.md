# Production Deployment Runbook

This runbook describes the minimum production baseline for running Name 100 as a long-term service instead of a local MVP.
For active incidents and readiness failures, pair it with the [incident handbook](./incident-handbook.md).
For final ship prep, also use the [release closeout checklist](./release-closeout-checklist.md).
If you are deploying on Vercel, also use the [Vercel deployment guide](./vercel-deployment.md).

## Production Principles

- Production must use `NAME100_STORE_DRIVER=postgres`.
- Production must have a managed PostgreSQL database before first traffic.
- Internal operations must be protected by `NAME100_ADMIN_SECRET`.
- Health checks and CI must pass before every rollout.

## Required Environment Variables

Set these variables in your deployment platform:

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
NAME100_STORE_DRIVER=postgres
DATABASE_URL=postgres://user:password@host:5432/name100
NAME100_ADMIN_SECRET=generate-a-long-random-secret
NAME100_LOG_LEVEL=info
NAME100_RATE_LIMIT_DRIVER=postgres
NAME100_ALERT_WEBHOOK_URL=https://your-alert-endpoint.example.com/webhook
NAME100_ALERT_LEVEL=error
NAME100_ALERT_DEDUP_WINDOW_MS=300000
NAME100_EMAIL_DELIVERY_DRIVER=webhook
NAME100_EMAIL_WEBHOOK_URL=https://your-email-bridge.example.com/webhook
NAME100_EMAIL_EVENT_WEBHOOK_SECRET=generate-a-separate-hmac-secret
NAME100_EMAIL_FROM=noreply@your-production-domain.com
NAME100_MAGIC_LINK_TTL_MINUTES=15
NAME100_MAGIC_LINK_RETENTION_DAYS=30
NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS=90
NAME100_OPERATIONAL_REPORT_RETENTION_DAYS=180
NAME100_BACKUP_DIR=/var/backups/name100
NAME100_RESTORE_DATABASE_URL=postgres://user:password@host:5432/name100_restore_drill
NAME100_RELEASE_BASE_URL=https://your-production-domain.com
```

Notes:

- `NEXT_PUBLIC_SITE_URL` must match the public HTTPS origin used by players.
- `NAME100_STORE_DRIVER=file` is intentionally blocked in production.
- `NAME100_ADMIN_SECRET` should be high-entropy and stored in your platform secret manager.
- `NAME100_LOG_LEVEL=info` is the recommended production default for structured logs.
- `NAME100_RATE_LIMIT_DRIVER=postgres` is the recommended production setting and is the default when PostgreSQL is the active store.
- `NAME100_ALERT_WEBHOOK_URL` should point to your incident intake endpoint such as Slack, PagerDuty relay, or a custom webhook bridge.
- `NAME100_ALERT_LEVEL=error` is the safe default. Raise it to `warn` only when your webhook target can handle higher alert volume.
- `NAME100_EMAIL_DELIVERY_DRIVER=webhook` is the expected production mode for magic-link delivery.
- `NAME100_EMAIL_WEBHOOK_URL` should point to your email bridge that sends through SES, Resend, Postmark, or another provider.
- `NAME100_EMAIL_EVENT_WEBHOOK_SECRET` is recommended for signed delivery callbacks and should be different from `NAME100_ADMIN_SECRET`.
- That bridge should also forward delivery callbacks into `POST /api/internal/email-delivery-events` with `x-name100-admin-secret`.
- When `NAME100_EMAIL_EVENT_WEBHOOK_SECRET` is set, callback requests must also include:
  `x-name100-timestamp`
  `x-name100-signature: sha256=<hex-hmac-of-${timestamp}.${rawBody}>`
- `NAME100_MAGIC_LINK_TTL_MINUTES=15` is a reasonable production default for sign-in links.
- `NAME100_MAGIC_LINK_RETENTION_DAYS=30` keeps expired tokens available for short-term incident review without retaining them indefinitely.
- `NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS=90` is a reasonable starting point for callback forensics and bounce investigations.
- `NAME100_OPERATIONAL_REPORT_RETENTION_DAYS=180` is a reasonable starting point for retaining archived daily reports and incident triage snapshots.
- `NAME100_BACKUP_DIR` controls where operator-run JSON backups are written when using `npm.cmd run db:backup`.
- `NAME100_RESTORE_DATABASE_URL` should point at an isolated restore-drill database, never the production database.
- `NAME100_RELEASE_BASE_URL` optionally overrides which deployed environment `npm.cmd run release:readiness` probes. It defaults to `NEXT_PUBLIC_SITE_URL`.

## Pre-Deployment Checklist

Before the first production release:

- Provision PostgreSQL with backups enabled.
- Restrict database access to the application runtime and trusted operators.
- Set all required environment variables.
- Confirm CI passes on the release branch.
- Run a staging deploy if your platform supports preview environments.
- Verify the admin secret is available for internal operations.

## Database Initialization

Initialize the schema before serving production traffic.

Option 1: from a trusted operator machine

```powershell
npm.cmd run db:init
```

Optional status check before or after rollout:

```powershell
npm.cmd run db:status
```

Operator backup command:

```powershell
npm.cmd run db:backup
```

Restore drill command against an isolated database:

```powershell
npm.cmd run db:restore-drill -- .data/backups/name100-backup-YYYY-MM-DDTHH-MM-SS.sssZ.json
```

Executable release-readiness check:

```powershell
npm.cmd run release:readiness
```

Scheduled readiness probe against the deployed environment:

```powershell
npm.cmd run ops:readiness-check
```

Protected retention cleanup helper:

```powershell
npm.cmd run ops:cleanup
```

Protected alert-drill helper:

```powershell
npm.cmd run ops:alert-drill
```

Semi-automated incident triage:

```powershell
npm.cmd run ops:incident-triage
```

Read-only daily operator report:

```powershell
npm.cmd run ops:daily-report
```

Nightly maintenance bundle for trusted schedulers:

```powershell
npm.cmd run ops:nightly-maintenance
```

Option 2: through the internal route from a trusted environment

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri https://your-production-domain.com/api/internal/init-db `
  -Headers @{ "x-name100-admin-secret" = "your-admin-secret" }
```

The internal route is intended for controlled operations only. Do not expose the admin secret in browser code or public clients.
Both the internal route and CLI now apply tracked migrations from `db/migrations/` instead of replaying a single unversioned schema file.
The same admin secret also protects the internal audit endpoint used by the lightweight `/admin` dashboard.
That audit endpoint now supports filtered and paginated operator queries for larger incident windows.
The same protected surface now also includes `POST /api/internal/cleanup` for retention previews and explicit cleanup runs.
Cleanup requests can include JSON fields such as `source`, `reason`, and `requestedBy` so the
result appears in recent cleanup history inside `/admin`. Cleanup now also covers archived
operational reports in addition to stale magic-link tokens and delivery events.
`POST /api/internal/recompute-leaderboards` uses the same protection model for rebuilding daily leaderboard snapshots after data corrections or rules changes.
`POST /api/internal/abuse-restrictions` uses the same protection model for emergency player restriction and lift actions.
`GET /api/internal/readiness` uses the same protection model for consolidated operational readiness checks that can be polled by a trusted operator job.
Scheduled readiness probes can also persist a `readiness_probe` history entry so operators can review degraded runs later in `/admin`.
The admin dashboard also summarizes the last 24 hours of readiness drift so operators can spot repeated failures and the most common broken checks quickly.

## Health Verification

Check runtime health after each deploy:

```powershell
Invoke-WebRequest `
  -Uri https://your-production-domain.com/api/internal/health
```

Expected verification points:

- The route responds successfully.
- The active driver reports `postgres`.
- Database connectivity is healthy.
- The health payload reports `schema_migrations_ready: true` after initialization.
- A response `X-Request-Id` header is present for traceability.

## Rollout Procedure

Use this order for safe deploys:

1. Merge only after CI is green.
2. Confirm production environment variables are set.
3. Initialize or migrate the database schema.
4. Deploy the application.
5. Verify `/api/internal/health`.
6. Smoke-test open mode, daily mode, leaderboard reads, and share tracking.
7. Smoke-test handle claim and session recovery with a saved recovery code.
8. Smoke-test email magic-link delivery and verification.
9. Verify the `/admin` audit view can read and filter identity and magic-link events.
10. Verify at least one provider callback reaches `/api/internal/email-delivery-events` and updates the latest delivery status in `/admin`.
11. Run a dry cleanup preview from `/admin` or `POST /api/internal/cleanup` and confirm the retention windows look correct.
12. Run a dry leaderboard recompute preview for the target day window and confirm the affected dates look correct.
13. Confirm the abuse restriction control path works in a trusted environment and that an active restriction appears in `/admin`.
14. Review the suspicious activity cards in `/admin` and confirm the highest-severity flags match expected test traffic before launch.
15. Run `npm.cmd run db:backup` and then a `db:restore-drill` against the isolated restore database.
16. Run `npm.cmd run release:readiness` against the target deployment and resolve every failure before switching traffic.
17. Run `npm.cmd run ops:readiness-check` against the deployed environment and verify the readiness response is green.
18. Monitor application and database errors for the first live traffic window.

Example scheduled cleanup call from a trusted job runner:

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri https://your-production-domain.com/api/internal/cleanup `
  -Headers @{
    "x-name100-admin-secret" = "your-admin-secret"
    "Content-Type" = "application/json"
    "x-name100-operator" = "nightly-retention-job"
  } `
  -Body '{"dryRun":false,"source":"cron","reason":"nightly retention cleanup","requestedBy":"nightly-retention-job"}'
```

Equivalent CLI cleanup from a trusted operator shell:

```powershell
npm.cmd run ops:cleanup -- --apply --requested-by=nightly-retention-job
```

Example targeted leaderboard snapshot rebuild:

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri https://your-production-domain.com/api/internal/recompute-leaderboards `
  -Headers @{
    "x-name100-admin-secret" = "your-admin-secret"
    "Content-Type" = "application/json"
    "x-name100-operator" = "ops-manual-fix"
  } `
  -Body '{"dryRun":false,"source":"admin","date":"2026-07-09","days":3,"reason":"rebuild after validation rules update","requestedBy":"ops-manual-fix"}'
```

Example emergency player restriction:

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri https://your-production-domain.com/api/internal/abuse-restrictions `
  -Headers @{
    "x-name100-admin-secret" = "your-admin-secret"
    "Content-Type" = "application/json"
    "x-name100-operator" = "incident-operator"
  } `
  -Body '{"action":"activate","source":"admin","targetType":"player","targetValue":"player-id-here","reason":"manual abuse response","requestedBy":"incident-operator"}'
```

## Operational Monitoring

At minimum, monitor:

- application error rate
- API latency for daily and open guess submission
- PostgreSQL connection failures
- health endpoint failures
- unusually high guess rejection or rate-limit spikes

Every API response now includes `X-Request-Id`. Use that value to correlate client-visible failures with structured server logs.
When `NAME100_ALERT_WEBHOOK_URL` is configured, server errors and critical warnings are also pushed to the webhook with request IDs and route metadata.
`/api/internal/readiness` is designed for scheduled polling and returns HTTP `503` when error-grade readiness checks fail, so trusted cron or monitor jobs can alert immediately.
The bundled `npm.cmd run ops:readiness-check` script records those probe outcomes so readiness drift becomes part of the auditable operations history.
When a scheduled readiness probe recovers after a previous failing run, the system also emits a dedicated `internal.readiness.recovered` alert with state-transition metadata so external responders can close the loop cleanly.
Operational alert attempts are also stored in the admin audit trail so operators can distinguish sent, suppressed, and failed webhook dispatches during incident review.
The admin dashboard now also tracks freshness for scheduled readiness probes, retention cleanup, and daily report runs so missed recurring jobs show up as explicit warning or error signals instead of silent drift.
Use `npm.cmd run ops:alert-drill` to verify the external alert webhook path from a trusted shell without waiting for a real incident.
Use the [incident handbook](./incident-handbook.md) to map readiness failures and escalation levels to concrete response steps.
Use `npm.cmd run ops:incident-triage` when a responder needs a fast snapshot plus optional safe maintenance previews without manually composing internal API calls.
`npm.cmd run ops:incident-triage` now also includes operational alert-delivery issues and a merged incident timeline so responders can correlate alerts with maintenance actions quickly.
Use `npm.cmd run ops:daily-report` for routine daily or weekly review when you want a read-only operational summary without creating new maintenance runs.
`npm.cmd run ops:daily-report` now also includes alert-dispatch health and a recent incident timeline for shift handoff review.
Both scripts now archive their snapshots through `/api/internal/ops-reports`, so operators can review prior handoff and triage output in `/admin` without depending on terminal logs.
Use `npm.cmd run ops:cleanup` when you want the same protected cleanup path from a trusted shell without manually composing the HTTP request body.
Use `npm.cmd run ops:nightly-maintenance` to bundle recorded readiness checks, retention cleanup, and a daily archived ops report into one scheduler-friendly job. It defaults cleanup to `dryRun: true`; pass `-- --apply` only after the retention windows are proven correct.
Use `/admin/history` when you need a longer incident timeline or report archive review window than the main `/admin` dashboard provides.
That focused history console also supports local saved views, shareable filter URLs, and one-click filter reset so responders can hand off the same investigation scope cleanly.
If you deploy on Vercel Hobby, remember its built-in Cron frequency is more limited than paid plans; keep `vercel.json` on a daily cadence or move higher-frequency checks to an external scheduler.

Current production deployments should use the shared Postgres-backed limiter. Local development can continue using the in-memory limiter.
Identity recovery now relies on server-stored hashed recovery codes. Operators should treat recovery-code support as a user-facing availability feature and include it in release smoke tests.
Identity claim and recovery endpoints are rate-limited. Repeated recovery failures are also audit-logged for incident review.
Email magic links are also hashed at rest, expire automatically, and should be included in smoke tests when email delivery is enabled.
Delivery callbacks now have a protected internal ingestion route so operators can distinguish queued mail from delivered, failed, bounced, or complained mail during incidents.
Repeated provider callbacks are deduplicated in application code, and PostgreSQL also enforces unique non-null provider event IDs for stronger idempotency under concurrency.
Retention cleanup is operator-triggered rather than automatic. Schedule a recurring dry-run review and only apply deletion from a trusted operator environment.
Recent cleanup-run history in `/admin` should be part of the weekly operator review so unexpected deletions or job drift are caught quickly.
Leaderboard recompute history should also be reviewed after any rules, migration, or data backfill change that could affect ranked order.
Abuse restrictions should be time-boxed and reviewed regularly so temporary incident controls do not become forgotten permanent blocks.

## Backups And Recovery

Treat the database as a critical production dependency:

- Enable automated daily backups.
- Keep a tested restore path for the `name100` database.
- Document who can rotate `NAME100_ADMIN_SECRET`.
- Review backup retention and restore permissions before launch.

Recommended operator drill:

1. Run `npm.cmd run db:backup` from a trusted machine with `DATABASE_URL` pointed at production.
2. Confirm the JSON artifact lands in `NAME100_BACKUP_DIR` or `.data/backups/`.
3. Point `NAME100_RESTORE_DATABASE_URL` at a separate restore-drill database.
4. Run `npm.cmd run db:restore-drill -- <backup-file>`.
5. Verify the reported row counts are plausible for players, sessions, and attempts.
6. Destroy or reset the restore-drill database after verification.

Recommended pre-release automation:

1. Export the production environment variables into a trusted operator shell.
2. Run `npm.cmd run release:readiness`.
3. Run `npm.cmd run ops:readiness-check`.
4. Treat any failure as a release blocker.
5. Treat warnings as items to consciously accept or remediate before launch.

Recommended recurring production automation:

1. Schedule `npm.cmd run ops:nightly-maintenance` from a trusted runner every day with `--dry-run` cleanup first.
2. After retention windows are validated, switch that scheduler to `npm.cmd run ops:nightly-maintenance -- --apply`.
3. Keep `npm.cmd run ops:readiness-check` on a tighter interval than the nightly bundle so faster incidents still alert quickly.
4. Review `/admin/history` for missed or failed nightly runs during weekly operator review.
5. Run `npm.cmd run ops:alert-drill` on a fixed cadence such as weekly or monthly and confirm the drill reached the external responder path.

## Known Production Gaps

The service is not yet fully mature in these areas:

- limited structured observability and alerting
- no OAuth account-linking or operator dashboard yet
- no rollback automation or migration conflict tooling yet

This alerting and email-delivery setup is webhook-based and intentionally lightweight. It does not yet provide dashboards, bounce handling, provider failover, or long-term event storage on its own.

Those gaps do not block initial release, but they should stay on the phase 2 and phase 3 roadmap.
