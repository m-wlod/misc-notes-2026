import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 19a: the landing page, a video landing page (/v/<slug>, one content file each)
 * and the link-in-bio page. Internal deployment, so the labelled samples show.
 */
test("the landing runs a live simulation and a sample exercise anyone can solve", async ({
  page,
}) => {
  await page.goto("/pl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Matematyka, której guru nie znają — za darmo",
  );
  await expect(page.locator("[data-landing-sim] canvas").first()).toBeVisible({
    timeout: 15_000,
  });
  const exercise = page.locator("[data-landing-exercise='przyklad-wybor']");
  await exercise.getByRole("radio", { name: "4" }).check();
  await exercise.getByRole("button", { name: "Sprawdź" }).click();
  await expect(exercise.getByRole("status").filter({ hasText: "Dobrze!" })).toBeVisible();
  await expect(page.locator("[data-landing-video='przyklad']")).toBeVisible();
});

test("a video page: clip on click, formula, simulation, three exercises, what next", async ({
  page,
}) => {
  await page.goto("/pl/v/przyklad");
  const article = page.locator("[data-video='przyklad']");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "Przykład: dlaczego połowa Kelly'ego",
  );
  // Nothing from YouTube loads until the visitor asks for it.
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(article.locator("[data-formula] .katex-display")).toBeVisible();
  await expect(article.locator("[data-video-sim='kelly'] canvas").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(article.locator("[data-video-exercise]")).toHaveCount(3);
  await expect(article.locator("[data-next-lesson='expected-value'] a")).toBeVisible();
  await expect(article.locator("[data-video-debunk='przyklad-skutecznosc'] a")).toBeVisible();

  await page.goto("/en/v/przyklad");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sample: why half Kelly");
});

test("short links without a locale, and unknown videos are not found", async ({
  page,
  request,
}) => {
  await page.goto("/v/przyklad");
  await expect(page).toHaveURL(/\/(pl|en)\/v\/przyklad$/);
  const missing = await request.get("/pl/v/nie-ma-takiego-wideo");
  // Not found (a soft 404 when served from the prerendered shell): never indexable.
  expect(await missing.text()).toContain("noindex");
});

test("link in bio: every link carries the campaign", async ({ page }) => {
  await page.goto("/pl/links?src=tiktok");
  const links = page.getByRole("navigation", { name: "Linki" }).getByRole("link");
  expect(await links.count()).toBeGreaterThan(4);
  for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) {
    expect(href).toMatch(/[?&]utm_source=tiktok&utm_medium=link-in-bio&utm_campaign=bio$/);
  }
  await expect(page.locator("[data-links-video='przyklad']")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/pl/links?src=unknown");
  await expect(page.locator("[data-links='bio']")).toBeVisible();
});

test("a campaign landing is sent once and the address is cleaned", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/utm")) sent.push(r.postData() ?? "");
  });
  await page.goto("/pl/laboratorium?utm_source=tiktok&utm_medium=video&utm_campaign=kelly");
  await expect(page).toHaveURL(/\/pl\/laboratorium$/);
  await expect.poll(() => sent.length).toBe(1);
  expect(JSON.parse(sent[0] ?? "{}")).toEqual({
    search: "?utm_source=tiktok&utm_medium=video&utm_campaign=kelly",
    path: "/pl/laboratorium",
  });
  await page.goto("/pl/laboratorium?utm_source=tiktok&utm_medium=video&utm_campaign=kelly");
  await expect(page).toHaveURL(/\/pl\/laboratorium$/);
  expect(sent).toHaveLength(1);
});

for (const theme of ["light", "dark"] as const) {
  test(`landing, video and link pages pass axe (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    for (const path of ["/pl", "/pl/v/przyklad", "/pl/links"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      expect(
        violations.map(
          (v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    }
  });
}
