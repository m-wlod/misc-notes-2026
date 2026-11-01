-- Interview simulator (Phase 11). Scored, so server-written; users read their own.

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('brainteasers', 'probability_sprint', 'mental_math', 'market_making', 'open_modelling')),
  level smallint not null check (level between 1 and 5),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score numeric(6, 4),
  summary jsonb
);
create index interview_sessions_user_idx on public.interview_sessions (user_id, started_at desc);

create table public.interview_answers (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  score numeric(5, 4) check (score between 0 and 1),
  feedback jsonb,
  created_at timestamptz not null default now()
);
create index interview_answers_session_idx on public.interview_answers (session_id);
create index interview_answers_user_idx on public.interview_answers (user_id);

alter table public.interview_sessions enable row level security;
create policy "own sessions: read" on public.interview_sessions
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.interview_answers enable row level security;
create policy "own answers: read" on public.interview_answers
  for select to authenticated using (user_id = (select auth.uid()));
