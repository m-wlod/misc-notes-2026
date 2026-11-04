import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 14: gamification is for signed-in learners and stays dormant while accounts are
 * off. Signed out, the home page shows the next lesson and the problem of the day, the
 * league page explains, the header keeps its dashes; the signed-in UI is checked on the
 * style guide's sample-data specimens.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function axe(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  const { violations } = await (include ? builder.include(include) : builder).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test("home: next lesson and problem of the day, signed out", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.getByRole("heading", { name: "Na dziś" })).toBeVisible();
  const next = page.locator("[data-dashboard='next-lesson']");
  await expect(next.getByRole("link")).toBeVisible();
  // No exercise is published yet, so the problem of the day says so honestly.
  await expect(
    page.getByText("Zadanie dnia pojawi się, gdy opublikujemy pierwsze zadania."),
  ).toBeVisible();
  // The header keeps the signed-out dashes.
  await expect(page.getByText("po zalogowaniu")).toBeAttached(); // hidden on phones
});

test("home: the next lesson follows this browser's progress", async ({ page }) => {
  await page.goto("/pl");
  const link = page.locator("[data-dashboard='next-lesson']").getByRole("link");
  const first = await link.innerText();
  // Mark the first lesson (curriculum order) completed in this browser, then reload.
  const lessonId = "percentages-compounding";
  await page.evaluate((lesson) => {
    localStorage.setItem(
      "qla:progress:v1",
      JSON.stringify({
        version: 1,
        lessons: { [lesson]: { status: "completed", updatedAt: new Date().toISOString() } },
        attempts: [],
      }),
    );
  }, lessonId);
  await page.reload();
  await expect(link).not.toHaveText(first);
});

test("league page explains it needs accounts", async ({ page }) => {
  await page.goto("/pl/liga");
  await expect(page.getByRole("heading", { level: 1, name: "Liga" })).toBeVisible();
  await expect(page.locator("[data-league-note]")).toBeVisible();
  await page.goto("/en/league");
  await expect(page.getByRole("heading", { level: 1, name: "League" })).toBeVisible();
});

test.describe("style guide specimens (sample data)", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`dashboard, league, radar and achievements pass axe (${theme})`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value);
        },
        [THEME_STORAGE_KEY, theme] as const,
      );
      await page.goto("/pl/styleguide#gamification");
      const section = page.locator("#gamification");
      await expect(section.locator("[data-goal-ring='60']")).toBeVisible();
      await expect(section.locator("[data-league-table] [data-me]")).toContainText("Ty");
      await expect(section.getByText("↑ Strefa awansu")).toBeVisible();
      await expect(section.locator("[data-skill-radar]")).toBeVisible();
      await expect(section.locator("[data-achievement][data-earned]")).toHaveCount(4);
      await axe(page, "#gamification");
    });
  }

  test("the celebration toast shows the reward and remembers mute", async ({ page }) => {
    await page.goto("/pl/styleguide#gamification");
    const show = page.getByRole("button", { name: "Pokaż nagrodę" });
    await show.click();
    const toast = page.locator("[data-celebration]");
    await expect(toast).toContainText("+45 XP");
    await expect(toast).toContainText("Cel dnia zrobiony");
    await expect(toast).toContainText("Seria: 7 dni");
    await expect(toast).toContainText("Nowe osiągnięcie: Tydzień");
    await toast.getByRole("button", { name: "Wycisz dźwięk" }).click();
    expect(await page.evaluate(() => localStorage.getItem("qla:sound:v1"))).toBe("off");
    await page.reload();
    await show.click();
    await expect(
      page.locator("[data-celebration]").getByRole("button", { name: "Włącz dźwięk" }),
    ).toBeVisible();
  });
});
