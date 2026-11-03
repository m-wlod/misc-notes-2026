-- Phase 18b: exercise analytics for staff (admins, moderators, reviewers).
-- Security definer because attempts are private to their authors; the function checks
-- the role itself and returns only aggregates (no user ids).

create or replace function public.admin_exercise_analytics(ex text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select public.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'attempts', count(*),
    'users', count(distinct a.user_id),
    'success_rate', case when count(*) = 0 then null
      else round(count(*) filter (where a.score >= 1)::numeric / count(*), 4) end,
    -- Nulls (no timing recorded) are skipped by the aggregate.
    'median_time_ms', percentile_disc(0.5) within group (order by a.time_ms),
    'mean_hints', case when count(*) = 0 then null else round(avg(a.hints_used), 2) end,
    'wrong', coalesce((
      select jsonb_agg(jsonb_build_object('answer', w.answer, 'count', w.n) order by w.n desc, w.answer::text)
      from (
        -- Typed answers are compared trimmed, lower-case and with single spaces, so
        -- " 6 " and "6" count as one; revealed solutions aren't answers at all.
        select x.answer, count(*) as n
        from (
          select case
            when b.answer->>'kind' in ('text', 'choice') then jsonb_build_object(
              'kind', b.answer->>'kind',
              'value', lower(regexp_replace(btrim(b.answer->>'value'), '\s+', ' ', 'g')))
            else b.answer
          end as answer
          from public.exercise_attempts b
          where b.exercise_id = ex and b.score < 1 and not (b.answer ? 'revealed')
        ) x
        group by x.answer
        order by count(*) desc, x.answer::text
        limit 10
      ) w
    ), '[]'::jsonb)
  )
  into result
  from public.exercise_attempts a
  where a.exercise_id = ex;
  return result;
end;
$$;

revoke all on function public.admin_exercise_analytics(text) from public, anon;
grant execute on function public.admin_exercise_analytics(text) to authenticated;
