-- Learning: progress, attempts, spaced repetition, notes, notebooks.

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 120),
  status public.lesson_status not null default 'in_progress',
  last_position jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();

alter table public.lesson_progress enable row level security;
create policy "own lesson progress: read" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own lesson progress: insert" on public.lesson_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own lesson progress: update" on public.lesson_progress
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own lesson progress: delete" on public.lesson_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- Attempts carry scores, so only server code writes them (grading is server-side).
create table public.exercise_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) <= 120),
  variant_seed bigint,
  answer jsonb not null,
  score numeric(5, 4) not null check (score between 0 and 1),
  grader public.grader not null,
  feedback jsonb,
  hints_used smallint not null default 0 check (hints_used >= 0),
  time_ms integer check (time_ms >= 0),
  source public.attempt_source not null default 'app',
  -- Lets the anonymous-progress merge be idempotent (same local attempt imported once).
  client_attempt_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, client_attempt_id)
);
create index exercise_attempts_user_idx on public.exercise_attempts (user_id, created_at desc);
create index exercise_attempts_exercise_idx on public.exercise_attempts (exercise_id);

alter table public.exercise_attempts enable row level security;
create policy "own attempts: read" on public.exercise_attempts
  for select to authenticated using (user_id = (select auth.uid()));

-- Aggregates per exercise (nightly calibration job, Phase 9). Public, server-written.
create table public.exercise_stats (
  exercise_id text primary key,
  attempts integer not null default 0,
  success_rate numeric(5, 4) check (success_rate between 0 and 1),
  median_time_ms integer,
  updated_at timestamptz not null default now()
);
alter table public.exercise_stats enable row level security;
create policy "exercise stats are public" on public.exercise_stats
  for select to anon, authenticated using (true);

-- FSRS spaced-repetition state (Phase 15). Scheduling has no XP value, so users own it.
create table public.review_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null check (char_length(card_id) <= 160),
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0 check (state between 0 and 3),
  last_review timestamptz,
  primary key (user_id, card_id)
);
create index review_cards_due_idx on public.review_cards (user_id, due);

create table public.lesson_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 120),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lesson_notes_user_idx on public.lesson_notes (user_id, lesson_id);
create trigger lesson_notes_updated_at before update on public.lesson_notes
  for each row execute function public.set_updated_at();

create table public.highlights (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 120),
  anchor jsonb not null,
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index highlights_user_idx on public.highlights (user_id, lesson_id);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 120),
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Notatnik' check (char_length(title) between 1 and 120),
  cells jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notebooks_user_idx on public.notebooks (user_id);
create trigger notebooks_updated_at before update on public.notebooks
  for each row execute function public.set_updated_at();

-- Same four "own rows" policies for every user-owned table above.
do $$
declare
  t text;
begin
  foreach t in array array['review_cards', 'lesson_notes', 'highlights', 'bookmarks', 'notebooks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows: read" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;
