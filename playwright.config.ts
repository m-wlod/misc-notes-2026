import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Tests run against the production build, never the dev server.
    command: `pnpm start --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
