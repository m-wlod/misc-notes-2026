-- Phase 22a: operational alerts (AI budget thresholds, failed or late cron jobs). One row
-- per alert key per day, so an alert is sent once a day at most, from any instance.
create table public.alert_log (
  day date not null,
  key text not null check (char_length(key) <= 120),
  subject text not null check (char_length(subject) <= 200),
  created_at timestamptz not null default now(),
  primary key (day, key)
);
alter table public.alert_log enable row level security;
-- No policies: only server code (secret key) writes and reads it.

-- Pruned by the daily retention job after 90 days, like the other operational logs.
create or replace function public.prune_alert_log()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.alert_log where day < current_date - 90 returning 1)
  select count(*)::integer from gone;
$$;
revoke execute on function public.prune_alert_log() from public, anon, authenticated;
grant execute on function public.prune_alert_log() to service_role;
