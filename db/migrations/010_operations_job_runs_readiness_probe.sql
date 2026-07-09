alter table operations_job_runs
  drop constraint if exists operations_job_runs_job_type_check;

alter table operations_job_runs
  add constraint operations_job_runs_job_type_check
  check (job_type in ('retention_cleanup', 'leaderboard_recompute', 'readiness_probe'));

alter table operations_job_runs
  add column if not exists readiness_ok boolean;

alter table operations_job_runs
  add column if not exists readiness_failed_checks integer;

alter table operations_job_runs
  add column if not exists readiness_warning_checks integer;

alter table operations_job_runs
  add column if not exists readiness_checks jsonb;
