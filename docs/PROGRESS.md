# PROGRESS

Living log. Update at the end of every phase: what's done, decisions, open questions, `TODO(verify)`.

## Phase checklist

- [ ] 0 — Repo bootstrap and tooling
- [ ] 1 — Design system and brand foundations **[you: sign-off]**
- [ ] 2 — i18n, routing and app shell
- [ ] 3 — Auth, profiles and database schema
- [ ] 4 — Content engine (MDX textbook)
- [ ] 5 — Curriculum map and learning path
- [ ] 6 — Lesson reader UX
- [ ] 7 — Content pipeline and first real content **[you]**
- [ ] 8 — Exercise engine core
- [ ] 9 — Auto-grading and randomized variants
- [ ] 10 — AI grading for open questions
- [ ] 11 — Interview mode
- [ ] 12 — Interactive simulation library
- [ ] 13 — Python lab
- [ ] 14 — Gamification I: XP, streaks, leagues
- [ ] 15 — Gamification II: review, challenges, certificates, notifications
- [ ] 16 — Debunk Lab **[you: review]**
- [ ] 17 — Community
- [ ] 18 — Admin panel
- [ ] 19 — Social funnel, landing and SEO
- [ ] 20 — Quality, accessibility and performance
- [ ] 21 — Security and privacy (RODO/GDPR) **[you: legal review]**
- [ ] 22 — Observability and learning analytics
- [ ] 23 — Production launch **[you]**

Review sessions due after phases 1, 4, 8, 12, 19.

## Environment (checked 2026-11-01)

| Tool | Status |
| --- | --- |
| git 2.53, Node 24.19, npm 11.17, Python 3.12, Docker 29.4, gh 2.91, Vercel CLI 54.6 | present |
| pnpm 12.16.1 | installed via corepack (user-level shims) |
| Supabase CLI | **missing**: add as a dev dependency (`pnpm add -D supabase`) in Phase 0; local stack needs Docker running |

## External accounts and secrets

| Service | Needed by | Env vars |
| --- | --- | --- |
| GitHub repo | Phase 0 (CI) | none |
| Vercel (linked to repo) | Phase 0 | `NEXT_PUBLIC_SITE_URL` |
| Supabase (EU, Frankfurt): dev now, separate prod project in Phase 23 | Phase 3 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Google OAuth client | Phase 3 | configured in Supabase dashboard |
| GitHub OAuth app | Phase 3 | configured in Supabase dashboard |
| Anthropic API | Phase 10 | `ANTHROPIC_API_KEY`, `AI_GRADER_MODEL`, `AI_DAILY_BUDGET_USD`, `AI_USER_DAILY_QUOTA` |
| Upstash Redis | Phase 10 | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Resend (+ verified sending domain) | Phase 3 (magic-link SMTP) / Phase 15 | `RESEND_API_KEY`, `EMAIL_FROM` |
| Web push (VAPID keys, self-generated) | Phase 15 | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Cron auth | Phase 14 | `CRON_SECRET` |
| PostHog EU | Phase 22 (consent wiring earlier) | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Sentry | Phase 22 | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| Turnstile or Vercel BotID | Phase 21 | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (if Turnstile) |
| Domain + Discord server | Phase 23 | none |

## Open questions (answer before the phase that needs them)

1. **Undecided defaults for choices the plan leaves open.** Velite (not Content Collections), Pagefind (not Orama), a Vitest suite with two test users for RLS (not pgTAP), Vercel Cron (not Supabase cron), ts-fsrs, MathLive. These apply unless you object before the phase that needs them.
2. **Anonymous progress (Phase 3).** Kept in localStorage as planned, not Supabase anonymous sign-in. This applies unless you object.
3. **App name** (`APP_NAME`) and the **domain**. You will buy the domain soon. It unblocks Resend SMTP and Google sign-in branding, and both are needed by Phase 19 and Phase 23.
4. **Minor wording.** The lazy-load rule mentions "Monaco-class editors"; read it as "any code editor" (we use CodeMirror 6). Quant Guild / Roman Paolucci is a tone reference only.

## Decisions log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-01 | Repo at `C:\projects\quant-learning-app`, branch `main` | Kickoff |
| 2026-11-01 | All graded exercises graded server-side, incl. signed-out users (IP rate limit, attempts kept in localStorage). Only ungraded inline "check yourself" questions may grade client-side | Answers must never reach the client before submission; server action latency is fine |
| 2026-11-01 | Add all 15+ missing tables in Phase 3; later phases may amend via new migrations | No schema surprises, not a frozen schema |
| 2026-11-01 | Dev magic links use the Supabase local mail catcher; Resend as custom SMTP is a [you] step once the domain is verified | Resend only sends from a verified domain |
| 2026-11-01 | Next.js 16 `proxy.ts` replaces `middleware.ts` (Phases 2, 18); proxy only redirects, authorization is in RLS and server code | Follow Next.js 16; defence in depth |
| 2026-11-01 | One shared league until ~60 weekly actives (config value), then auto-split into groups of ~30 | Cold start at launch |
| 2026-11-01 | Phases 4–6 use one clearly labelled sample lesson. Phase 7 drafts Fundamenty and Wartość oczekiwana from own knowledge as `status: draft`; modules 4+ wait for `content/_inbox/` notes | No fake content; those two modules are standard material |
| 2026-11-01 | pnpm 12.16.1 via corepack, shims in `%APPDATA%\npm` (`corepack enable pnpm --install-directory`) | Default `corepack enable` needs admin to write into `C:\Program Files\nodejs` |
| 2026-11-01 | Supabase CLI installed as a dev dependency in Phase 0, right after the Next.js scaffold | Needs a package.json; create-next-app refuses a folder that already has one |

## New dependencies

(Log each with a one-line reason.)

## TODO(verify)

(none yet)
