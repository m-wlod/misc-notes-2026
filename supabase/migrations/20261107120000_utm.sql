-- Phase 19: our own campaign counter. Daily totals of landings per campaign and page,
-- nothing about the visitor: no IP, no user id, no cookie. Written only by the server
-- (/api/utm, secret key) through record_utm_visit; read by admins.

create table public.utm_visits (
  day date not null,
  source text not null check (source ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  medium text not null default '' check (medium ~ '^([a-z0-9][a-z0-9._-]{0,39})?$'),
  campaign text not null default '' check (campaign ~ '^([a-z0-9][a-z0-9._-]{0,39})?$'),
  landing_path text not null check (char_length(landing_path) between 1 and 120),
  visits integer not null default 0 check (visits >= 0),
  primary key (day, source, medium, campaign, landing_path)
);
alter table public.utm_visits enable row level security;
create policy "admins read campaign visits" on public.utm_visits
  for select to authenticated using ((select public.has_role('admin')));

-- One landing: +1 on today's row (Warsaw day, like the dashboard).
create or replace function public.record_utm_visit(
  src text, med text, camp text, path text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.utm_visits as v (day, source, medium, campaign, landing_path, visits)
  values ((now() at time zone 'Europe/Warsaw')::date, src, coalesce(med, ''), coalesce(camp, ''), path, 1)
  on conflict (day, source, medium, campaign, landing_path)
  do update set visits = v.visits + 1;
$$;
revoke all on function public.record_utm_visit(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_utm_visit(text, text, text, text) to service_role;

-- Campaign totals for the admin dashboard.
create or replace function public.admin_utm(from_day date, to_day date)
returns table (source text, medium text, campaign text, landing_path text, visits bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select u.source, u.medium, u.campaign, u.landing_path, sum(u.visits)::bigint
    from public.utm_visits u
    where u.day between from_day and to_day
    group by u.source, u.medium, u.campaign, u.landing_path
    order by sum(u.visits) desc, u.source, u.medium, u.campaign, u.landing_path
    limit 200;
end;
$$;
revoke all on function public.admin_utm(date, date) from public, anon;
grant execute on function public.admin_utm(date, date) to authenticated;
