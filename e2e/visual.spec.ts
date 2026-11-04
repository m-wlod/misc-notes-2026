import { expect, test, type Page } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 20b: visual regression of the key pages, in both themes, desktop and phone.
 * Baselines are Linux screenshots (fonts render differently elsewhere), so these run
 * only in CI's `visual` job (VISUAL=1). A missing baseline is written there and the job
 * fails, with the new images as an artifact to review and commit; see e2e/README.md.
 */
test.skip(!process.env.VISUAL, "visual baselines are Linux-only: CI's visual job");

/** Things that change by themselves: today's problem, the landing's live simulation. */
const masks = (page: Page) => [
  page.locator("section[aria-labelledby='today-title']"),
  page.locator("[data-landing-sim] canvas"),
];

const PAGES: [string, string][] = [
  ["landing", "/pl"],
  ["lesson", "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana"],
  ["exercise", "/pl/praktyka/przyklad-liczba"],
  // A fixed seed, shown at its last frame: the same picture on every run.
  ["simulation", "/pl/laboratorium/symulacje/ruch-browna?seed=7&t=250"],
  ["debunk", "/pl/debunk/przyklad-90-procent-skutecznosci"],
  ["video", "/pl/v/przyklad"],
  ["sign-in", "/pl/logowanie"],
];

for (const theme of ["light", "dark"] as const) {
  for (const [name, path] of PAGES) {
    test(`${name} (${theme})`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value);
        },
        [THEME_STORAGE_KEY, theme] as const,
      );
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
        fullPage: true,
        mask: masks(page),
        maxDiffPixelRatio: 0.01,
      });
    });
  }
}
