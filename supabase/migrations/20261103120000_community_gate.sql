-- Community rules in the database (Phase 17): the spoiler gate on exercise discussions
-- and shared solutions, bans that block every way of posting, public vote totals and
-- reputation without exposing who voted.

-- The spoiler gate ------------------------------------------------------------------
-- An exercise's discussion opens for a learner who solved it in the app (graded on the
-- server) or revealed its solution. Attempts imported from a signed-out browser don't
-- count: their scores came from the browser.
create function public.discussion_unlocked(exercise_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_attempts a
    where a.user_id = (select auth.uid())
      and a.exercise_id = discussion_unlocked.exercise_id
      and a.source = 'app'
      and (a.score >= 1 or a.answer ->> 'revealed' = 'true')
  );
$$;
grant execute on function public.discussion_unlocked(text) to authenticated;

drop policy "approved comments are public" on public.comments;
create policy "approved comments are public (exercises after solving)" on public.comments
  for select to anon, authenticated
  using (
    (status = 'approved'
      and (target_type <> 'exercise' or (select public.discussion_unlocked(target_id))))
    or user_id = (select auth.uid())
    or (select public.is_staff())
  );

drop policy "own solutions: read" on public.shared_solutions;
create policy "solutions: own, staff, or after solving" on public.shared_solutions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_staff())
    or (status = 'approved' and (select public.discussion_unlocked(exercise_id)))
  );

-- Bans -----------------------------------------------------------------------------
create table public.bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz,
  reason text not null check (char_length(reason) between 1 and 500),
  banned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index bans_banned_by_idx on public.bans (banned_by);

-- Written only by server code (audited); staff can read it.
alter table public.bans enable row level security;
create policy "staff read bans" on public.bans
  for select to authenticated using ((select public.is_staff()));

create function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bans b
    where b.user_id = (select auth.uid()) and (b.until is null or b.until > now())
  );
$$;
grant execute on function public.is_banned() to authenticated;

drop policy "own comments: insert" on public.comments;
create policy "own comments: insert" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'approved' and not (select public.is_banned())
    and (target_type <> 'exercise' or (select public.discussion_unlocked(target_id)))
  );

drop policy "own solutions: insert" on public.shared_solutions;
create policy "own solutions: insert" on public.shared_solutions
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'approved' and not mentor_pick
    and not (select public.is_banned())
    and (select public.discussion_unlocked(exercise_id))
  );

drop policy "own votes: insert" on public.votes;
create policy "own votes: insert" on public.votes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()));

drop policy "queue: submit" on public.reports;
create policy "queue: submit" on public.reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and not (select public.is_banned()));

-- Vote totals and reputation --------------------------------------------------------
-- Votes stay private (own rows only); these return sums, never voters.
create function public.vote_totals(target_type text, ids bigint[])
returns table (target_id bigint, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.target_id, coalesce(sum(v.value), 0)::bigint
  from public.votes v
  where v.target_type = vote_totals.target_type and v.target_id = any (vote_totals.ids)
  group by v.target_id;
$$;
grant execute on function public.vote_totals(text, bigint[]) to anon, authenticated;

-- Upvotes received on approved comments and solutions, plus 10 per accepted correction.
create function public.reputation(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(v.value) from public.votes v
      join public.comments c on v.target_type = 'comment' and v.target_id = c.id
      where c.user_id = reputation.uid and c.status = 'approved'
    ), 0)
    + coalesce((
      select sum(v.value) from public.votes v
      join public.shared_solutions s on v.target_type = 'solution' and v.target_id = s.id
      where s.user_id = reputation.uid and s.status = 'approved'
    ), 0)
    + 10 * (
      select count(*) from public.content_error_reports r
      where r.user_id = reputation.uid and r.status = 'approved'
    )
  )::integer;
$$;
grant execute on function public.reputation(uuid) to anon, authenticated;

-- Authors edit only their live posts: a hidden or held comment stays as the moderator
-- left it (the old policy let an author set a hidden comment back to approved).
drop policy "own comments: edit" on public.comments;
create policy "own comments: edit" on public.comments
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'approved')
  with check (user_id = (select auth.uid()) and status = 'approved' and not (select public.is_banned()));
