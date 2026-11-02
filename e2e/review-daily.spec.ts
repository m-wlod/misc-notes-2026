import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 15a: problem of the day with a shareable card, review (dormant: accounts off),
 * the weekly challenge (no challenges yet), and the style guide specimens.
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

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (buf: Buffer) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

test("share card renders as a PNG in both formats and rejects bad parameters", async ({
  request,
}) => {
  const base = "/api/share/daily?d=2026-11-02&l=3&r=xxo&h=1&lang=pl";
  for (const [format, w, h] of [
    ["og", 1200, 630],
    ["story", 1080, 1920],
  ] as const) {
    const res = await request.get(`${base}&format=${format}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const body = await res.body();
    expect(body.subarray(1, 4).toString()).toBe("PNG");
    expect(pngSize(body)).toEqual({ width: w, height: h });
  }
  const en = await request.get("/api/share/daily?d=2026-11-02&l=5&r=o&h=0&lang=en&format=og");
  expect(en.status()).toBe(200);
  for (const bad of ["d=2026-11-02&l=9&r=o&h=0", "d=x&l=1&r=o&h=0", "d=2026-11-02&l=1&r=abc&h=0"]) {
    expect((await request.get(`/api/share/daily?${bad}`)).status()).toBe(400);
  }
});

test("problems of the day per level, and the share panel after a result", async ({ page }) => {
  await page.goto("/pl/praktyka");
  const section = page.locator("[data-daily-problems]");
  await expect(section.getByRole("heading", { name: "Zadania dnia" })).toBeVisible();
  // Internal deployments (e2e) may use the labelled samples.
  const slot = section.locator("[data-daily-level]").first();
  await expect(slot).toBeVisible();
  const level = Number(await slot.getAttribute("data-daily-level"));
  const href = (await slot.getByRole("link").getAttribute("href")) ?? "";

  // A result for today in this browser (as the card records it after grading).
  const day = await page.evaluate(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date()),
  );
  await page.evaluate(
    ([d, l]) => {
      localStorage.setItem(
        "qla:daily:v1",
        JSON.stringify({
          version: 1,
          days: { [`${d}:${String(l)}`]: { exerciseId: "x", marks: ["x", "o"], hints: 0 } },
        }),
      );
    },
    [day, level] as const,
  );
  await page.reload();
  await expect(slot).toContainText("Rozwiązane");

  await page.goto(href);
  const panel = page.locator("[data-daily-share]");
  await expect(panel).toContainText("🟥🟩");
  const image = await panel.getByRole("link", { name: "Pobierz obraz" }).getAttribute("href");
  expect(image).toContain(`d=${day}`);
  expect(image).toContain("r=xo");
  expect(image).toContain("format=story");
  const res = await page.request.get(image ?? "");
  expect(pngSize(await res.body())).toEqual({ width: 1080, height: 1920 });
});

test("review and the weekly challenge, signed out", async ({ page }) => {
  await page.goto("/pl/powtorka");
  await expect(page.getByRole("heading", { level: 1, name: "Powtórka" })).toBeVisible();
  await expect(page.locator("[data-review-note]")).toBeVisible();
  await page.goto("/pl/wyzwanie");
  await expect(page.getByRole("heading", { level: 1, name: "Wyzwanie tygodnia" })).toBeVisible();
  await expect(page.locator("[data-challenge-none]")).toBeVisible();
  await page.goto("/en/challenge");
  await expect(page.getByRole("heading", { level: 1, name: "Weekly challenge" })).toBeVisible();
});

test.describe("style guide specimens", () => {
  test("the review card flips, rates with keys, and finishes", async ({ page }) => {
    await page.goto("/pl/styleguide#gamification");
    const spec = page.locator("[data-specimen='review']");
    await expect(spec.getByText("1 z 1")).toBeVisible();
    await spec.getByRole("button", { name: "Pokaż odpowiedź" }).click();
    await expect(spec.locator("[data-review-back] .katex").first()).toBeVisible();
    await expect(spec.getByRole("button", { name: /3\. Dobrze/ })).toBeVisible();
    await page.keyboard.press("3");
    await expect(spec.locator("[data-review-done]")).toContainText("Powtórka na dziś zrobiona.");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`review card and share image pass axe (${theme})`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value);
        },
        [THEME_STORAGE_KEY, theme] as const,
      );
      await page.goto("/pl/styleguide#gamification");
      const img = page.locator("[data-specimen='share'] img");
      await expect(img).toBeVisible();
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBe(1200);
      await page
        .locator("[data-specimen='review']")
        .getByRole("button", { name: "Pokaż odpowiedź" })
        .click();
      await axe(page, "[data-specimen='review']");
      await axe(page, "[data-specimen='share']");
    });
  }
});
