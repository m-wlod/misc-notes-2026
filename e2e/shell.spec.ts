import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/** Public routes: [polish path, english path]. Mirrors src/i18n/routing.ts pathnames. */
const ROUTES = [
  ["/pl", "/en"],
  ["/pl/nauka", "/en/learn"],
  ["/pl/praktyka", "/en/practice"],
  ["/pl/rozmowa", "/en/interview"],
  ["/pl/debunk", "/en/debunk"],
  ["/pl/slowniczek", "/en/glossary"],
  ["/pl/laboratorium", "/en/lab"],
  ["/pl/profil", "/en/profile"],
  ["/pl/ustawienia", "/en/settings"],
  ["/pl/o-projekcie", "/en/about"],
  ["/pl/prywatnosc", "/en/privacy"],
  ["/pl/regulamin", "/en/terms"],
  ["/pl/cookies", "/en/cookies"],
  ["/pl/zastrzezenia", "/en/disclaimer"],
] as const;

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

test.describe("every route in both locales", () => {
  for (const [pl, en] of ROUTES) {
    test(`${pl} ↔ ${en}`, async ({ page }) => {
      for (const [path, lang, other] of [
        [pl, "pl", en],
        [en, "en", pl],
      ] as const) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

        // canonical + hreflang point at the localised slugs. The host comes from
        // resolveSiteUrl() at build time, so compare the path only.
        // Paths are [a-z/-] only, so they are safe to use in a RegExp unescaped.
        const endsWith = (p: string) => new RegExp(`^https?://[^/]+${p}$`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", endsWith(path));
        await expect(
          page.locator(`link[rel="alternate"][hreflang="${lang === "pl" ? "en" : "pl"}"]`),
        ).toHaveAttribute("href", endsWith(other));
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
          "href",
          endsWith(pl),
        );
      }
    });
  }
});

test("prefix-less URLs follow Accept-Language, then default to Polish", async ({ browser }) => {
  const en = await browser.newContext({ locale: "en-GB" });
  const enPage = await en.newPage();
  await enPage.goto("/");
  await expect(enPage).toHaveURL(/\/en$/);
  await en.close();

  const pl = await browser.newContext({ locale: "de-DE" });
  const plPage = await pl.newPage();
  await plPage.goto("/");
  await expect(plPage).toHaveURL(/\/pl$/);
  await pl.close();
});

test("switching language keeps the page and is remembered", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "the compact switch is desktop-only; footer switch is covered on desktop",
  );
  await page.goto("/pl/nauka");
  await page.getByRole("contentinfo").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/learn$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // The proxy stored the choice: a prefix-less visit now lands on English.
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("keyboard: skip link, top-bar order, focus ring and aria-current", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "keyboard navigation is a desktop concern");
  await page.addInitScript(
    ([key]) => {
      window.localStorage.setItem(key, "light");
    },
    [THEME_STORAGE_KEY] as const,
  );
  await page.goto("/pl/praktyka");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Przejdź do treści" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#content")).toBeFocused();

  await page.goto("/pl/praktyka");
  const order: string[] = [];
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => document.activeElement?.textContent.trim() ?? ""));
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
    });
    expect(ring, `focus ring on "${order.at(-1) ?? ""}"`).toBe(true);
  }
  expect(order.slice(0, 6)).toEqual([
    "Przejdź do treści",
    "APP_NAME",
    "Nauka",
    "Praktyka",
    "Rozmowa",
    "Debunk Lab",
  ]);

  const nav = page.getByRole("navigation", { name: "Główna nawigacja", exact: true });
  await expect(nav.getByRole("link", { name: "Praktyka" })).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
});

test("mobile: bottom bar replaces the top-bar links and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile layout only");
  await page.goto("/pl");
  await expect(
    page.getByRole("navigation", { name: "Główna nawigacja", exact: true }),
  ).toBeHidden();
  const bottom = page.getByRole("navigation", { name: "Nawigacja", exact: true });
  await expect(bottom).toBeVisible();
  await bottom.getByRole("link", { name: "Rozmowa" }).click();
  await expect(page).toHaveURL(/\/pl\/rozmowa$/);
  await expect(bottom.getByRole("link", { name: "Rozmowa" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rozmowa rekrutacyjna");
});

test("mobile: the bottom bar never covers the end of the footer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile layout only");
  await page.goto("/pl");
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  const bar = await page.getByRole("navigation", { name: "Nawigacja", exact: true }).boundingBox();
  const lastControl = await page.getByRole("contentinfo").getByRole("radiogroup").boundingBox();
  expect(bar && lastControl).toBeTruthy();
  if (bar && lastControl) expect(lastControl.y + lastControl.height).toBeLessThanOrEqual(bar.y);
});

test("desktop: bottom bar is hidden", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop layout only");
  await page.goto("/pl");
  await expect(page.getByRole("navigation", { name: "Nawigacja", exact: true })).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Główna nawigacja", exact: true }),
  ).toBeVisible();
});

for (const [path, lang, oddsText] of [
  ["/pl/nie-ma-takiej-strony", "pl", "Szansa, że trafisz tu, pisząc losowo: 1 na 2,2·10³⁶."],
  ["/en/no-such-page-here", "en", "Chance of landing here by typing at random: 1 in"],
] as const) {
  test(`404 in ${lang} has the right status and the typing odds`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByText(oddsText)).toBeVisible();
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`axe: home, a section and the 404 (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    for (const path of ["/pl", "/en/learn", "/pl/nie-ma-takiej-strony"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });
}

test("robots.txt and sitemap.xml list localised URLs", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /pl/styleguide");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/pl\/nauka<\/loc>/);
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/en\/learn<\/loc>/);
  expect(sitemap).toContain('hreflang="en"');
});
