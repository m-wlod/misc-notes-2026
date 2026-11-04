/**
 * Signed-in end-to-end tests (Phase 17c): builds the app against the local Supabase
 * stack (into .next-db, so the regular build is untouched), then runs e2e-db/ with
 * Playwright. Needs a running stack (`pnpm db:start`); without one it says so and
 * exits without failing, so a laptop without Docker isn't blocked.
 *
 *   pnpm test:e2e:db              build + test
 *   pnpm test:e2e:db --no-build   reuse the last .next-db build
 *
 * Runs directly on Node 24 (built-in TypeScript type stripping).
 */
import { execSync, spawnSync } from "node:child_process";

type Status = {
  API_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
  MAILPIT_URL?: string;
  INBUCKET_URL?: string;
};

function status(): Status | null {
  try {
    const out = execSync("pnpm exec supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(out.slice(out.indexOf("{"))) as Partial<Status>;
    return parsed.API_URL && parsed.PUBLISHABLE_KEY && parsed.SECRET_KEY
      ? (parsed as Status)
      : null;
  } catch {
    return null;
  }
}

const s = status();
if (!s) {
  console.log("e2e-db: no local Supabase stack running (pnpm db:start). Skipped.");
  process.exit(0);
}

const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-db",
  NEXT_PUBLIC_SUPABASE_URL: s.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: s.SECRET_KEY,
  // Labelled sample exercises and lessons (internal deployment).
  ENABLE_STYLEGUIDE: "1",
  // Signs newsletter unsubscribe links: a fixed test value (e2e-db/newsletter.spec.ts).
  EMAIL_TOKEN_SECRET: "e2e-email-token-secret",
  // The stack's mail catcher: sign-up links are read from it (e2e-db/journeys.spec.ts).
  MAILPIT_URL: s.MAILPIT_URL ?? s.INBUCKET_URL ?? "http://127.0.0.1:54324",
};

const run = (cmd: string) => {
  const r = spawnSync(cmd, { stdio: "inherit", shell: true, env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!process.argv.includes("--no-build")) run("pnpm build");
run("pnpm exec playwright test -c playwright.db.config.ts");
