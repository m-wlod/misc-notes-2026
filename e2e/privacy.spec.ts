import { expect, test } from "./test";

/**
 * Phase 21b: legal pages (drafts until the legal review: marked and noindex), the consent
 * settings on the cookies page, and videos that load by themselves only after consent.
 * Analytics isn't configured in this build, so no banner shows (its rule is unit-tested).
 */
const LEGAL: [string, string, string][] = [
  ["privacy", "/pl/prywatnosc", "/en/privacy"],
  ["terms", "/pl/regulamin", "/en/terms"],
  ["cookies", "/pl/cookies", "/en/cookies"],
  ["disclaimer", "/pl/zastrzezenia", "/en/disclaimer"],
  ["community", "/pl/zasady-spolecznosci", "/en/community-guidelines"],
  ["corrections", "/pl/korekty", "/en/corrections"],
];

test("legal pages: a heading, the draft note, noindex until reviewed, in both languages", async ({
  page,
}) => {
  for (const [id, pl, en] of LEGAL) {
    for (const path of [pl, en]) {
      await page.goto(path);
      const article = page.locator(`[data-legal='${id}']`);
      await expect(article.getByRole("heading", { level: 1 }), path).toBeVisible();
      await expect(article.locator("[data-legal-draft]"), path).toBeVisible();
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    }
  }
});

test("the footer links every legal page", async ({ page }) => {
  await page.goto("/pl");
  const footer = page.locator("footer");
  for (const [, pl] of LEGAL) await expect(footer.locator(`a[href='${pl}']`)).toHaveCount(1);
});

test("no banner without analytics; videos load by themselves only after consent", async ({
  page,
}) => {
  const thirdParty: string[] = [];
  page.on("request", (r) => {
    if (/youtube|tiktok|posthog/.test(new URL(r.url()).hostname)) thirdParty.push(r.url());
  });

  await page.goto("/pl/v/przyklad");
  await expect(page.locator("[data-consent-banner]")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(thirdParty).toEqual([]);

  // Allow videos on the cookies page; the player then loads without a click.
  await page.goto("/pl/cookies");
  const settings = page.locator("[data-consent-settings]");
  await expect(settings.getByRole("checkbox", { name: /Niezbędne/ })).toBeDisabled();
  await settings.getByRole("checkbox", { name: /Filmy z YouTube i TikToka/ }).check();
  await expect(settings.getByRole("status")).toHaveText("Zapisano.");
  await page.goto("/pl/v/przyklad");
  await expect(page.locator("iframe")).toHaveCount(1);

  // And off again: back to click-to-load.
  await page.goto("/pl/cookies");
  await page
    .locator("[data-consent-settings]")
    .getByRole("checkbox", { name: /Filmy z YouTube i TikToka/ })
    .uncheck();
  await page.goto("/pl/v/przyklad");
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("'remember my choice' on a video allows the others too", async ({ page }) => {
  await page.goto("/pl/v/przyklad");
  await page.getByRole("checkbox", { name: /Zapamiętaj wybór/ }).check();
  await page.getByRole("button", { name: /Odtwórz: / }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("iframe")).toHaveCount(1);
});
