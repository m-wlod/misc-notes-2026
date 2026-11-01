-- Community (Phase 17), notifications (Phase 15), moderation queues (Phase 18).
-- Author columns on public content use ON DELETE SET NULL: deleting an account keeps the
-- discussion readable but anonymises it (RODO choice documented in the plan).

create table public.comments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('lesson', 'exercise', 'debunk')),
  target_id text not null check (char_length(target_id) <= 120),
  parent_id bigint references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  status public.moderation_status not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_target_idx on public.comments (target_type, target_id, created_at);
create index comments_user_idx on public.comments (user_id);
create index comments_parent_idx on public.comments (parent_id);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

create table public.votes (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'solution')),
  target_id bigint not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('comment', 'solution', 'profile')),
  target_id text not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  status public.moderation_status not null default 'pending',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_user_idx on public.reports (user_id);
create index reports_status_idx on public.reports (status, created_at);
create index reports_resolved_by_idx on public.reports (resolved_by);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) <= 60),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_streak boolean not null default true,
  email_weekly boolean not null default true,
  email_league boolean not null default true,
  push_enabled boolean not null default false,
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now()
);
create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Shared solutions are readable only by the author and staff for now; Phase 17 adds the
-- spoiler-gated read policy ("only after you solved it"), enforced in the database.
create table public.shared_solutions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  exercise_id text not null check (char_length(exercise_id) <= 120),
  body text not null check (char_length(body) between 1 and 20000),
  format text not null check (format in ('text', 'math', 'code')),
  status public.moderation_status not null default 'approved',
  mentor_pick boolean not null default false,
  created_at timestamptz not null default now()
);
create index shared_solutions_exercise_idx on public.shared_solutions (exercise_id);
create index shared_solutions_user_idx on public.shared_solutions (user_id);

create table public.content_error_reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  content_type text not null check (content_type in ('lesson', 'exercise', 'debunk', 'glossary')),
  content_id text not null check (char_length(content_id) <= 120),
  body text not null check (char_length(body) between 1 and 5000),
  status public.moderation_status not null default 'pending',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index content_error_reports_user_idx on public.content_error_reports (user_id);
create index content_error_reports_resolved_by_idx on public.content_error_reports (resolved_by);

create table public.debunk_submissions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  claim text not null check (char_length(claim) between 1 and 2000),
  source_url text check (source_url ~ '^https?://'),
  status public.moderation_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index debunk_submissions_user_idx on public.debunk_submissions (user_id);
create index debunk_submissions_reviewed_by_idx on public.debunk_submissions (reviewed_by);

create table public.grading_disputes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id bigint not null references public.exercise_attempts (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 2000),
  status public.moderation_status not null default 'pending',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index grading_disputes_user_idx on public.grading_disputes (user_id);
create index grading_disputes_attempt_idx on public.grading_disputes (attempt_id);
create index grading_disputes_resolved_by_idx on public.grading_disputes (resolved_by);

-- RLS -----------------------------------------------------------------------

alter table public.comments enable row level security;
create policy "approved comments are public" on public.comments
  for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_staff()));
create policy "own comments: insert" on public.comments
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'approved');
create policy "own comments: edit" on public.comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'approved');
create policy "own comments: delete" on public.comments
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "staff moderate comments" on public.comments
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.votes enable row level security;
create policy "own votes: read" on public.votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own votes: insert" on public.votes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own votes: update" on public.votes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own votes: delete" on public.votes
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.notifications enable row level security;
create policy "own notifications: read" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own notifications: mark read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own notifications: delete" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.notification_prefs enable row level security;
create policy "own prefs: read" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own prefs: insert" on public.notification_prefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own prefs: update" on public.notification_prefs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.push_subscriptions enable row level security;
create policy "own push: read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own push: insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own push: delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.shared_solutions enable row level security;
create policy "own solutions: read" on public.shared_solutions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "own solutions: insert" on public.shared_solutions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'approved' and not mentor_pick);
create policy "own solutions: delete" on public.shared_solutions
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "staff moderate solutions" on public.shared_solutions
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Moderation queues: reporters create and read their own; staff read and resolve all.
do $$
declare
  t text;
begin
  foreach t in array array['reports', 'content_error_reports', 'debunk_submissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "queue: read own or staff" on public.%I for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()))', t);
    execute format(
      'create policy "queue: submit" on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and status = ''pending'')', t);
    execute format(
      'create policy "queue: staff resolve" on public.%I for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
  end loop;
end;
$$;

alter table public.grading_disputes enable row level security;
create policy "disputes: read own or staff" on public.grading_disputes
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "disputes: open on own attempt" on public.grading_disputes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.exercise_attempts a
      where a.id = attempt_id and a.user_id = (select auth.uid())
    )
  );
create policy "disputes: staff resolve" on public.grading_disputes
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
