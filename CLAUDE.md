# CLAUDE.md — Quant Learning App

Project constitution. Full phased plan: docs/BUILD_PLAN.md. Progress and decisions: docs/PROGRESS.md.

Next.js 16.4 differs from older training data: before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (see AGENTS.md). Toolchain pins (TypeScript 6.0, ESLint 9) and why are in PROGRESS.md.

## Product

Working name: `APP_NAME` (placeholder in `src/config/site.ts`, change in one place). A free web app that teaches the real mathematics, probability, statistics and quantitative finance behind trading, and shows with proofs and simulations why most retail trading "systems" and guru courses fail. It is the product side of a TikTok/YouTube brand (tone inspired by Roman Paolucci / Quant Guild): rigorous, calm, slightly ironic, never hype.

- **Market:** Poland first (Polish UI and content). Architecture is multilingual from day one; English is the second locale.
- **Business model now:** 100% free, no paywall, no upsell. The founder is a mentor, not a course seller. But the data model must already support entitlements so a paywall can be added later without migrations (see Later).
- **Audience:** Polish retail traders burned by gurus; students of economics, econometrics, maths and CS; data scientists moving into quant; people preparing for quant interviews.
- **Reference product:** Quant Guild Academy (courses, interview questions, lessons/games, roadmap). We go further with a structured textbook, 5 difficulty levels and Duolingo-style habit loops.

## Non-negotiable principles

1. **Correctness over volume.** Every formula, number and claim must be verifiable. Numeric answers are checked by a script, not by eye.
2. **Layered explanations.** Every concept exists at two depths: _Po ludzku_ (plain-language intuition) and _Podręcznik_ (formal textbook). The reader toggles between them.
3. **Intuition → formalism → simulation → code → exercise.** This is the order of every lesson.
4. **Anti-guru tone, not anti-person.** Debunk claims with math. Never insult, never name private individuals, never make factual allegations about a person.
5. **No AI slop** in design, copy or code (rules below).
6. **Educational only.** No investment advice, no signals, no "strategies that work". A short disclaimer lives in the footer and on Debunk pages.

## Tech stack (use latest stable versions at build time)

| Concern                   | Choice                                                                             | Notes                                                     |
| ------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Framework                 | Next.js (App Router), React, TypeScript strict                                     | Server components by default                              |
| Styling                   | Tailwind CSS + CSS variables for tokens                                            | Radix primitives for a11y behaviour; no stock shadcn look |
| Database / auth / storage | Supabase (Postgres, Auth, Storage, RLS), EU region                                 | Migrations via Supabase CLI, types generated              |
| Validation                | Zod everywhere (env, forms, content schemas, API I/O)                              |                                                           |
| Content                   | MDX in git, compiled by a typed content layer (Velite or Content Collections)      | Content-as-code: versioned, reviewable                    |
| Math                      | remark-math + rehype-katex; Compute Engine (CortexJS) for symbolic answer checking | Server-side KaTeX render                                  |
| Charts / simulations      | D3 (scales, shapes) + React, Canvas for heavy paths                                | No chart-lib default styling                              |
| In-browser Python         | Pyodide in a Web Worker; CodeMirror 6 editor                                       | numpy, pandas, scipy, statsmodels                         |
| AI grading                | Anthropic API (model from env `AI_GRADER_MODEL`), server-only                      | Structured JSON output                                    |
| Rate limiting / cache     | Upstash Redis                                                                      | Per-user and per-IP                                       |
| i18n                      | next-intl, routes `/pl/...`, `/en/...`                                             | Polish is default                                         |
| Email                     | Resend + React Email                                                               |                                                           |
| Analytics / errors        | PostHog (EU cloud), Sentry                                                         | Consent-gated                                             |
| Tests                     | Vitest, Testing Library, Playwright                                                |                                                           |
| Tooling                   | pnpm, ESLint, Prettier, Husky + lint-staged, GitHub Actions                        |                                                           |
| Hosting                   | Vercel                                                                             | Preview deploys per PR                                    |

## Design system: "research notebook meets trading desk"

The app should feel like a well-typeset quant research note and a terminal, not like a SaaS template.

- **Palette:** warm paper off-white (light) and deep ink blue-black (dark). Neutrals carry 90% of the UI. One accent (signal orange) for actions and focus; red/green only for data and correctness, never decoration.
- **Type:** serif for headings and long reading (e.g. Newsreader or Source Serif 4), a humanist sans for UI (e.g. IBM Plex Sans), monospace for numbers, code and tickers (e.g. JetBrains Mono or IBM Plex Mono). Tabular figures for all numbers. **Every font must fully support Polish diacritics (ąćęłńóśźż).** Self-host via `next/font`.
- **Layout:** reading column \~68ch with Tufte-style margin notes (sidenotes) on desktop. Numbered figures and equations ("Rys. 3.2", "(4.1)"). Fine 1px rules and grid lines instead of shadows.
- **Decoration is data:** use real plots (a random walk, a distribution) as visual elements, never stock illustrations.
- **Motion:** minimal and functional (≤150ms, respects `prefers-reduced-motion`). Celebration moments in gamification are the only exception and are still restrained.
- **Banned (AI slop list):** purple/blue gradients, glassmorphism, glowing blobs, emoji in UI, sparkle/rocket icons, "Unlock your potential"-style copy, generic hero + three icon cards, everything `rounded-2xl` with drop shadows, default Inter, lorem ipsum, fake testimonials, fake user counts, stock 3D illustrations.
- **Accessibility:** WCAG 2.1 AA, full keyboard use, visible focus, KaTeX output readable by screen readers (MathML).

## Content model

- **Track** (e.g. "Prawdopodobieństwo") → **Module** → **Lesson** → sections.
- Every lesson MDX has frontmatter: `id` (stable, never changes), `slug`, `locale`, `title`, `summary`, `level` (1–5), `prerequisites` (lesson ids), `estimatedMinutes`, `status` (draft | review | published), `sources` (book, chapter, page), `relatedVideos`, `glossaryTerms`.
- Lesson building blocks (MDX components): `Intuition`, `Definition`, `Theorem`, `Proof` (collapsible), `Example`, `GuruMyth` (a common false claim and why it's false), `Sidenote`, `Figure`, `Simulation`, `PythonCell`, `ExerciseRef`, `InterviewTip`, `KeyFormula`.
- Translations are separate MDX files sharing the same `id`. Missing translations fall back to Polish with a visible notice.

## The 5 levels

| Level | Polish label | Who it's for                     | Example task                                                                                                          |
| ----- | ------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | Podstawy     | Anyone after high school         | Expected value of a die roll; percentage loss needed to recover from a 50% drawdown                                   |
| 2     | Średnio      | First-year university            | Variance of a sum; probability a strategy with 55% win rate has 6 losses in a row in 100 trades                       |
| 3     | Trudno       | Strong STEM/econometrics student | Derive Kelly fraction; test whether a backtest Sharpe is significant                                                  |
| 4     | Ekstremalnie | Graduate level                   | Itô's lemma on GBM; Fourier transform of a price series; bias of overlapping returns                                  |
| 5     | Quant Trader | Interview-ready                  | Market-making games, brainteasers, expected-value puzzles under time pressure, open "how would you model X" questions |

Exercise types: numeric (with tolerance), multiple choice, multi-select, symbolic expression, estimation/Fermi (log-error scoring), ordering, interactive (move a slider to a target), Python code (hidden tests), open-ended (AI-graded with rubric), interview brainteaser (open + hints + follow-up).

## Global engineering rules

- TypeScript strict; no `any`, no `@ts-ignore` without a comment explaining why.
- No user-facing string hardcoded in components: everything through next-intl messages (`messages/<locale>/<namespace>.json`, typed from Polish; `pnpm i18n:check` keeps locales in sync). The one documented exception is the internal `/styleguide`, whose Polish samples are design specimens. Numbers, dates and percentages use locale formatting; **numeric answer inputs accept both `0,25` and `0.25`.**
- Row Level Security on every table, no exceptions; service-role key only in server code.
- **Grading is server-side for every graded exercise**, signed-in or not (signed-out users: IP rate limit, attempts stored in the browser). Answers never reach the client before submission. Only the ungraded inline "check yourself" questions in lessons may grade client-side.
- Supabase env vars are optional: without them accounts are off (sign-in shows a note) and the app must still build and work. Don't assume a local Docker stack, which is unstable on the dev machine; CI runs the database tests.
- Next.js 16 `proxy.ts` (not `middleware.ts`) does locale handling and redirects only; authorization is always enforced in RLS and server code.
- Every feature ships with tests: unit for logic (graders, scoring, streaks), Playwright for user flows.
- Validate all env vars at startup with Zod (`src/env.ts`).
- Server components by default; client components only for interactivity.
- Heavy dependencies (Pyodide, Monaco-class editors, D3 bundles) are lazy-loaded.
- Before adding a new dependency, state why in PROGRESS.md.
- Never invent math. If unsure of a formula or number, mark it `TODO(verify)` and list it in PROGRESS.md.
- Keep `docs/PROGRESS.md` updated at the end of each phase: done, decisions, open questions, `TODO(verify)` list.

## Repo layout (target)

```text
src/app/[locale]/...        routes (public URLs are localised: /pl/nauka ↔ /en/learn, see src/i18n/routing.ts)
src/i18n/                   routing (pathnames), navigation, request config, message loading
messages/<locale>/          UI messages split by feature
src/components/ui/          design-system primitives
src/components/content/     MDX components
src/components/sims/        simulations
src/features/<feature>/     exercises, grading, gamification, community, debunk, admin
src/lib/                    supabase, ai, rate-limit, analytics, math utils
content/<locale>/tracks/... lessons (MDX)
content/exercises/...       exercises (YAML/MDX)
content/glossary/           glossary terms
content/_inbox/             raw notes from NotebookLM awaiting conversion
scripts/                    content QA, answer verification, imports
supabase/migrations/        SQL migrations
docs/                       BUILD_PLAN.md, PROGRESS.md, CONTENT_GUIDE.md
```
