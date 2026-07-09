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
