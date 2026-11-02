-- Local development seed. Runs after migrations on `pnpm db:reset`.
-- Catalog data only. Users are created by tests (supabase/tests) or by signing in
-- locally with a magic link (Mailpit, http://127.0.0.1:54324). Never put production data here.

-- Leagues and achievements come from the catalog migration (Phase 14).

insert into public.feature_flags (key, enabled, description) values
  ('placement-quiz', true, 'Optional placement quiz after onboarding');
