# Name 100

Name 100 is a Next.js 16 daily word-game style project built around Wikidata validation. Players submit names, the app verifies them against Wikidata, and the daily mode rotates themed challenges such as female actors, singers, directors, and fictional characters.

## Current Product Surface

- Open mode: name 100 real women
- Daily mode: one theme per day with deterministic routes
- Share preview and OG images
- Local MVP leaderboard and analytics snapshot

## Development

Use `npm.cmd` in PowerShell if `npm.ps1` is blocked by execution policy.

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run db:init
npm.cmd run db:status
npm.cmd run db:backup
npm.cmd run db:restore-drill -- .data/backups/your-backup.json
npm.cmd run release:readiness
```

Set the production site URL before release:

```powershell
Copy-Item .env.example .env.local
```

Then set:

```env
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
NAME100_STORE_DRIVER=file
DATABASE_URL=postgres://postgres:postgres@localhost:5432/name100
NAME100_ADMIN_SECRET=replace-with-a-long-random-secret
NAME100_LOG_LEVEL=info
NAME100_RATE_LIMIT_DRIVER=memory
NAME100_ALERT_WEBHOOK_URL=
NAME100_ALERT_LEVEL=error
NAME100_ALERT_DEDUP_WINDOW_MS=300000
NAME100_EMAIL_DELIVERY_DRIVER=log
NAME100_EMAIL_WEBHOOK_URL=
NAME100_EMAIL_EVENT_WEBHOOK_SECRET=
NAME100_EMAIL_FROM=noreply@name100.local
NAME100_MAGIC_LINK_TTL_MINUTES=15
NAME100_MAGIC_LINK_RETENTION_DAYS=30
NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS=90
NAME100_OPERATIONAL_REPORT_RETENTION_DAYS=180
NAME100_BACKUP_DIR=
NAME100_RESTORE_DATABASE_URL=
NAME100_RELEASE_BASE_URL=
```

## Phase 2

The repository has entered the backend architecture phase for long-term operations.

Key references:

- [Phase 2 backend architecture](./docs/phase-2-backend-architecture.md)
- [Production deployment runbook](./docs/production-deployment.md)
- [Incident handbook](./docs/incident-handbook.md)
- [Shared backend contracts](./lib/backend-contracts.ts)
- [Postgres schema baseline](./db/schema.sql)
- [Database migrations](./db/migrations/001_initial_schema.sql)
- [CI workflow](./.github/workflows/ci.yml)

## Storage Drivers

- `NAME100_STORE_DRIVER=file`
  Uses the temporary file-backed development store.
- `NAME100_STORE_DRIVER=postgres`
  Uses the PostgreSQL-backed production adapter and requires `DATABASE_URL`.

## Operations

- `GET /api/internal/health`
  Returns the active store driver health status.
- `POST /api/internal/init-db`
  Applies [db/schema.sql](./db/schema.sql) using the active runtime store.
  Requires the `x-name100-admin-secret` header to match `NAME100_ADMIN_SECRET`.
- `GET /api/internal/audit`
  Returns filtered, paginated identity and magic-link audit activity for operators.
- `GET /api/internal/readiness`
  Returns a protected operational-readiness summary that combines health, delivery drift, suspicious activity, and job-history checks.
- `POST /api/internal/ops-reports`
  Archives protected daily-report or incident-triage snapshots into the operations history for later review in `/admin`.
- `POST /api/internal/cleanup`
  Runs retention cleanup for stale magic-link tokens, delivery events, and archived operational reports. Defaults to dry-run when
  the request body is empty.
  Supports optional JSON fields such as `source`, `reason`, and `requestedBy` so scheduled jobs
  and operators leave auditable execution history.
- `POST /api/internal/recompute-leaderboards`
  Rebuilds precomputed daily leaderboard snapshots for one date or a short rolling window, with
  dry-run support and auditable execution history.
- `POST /api/internal/abuse-restrictions`
  Activates or lifts operator-managed player restrictions for abuse response and incident handling.
- `POST /api/internal/email-delivery-events`
  Accepts protected provider callback events so operators can track delivered, failed, and bounced magic-link emails.
- `npm.cmd run db:init`
  Runs pending database migrations using `DATABASE_URL`.
- `npm.cmd run db:migrate`
  Runs pending database migrations explicitly.
- `npm.cmd run db:status`
  Shows how many migrations are known, applied, and still pending.
- `npm.cmd run db:backup`
  Writes a JSON backup of the production Postgres tables to `.data/backups/` or `NAME100_BACKUP_DIR`.
- `npm.cmd run db:restore-drill -- <backup-file>`
  Restores a backup into `NAME100_RESTORE_DATABASE_URL` so operators can validate the recovery path without touching the live database.
- `npm.cmd run release:readiness`
  Validates production-critical environment variables and, when secrets are available, probes `/api/internal/health` and `/api/internal/audit` on the target deployment.
- `npm.cmd run ops:readiness-check`
  Calls the deployed `/api/internal/readiness` endpoint, records a readiness-probe history entry, and exits non-zero when the environment is not operationally ready.
  Recovery from a previously failing probe now also emits a dedicated external alert signal and shows up as a recovery state in `/admin`.
- `npm.cmd run ops:incident-triage`
  Runs a first-pass incident workflow by pulling readiness and audit state, surfacing alert-delivery issues in the action list, and generating a merged incident timeline. Optional `--with-cleanup-preview` or `--with-recompute-preview` flags add safe dry-run maintenance previews.
- `npm.cmd run ops:daily-report`
  Produces a read-only operator summary of readiness drift, alert-dispatch health, suspicious activity, and a merged recent incident timeline for daily review.
  Both scripts now also archive their snapshots into the operations history so shift handoff and post-incident review do not depend on terminal scrollback.

## Identity Recovery

- `POST /api/me/identity`
  Claims or updates the current player handle and rotates a fresh recovery code.
- `POST /api/session/recover`
  Restores a player session from a saved handle plus recovery code.
- `POST /api/session/email/request`
  Sends a magic link for email sign-in or links an email to the current player.
- `GET /api/session/email/verify`
  Consumes the emailed token, verifies the email, and restores a session.
- Recovery codes are shown only when issued and are stored server-side as hashes.
- Identity claim operations are rate-limited server-side.
- Session recovery attempts are rate-limited and audit-logged server-side.
- Email magic links are hashed at rest and expire automatically.

Operational response headers:

- `X-Request-Id`
  Returned by API routes for request tracing across logs and incidents.
- `Cache-Control: no-store`
  Applied to dynamic API responses to avoid stale operational reads.

Operational alerting:

- `NAME100_ALERT_WEBHOOK_URL`
  Optional webhook endpoint for production error and warning alerts.
- `NAME100_ALERT_LEVEL=error|warn`
  Controls whether only errors or both warnings and errors should trigger alerts.
- `NAME100_ALERT_DEDUP_WINDOW_MS`
  Prevents duplicate alerts for the same incident from being sent too frequently.

Email auth delivery:

- `NAME100_EMAIL_DELIVERY_DRIVER=log|webhook`
  Uses local preview logging by default or a production webhook bridge when configured.
- `NAME100_EMAIL_WEBHOOK_URL`
  Receives outbound magic-link payloads when webhook delivery is enabled.
- `NAME100_EMAIL_EVENT_WEBHOOK_SECRET`
  Optional HMAC secret for signed delivery callbacks into `/api/internal/email-delivery-events`.
- `NAME100_EMAIL_FROM`
  Logical sender address attached to outgoing magic-link payloads.
- `NAME100_MAGIC_LINK_TTL_MINUTES`
  Controls how long a magic link remains valid.
- `NAME100_MAGIC_LINK_RETENTION_DAYS`
  Controls how long expired magic-link tokens are retained before operator cleanup removes them.
- `NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS`
  Controls how long email delivery events are retained before operator cleanup removes them.
- `NAME100_OPERATIONAL_REPORT_RETENTION_DAYS`
  Controls how long archived daily reports and incident-triage snapshots are retained before operator cleanup removes them.
- Webhook bridges should forward provider delivery callbacks to `/api/internal/email-delivery-events`
  using the same `x-name100-admin-secret` header used for other internal routes.
  If `NAME100_EMAIL_EVENT_WEBHOOK_SECRET` is set, also send `x-name100-timestamp` and
  `x-name100-signature: sha256=<hmac>` over `${timestamp}.${rawBody}`.

## Production Baseline

For formal long-term operation:

- use `NAME100_STORE_DRIVER=postgres`
- use `NAME100_RATE_LIMIT_DRIVER=postgres` or leave it unset when using Postgres
- provision PostgreSQL backups before launch
- run a restore drill before launch and repeat it on a schedule
- run `npm.cmd run release:readiness` before each production rollout
- protect internal routes with `NAME100_ADMIN_SECRET`
- set `NAME100_LOG_LEVEL=info` in production for structured server logs
- configure `NAME100_ALERT_WEBHOOK_URL` before high-traffic launch
- configure `NAME100_EMAIL_DELIVERY_DRIVER=webhook` and `NAME100_EMAIL_WEBHOOK_URL` before email sign-in launch
- require CI to pass before deploys
- follow the [production deployment runbook](./docs/production-deployment.md)
- use the [incident handbook](./docs/incident-handbook.md) during readiness failures or active incidents

## Abuse Protection

- Open mode guess submissions are rate-limited server-side.
- Daily guess submissions are rate-limited server-side.
- Share event writes are rate-limited server-side.
- Internal database initialization is also rate-limited and admin-secret protected.
- PostgreSQL deployments default to a shared Postgres-backed limiter for multi-instance safety.
- PostgreSQL deployments should advance schema through tracked migrations in `db/migrations/`.
- Permanent player continuity now depends on saved recovery codes, not only browser cookies.

## Notes

- Fonts are self-hosted locally for stable production builds.
- The file-backed store is still available for local development, but the production path is now the PostgreSQL adapter.
- `db/schema.sql` is the current schema snapshot, while `db/migrations/` is the source of truth for schema evolution.
- `/admin` is a minimal operator page that reads the protected audit endpoint with `NAME100_ADMIN_SECRET`.
- `/admin` now also shows delivery summary cards and can trigger retention cleanup previews or live cleanup runs.
- `/admin` now keeps recent cleanup-run history so operators can review manual and scheduled retention jobs.
- `/admin` now also supports leaderboard snapshot recompute previews and history for operator repairs after rule or data fixes.
- `/admin` now also includes basic abuse controls so operators can restrict or lift specific player IDs during incidents.
- `/admin` now also surfaces suspicious activity flags from guess and recovery traffic so operators can triage likely abuse before restricting a player.
- `/api/internal/audit` supports `identityEventType`, `identityHandle`, `identityLimit`, `identityOffset`, `magicLinkMode`, `magicLinkEmail`, `magicLinkLimit`, and `magicLinkOffset`.
- `/api/internal/readiness` now combines health and audit drift checks so scheduled operator jobs can watch for operational degradation from one endpoint.
- `/admin` now also shows recent readiness-probe history so scheduled health checks leave an operator-visible trail.
- `/admin` now also summarizes readiness drift over the last 24 hours, including consecutive failing probes and the most common failing checks.
- Readiness recovery after a failing probe now emits a dedicated `internal.readiness.recovered` alert signal with state-transition metadata for downstream incident tooling.
- `/admin` now also keeps recent operational alert history, including sent, suppressed, and failed webhook dispatch attempts for operator review.
- `/admin` now also keeps an ops report archive for recent daily-review and incident-triage snapshots.
- `ops:incident-triage` now provides a semi-automated first-pass operator workflow so incident responders do not need to hand-build every internal request.
- `ops:daily-report` now provides a repeatable daily review summary so routine operations are not limited to ad hoc incident checks.
- Magic-link audit rows now include the latest delivery status, callback timestamp, provider message ID, and failure reason when available.
- Replayed provider callbacks are deduplicated server-side, and PostgreSQL deployments also enforce unique `provider_event_id` values at the database layer.
