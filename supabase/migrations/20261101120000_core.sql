-- Core: extensions, enums, shared helpers, roles.
-- Conventions for every later migration:
--   * RLS is enabled on every table (enforced by supabase/tests/rls.test.ts).
--   * Policies call (select auth.uid()) so Postgres evaluates it once per query.
--   * "Server-written" tables have no insert/update policy for users: scores, XP and
--     entitlements are written only by server code with the secret key (CLAUDE.md:
--     grading is server-side).

create extension if not exists citext with schema extensions;

create type public.lesson_status as enum ('not_started', 'in_progress', 'completed', 'mastered');
create type public.grader as enum ('auto', 'ai', 'self');
create type public.attempt_source as enum ('app', 'anonymous_import');
create type public.app_role as enum ('admin', 'moderator', 'reviewer');
create type public.plan as enum ('free', 'pro');
create type public.moderation_status as enum ('pending', 'approved', 'rejected', 'hidden');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Roles ---------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- security definer: policies on other tables call these without needing read access
-- to user_roles themselves. search_path is pinned to avoid hijacking.
create function public.has_role(r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = r
  );
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('admin', 'moderator')
  );
$$;

alter table public.user_roles enable row level security;

create policy "read own roles" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role('admin')));
-- No write policies: roles are granted by admins through server code (Phase 18).
