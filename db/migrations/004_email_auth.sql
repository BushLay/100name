alter table players
  add column if not exists email varchar(320),
  add column if not exists email_verified_at timestamptz;

create unique index if not exists idx_players_email_unique
  on players (lower(email))
  where email is not null;

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
