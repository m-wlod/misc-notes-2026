-- Phase 21b: data retention. Applied once a day by /api/cron/retention (secret key only).
-- The policy, also stated in the privacy policy:
--   open-answer text of AI-graded attempts   redacted after 365 days (the score stays;
--                                            not while a grading dispute is open)
--   AI usage log                             13 months
--   notifications                            read: 90 days; unread: 1 year
--   job run log                              90 days
--   staff audit log                          2 years
--   newsletter                               unconfirmed: 7 days; unsubscribed: 30 days
--   bans                                     1 year after they ended
-- Account data stays until the account is deleted (cascade, Phase 3).

create function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  redacted int;
  usage int;
  notes int;
  runs int;
  audits int;
  unconfirmed int;
  unsubscribed int;
  old_bans int;
begin
  update public.exercise_attempts a
     set answer = jsonb_build_object('kind', 'text', 'redacted', true)
   where a.grader = 'ai'
     and a.created_at < now() - interval '365 days'
     and not (a.answer ? 'redacted')
     and not exists (
       select 1 from public.grading_disputes d where d.attempt_id = a.id and d.status = 'pending'
     );
  get diagnostics redacted = row_count;

  delete from public.ai_grading_usage where created_at < now() - interval '13 months';
  get diagnostics usage = row_count;

  delete from public.notifications
   where (read_at is not null and created_at < now() - interval '90 days')
      or created_at < now() - interval '1 year';
  get diagnostics notes = row_count;

  delete from public.cron_runs where started_at < now() - interval '90 days';
  get diagnostics runs = row_count;

  delete from public.audit_log where created_at < now() - interval '2 years';
  get diagnostics audits = row_count;

  delete from public.newsletter_subscribers
   where confirmed_at is null and unsubscribed_at is null
     and created_at < now() - interval '7 days';
  get diagnostics unconfirmed = row_count;

  delete from public.newsletter_subscribers
   where unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days';
  get diagnostics unsubscribed = row_count;

  delete from public.bans where until is not null and until < now() - interval '1 year';
  get diagnostics old_bans = row_count;

  return jsonb_build_object(
    'redactedAnswers', redacted,
    'aiUsage', usage,
    'notifications', notes,
    'cronRuns', runs,
    'auditLog', audits,
    'newsletterUnconfirmed', unconfirmed,
    'newsletterUnsubscribed', unsubscribed,
    'bans', old_bans
  );
end;
$$;
revoke execute on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;

alter table public.cron_runs drop constraint cron_runs_job_check;
alter table public.cron_runs
  add constraint cron_runs_job_check
  check (job in ('leagues', 'calibrate', 'notify', 'newsletter', 'retention'));

-- Deleting an account also removes a newsletter subscription with the same address
-- (subscribers aren't linked to accounts, so the cascade doesn't reach them).
create function public.forget_newsletter_on_account_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.newsletter_subscribers where lower(email) = lower(old.email);
  return old;
end;
$$;
revoke execute on function public.forget_newsletter_on_account_delete() from public, anon, authenticated;
create trigger forget_newsletter_on_account_delete
  after delete on auth.users
  for each row execute function public.forget_newsletter_on_account_delete();

-- Data export covers every table that holds the user's data (RODO art. 15/20). A ban
-- was the one missing: users may now read their own ban (and its reason) too.
create policy "read own ban" on public.bans
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', (select auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'entitlements', coalesce((select jsonb_agg(to_jsonb(t)) from public.entitlements t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'streak', (select to_jsonb(t) from public.streaks t where t.user_id = (select auth.uid())),
    'lesson_progress', coalesce((select jsonb_agg(to_jsonb(t)) from public.lesson_progress t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'exercise_attempts', coalesce((select jsonb_agg(to_jsonb(t)) from public.exercise_attempts t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'review_cards', coalesce((select jsonb_agg(to_jsonb(t)) from public.review_cards t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'lesson_notes', coalesce((select jsonb_agg(to_jsonb(t)) from public.lesson_notes t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'highlights', coalesce((select jsonb_agg(to_jsonb(t)) from public.highlights t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'bookmarks', coalesce((select jsonb_agg(to_jsonb(t)) from public.bookmarks t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'notebooks', coalesce((select jsonb_agg(to_jsonb(t)) from public.notebooks t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(t)) from public.xp_events t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_achievements t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'league_memberships', coalesce((select jsonb_agg(to_jsonb(t)) from public.league_memberships t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'topic_ratings', coalesce((select jsonb_agg(to_jsonb(t)) from public.topic_ratings t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(to_jsonb(t)) from public.certificates t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'challenge_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.challenge_submissions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'interview_sessions', coalesce((select jsonb_agg(to_jsonb(t)) from public.interview_sessions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'interview_answers', coalesce((select jsonb_agg(to_jsonb(t)) from public.interview_answers t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(t)) from public.comments t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'votes', coalesce((select jsonb_agg(to_jsonb(t)) from public.votes t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(t)) from public.reports t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(t)) from public.notifications t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'notification_prefs', (select to_jsonb(t) from public.notification_prefs t where t.user_id = (select auth.uid())),
    'push_subscriptions', coalesce((select jsonb_agg(to_jsonb(t) - 'auth' - 'p256dh') from public.push_subscriptions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'shared_solutions', coalesce((select jsonb_agg(to_jsonb(t)) from public.shared_solutions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'content_error_reports', coalesce((select jsonb_agg(to_jsonb(t)) from public.content_error_reports t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'debunk_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.debunk_submissions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'grading_disputes', coalesce((select jsonb_agg(to_jsonb(t)) from public.grading_disputes t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'ai_grading_usage', coalesce((select jsonb_agg(to_jsonb(t)) from public.ai_grading_usage t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_roles t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'bans', coalesce((select jsonb_agg(to_jsonb(t)) from public.bans t where t.user_id = (select auth.uid())), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;
