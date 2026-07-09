create table if not exists email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references email_magic_link_tokens(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  email varchar(320) not null,
  mode varchar(16) not null check (mode in ('link', 'login')),
  driver varchar(16) not null check (driver in ('log', 'webhook')),
  status varchar(16) not null check (status in ('generated', 'queued', 'delivered', 'failed', 'bounced', 'complained')),
  provider_message_id varchar(255),
  provider_event_id varchar(255),
  failure_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_delivery_events_token_updated
  on email_delivery_events(token_id, updated_at desc);

create index if not exists idx_email_delivery_events_provider_message
  on email_delivery_events(provider_message_id)
  where provider_message_id is not null;
