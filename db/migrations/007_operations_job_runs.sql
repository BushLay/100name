create table if not exists operations_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type varchar(64) not null check (job_type in ('retention_cleanup', 'leaderboard_recompute')),
  source varchar(32) not null check (source in ('admin', 'api', 'cron', 'unknown')),
  reason text,
  requested_by text,
  request_id varchar(255),
  dry_run boolean not null,
  driver varchar(32) not null,
  deleted_magic_link_tokens integer not null default 0,
  deleted_delivery_events integer not null default 0,
  remaining_magic_link_tokens integer not null default 0,
  remaining_delivery_events integer not null default 0,
  magic_link_retention_days integer not null,
  delivery_event_retention_days integer not null,
  recompute_dates jsonb,
  recompute_total_dates integer,
  snapshot_deleted_rows integer,
  snapshot_inserted_rows integer,
  created_at timestamptz not null default now()
);


create index if not exists idx_operations_job_runs_type_created
  on operations_job_runs(job_type, created_at desc);
