import { defineConfig, devices } from "@playwright/test";

/**
 * Signed-in end-to-end tests against the local Supabase stack (Phase 17c). Run through
 * `pnpm test:e2e:db` (scripts/e2e-db.ts), which builds with the stack's settings and
 * passes them in the environment.
 */
const PORT = Number(process.env.E2E_DB_PORT ?? 3200);
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e-db",
  // One flow per file, steps in order; files may run side by side.
  fullyParallel: false,
  forbidOnly: isCI,
  // A serial flow with shared users: a retry would start mid-story, so none.
  retries: 0,
  reporter: isCI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-db" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
