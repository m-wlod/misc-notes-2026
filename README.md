# Quant Learning App (working name)

A free web app that teaches the mathematics, probability, statistics and quantitative finance behind trading. Polish first, English second.

- Project rules: [`CLAUDE.md`](CLAUDE.md)
- Build plan: [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md)
- Progress, decisions, open questions: [`docs/PROGRESS.md`](docs/PROGRESS.md)

## Requirements

- Node 24 (`.nvmrc`)
- pnpm 12 via corepack. On Windows, `corepack enable pnpm` needs admin rights to write into `C:\Program Files\nodejs`. Without admin rights, use `corepack enable pnpm --install-directory "$(npm config get prefix)"`.
- Docker Desktop, running, for the local Supabase stack.
- Python 3.12, for content answer verification (from Phase 7).

## Getting started

```sh
pnpm install
cp .env.example .env.local      # fill in what you have; everything is optional in Phase 0
pnpm db:start                   # local Supabase; Studio on :54323, mail catcher on :54324
pnpm dev                        # http://localhost:3000
```

## Scripts

| Script                                                | What it does                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`                        | Next.js dev server, production build, production server          |
| `pnpm lint` / `lint:fix`                              | ESLint (zero warnings allowed)                                   |
| `pnpm format` / `format:check`                        | Prettier                                                         |
| `pnpm typecheck`                                      | Route type generation + `tsc --noEmit`                           |
| `pnpm test` / `test:watch`                            | Vitest unit tests                                                |
| `pnpm test:e2e`                                       | Playwright against the production build (run `pnpm build` first) |
| `pnpm db:start` / `db:stop` / `db:reset` / `db:types` | Local Supabase stack, reset with seed, generate TS types         |

A pre-commit hook runs ESLint and Prettier on staged files.
