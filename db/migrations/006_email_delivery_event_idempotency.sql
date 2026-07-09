create unique index if not exists idx_email_delivery_events_provider_event_unique
  on email_delivery_events(provider_event_id)
  where provider_event_id is not null;
