alter table players
  add column if not exists recovery_code_hash varchar(128),
  add column if not exists recovery_code_generated_at timestamptz;

create index if not exists idx_players_recovery_code_generated_at
  on players(recovery_code_generated_at desc);
