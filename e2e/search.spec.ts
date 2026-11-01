import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function openSearch(page: Page, name = "Szukaj") {
  // The trigger is hydrated once the theme switch has a checked option.
  await expect(page.getByRole("radio", { checked: true }).first()).toBeVisible();
  await page.getByRole("button", { name }).click();
  const input = page.getByRole("combobox", { name });
  await expect(input).toBeFocused();
  return input;
}

test("finds a lesson typed without Polish letters and opens it", async ({ page }) => {
  await page.goto("/pl");
  const input = await openSearch(page);
  await input.fill("rozklad");
  const first = page.getByRole("option").first();
  await expect(first).toContainText("Zmienne losowe i rozkłady");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pl\/nauka\/prawdopodobienstwo\/zliczanie#random-variables$/);
  await expect(page.locator("#random-variables")).toBeInViewport();
});

test("groups glossary terms and moves with the arrow keys", async ({ page }) => {
  await page.goto("/pl");
  const input = await openSearch(page);
  await input.fill("wariancja");
  await expect(page.getByRole("group", { name: "Słowniczek" })).toContainText("wariancja");
  await expect(page.getByRole("group", { name: "Lekcje" })).toContainText("Wariancja wyników");
  const options = page.getByRole("option");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await options.nth(1).getAttribute("id")) ?? "",
  );
});

test("English search, empty results, and closing with Escape", async ({ page }) => {
  await page.goto("/en");
  const input = await openSearch(page, "Search");
  await input.fill("Kelly");
  await expect(page.getByRole("option").first()).toContainText("The Kelly criterion");
  await input.fill("zzzz");
  await expect(page.getByRole("status").filter({ hasText: "No results" })).toHaveText(
    "No results for “zzzz”.",
  );
  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeFocused();
});

test("opens with Ctrl+K and with /", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcuts are a desktop concern");
  await page.goto("/pl/nauka");
  await expect(page.getByRole("radio", { checked: true }).first()).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: "Szukaj" })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "Szukaj" })).toBeFocused();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: search dialog with results (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl");
    const input = await openSearch(page);
    await input.fill("wartosc");
    await expect(page.getByRole("option").first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
