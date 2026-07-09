alter table operations_job_runs
  drop constraint if exists operations_job_runs_job_type_check;

alter table operations_job_runs
  add constraint operations_job_runs_job_type_check
  check (
    job_type in (
      'retention_cleanup',
      'leaderboard_recompute',
      'readiness_probe',
      'operational_alert',
      'operational_report'
    )
  );

alter table operations_job_runs
  add column if not exists report_type varchar(32);

alter table operations_job_runs
  add column if not exists report_summary jsonb;

alter table operations_job_runs
  add column if not exists report_actions jsonb;

alter table operations_job_runs
  add column if not exists report_timeline jsonb;

alter table operations_job_runs
  drop constraint if exists operations_job_runs_report_type_check;

alter table operations_job_runs
  add constraint operations_job_runs_report_type_check
  check (report_type in ('daily_report', 'incident_triage'));
