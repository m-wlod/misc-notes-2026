-- Gamification (Phases 14–15 build the logic). Scores and rewards are server-written.

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount between -10000 and 10000),
  reason text not null check (char_length(reason) <= 60),
  ref text check (char_length(ref) <= 160),
  idempotency_key text not null unique check (char_length(idempotency_key) <= 200),
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

create table public.achievements (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name_pl text not null,
  name_en text not null,
  description_pl text not null,
  description_en text not null,
  sort smallint not null default 0
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create index user_achievements_achievement_idx on public.user_achievements (achievement_id);

create table public.leagues (
  id smallint primary key,
  slug text not null unique,
  name_pl text not null,
  name_en text not null,
  tier smallint not null unique
);

-- Weekly membership. Members of a league see each other's weekly XP (that's the game);
-- users who opted out (profiles.league_opt_out) are never inserted.
create table public.league_memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id smallint not null references public.leagues (id),
  group_no integer not null default 1,
  week_start date not null,
  weekly_xp integer not null default 0,
  final_rank integer,
  primary key (user_id, week_start)
);
create index league_memberships_group_idx on public.league_memberships (week_start, league_id, group_no);

create table public.topic_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null check (char_length(topic) <= 80),
  rating double precision not null default 1000,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null,
  score numeric(5, 4) check (score between 0 and 1),
  issued_at timestamptz not null default now()
);
create index certificates_user_idx on public.certificates (user_id);

create table public.daily_problems (
  day date not null,
  level smallint not null check (level between 1 and 5),
  exercise_id text not null,
  primary key (day, level)
);

create table public.challenge_submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id text not null check (char_length(challenge_id) <= 120),
  body text not null check (char_length(body) between 1 and 20000),
  status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index challenge_submissions_user_idx on public.challenge_submissions (user_id);

-- RLS -----------------------------------------------------------------------

alter table public.xp_events enable row level security;
create policy "own xp: read" on public.xp_events
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.achievements enable row level security;
create policy "achievements are public" on public.achievements
  for select to anon, authenticated using (true);

alter table public.user_achievements enable row level security;
create policy "own achievements: read" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.leagues enable row level security;
create policy "leagues are public" on public.leagues
  for select to anon, authenticated using (true);

-- A policy that queried league_memberships directly would recurse into its own RLS,
-- so the "am I in this group?" lookup is a security-definer helper.
create function public.in_my_league_group(w date, l smallint, g integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_memberships
    where user_id = (select auth.uid()) and week_start = w and league_id = l and group_no = g
  );
$$;

alter table public.league_memberships enable row level security;
create policy "league members see their group" on public.league_memberships
  for select to authenticated
  using ((select public.in_my_league_group(week_start, league_id, group_no)));

alter table public.topic_ratings enable row level security;
create policy "own ratings: read" on public.topic_ratings
  for select to authenticated using (user_id = (select auth.uid()));

-- Certificates are verified publicly through verify_certificate(id), not by listing the table.
alter table public.certificates enable row level security;
create policy "own certificates: read" on public.certificates
  for select to authenticated using (user_id = (select auth.uid()));

create function public.verify_certificate(certificate_id uuid)
returns table (track_id text, issued_at timestamptz, handle text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.track_id, c.issued_at, p.handle::text, p.display_name
  from public.certificates c
  join public.profiles p on p.id = c.user_id
  where c.id = certificate_id;
$$;
grant execute on function public.verify_certificate(uuid) to anon, authenticated;

alter table public.daily_problems enable row level security;
create policy "daily problems are public" on public.daily_problems
  for select to anon, authenticated using (true);

alter table public.challenge_submissions enable row level security;
create policy "own submissions: read" on public.challenge_submissions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "own submissions: insert" on public.challenge_submissions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "staff moderate submissions" on public.challenge_submissions
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
