# Release Closeout Checklist

Use this checklist when the repo is feature-complete enough to stop building and start preparing a real release.
Pair it with [production-deployment.md](./production-deployment.md) and [incident-handbook.md](./incident-handbook.md).

## 1. Local Green State

Run these commands from the repo root:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Release only if all four commands succeed.

## 2. Required Production Environment

Confirm these values exist in the deployment platform before rollout:

- `NODE_ENV=production`
- `NEXT_PUBLIC_SITE_URL`
- `NAME100_STORE_DRIVER=postgres`
- `DATABASE_URL`
- `NAME100_ADMIN_SECRET`
- `NAME100_RATE_LIMIT_DRIVER=postgres`
- `NAME100_ALERT_WEBHOOK_URL`
- `NAME100_EMAIL_WEBHOOK_URL`
- `NAME100_EMAIL_EVENT_WEBHOOK_SECRET`
- `NAME100_EMAIL_FROM`
- `NAME100_BACKUP_DIR`
- `NAME100_RESTORE_DATABASE_URL`

Also confirm the retention windows are intentionally set:

- `NAME100_MAGIC_LINK_RETENTION_DAYS`
- `NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS`
- `NAME100_OPERATIONAL_REPORT_RETENTION_DAYS`

## 3. Database And Release Readiness

Run these commands from a trusted shell with production environment variables loaded:

```powershell
npm.cmd run db:status
npm.cmd run release:readiness
```

Do not continue if either command reports a failure.

## 4. Post-Deploy Operator Verification

Run these commands against the deployed environment:

```powershell
npm.cmd run ops:readiness-check
npm.cmd run ops:daily-report
npm.cmd run ops:alert-drill
```

Confirm all three succeed.

## 5. Admin Surface Verification

Open `/admin` and verify:

- health and readiness summary loads
- scheduled job freshness card shows expected status
- recent cleanup, alert, and readiness history are visible
- no unexpected high-severity suspicious activity flags exist

Open `/admin/history` and verify:

- incident timeline loads
- archived ops reports load
- share link and saved views behave normally

## 6. User-Facing Smoke Test

Verify the live site can complete these flows:

- open mode loads and accepts valid guesses
- daily mode loads for the current date
- leaderboard page loads
- session bootstrap works on a clean browser session
- identity claim and recovery flow works
- email magic link request and verify flow works

## 7. Operations Drill Confirmation

After running `npm.cmd run ops:alert-drill`, confirm:

- the external responder destination received `internal.alert.drill`
- `/admin` records the drill in operational alert history
- any failed or suppressed drill result is investigated before launch

After running `npm.cmd run ops:nightly-maintenance`, confirm:

- cleanup history appears in `/admin`
- a fresh daily report appears in `/admin/history`
- scheduled job freshness reflects the latest runs

## 8. Backup And Restore

Run:

```powershell
npm.cmd run db:backup
npm.cmd run db:restore-drill -- .data/backups/name100-backup-YYYY-MM-DDTHH-MM-SS.sssZ.json
```

Release only if backup creation and restore drill both succeed.

## 9. Human Go/No-Go Questions

Do not ship until the answer is "yes" to each item:

- Can operators sign in to the admin surfaces with the current secret?
- Can responders receive a drill alert outside the app?
- Can the team explain how nightly maintenance is scheduled?
- Can the team restore from a recent backup?
- Is there a clear owner for first-week production monitoring?

## 10. Minimal Remaining Follow-Up

These items do not block a basic release, but should be tracked immediately after launch:

- external dashboarding beyond webhook alerts
- stronger scheduler failure monitoring at the platform layer
- routine drill cadence for alerts and restore testing
