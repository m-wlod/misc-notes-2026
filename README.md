# Quant Learning App (working name)

A free web app that teaches the mathematics, probability, statistics and quantitative finance behind trading. Polish first, English second.

- Project rules: [`CLAUDE.md`](CLAUDE.md)
- Build plan: [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md)
- Progress, decisions, open questions: [`docs/PROGRESS.md`](docs/PROGRESS.md)

## Requirements

- Node 24 (`.nvmrc`)
- pnpm 12 via corepack. On Windows, `corepack enable pnpm` needs admin rights to write into `C:\Program Files\nodejs`. Without admin rights, use `corepack enable pnpm --install-directory "$(npm config get prefix)"`.
- No database is needed to run the app: without Supabase env vars, accounts are switched off and everything else works.
- Python 3.12, for content answer verification (from Phase 7).

## Getting started

```sh
pnpm install
cp .env.example .env.local      # fill in what you have; everything is optional in Phase 0
pnpm dev                        # http://localhost:3000
```

## Database

- Schema lives in `supabase/migrations/` (one file per area). RLS is on for every table; scores, XP and entitlements are written only by server code.
- After changing a migration: `pnpm db:reset` (re-applies everything + `supabase/seed.sql`), then `pnpm db:types` and commit `src/lib/db/database.types.ts` (CI fails if it is stale).
- `pnpm test:db` runs the RLS and account tests against a Supabase database. CI runs it in Docker on every PR. The local Docker stack is optional and unstable on low-memory machines; a cloud dev project is planned (see docs/PROGRESS.md). A new table must be added to `supabase/tests/rls.test.ts` or the suite fails.
- Server code uses `src/lib/db/server.ts` (acts as the signed-in user). `src/lib/db/admin.ts` uses the secret key and bypasses RLS: only for server-owned writes, after checking the user.

## Content

- The curriculum outline (tracks → modules → lesson order) is `content/curriculum.ts`. Lessons are MDX in `content/<locale>/tracks/<track>/<module>/<id>.mdx`; unwritten ones have the body `<Stub />`. Glossary terms are YAML in `content/glossary/`. `pnpm content:build` (also run by `build`, `lint` and `typecheck`) validates them and compiles them into `.velite/`, imported as `#content`.
- Invalid content fails the build with `file: field: reason`. Components and authoring rules: `src/components/content/README.md`.
- `pnpm content:build` also writes the search indexes (`public/search/<locale>.json`, generated, not committed).
- Preview any lesson, drafts included, at `/pl/dev/content-preview` (dev and previews only).

## Routing and translations

- Every page lives under `src/app/[locale]/` and is served at a locale prefix: `/pl/...` (default) or `/en/...`.
- Polish pages use Polish slugs (`/pl/nauka` ↔ `/en/learn`). The mapping is in `src/i18n/routing.ts`; link with the typed `Link` from `src/i18n/navigation.ts`, never a raw path.
- UI copy lives in `messages/<locale>/<namespace>.json`. Polish is the source of truth for types; `pnpm i18n:check` (also in CI) fails on missing keys, extra keys, mismatched `{placeholders}` or empty strings.
- `src/proxy.ts` redirects prefix-less URLs (cookie → Accept-Language → Polish) and hides `/styleguide` in production.

## Scripts

| Script                         | What it does                                                               |
| ------------------------------ | -------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start` | Next.js dev server, production build, production server                    |
| `pnpm lint` / `lint:fix`       | ESLint (zero warnings allowed)                                             |
| `pnpm format` / `format:check` | Prettier                                                                   |
| `pnpm typecheck`               | Route type generation + `tsc --noEmit`                                     |
| `pnpm content:build`           | Validate and compile content (MDX lessons, glossary) into `.velite/`       |
| `pnpm i18n:check`              | Key, placeholder and file parity between `messages/pl` and `messages/en`   |
| `pnpm test` / `test:watch`     | Vitest unit tests                                                          |
| `pnpm test:db`                 | RLS and account tests against a Supabase database (CI runs them in Docker) |
| `pnpm test:e2e`                | Playwright against the production build (run `pnpm build` first)           |
| `pnpm db:types`                | Regenerate TS types from the migrations (CI fails if they are stale)       |

A pre-commit hook runs ESLint and Prettier on staged files.
