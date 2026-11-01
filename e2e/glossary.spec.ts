import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

test("the glossary lists terms A–Z in Polish with English names", async ({ page }) => {
  await page.goto("/pl/slowniczek");
  await expect(page.getByRole("heading", { level: 1, name: "Słowniczek" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(["M", "W"]);
  await expect(page.locator("dt")).toHaveText([
    /^martyngał \(podwajanie stawki\)martingale/,
    /^wariancjavariance/,
    /^wartość oczekiwanaexpected value/,
  ]);
  await expect(page.getByRole("status")).toHaveText("3 pojęcia");
  await expect(page.getByText("przykład", { exact: true })).toHaveCount(3);
});

test("search filters by either language, ignoring diacritics", async ({ page }) => {
  await page.goto("/pl/slowniczek");
  const search = page.getByRole("searchbox", { name: "Szukaj w słowniczku" });
  // Typing before hydration is lost when React attaches, so retry until it filters.
  await expect(async () => {
    // No diacritics typed; the other definitions say "wartości oczekiwanej", which must not match.
    await search.fill("wartosc oczek");
    await expect(page.locator("dt")).toHaveCount(1, { timeout: 1000 });
  }).toPass();
  await expect(page.getByRole("status")).toHaveText("1 pojęcie");
  await search.fill("variance");
  await expect(page.locator("dt")).toHaveText([/^wariancja/]);
  await search.fill("xyz");
  await expect(page.getByText("Brak pojęć pasujących do „xyz”.")).toBeVisible();
});

test("the English glossary uses English names and sorting", async ({ page }) => {
  await page.goto("/en/glossary");
  await expect(page.locator("dt")).toHaveText([/^expected value/, /^martingale/, /^variance/]);
  await expect(page.getByRole("status")).toHaveText("3 terms");
});

test("a term deep link scrolls to its entry", async ({ page }) => {
  await page.goto("/pl/slowniczek#variance");
  await expect(page.locator("#variance")).toBeInViewport();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: glossary (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    for (const path of ["/pl/slowniczek", "/en/glossary"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });
}
