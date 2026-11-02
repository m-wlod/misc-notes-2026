import { defineConfig, devices } from "@playwright/test";

// E2E_PORT: run locally beside another server on 3100.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    // Keep the trace of every failed attempt (the first one has the error; a passing
    // retry hides it). See docs/PROGRESS.md, known issue on client re-renders.
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Tests run against the production build, never the dev server.
    command: `pnpm start --port ${String(PORT)}`,
    // /styleguide is gated at request time; e2e runs a production build, so opt in.
    env: { ENABLE_STYLEGUIDE: "1" },
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
