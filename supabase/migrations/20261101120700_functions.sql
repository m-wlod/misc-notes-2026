-- RODO/GDPR data export: everything the caller owns, as one JSON document.
-- security invoker: runs with the caller's rights, so RLS limits it to their own rows
-- (and it returns nothing for anonymous callers).

create function public.export_my_data()
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
    'roles', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_roles t where t.user_id = (select auth.uid())), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;

revoke execute on function public.export_my_data() from anon;
grant execute on function public.export_my_data() to authenticated;
