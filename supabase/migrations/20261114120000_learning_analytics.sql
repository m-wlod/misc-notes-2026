-- Phase 22c: learning analytics for staff (Admin → Nauka), from our own data only.
-- Read-only, for admins, moderators and reviewers; server-graded attempts only (imported
-- browser scores never count, Phase 21).

-- Where learners drop out of lessons: per lesson, how many started, completed, and are
-- stuck (in progress, untouched for 14 days). Lessons touched in the date range.
create function public.admin_learning_lessons(from_day date, to_day date)
returns table (lesson_id text, started bigint, completed bigint, stalled bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_role('admin') or public.has_role('moderator') or public.has_role('reviewer')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.lesson_id,
           count(*) filter (where p.status <> 'not_started'),
           count(*) filter (where p.status in ('completed', 'mastered')),
           count(*) filter (where p.status = 'in_progress' and p.updated_at < now() - interval '14 days')
      from public.lesson_progress p
     where p.lesson_id not like 'debunk:%'
       and p.updated_at::date between from_day and to_day
     group by p.lesson_id;
end;
$$;
revoke execute on function public.admin_learning_lessons(date, date) from public, anon;
grant execute on function public.admin_learning_lessons(date, date) to authenticated;

-- Hint dependence: per exercise, graded attempts, hints used, solves and solves that used
-- a hint, in the date range. Levels live in the content, so the page groups by level.
create function public.admin_learning_hints(from_day date, to_day date)
returns table (exercise_id text, attempts bigint, hints bigint, solves bigint, solves_with_hints bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_role('admin') or public.has_role('moderator') or public.has_role('reviewer')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.exercise_id,
           count(*),
           coalesce(sum(a.hints_used), 0)::bigint,
           count(*) filter (where a.score >= 1),
           count(*) filter (where a.score >= 1 and a.hints_used > 0)
      from public.exercise_attempts a
     where a.source = 'app'
       and a.grader in ('auto', 'ai')
       and a.created_at::date between from_day and to_day
     group by a.exercise_id;
end;
$$;
revoke execute on function public.admin_learning_hints(date, date) from public, anon;
grant execute on function public.admin_learning_hints(date, date) to authenticated;
