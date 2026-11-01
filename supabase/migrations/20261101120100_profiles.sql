-- Profiles, entitlements, streaks + the signup trigger that creates them.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle extensions.citext not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) between 1 and 60),
  locale text not null default 'pl' check (locale in ('pl', 'en')),
  avatar_url text check (avatar_url ~ '^https://'),
  goal text check (goal in ('trading', 'interviews', 'university', 'curiosity')),
  self_level smallint check (self_level between 1 and 5),
  placement_level smallint check (placement_level between 1 and 5),
  daily_goal_minutes smallint not null default 10 check (daily_goal_minutes in (5, 10, 20)),
  timezone text not null default 'Europe/Warsaw' check (char_length(timezone) <= 64),
  is_public boolean not null default false,
  league_opt_out boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- No insert/delete policies: the signup trigger creates the row, account deletion cascades.

-- Public profiles: only safe columns, only for users who opted in. A plain (definer)
-- view on purpose, so anonymous visitors can read it without access to `profiles`.
create view public.public_profiles
with (security_invoker = false)
as
  select id, handle, display_name, avatar_url, placement_level, created_at
  from public.profiles
  where is_public;

grant select on public.public_profiles to anon, authenticated;

-- Entitlements (paywall hook, see "Later" in the plan). Everyone gets `free`.
create table public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  plan public.plan not null,
  source text not null default 'default',
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, plan)
);

alter table public.entitlements enable row level security;
create policy "read own entitlements" on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));

-- Streaks (Phase 14 fills them in). Server-written.
create table public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_days integer not null default 0 check (current_days >= 0),
  longest_days integer not null default 0 check (longest_days >= 0),
  last_active_date date,
  freezes smallint not null default 0 check (freezes between 0 and 2),
  updated_at timestamptz not null default now()
);

create trigger streaks_updated_at before update on public.streaks
  for each row execute function public.set_updated_at();

alter table public.streaks enable row level security;
create policy "read own streak" on public.streaks
  for select to authenticated using (user_id = (select auth.uid()));

-- Signup trigger ----------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'pl');
begin
  insert into public.profiles (id, handle, locale)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    case when wanted_locale in ('pl', 'en') then wanted_locale else 'pl' end
  );
  insert into public.entitlements (user_id, plan) values (new.id, 'free');
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
