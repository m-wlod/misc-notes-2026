-- Admin panel (Phase 18): dashboard metrics, retention cohorts and user search.
-- Security definer (they read every user's rows), and each one refuses anyone who
-- isn't an admin, so calling them through the API gives nothing to anyone else.
-- Days are Warsaw days, like the rest of the app.

create function public.admin_metrics(from_day date, to_day date)
returns table (
  day date,
  active_users integer,
  wau integer,
  signups integer,
  lessons_completed integer,
  attempts integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with activity as (
    select a.user_id, (a.created_at at time zone 'Europe/Warsaw')::date as d
    from public.exercise_attempts a
    union
    select p.user_id, (p.completed_at at time zone 'Europe/Warsaw')::date
    from public.lesson_progress p where p.completed_at is not null
    union
    select x.user_id, (x.created_at at time zone 'Europe/Warsaw')::date
    from public.xp_events x
  ),
  days as (
    select g::date as d from generate_series(from_day, to_day, interval '1 day') g
  )
  select
    days.d,
    (select count(distinct act.user_id) from activity act where act.d = days.d)::integer,
    (select count(distinct act.user_id) from activity act
      where act.d between days.d - 6 and days.d)::integer,
    (select count(*) from auth.users u
      where (u.created_at at time zone 'Europe/Warsaw')::date = days.d)::integer,
    (select count(*) from public.lesson_progress p
      where p.completed_at is not null and p.lesson_id not like 'debunk:%'
        and (p.completed_at at time zone 'Europe/Warsaw')::date = days.d)::integer,
    (select count(*) from public.exercise_attempts a
      where (a.created_at at time zone 'Europe/Warsaw')::date = days.d)::integer
  from days
  order by days.d;
end;
$$;

-- Weekly sign-up cohorts (weeks start on Monday) and how many of each were active in
-- each later week: week 0 is the sign-up week.
create function public.admin_retention(weeks integer)
returns table (cohort date, size integer, week integer, active integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with users as (
    select u.id,
      date_trunc('week', (u.created_at at time zone 'Europe/Warsaw'))::date as cohort
    from auth.users u
    where u.created_at >= now() - make_interval(weeks => weeks + 1)
  ),
  activity as (
    select a.user_id, (a.created_at at time zone 'Europe/Warsaw')::date as d
    from public.exercise_attempts a
    union
    select p.user_id, (p.completed_at at time zone 'Europe/Warsaw')::date
    from public.lesson_progress p where p.completed_at is not null
    union
    select x.user_id, (x.created_at at time zone 'Europe/Warsaw')::date
    from public.xp_events x
  ),
  sizes as (select users.cohort, count(*)::integer as n from users group by users.cohort),
  grid as (
    select sizes.cohort, sizes.n, w as week
    from sizes, generate_series(0, weeks) w
    where sizes.cohort + (w * 7) <= (now() at time zone 'Europe/Warsaw')::date
  )
  select grid.cohort, grid.n, grid.week,
    (select count(distinct users.id) from users
      join activity on activity.user_id = users.id
      where users.cohort = grid.cohort
        and activity.d >= grid.cohort + grid.week * 7
        and activity.d < grid.cohort + (grid.week + 1) * 7)::integer
  from grid
  order by grid.cohort desc, grid.week;
end;
$$;

-- Search by email or handle (admins only); at most 50 rows.
create function public.admin_find_users(q text)
returns table (
  id uuid,
  email text,
  handle text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles text,
  banned boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, p.handle::text, p.display_name, u.created_at, u.last_sign_in_at,
    coalesce((select string_agg(r.role::text, ',' order by r.role)
      from public.user_roles r where r.user_id = u.id), ''),
    exists (select 1 from public.bans b
      where b.user_id = u.id and (b.until is null or b.until > now()))
  from auth.users u
  left join public.profiles p on p.id = u.id
  where q = ''
    or u.email ilike '%' || q || '%'
    or p.handle::text ilike '%' || q || '%'
    or u.id::text = q
  order by u.created_at desc
  limit 50;
end;
$$;

revoke execute on function public.admin_metrics(date, date) from public, anon;
revoke execute on function public.admin_retention(integer) from public, anon;
revoke execute on function public.admin_find_users(text) from public, anon;
grant execute on function public.admin_metrics(date, date) to authenticated;
grant execute on function public.admin_retention(integer) to authenticated;
grant execute on function public.admin_find_users(text) to authenticated;

-- A user's data export for admins (requests under RODO art. 15/20 made by email). The
-- same keys as export_my_data(); supabase/tests/admin.test.ts checks they stay equal.
create function public.admin_export_user(target uuid)
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
      'roles', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_roles t where t.user_id = target), '[]'::jsonb)
    )
  );
end;
$$;
revoke execute on function public.admin_export_user(uuid) from public, anon;
grant execute on function public.admin_export_user(uuid) to authenticated;
