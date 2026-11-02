import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/** Phase 8b: the practice hub (filters in the URL, level steps, lesson sets, next in set). */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const results = (page: Page) => page.locator("li[data-exercise]");
const hydrated = (page: Page) =>
  expect(page.getByRole("radio", { checked: true }).first()).toBeVisible();

test("the hub lists the sample exercises with a count", async ({ page }) => {
  await page.goto("/pl/praktyka");
  await expect(page.getByRole("heading", { level: 1, name: "Praktyka" })).toBeVisible();
  await expect(results(page)).toHaveCount(11);
  await expect(page.getByRole("status").filter({ hasText: "zada" })).toHaveText("11 zadań");
});

test("level steps filter and keep the other filters", async ({ page }) => {
  await page.goto("/pl/praktyka?type=numeric");
  const steps = page.getByRole("navigation", { name: "Poziom" });
  await expect(steps.getByRole("link")).toHaveText([
    "Wszystkie",
    /1\s*Podstawy/,
    /2\s*Średnio/,
    /3\s*Trudno/,
    /4\s*Ekstremalnie/,
    /5\s*Quant Trader/,
  ]);
  await steps.getByRole("link", { name: /2\s*Średnio/ }).click();
  await expect(page).toHaveURL(/[?&]level=2/);
  await expect(page).toHaveURL(/[?&]type=numeric/);
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByText("Brak zadań dla tych filtrów.")).toBeVisible();

  await page.goto("/pl/praktyka?level=2");
  await expect(steps.getByRole("link", { name: /2\s*Średnio/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(results(page)).toHaveCount(3);
});

test("the type filter submits on change, and filters clear", async ({ page }) => {
  await page.goto("/pl/praktyka");
  await hydrated(page);
  await page.getByLabel("Typ").selectOption("ordering");
  await expect(page).toHaveURL(/[?&]type=ordering/);
  await expect(results(page)).toHaveCount(1);
  await page.getByRole("link", { name: "Wyczyść filtry" }).click();
  await expect(results(page)).toHaveCount(11);
});

test("a set from the hub: open, solve, then N goes to the next in the set", async ({ page }) => {
  await page.goto("/pl/praktyka?level=2");
  await results(page).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/pl\/praktyka\/[a-z-]+\?level=2$/);
  const first = page.url();
  await hydrated(page);
  // Let Next finish prefetching links first: acting mid-prefetch stalled here.
  await page.waitForLoadState("networkidle");
  await page.locator("body").press("n");
  // Dynamic pages render slowly on a memory-starved machine; CI is faster.
  await expect(page).not.toHaveURL(first, { timeout: 15_000 });
  await expect(page).toHaveURL(/\?level=2$/);
  await expect(page.getByText("Poziom 2").first()).toBeVisible();
});

test("unsolved only hides what was solved in this browser", async ({ page }) => {
  await page.goto("/pl/praktyka/przyklad-wybor");
  await hydrated(page);
  await page.getByRole("radio", { name: "4" }).check();
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(page.getByText("Dobrze!")).toBeVisible();

  await page.goto("/pl/praktyka");
  await hydrated(page);
  const solved = page.locator('li[data-exercise="przyklad-wybor"]');
  await expect(solved).toContainText("rozwiązane");
  await page.getByLabel("Tylko nierozwiązane").check();
  await expect(solved).toHaveCount(0);
  await expect(results(page)).toHaveCount(10);
});

test("practise this lesson: from the lesson to its set", async ({ page }) => {
  await page.goto("/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Ćwicz tę lekcję (11 zadań)" }).click();
  await expect(page).toHaveURL(/\/pl\/praktyka\?lesson=przyklad-wartosc-oczekiwana$/, {
    timeout: 15_000,
  });
  await expect(results(page)).toHaveCount(11);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: practice hub (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/praktyka?level=1");
    await expect(results(page).first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}
