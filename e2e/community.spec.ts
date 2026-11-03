import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 17b: the community UI on the style guide (sample data; posting needs accounts,
 * covered by the signed-in suite in 17c). Checks the rendered markdown, the composer
 * preview, sorting, the locked state and accessibility in both themes.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function axe(page: Page, include: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include(include)
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

const thread = (page: Page) => page.locator("[data-specimen='community-thread']");

test.beforeEach(async ({ page }) => {
  await page.goto("/pl/styleguide#community");
});

test("a thread renders markdown, math, replies and a shadow-hidden own post", async ({ page }) => {
  const t = thread(page);
  await expect(t.getByRole("heading", { name: /Dyskusja/ })).toBeVisible();
  await expect(t.locator("[data-comment='1'] .katex").first()).toBeVisible();
  await expect(t.locator("[data-comment='1'] code")).toHaveText("np.mean(x)");
  await expect(t.locator("[data-comment='2'] a")).toHaveAttribute(
    "rel",
    "nofollow ugc noopener noreferrer",
  );
  await expect(t.locator("[data-comment='3']")).toContainText("Widzisz to tylko Ty");
  await expect(t.getByRole("link", { name: "Porozmawiaj na Discordzie" })).toBeVisible();
});

test("sorting by votes puts the top post first", async ({ page }) => {
  const t = thread(page);
  const first = t.locator("[data-discussion] > ul > li").first();
  await expect(first).toHaveAttribute("data-comment", "3");
  await t.getByRole("button", { name: "Najlepsze" }).click();
  await expect(first).toHaveAttribute("data-comment", "1");
});

test("the composer preview renders what will be posted, inertly", async ({ page }) => {
  const t = thread(page);
  const composer = t.locator("[data-composer]").first();
  await composer.getByLabel("Twój komentarz").fill('$\\sigma^2$ i <img src=x onerror="alert(1)">');
  await composer.getByRole("button", { name: "Podgląd" }).click();
  const preview = composer.locator("[data-preview]");
  await expect(preview.locator(".katex")).toBeVisible();
  await expect(preview.locator("img")).toHaveCount(0);
  await expect(preview).toContainText("<img");
});

test("a locked exercise thread shows no posts and explains why", async ({ page }) => {
  const locked = page.locator("[data-specimen='community-locked']");
  await expect(locked.locator("[data-locked]")).toContainText("rozwiążesz");
  await expect(locked.locator("[data-comment]")).toHaveCount(0);
  await expect(locked.getByRole("button", { name: /Pokaż dyskusję/ })).toBeVisible();
});

test("solutions list Mentor picks first", async ({ page }) => {
  const sols = page.locator("[data-specimen='community-solutions'] [data-solution]");
  await expect(sols).toHaveCount(2);
  await expect(sols.first()).toContainText("Wybór mentora");
});

for (const theme of ["light", "dark"] as const) {
  test(`community specimens pass axe (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/styleguide#community");
    await axe(page, "#community");
  });
}
