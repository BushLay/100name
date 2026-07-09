alter table operations_job_runs
  drop constraint if exists operations_job_runs_job_type_check;

alter table operations_job_runs
  add constraint operations_job_runs_job_type_check
  check (job_type in ('retention_cleanup', 'leaderboard_recompute', 'readiness_probe', 'operational_alert'));

alter table operations_job_runs
  add column if not exists alert_event varchar(255);

alter table operations_job_runs
  add column if not exists alert_severity varchar(16);

alter table operations_job_runs
  add column if not exists alert_message text;

alter table operations_job_runs
  add column if not exists alert_metadata jsonb;

alter table operations_job_runs
  add column if not exists alert_dedup_key text;

alter table operations_job_runs
  add column if not exists alert_dispatch_status varchar(16);

alter table operations_job_runs
  add column if not exists alert_suppression_reason varchar(64);

alter table operations_job_runs
  add column if not exists alert_error_message text;

alter table operations_job_runs
  drop constraint if exists operations_job_runs_alert_severity_check;

alter table operations_job_runs
  add constraint operations_job_runs_alert_severity_check
  check (alert_severity in ('warn', 'error'));

alter table operations_job_runs
  drop constraint if exists operations_job_runs_alert_dispatch_status_check;

alter table operations_job_runs
  add constraint operations_job_runs_alert_dispatch_status_check
  check (alert_dispatch_status in ('sent', 'suppressed', 'failed'));

alter table operations_job_runs
  drop constraint if exists operations_job_runs_alert_suppression_reason_check;

alter table operations_job_runs
  add constraint operations_job_runs_alert_suppression_reason_check
  check (
    alert_suppression_reason in ('webhook_unconfigured', 'below_threshold', 'deduplicated')
  );
