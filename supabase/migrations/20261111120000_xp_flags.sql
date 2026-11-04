-- Phase 21c: XP anomaly checks. Flags only: a person looks at each one; XP is never taken
-- away automatically. Plus a hard daily backstop on XP per user.

create table public.xp_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  xp integer not null,
  -- 'volume': 2,000+ XP in 24 h; 'burst': faster than the exercise limit allows
  reason text not null check (reason in ('volume', 'burst')),
  status public.moderation_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index xp_flags_status_idx on public.xp_flags (status, created_at desc);
create index xp_flags_reviewed_by_idx on public.xp_flags (reviewed_by);

alter table public.xp_flags enable row level security;
create policy "staff read xp flags" on public.xp_flags
  for select to authenticated using ((select public.is_staff()));
create policy "read own xp flags" on public.xp_flags
  for select to authenticated using (user_id = (select auth.uid()));
-- No write policies: the job writes flags, staff resolve them through audited server code.

-- Flags users who earned 2,000 XP or more in the last 24 hours (a very heavy real day is a
-- few hundred) or who earned exercise XP faster than the exercise rate limit (30 graded
-- actions a minute) allows. Run daily by /api/cron/retention.
create function public.flag_xp_anomalies()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  flagged integer;
begin
  with day as (
    select user_id, sum(amount)::integer as xp
      from public.xp_events
     where created_at >= now() - interval '24 hours' and amount > 0
     group by user_id
  ),
  burst as (
    select user_id, max(n) as per_minute
      from (
        select user_id, date_trunc('minute', created_at) as m, count(*) as n
          from public.xp_events
         where created_at >= now() - interval '24 hours' and reason = 'exercise'
         group by 1, 2
      ) b
     group by user_id
  )
  insert into public.xp_flags (user_id, day, xp, reason)
  select d.user_id,
         (now() at time zone 'Europe/Warsaw')::date,
         d.xp,
         case when d.xp >= 2000 then 'volume' else 'burst' end
    from day d
    left join burst b on b.user_id = d.user_id
   where d.xp >= 2000 or coalesce(b.per_minute, 0) > 30
  on conflict (user_id, day) do nothing;
  get diagnostics flagged = row_count;
  return flagged;
end;
$$;
revoke execute on function public.flag_xp_anomalies() from public, anon, authenticated;
grant execute on function public.flag_xp_anomalies() to service_role;

-- Backstop: no one earns more than 5,000 XP in 24 hours, whatever goes wrong upstream (a
-- normal heavy day is a few hundred). Rows over the cap are skipped silently, like a
-- duplicate award, so the awarding code needs no special case.
create function public.cap_daily_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount > 0 and (
    select coalesce(sum(amount), 0) from public.xp_events
     where user_id = new.user_id and created_at >= now() - interval '24 hours' and amount > 0
  ) + new.amount > 5000 then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function public.cap_daily_xp() from public, anon, authenticated;
create trigger cap_daily_xp before insert on public.xp_events
  for each row execute function public.cap_daily_xp();

-- A flag is data about the user: it is part of their export (RODO art. 15), without the
-- reviewer's id. Both exports keep the same keys.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', (select auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'entitlements', coalesce((select jsonb_agg(to_jsonb(t)) from public.entitlements t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'streak', (select to_jsonb(t) from public.streaks t where t.user_id = (select auth.uid())),
    'lesson_progress', coalesce((select jsonb_agg(to_jsonb(t)) from public.lesson_progress t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'exercise_attempts', coalesce((select jsonb_agg(to_jsonb(t)) from public.exercise_attempts t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'review_cards', coalesce((select jsonb_agg(to_jsonb(t)) from public.review_cards t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'lesson_notes', coalesce((select jsonb_agg(to_jsonb(t)) from public.lesson_notes t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'highlights', coalesce((select jsonb_agg(to_jsonb(t)) from public.highlights t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'bookmarks', coalesce((select jsonb_agg(to_jsonb(t)) from public.bookmarks t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'notebooks', coalesce((select jsonb_agg(to_jsonb(t)) from public.notebooks t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(t)) from public.xp_events t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_achievements t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'league_memberships', coalesce((select jsonb_agg(to_jsonb(t)) from public.league_memberships t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'topic_ratings', coalesce((select jsonb_agg(to_jsonb(t)) from public.topic_ratings t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(to_jsonb(t)) from public.certificates t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'challenge_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.challenge_submissions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'interview_sessions', coalesce((select jsonb_agg(to_jsonb(t)) from public.interview_sessions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'interview_answers', coalesce((select jsonb_agg(to_jsonb(t)) from public.interview_answers t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(t)) from public.comments t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'votes', coalesce((select jsonb_agg(to_jsonb(t)) from public.votes t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(t)) from public.reports t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(t)) from public.notifications t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'notification_prefs', (select to_jsonb(t) from public.notification_prefs t where t.user_id = (select auth.uid())),
    'push_subscriptions', coalesce((select jsonb_agg(to_jsonb(t) - 'auth' - 'p256dh') from public.push_subscriptions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'shared_solutions', coalesce((select jsonb_agg(to_jsonb(t)) from public.shared_solutions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'content_error_reports', coalesce((select jsonb_agg(to_jsonb(t)) from public.content_error_reports t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'debunk_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.debunk_submissions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'grading_disputes', coalesce((select jsonb_agg(to_jsonb(t)) from public.grading_disputes t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'ai_grading_usage', coalesce((select jsonb_agg(to_jsonb(t)) from public.ai_grading_usage t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_roles t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'bans', coalesce((select jsonb_agg(to_jsonb(t)) from public.bans t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'xp_flags', coalesce((select jsonb_agg(to_jsonb(t) - 'reviewed_by') from public.xp_flags t where t.user_id = (select auth.uid())), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;

create or replace function public.admin_export_user(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'exported_at', now(),
      'user_id', target,
      'profile', (select to_jsonb(p) from public.profiles p where p.id = target),
      'entitlements', coalesce((select jsonb_agg(to_jsonb(t)) from public.entitlements t where t.user_id = target), '[]'::jsonb),
      'streak', (select to_jsonb(t) from public.streaks t where t.user_id = target),
      'lesson_progress', coalesce((select jsonb_agg(to_jsonb(t)) from public.lesson_progress t where t.user_id = target), '[]'::jsonb),
      'exercise_attempts', coalesce((select jsonb_agg(to_jsonb(t)) from public.exercise_attempts t where t.user_id = target), '[]'::jsonb),
      'review_cards', coalesce((select jsonb_agg(to_jsonb(t)) from public.review_cards t where t.user_id = target), '[]'::jsonb),
      'lesson_notes', coalesce((select jsonb_agg(to_jsonb(t)) from public.lesson_notes t where t.user_id = target), '[]'::jsonb),
      'highlights', coalesce((select jsonb_agg(to_jsonb(t)) from public.highlights t where t.user_id = target), '[]'::jsonb),
      'bookmarks', coalesce((select jsonb_agg(to_jsonb(t)) from public.bookmarks t where t.user_id = target), '[]'::jsonb),
      'notebooks', coalesce((select jsonb_agg(to_jsonb(t)) from public.notebooks t where t.user_id = target), '[]'::jsonb),
      'xp_events', coalesce((select jsonb_agg(to_jsonb(t)) from public.xp_events t where t.user_id = target), '[]'::jsonb),
      'achievements', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_achievements t where t.user_id = target), '[]'::jsonb),
      'league_memberships', coalesce((select jsonb_agg(to_jsonb(t)) from public.league_memberships t where t.user_id = target), '[]'::jsonb),
      'topic_ratings', coalesce((select jsonb_agg(to_jsonb(t)) from public.topic_ratings t where t.user_id = target), '[]'::jsonb),
      'certificates', coalesce((select jsonb_agg(to_jsonb(t)) from public.certificates t where t.user_id = target), '[]'::jsonb),
      'challenge_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.challenge_submissions t where t.user_id = target), '[]'::jsonb),
      'interview_sessions', coalesce((select jsonb_agg(to_jsonb(t)) from public.interview_sessions t where t.user_id = target), '[]'::jsonb),
      'interview_answers', coalesce((select jsonb_agg(to_jsonb(t)) from public.interview_answers t where t.user_id = target), '[]'::jsonb),
      'comments', coalesce((select jsonb_agg(to_jsonb(t)) from public.comments t where t.user_id = target), '[]'::jsonb),
      'votes', coalesce((select jsonb_agg(to_jsonb(t)) from public.votes t where t.user_id = target), '[]'::jsonb),
      'reports', coalesce((select jsonb_agg(to_jsonb(t)) from public.reports t where t.user_id = target), '[]'::jsonb),
      'notifications', coalesce((select jsonb_agg(to_jsonb(t)) from public.notifications t where t.user_id = target), '[]'::jsonb),
      'notification_prefs', (select to_jsonb(t) from public.notification_prefs t where t.user_id = target),
      'push_subscriptions', coalesce((select jsonb_agg(to_jsonb(t) - 'auth' - 'p256dh') from public.push_subscriptions t where t.user_id = target), '[]'::jsonb),
      'shared_solutions', coalesce((select jsonb_agg(to_jsonb(t)) from public.shared_solutions t where t.user_id = target), '[]'::jsonb),
      'content_error_reports', coalesce((select jsonb_agg(to_jsonb(t)) from public.content_error_reports t where t.user_id = target), '[]'::jsonb),
      'debunk_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.debunk_submissions t where t.user_id = target), '[]'::jsonb),
      'grading_disputes', coalesce((select jsonb_agg(to_jsonb(t)) from public.grading_disputes t where t.user_id = target), '[]'::jsonb),
      'ai_grading_usage', coalesce((select jsonb_agg(to_jsonb(t)) from public.ai_grading_usage t where t.user_id = target), '[]'::jsonb),
      'roles', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_roles t where t.user_id = target), '[]'::jsonb),
      'bans', coalesce((select jsonb_agg(to_jsonb(t)) from public.bans t where t.user_id = target), '[]'::jsonb),
      'xp_flags', coalesce((select jsonb_agg(to_jsonb(t) - 'reviewed_by') from public.xp_flags t where t.user_id = target), '[]'::jsonb)
    )
  );
end;
$$;
