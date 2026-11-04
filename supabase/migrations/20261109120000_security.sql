-- Phase 21a: security review.
--
-- 1. Staff write only through server code. Every moderation and admin action checks the
--    role against the access map (src/features/admin/access.ts) and writes an audit row,
--    then writes with the secret key. These policies let a moderator change the same
--    rows directly through the API with the publishable key, skipping both: the role
--    split (announcements are admin-only in the app) and the audit log. Reading stays.
drop policy "staff moderate submissions" on public.challenge_submissions;
drop policy "staff moderate comments" on public.comments;
drop policy "staff moderate solutions" on public.shared_solutions;
drop policy "queue: staff resolve" on public.reports;
drop policy "queue: staff resolve" on public.content_error_reports;
drop policy "queue: staff resolve" on public.debunk_submissions;
drop policy "disputes: staff resolve" on public.grading_disputes;
drop policy "staff manage announcements" on public.announcements;
-- Admins too: flags change through `saveFlag`, which audits (Phase 18c).
drop policy "admins manage flags" on public.feature_flags;

-- 2. The day's AI-grading spend from the usage log: the budget kill-switch reads it, so
--    it holds across server instances even without the shared KV store.
create function public.ai_spend_since(since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0) from public.ai_grading_usage where created_at >= since;
$$;
revoke execute on function public.ai_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_spend_since(timestamptz) to service_role;
