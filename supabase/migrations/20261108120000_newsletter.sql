-- Phase 19c: the weekly newsletter ("Problem tygodnia + Debunk").
-- Subscribers live in newsletter_subscribers (Phase 3, server only). Each weekly send is
-- logged once per subscriber and week, so a retried cron never sends twice.

create table public.newsletter_sends (
  week date not null,
  subscriber_id bigint not null references public.newsletter_subscribers (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (week, subscriber_id)
);
create index newsletter_sends_subscriber_idx on public.newsletter_sends (subscriber_id);
alter table public.newsletter_sends enable row level security;
-- No policies: only server code (secret key) reads or writes it.

alter table public.cron_runs drop constraint cron_runs_job_check;
alter table public.cron_runs
  add constraint cron_runs_job_check check (job in ('leagues', 'calibrate', 'notify', 'newsletter'));
