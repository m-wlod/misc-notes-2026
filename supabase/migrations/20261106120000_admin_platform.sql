-- Phase 18c: AI costs per exercise, admin settings, cron run history.

-- Which exercise a grading call was for (null for calls logged before this column).
alter table public.ai_grading_usage
  add column exercise_id text check (char_length(exercise_id) <= 120);
create index ai_grading_usage_exercise_idx on public.ai_grading_usage (exercise_id);

-- Settings admins change in the panel (today: the AI budget and quotas). Written only by
-- server code after an admin check, with an audit row; readable by admins.
create table public.app_settings (
  key text primary key check (key in ('ai')),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index app_settings_updated_by_idx on public.app_settings (updated_by);
alter table public.app_settings enable row level security;
create policy "admins read settings" on public.app_settings
  for select to authenticated using ((select public.has_role('admin')));

-- One row per cron run (leagues, calibrate, notify), written by the cron routes.
create table public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('leagues', 'calibrate', 'notify')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  details jsonb
);
create index cron_runs_job_idx on public.cron_runs (job, started_at desc);
alter table public.cron_runs enable row level security;
create policy "admins read cron runs" on public.cron_runs
  for select to authenticated using ((select public.has_role('admin')));

-- AI grading costs for the panel: per UTC day (the budget's day), top users, per
-- exercise. Admin only.
create or replace function public.admin_ai_costs(from_day date, to_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select public.has_role('admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with spend as (
    select u.*
    from public.ai_grading_usage u
    where u.created_at >= (from_day::timestamp at time zone 'UTC')
      and u.created_at < ((to_day + 1)::timestamp at time zone 'UTC')
  )
  select jsonb_build_object(
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'calls', d.calls, 'cost', d.cost) order by d.day)
      from (
        select g.day::date as day, count(u.id) as calls, coalesce(sum(u.cost_usd), 0) as cost
        from generate_series(from_day::timestamp, to_day::timestamp, interval '1 day') g(day)
        left join spend u on (u.created_at at time zone 'UTC')::date = g.day::date
        group by g.day
      ) d
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'handle', x.handle, 'calls', x.calls, 'cost', x.cost) order by x.cost desc, x.user_id)
      from (
        select u.user_id, p.handle, count(*) as calls, sum(u.cost_usd) as cost
        from spend u
        left join public.profiles p on p.id = u.user_id
        group by u.user_id, p.handle
        order by sum(u.cost_usd) desc, u.user_id
        limit 20
      ) x
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object('exercise_id', x.exercise_id, 'calls', x.calls, 'cost', x.cost) order by x.cost desc, x.exercise_id)
      from (
        select u.exercise_id, count(*) as calls, sum(u.cost_usd) as cost
        from spend u
        group by u.exercise_id
        order by sum(u.cost_usd) desc, u.exercise_id
        limit 50
      ) x
    ), '[]'::jsonb)
  )
  into result;
  return result;
end;
$$;

revoke all on function public.admin_ai_costs(date, date) from public, anon;
grant execute on function public.admin_ai_costs(date, date) to authenticated;
