# Phase 2 Backend Architecture

This document defines the first production backend for Name 100. The goal is to move the game from local-only MVP state to a service that supports identity, server-trusted leaderboards, analytics, anti-abuse controls, and future live operations.

## Goals

- Preserve the current product loop: open play, daily challenge, share result, return tomorrow.
- Move daily progress, streaks, and leaderboards from browser storage to the server.
- Make Wikidata verification trustworthy enough for ranked competition.
- Keep the migration incremental so the current front end can keep shipping.

## Non-goals

- Full social graph or friend system in phase 2.
- Complex moderation tooling in the first backend cut.
- Real-money or prize-backed competition.

## Current Frontend State

Current client state lives in [lib/growth.ts](/C:/Project/100name/lib/growth.ts) and is used by [components/DailyChallengeBoard.tsx](/C:/Project/100name/components/DailyChallengeBoard.tsx).

The browser currently stores:

- Daily score and guessed QIDs
- Daily completion status and best time
- Current streak and max streak
- Share clicks and lightweight analytics
- Local-only leaderboard projections

This is fine for MVP, but it breaks as soon as users switch devices, clear storage, compete against each other, or try to automate submissions.

## Production Principles

- The server is the source of truth for ranked daily attempts.
- The client may cache state locally for resilience, but never owns ranking truth.
- Guess validation for ranked modes must happen server-side.
- Analytics events should be append-only where practical.
- Player identity should start simple but be upgrade-safe.

## Recommended Stack

- Runtime: Next.js App Router with Route Handlers for the first backend cut
- Database: PostgreSQL
- ORM: Drizzle or Prisma
- Cache and rate limit store: Redis
- Auth: anonymous guest identity first, then optional account linking
- Hosting: Vercel or another Node-compatible platform with Postgres and Redis

## Core Domain Model

Shared TypeScript contracts live in [lib/backend-contracts.ts](/C:/Project/100name/lib/backend-contracts.ts).
The first Postgres baseline now also lives in [db/schema.sql](/C:/Project/100name/db/schema.sql).
The runtime now supports `NAME100_STORE_DRIVER=file|postgres`, with the PostgreSQL adapter intended for production.
Deployment operations now have two first-class entry points:

- `GET /api/internal/health`
- `POST /api/internal/init-db`

### 1. players

Represents the long-lived identity behind streaks, history, and leaderboard entries.

Suggested columns:

- `id` uuid primary key
- `handle` varchar nullable unique
- `is_guest` boolean not null default true
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Notes:

- Every new visitor gets a guest player record.
- Later we can link this record to OAuth or email auth without rewriting historical attempts.

### 2. player_sessions

Represents a device or browser session for rate limiting, analytics, and fraud analysis.

Suggested columns:

- `id` uuid primary key
- `player_id` uuid not null references `players(id)`
- `anonymous_token_hash` varchar not null
- `user_agent` text nullable
- `ip_hash` varchar nullable
- `country_code` varchar(2) nullable
- `created_at` timestamptz not null
- `last_seen_at` timestamptz not null

### 3. daily_attempts

Represents one player's authoritative run for one date and theme.

Suggested columns:

- `id` uuid primary key
- `player_id` uuid not null references `players(id)`
- `session_id` uuid not null references `player_sessions(id)`
- `date` date not null
- `theme_id` varchar not null
- `theme_title` varchar not null
- `theme_label` varchar not null
- `target_score` integer not null
- `status` varchar not null
- `score` integer not null default 0
- `attempts` integer not null default 0
- `guesses_submitted` integer not null default 0
- `started_at` timestamptz not null
- `completed_at` timestamptz nullable
- `best_time_ms` integer nullable
- `streak_at_completion` integer not null default 0
- `share_text` text not null default ''
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Constraints:

- Unique index on `player_id + date`
- Index on `date + completed_at`
- Index on `date + best_time_ms`

### 4. guess_events

Append-only log of every submitted guess.

Suggested columns:

- `id` uuid primary key
- `attempt_id` uuid not null references `daily_attempts(id)`
- `player_id` uuid not null references `players(id)`
- `date` date not null
- `query` varchar not null
- `normalized_query` varchar not null
- `qid` varchar nullable
- `resolved_name` varchar nullable
- `is_accepted` boolean not null
- `rejection_reason` varchar nullable
- `response_time_ms` integer nullable
- `created_at` timestamptz not null

Indexes:

- `attempt_id + created_at`
- `date + qid`
- `player_id + created_at`

### 5. share_events

Tracks actual share actions rather than mutating counters in place.

Suggested columns:

- `id` uuid primary key
- `attempt_id` uuid not null references `daily_attempts(id)`
- `player_id` uuid not null references `players(id)`
- `destination` varchar not null
- `created_at` timestamptz not null

### 6. daily_leaderboard_snapshots

Optional but recommended for scale. This stores precomputed leaderboard rows for fast reads.

Suggested columns:

- `id` uuid primary key
- `date` date not null
- `leaderboard_type` varchar not null
- `rank` integer not null
- `player_id` uuid not null
- `attempt_id` uuid not null
- `score` integer not null
- `completion_time_ms` integer nullable
- `streak_at_completion` integer not null
- `computed_at` timestamptz not null

## API Surface

The first production API can be implemented under `app/api/`.

### Identity

- `POST /api/session/bootstrap`
  - Creates or resumes a guest player and session
  - Returns `player`, `session`, and current stats summary

### Daily gameplay

- `GET /api/daily/:date`
  - Returns theme snapshot, player attempt state, and lightweight leaderboard preview
- `POST /api/daily/:date/guess`
  - Accepts a submitted name
  - Performs server-side Wikidata lookup and rule validation
  - Persists the guess event
  - Updates the authoritative attempt state
- `POST /api/daily/:date/complete`
  - Finalizes completion state when target score is reached
  - Computes streaks and share text on the server
- `POST /api/daily/:date/share`
  - Records a share destination event

### Player views

- `GET /api/me`
  - Returns player profile and stats
- `GET /api/me/history`
  - Returns paginated daily attempt history
- `GET /api/me/leaderboard-summary`
  - Returns best times, streak summary, and recent placements

### Leaderboards

- `GET /api/leaderboards/daily/:date`
  - Primary daily leaderboard
- `GET /api/leaderboards/streaks`
  - Longest streak leaderboard
- `GET /api/leaderboards/fastest`
  - Best completion times over a rolling window

### Admin and operations

- `POST /api/internal/recompute-leaderboards`
- `POST /api/internal/replay-daily-theme/:date`
- `GET /api/internal/health`

Internal routes should be protected by secret headers or platform-native auth.

## Server Validation Flow

For ranked daily guesses:

1. Authenticate or restore the player session.
2. Load the player's daily attempt for the given date.
3. Normalize the submitted name.
4. Reject empty input or obviously abusive patterns early.
5. Resolve the name with Wikidata server-side.
6. Load entity details and validate against the theme.
7. Reject duplicates based on accepted QIDs already stored for that attempt.
8. Persist the guess event.
9. Update the attempt aggregate.
10. If target score is reached, finalize completion and recompute streak.

Important:

- Never trust client-provided score, streak, elapsed time, or completion state.
- Server completion time should be derived from `started_at` and `completed_at`.

## Anti-abuse Strategy

Phase 2 does not need perfect anti-cheat, but it does need credible controls.

### Minimum controls

- Per-session and per-IP rate limits on guess submissions
- Session bootstrap token signed and httpOnly
- Duplicate guess detection by `qid`
- Submission timestamp logging
- User-agent and IP hashing for clustering abuse

### Recommended controls

- Cooldown after repeated failed guesses
- Heuristic flagging for unrealistic completion times
- Ban or shadowban table for abusive sessions
- Replay-safe idempotency keys for guess submission

### Examples of suspicious signals

- More than 5 accepted guesses in under 2 seconds
- Identical session behavior across many player IDs
- Extremely high completion frequency on fresh accounts
- Repeated high-volume invalid submissions

## Analytics Model

Treat analytics as event streams first, aggregate views second.

Track these events:

- session bootstrapped
- daily challenge opened
- guess submitted
- guess accepted
- guess rejected
- daily challenge completed
- share clicked
- leaderboard viewed

Useful derived metrics:

- DAU, WAU, MAU
- start rate per daily page visit
- completion rate
- median completion time
- share rate
- day-1 and day-7 retention

## Migration Plan

### Step 1. Introduce identity without breaking the current UI

- Add `POST /api/session/bootstrap`
- Store a guest cookie
- Keep existing local UI state as a fallback cache

### Step 2. Move daily attempts to the server

- Create `GET /api/daily/:date`
- Create `POST /api/daily/:date/guess`
- Mirror current `DailyRecord` fields into `daily_attempts`
- Keep client rendering mostly unchanged by adapting response shapes

### Step 3. Move completion and streak logic to the server

- Server computes `currentStreak`, `maxStreak`, and share text
- Client stops mutating leaderboard and streak truth locally

### Step 4. Replace local leaderboard calculations

- Read leaderboard data from backend endpoints
- Keep client-side optimistic presentation only where necessary

### Step 5. Backfill analytics and operational dashboards

- Start from event tables
- Add aggregate jobs and leaderboards snapshots later

## Frontend Refactor Targets

These frontend modules should become adapters over server data:

- [lib/growth.ts](/C:/Project/100name/lib/growth.ts)
  - Convert into client cache helpers and derived presentational utilities
- [components/DailyChallengeBoard.tsx](/C:/Project/100name/components/DailyChallengeBoard.tsx)
  - Replace direct localStorage writes with server mutations
- [components/LeaderboardBoard.tsx](/C:/Project/100name/components/LeaderboardBoard.tsx)
  - Read real leaderboard endpoints

## Suggested Milestone Breakdown

### Milestone A: service-ready identity and attempt storage

- Add guest session bootstrap
- Add Postgres schema
- Add daily attempt read/write endpoints
- Preserve current UI

### Milestone B: trusted ranked daily mode

- Server-side validation
- Real daily leaderboard
- Share tracking events
- Basic anti-abuse

### Milestone C: operations and growth

- Admin recompute tools
- Analytics dashboards
- Alerting and health checks
- Account linking

## Open Decisions

- Whether to support open mode rankings or keep rankings daily-only
- Whether guest profiles can appear publicly or require a chosen handle
- Whether to show provisional leaderboard results before server verification settles
- Which retention and privacy tooling is required in your target market

## Recommended Next Build Task

Implement Milestone A in the smallest useful slice:

1. add guest session bootstrap
2. define Postgres tables
3. add `GET /api/daily/:date`
4. add `POST /api/daily/:date/guess`
5. adapt `DailyChallengeBoard` to read and write through those endpoints
