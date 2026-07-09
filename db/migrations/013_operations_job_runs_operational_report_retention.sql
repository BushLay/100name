alter table operations_job_runs
  add column if not exists deleted_operational_reports integer not null default 0;

alter table operations_job_runs
  add column if not exists remaining_operational_reports integer not null default 0;

alter table operations_job_runs
  add column if not exists operational_report_retention_days integer not null default 0;
