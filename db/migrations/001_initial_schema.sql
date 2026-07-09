create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  handle varchar(40) unique,
  is_guest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
