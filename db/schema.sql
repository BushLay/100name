create extension if not exists "pgcrypto";

create table if not exists schema_migrations (
  version varchar(255) primary key,
  name varchar(255) not null,
  applied_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  handle varchar(40) unique,
  is_guest boolean not null default true,
  recovery_code_hash varchar(128),
  recovery_code_generated_at timestamptz,
  email varchar(320),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_recovery_code_generated_at
  on players(recovery_code_generated_at desc);

create unique index if not exists idx_players_email_unique
  on players (lower(email))
  where email is not null;

create table if not exists player_identity_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete set null,
  event_type varchar(32) not null check (event_type in ('claim_identity', 'recover_session', 'failed_recovery')),
  handle varchar(40),
  ip_hash varchar(128),
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_identity_events_player_created
  on player_identity_events(player_id, created_at desc);

create index if not exists idx_player_identity_events_type_created
  on player_identity_events(event_type, created_at desc);

create table if not exists email_magic_link_tokens (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  email varchar(320) not null,
  token_hash varchar(128) not null unique,
  mode varchar(16) not null check (mode in ('link', 'login')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_magic_link_tokens_player_created
  on email_magic_link_tokens(player_id, created_at desc);

create index if not exists idx_email_magic_link_tokens_expires
  on email_magic_link_tokens(expires_at);

create table if not exists email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references email_magic_link_tokens(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  email varchar(320) not null,
  mode varchar(16) not null check (mode in ('link', 'login')),
  driver varchar(16) not null check (driver in ('log', 'webhook')),
  status varchar(16) not null check (status in ('generated', 'queued', 'delivered', 'failed', 'bounced', 'complained')),
  provider_message_id varchar(255),
  provider_event_id varchar(255),
  failure_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_delivery_events_token_updated
  on email_delivery_events(token_id, updated_at desc);

create index if not exists idx_email_delivery_events_provider_message
  on email_delivery_events(provider_message_id)
  where provider_message_id is not null;

create unique index if not exists idx_email_delivery_events_provider_event_unique
  on email_delivery_events(provider_event_id)
  where provider_event_id is not null;

create table if not exists operations_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type varchar(64) not null check (job_type in ('retention_cleanup', 'leaderboard_recompute', 'readiness_probe', 'operational_alert', 'operational_report')),
  source varchar(32) not null check (source in ('admin', 'api', 'cron', 'unknown')),
  reason text,
  requested_by text,
  request_id varchar(255),
  dry_run boolean not null,
  driver varchar(32) not null,
  deleted_magic_link_tokens integer not null default 0,
  deleted_delivery_events integer not null default 0,
  deleted_operational_reports integer not null default 0,
  remaining_magic_link_tokens integer not null default 0,
  remaining_delivery_events integer not null default 0,
  remaining_operational_reports integer not null default 0,
  magic_link_retention_days integer not null,
  delivery_event_retention_days integer not null,
  operational_report_retention_days integer not null default 0,
  recompute_dates jsonb,
  recompute_total_dates integer,
  snapshot_deleted_rows integer,
  snapshot_inserted_rows integer,
  readiness_ok boolean,
  readiness_failed_checks integer,
  readiness_warning_checks integer,
  readiness_checks jsonb,
  alert_event varchar(255),
  alert_severity varchar(16) check (alert_severity in ('warn', 'error')),
  alert_message text,
  alert_metadata jsonb,
  alert_dedup_key text,
  alert_dispatch_status varchar(16) check (alert_dispatch_status in ('sent', 'suppressed', 'failed')),
  alert_suppression_reason varchar(64) check (alert_suppression_reason in ('webhook_unconfigured', 'below_threshold', 'deduplicated')),
  alert_error_message text,
  report_type varchar(32) check (report_type in ('daily_report', 'incident_triage')),
  report_summary jsonb,
  report_actions jsonb,
  report_timeline jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_operations_job_runs_type_created
  on operations_job_runs(job_type, created_at desc);

create table if not exists abuse_restrictions (
  id uuid primary key default gen_random_uuid(),
  target_type varchar(32) not null check (target_type in ('player')),
  target_value varchar(255) not null,
  reason text,
  source varchar(32) not null check (source in ('admin', 'api', 'cron', 'unknown')),
  requested_by text,
  request_id varchar(255),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_reason text
);

create index if not exists idx_abuse_restrictions_active_target
  on abuse_restrictions(target_type, target_value, created_at desc);

create table if not exists player_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  anonymous_token_hash varchar(128) not null unique,
  user_agent text,
  ip_hash varchar(128),
  country_code varchar(2),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_player_sessions_player_id on player_sessions(player_id);
create index if not exists idx_player_sessions_last_seen_at on player_sessions(last_seen_at desc);

create table if not exists daily_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  session_id uuid not null references player_sessions(id) on delete cascade,
  date date not null,
  theme_id varchar(80) not null,
  theme_title varchar(160) not null,
  theme_label varchar(160) not null,
  target_score integer not null,
  status varchar(20) not null check (status in ('in_progress', 'completed', 'abandoned', 'invalidated')),
  score integer not null default 0,
  attempts integer not null default 0,
  guesses_submitted integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  best_time_ms integer,
  streak_at_completion integer not null default 0,
  share_text text not null default '',
  share_clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, date)
);

create index if not exists idx_daily_attempts_date_status on daily_attempts(date, status);
create index if not exists idx_daily_attempts_date_best_time on daily_attempts(date, best_time_ms);
create index if not exists idx_daily_attempts_player_updated on daily_attempts(player_id, updated_at desc);

create table if not exists accepted_guesses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references daily_attempts(id) on delete cascade,
  qid varchar(32) not null,
  resolved_name varchar(255) not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, qid)
);

create index if not exists idx_accepted_guesses_attempt_id on accepted_guesses(attempt_id, created_at);

create table if not exists guess_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references daily_attempts(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  date date not null,
  query varchar(255) not null,
  normalized_query varchar(255) not null,
  qid varchar(32),
  resolved_name varchar(255),
  is_accepted boolean not null,
  rejection_reason varchar(32),
  response_time_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_guess_events_attempt_created on guess_events(attempt_id, created_at);
create index if not exists idx_guess_events_date_qid on guess_events(date, qid);
create index if not exists idx_guess_events_player_created on guess_events(player_id, created_at desc);

create table if not exists share_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references daily_attempts(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  destination varchar(32) not null check (destination in ('copy', 'twitter', 'reddit', 'discord', 'system_share')),
  created_at timestamptz not null default now()
);

create index if not exists idx_share_events_attempt_created on share_events(attempt_id, created_at desc);
create index if not exists idx_share_events_player_created on share_events(player_id, created_at desc);

create table if not exists open_game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references players(id) on delete cascade,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists open_game_guesses (
  id uuid primary key default gen_random_uuid(),
  open_game_id uuid not null references open_game_sessions(id) on delete cascade,
  qid varchar(32) not null,
  resolved_name varchar(255) not null,
  created_at timestamptz not null default now(),
  unique (open_game_id, qid)
);

create index if not exists idx_open_game_guesses_game_created
  on open_game_guesses(open_game_id, created_at);

create table if not exists daily_leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  leaderboard_type varchar(32) not null,
  rank integer not null,
  player_id uuid not null references players(id) on delete cascade,
  attempt_id uuid not null references daily_attempts(id) on delete cascade,
  score integer not null,
  target_score integer not null,
  completion_time_ms integer,
  streak_at_completion integer not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists idx_daily_leaderboard_snapshots_date_type_rank
  on daily_leaderboard_snapshots(date, leaderboard_type, rank);

create table if not exists rate_limit_buckets (
  bucket_key varchar(255) primary key,
  count integer not null,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_buckets_reset_at
  on rate_limit_buckets(reset_at);
