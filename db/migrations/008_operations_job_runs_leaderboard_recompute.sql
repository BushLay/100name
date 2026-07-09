alter table operations_job_runs
  drop constraint if exists operations_job_runs_job_type_check;

alter table operations_job_runs
  add constraint operations_job_runs_job_type_check
  check (job_type in ('retention_cleanup', 'leaderboard_recompute'));

alter table operations_job_runs
  add column if not exists recompute_dates jsonb;

alter table operations_job_runs
  add column if not exists recompute_total_dates integer;

alter table operations_job_runs
  add column if not exists snapshot_deleted_rows integer;

alter table operations_job_runs
  add column if not exists snapshot_inserted_rows integer;
