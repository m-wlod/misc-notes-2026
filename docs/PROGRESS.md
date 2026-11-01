# PROGRESS

Living log. Update at the end of every phase: what's done, decisions, open questions, `TODO(verify)`.

## Phase checklist

- [x] 0 — Repo bootstrap and tooling (local Supabase verified: Studio, Mailpit, auth healthy) — 2026-11-01
- [x] 1 — Design system and brand foundations — signed off 2026-11-01 (direction A)
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

Review sessions due after phases 1, 4, 8, 12, 19. **Phases 0–1 reviewed 2026-11-01:** findings and fixes in `docs/reviews/phase-0-1.md`.

## Environment (checked 2026-11-01)

| Tool                                                                                | Status                                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| git 2.53, Node 24.19, npm 11.17, Python 3.12, Docker 29.4, gh 2.91, Vercel CLI 54.6 | present                                                                                                         |
| pnpm 12.16.1                                                                        | installed via corepack (user-level shims)                                                                       |
| Supabase CLI 2.122                                                                  | dev dependency (`pnpm exec supabase`); local stack verified 2026-11-01 (first `db:start` pulls ~7 GB of images) |

## External accounts and secrets

| Service                                                              | Needed by                            | Env vars                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| GitHub repo                                                          | Phase 0 (CI)                         | none                                                                                      |
| Vercel (linked to repo)                                              | Phase 0                              | `NEXT_PUBLIC_SITE_URL`                                                                    |
| Supabase (EU, Frankfurt): dev now, separate prod project in Phase 23 | Phase 3                              | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| Google OAuth client                                                  | Phase 3                              | configured in Supabase dashboard                                                          |
| GitHub OAuth app                                                     | Phase 3                              | configured in Supabase dashboard                                                          |
| Anthropic API                                                        | Phase 10                             | `ANTHROPIC_API_KEY`, `AI_GRADER_MODEL`, `AI_DAILY_BUDGET_USD`, `AI_USER_DAILY_QUOTA`      |
| Upstash Redis                                                        | Phase 10                             | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                      |
| Resend (+ verified sending domain)                                   | Phase 3 (magic-link SMTP) / Phase 15 | `RESEND_API_KEY`, `EMAIL_FROM`                                                            |
| Web push (VAPID keys, self-generated)                                | Phase 15                             | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`                                       |
| Cron auth                                                            | Phase 14                             | `CRON_SECRET`                                                                             |
| PostHog EU                                                           | Phase 22 (consent wiring earlier)    | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                                     |
| Sentry                                                               | Phase 22                             | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                                             |
| Turnstile or Vercel BotID                                            | Phase 21                             | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (if Turnstile)                   |
| Domain + Discord server                                              | Phase 23                             | none                                                                                      |

## Open questions (answer before the phase that needs them)

1. **Undecided defaults for choices the plan leaves open.** Velite (not Content Collections), Pagefind (not Orama), a Vitest suite with two test users for RLS (not pgTAP), Vercel Cron (not Supabase cron), ts-fsrs, MathLive. These apply unless you object before the phase that needs them.
2. **Anonymous progress (Phase 3).** Kept in localStorage as planned, not Supabase anonymous sign-in. This applies unless you object.
3. **App name** (`APP_NAME`) and the **domain**. You will buy the domain soon. It unblocks Resend SMTP and Google sign-in branding, and both are needed by Phase 19 and Phase 23.
4. **Minor wording.** The lazy-load rule mentions "Monaco-class editors"; read it as "any code editor" (we use CodeMirror 6). Quant Guild / Roman Paolucci is a tone reference only.

## Decisions log

| Date       | Decision                                                                                                                                                                               | Why                                                                                                                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-01 | Repo at `C:\projects\quant-learning-app`, branch `main`                                                                                                                                | Kickoff                                                                                                                                                                                                                                                                                                             |
| 2026-11-01 | All graded exercises graded server-side, incl. signed-out users (IP rate limit, attempts kept in localStorage). Only ungraded inline "check yourself" questions may grade client-side  | Answers must never reach the client before submission; server action latency is fine                                                                                                                                                                                                                                |
| 2026-11-01 | Add all 15+ missing tables in Phase 3; later phases may amend via new migrations                                                                                                       | No schema surprises, not a frozen schema                                                                                                                                                                                                                                                                            |
| 2026-11-01 | Dev magic links use the Supabase local mail catcher; Resend as custom SMTP is a [you] step once the domain is verified                                                                 | Resend only sends from a verified domain                                                                                                                                                                                                                                                                            |
| 2026-11-01 | Next.js 16 `proxy.ts` replaces `middleware.ts` (Phases 2, 18); proxy only redirects, authorization is in RLS and server code                                                           | Follow Next.js 16; defence in depth                                                                                                                                                                                                                                                                                 |
| 2026-11-01 | One shared league until ~60 weekly actives (config value), then auto-split into groups of ~30                                                                                          | Cold start at launch                                                                                                                                                                                                                                                                                                |
| 2026-11-01 | Phases 4–6 use one clearly labelled sample lesson. Phase 7 drafts Fundamenty and Wartość oczekiwana from own knowledge as `status: draft`; modules 4+ wait for `content/_inbox/` notes | No fake content; those two modules are standard material                                                                                                                                                                                                                                                            |
| 2026-11-01 | pnpm 12.16.1 via corepack, shims in `%APPDATA%\npm` (`corepack enable pnpm --install-directory`)                                                                                       | Default `corepack enable` needs admin to write into `C:\Program Files\nodejs`                                                                                                                                                                                                                                       |
| 2026-11-01 | Supabase CLI installed as a dev dependency in Phase 0, right after the Next.js scaffold                                                                                                | Needs a package.json; create-next-app refuses a folder that already has one                                                                                                                                                                                                                                         |
| 2026-11-01 | TypeScript pinned to 6.0.3 (latest is 7.0.2)                                                                                                                                           | typescript-eslint 8.72 peer range is `<6.1.0`; revisit when it supports TS 7                                                                                                                                                                                                                                        |
| 2026-11-01 | ESLint pinned to 9.39.x (latest is 10)                                                                                                                                                 | eslint-plugin-react and eslint-plugin-jsx-a11y peer ranges stop at ESLint 9                                                                                                                                                                                                                                         |
| 2026-11-01 | Supabase keys named `PUBLISHABLE_KEY` / `SECRET_KEY`, not `ANON_KEY` / `SERVICE_ROLE_KEY`                                                                                              | Supabase's current API key model; legacy names avoided from day one                                                                                                                                                                                                                                                 |
| 2026-11-01 | Kept create-next-app 16.4 defaults `cacheComponents` and `partialPrefetching` on                                                                                                       | Default for new apps on this Next version; every route so far is static                                                                                                                                                                                                                                             |
| 2026-11-01 | Env vars for later phases are optional in `src/env.schema.ts`; each phase makes its own required                                                                                       | Build must pass without secrets that don't exist yet                                                                                                                                                                                                                                                                |
| 2026-11-01 | Playwright runs against `next start` (production build) on port 3100, desktop + Pixel 7 projects                                                                                       | Test what ships; avoid clashing with `pnpm dev` on 3000                                                                                                                                                                                                                                                             |
| 2026-11-01 | `vercel.json` sets `framework: nextjs`; `engines.node` is `24.x` (was `>=24`)                                                                                                          | First preview deploy failed: the Vercel project had preset "Other", so after a successful `next build` it looked for a Node server entrypoint (`No entrypoint found`). Pinning the framework in the repo stops the dashboard setting from mattering. `>=24` would let Vercel move to a new Node major automatically |
| 2026-11-01 | Design direction **A, research note** (Newsreader / IBM Plex Sans / IBM Plex Mono, warm paper + deep ink, burnt-orange accent)                                                         | Chosen by you from 3 rendered options (`design/explorations/`). My recommendation was A + B's structure; logged here in case the B details are wanted later                                                                                                                                                         |
| 2026-11-01 | Tailwind default colours, radii and shadows removed from the theme; only token utilities exist                                                                                         | Enforces the palette and the no-shadow / max-4px-radius rules at compile time (verified: `rounded-2xl`, `shadow-lg`, `bg-purple-500` produce no CSS)                                                                                                                                                                |
| 2026-11-01 | Theme via next-themes with `data-theme` on `<html>`                                                                                                                                    | Blocking script prevents flash; Playwright checks the first painted frame is already dark                                                                                                                                                                                                                           |
| 2026-11-01 | `/styleguide` visible in dev and Vercel previews, 404 when `VERCEL_ENV=production`                                                                                                     | Lets you review on the PR preview; admin access added in Phase 18; moves under `[locale]` in Phase 2                                                                                                                                                                                                                |
| 2026-11-01 | `parseLocaleNumber()` rejects ambiguous `1.234,5` / `1,234.5` instead of guessing                                                                                                      | A wrong guess on a graded answer is worse than asking the learner to retype                                                                                                                                                                                                                                         |
| 2026-11-01 | WalkChart renders two SVGs (desktop and phone aspect ratio)                                                                                                                            | One scaled SVG shrank tick labels to ~6px at 390px in the explorations                                                                                                                                                                                                                                              |
| 2026-11-01 | `parseLocaleNumber()` also rejects thousands lookalikes (`1,000`, `12.500`) and loose spaces (`2 3`) as ambiguous/invalid; `×10` requires `^`                                          | Review H1/H2: a grader must never guess. `0,125` stays valid (a thousands group can't follow a leading zero)                                                                                                                                                                                                        |
| 2026-11-01 | `cx()` uses tailwind-merge configured for our scale (`text-2xs`, `text-reading` are sizes)                                                                                             | Review M2: caller overrides must win regardless of CSS order                                                                                                                                                                                                                                                        |
| 2026-11-01 | `/styleguide` gated at request time (`proxy.ts` 404 + `connection()` server gate); `ENABLE_STYLEGUIDE=1` for e2e                                                                       | Review M11: a build-time gate leaks into non-Vercel production builds                                                                                                                                                                                                                                               |
| 2026-11-01 | ESLint bans arbitrary `shadow-[`, `rounded-[`, `-[#…]` and `text-[n]`; theme resets blur and animation groups                                                                          | Review L2: enforce DESIGN.md at lint time, not only by convention                                                                                                                                                                                                                                                   |
| 2026-11-01 | Pure unit tests run in `node`; component tests opt into jsdom per file; tests import from `vitest` (globals off)                                                                       | Review M10/L12: faster tests, no test globals in app types                                                                                                                                                                                                                                                          |
| 2026-11-01 | Transitions never include `outline-color`                                                                                                                                              | Found by the new focus-colour e2e test: rings faded in from the text colour                                                                                                                                                                                                                                         |

## New dependencies

| Package                                                                                                      | Why                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| next, react, react-dom, tailwindcss, @tailwindcss/turbopack                                                  | Stack (create-next-app 16.4.3 defaults)                                                                                                          |
| zod, @t3-oss/env-nextjs                                                                                      | Validated env (`src/env.ts`), Zod everywhere per CLAUDE.md                                                                                       |
| typescript, eslint, eslint-config-next, typescript-eslint, eslint-plugin-jsx-a11y, eslint-config-prettier    | Strict lint + typecheck                                                                                                                          |
| prettier, prettier-plugin-tailwindcss                                                                        | Formatting, class sorting                                                                                                                        |
| husky, lint-staged                                                                                           | Pre-commit lint/format on staged files                                                                                                           |
| vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/dom, @testing-library/jest-dom | Unit and component tests                                                                                                                         |
| @playwright/test                                                                                             | E2E tests                                                                                                                                        |
| supabase                                                                                                     | Supabase CLI for local stack, migrations, type generation                                                                                        |
| radix-ui                                                                                                     | Accessible behaviour for Dialog, Popover, Tooltip, Toast, Tabs, Select, Checkbox, RadioGroup, Progress, Label (unified package; our own styling) |
| next-themes                                                                                                  | System / light / dark without a flash of the wrong theme                                                                                         |
| @axe-core/playwright                                                                                         | Automated WCAG 2.1 AA checks in e2e                                                                                                              |
| tailwind-merge                                                                                               | Class conflicts resolve to the last class written (review M2), configured for our token scale                                                    |

## TODO(verify)

(none yet)

## Phase 1 self-review (AI-slop list)

Checked 2026-11-01 against the banned list in CLAUDE.md and the checklist in docs/DESIGN.md.

- Gradients, glass, blur, shadows: none in `src` (grep); shadows and default palette removed from the Tailwind theme.
- Emoji and decorative icons: none in `src`. The only icons are functional (check, chevron, close).
- Fonts: no Inter or Geist (create-next-app's Geist removed). All three faces load their latin-ext subset (Playwright).
- Radius: maximum 4px; `rounded-full` only on radio dots.
- Copy: sample text is lesson content, with no marketing phrases, no fake counts and no testimonials.
- Found and fixed during review:
  - Breadcrumb inherited the serif font (explorations).
  - Mono digits in the middle of prose (explorations).
  - Chart end label overlapped the line.
  - Chart tick labels too small on phones (two-layout chart).
  - Theme switch faded in on every load (transition limited to hover text colour).
  - Font test passed vacuously (now asserts the latin-ext face loaded).
