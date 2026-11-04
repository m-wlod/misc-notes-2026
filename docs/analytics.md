# Product analytics (Phase 22b)

PostHog, EU cloud (`https://eu.i.posthog.com`). It loads only when `NEXT_PUBLIC_POSTHOG_KEY` is set **and** the visitor has allowed analytics (cookie settings or the banner).

- **Tracking:** no cookies (localStorage), no autocapture, no session recording, no surveys.
- **Identity:** signed-in users are identified by their account id only.
- **The event list:** `src/features/analytics/events.ts`, the only events and properties the app sends. A unit test keeps personal fields out.

## Events

| Event                   | Properties                                                                                                           | Sent when                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `$pageview`             | URL                                                                                                                  | every route change                                        |
| `exercise_attempted`    | `exercise_id`, `level`, `result` (correct/partial/wrong), `context` (landing, video, practice, lesson, daily, other) | an answer is graded                                       |
| `lesson_completed`      | `lesson_id`                                                                                                          | "Oznacz jako zrozumiane"                                  |
| `signed_up`             | `goal`, `level`                                                                                                      | onboarding saved (a new account)                          |
| `video_landing_viewed`  | `slug` (+ PostHog's automatic `utm_*`)                                                                               | a `/v/<slug>` page is shown                               |
| `newsletter_subscribed` | `place` (landing, footer, links)                                                                                     | the "check your inbox" answer                             |
| `feature_used`          | `feature` (simulation, notebook, interview, debunk_checker), `id`                                                    | first play, a cell run, a session start, a checker change |

## Insights to create in PostHog

1. **Activation funnel** (Funnel, conversion window 14 days, by person). The steps:
   1. `$pageview`;
   2. `exercise_attempted` where `context` in (landing, video);
   3. `signed_up`;
   4. `$pageview` 7 days or more after `signed_up` (a "day-7 return"). Use a second funnel or Retention 3 below for the exact cohort.
2. **Video landing conversion by source** (Funnel, breakdown by `utm_source`). The steps:
   1. `video_landing_viewed`;
   2. `exercise_attempted` where `context` = video;
   3. `signed_up`.
3. **Retention** (Retention, weekly cohorts): start event `signed_up`, return event `$pageview`. Day-7 return is the week 1 value. A daily view is useful in the first month.
4. **Feature usage** (Trends, weekly, unique users): `feature_used` with breakdown by `feature`, plus `lesson_completed` and `exercise_attempted`.
5. **Exercise results** (Trends): `exercise_attempted` with breakdown by `result`, filtered by `level`. This complements Admin → Nauka (22c), which reads the database, not analytics.

## Launch check **[you]**

1. On a Vercel **preview**, set `NEXT_PUBLIC_POSTHOG_KEY` (the project's key; EU host by default) and redeploy.
2. Open the preview. The consent banner appears: choose "Zgadzam się na analitykę".
3. Click through the funnel:
   1. open the landing;
   2. solve the sample exercise;
   3. open `/v/<slug>?utm_source=test`;
   4. sign up and finish onboarding;
   5. complete a lesson.
4. In PostHog, **Activity** shows the events within a minute. Create the insights above; funnels 1 and 2 show the run.
5. Withdraw consent on `/cookies`: no further events arrive.
