-- Platform: AI cost tracking, flags, audit, announcements, newsletter.

create table public.ai_grading_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  tokens_in integer not null check (tokens_in >= 0),
  tokens_out integer not null check (tokens_out >= 0),
  cost_usd numeric(10, 6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index ai_grading_usage_user_idx on public.ai_grading_usage (user_id, created_at desc);
create index ai_grading_usage_day_idx on public.ai_grading_usage (created_at);

alter table public.ai_grading_usage enable row level security;
create policy "own ai usage: read" on public.ai_grading_usage
  for select to authenticated using (user_id = (select auth.uid()));

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_.-]{2,60}$'),
  enabled boolean not null default false,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  description text,
  updated_at timestamptz not null default now()
);
create trigger feature_flags_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
create policy "flags are public" on public.feature_flags
  for select to anon, authenticated using (true);
create policy "admins manage flags" on public.feature_flags
  for all to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Written only by server code; readable only by admins. Never editable.
alter table public.audit_log enable row level security;
create policy "admins read audit log" on public.audit_log
  for select to authenticated using ((select public.has_role('admin')));

create table public.announcements (
  id bigint generated always as identity primary key,
  body_pl text not null check (char_length(body_pl) between 1 and 500),
  body_en text not null check (char_length(body_en) between 1 and 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_created_by_idx on public.announcements (created_by);

alter table public.announcements enable row level security;
create policy "current announcements are public" on public.announcements
  for select to anon, authenticated
  using (starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "staff manage announcements" on public.announcements
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Newsletter (Phase 19, double opt-in). No user access at all: emails here may belong
-- to people without accounts, so only server code touches this table.
create table public.newsletter_subscribers (
  id bigint generated always as identity primary key,
  email extensions.citext not null unique,
  locale text not null default 'pl' check (locale in ('pl', 'en')),
  confirm_token uuid not null default gen_random_uuid(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
-- Intentionally no policies: deny all to anon/authenticated (see SERVER_ONLY in rls tests).
