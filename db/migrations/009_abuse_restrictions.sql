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
