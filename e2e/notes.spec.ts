import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/** Phase 6b: highlights, notes and bookmarks (kept in this browser), and the video facade. */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const SAMPLE = "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana";

const hydrated = (page: Page) =>
  expect(page.getByRole("radio", { name: "Po ludzku" })).toBeChecked();

/** Select a phrase inside the lesson text, as a reader would with mouse or keyboard. */
async function select(page: Page, phrase: string) {
  await page.evaluate((text) => {
    const root = document.getElementById("lesson-body");
    if (!root) throw new Error("no lesson body");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(text) ?? -1;
      if (at !== -1) {
        node.parentElement?.scrollIntoView({ block: "center" });
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + text.length);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
    }
    throw new Error(`"${text}" not found`);
  }, phrase);
}

const drawnHighlights = (page: Page) =>
  page.evaluate(() => CSS.highlights.get("qla-highlight")?.size ?? 0);

test("highlight, note and bookmark persist and appear on Moje notatki", async ({ page }) => {
  await page.goto(SAMPLE);
  await hydrated(page);

  await select(page, "pojedyncze wyniki przestają mieć znaczenie");
  await page.getByRole("button", { name: "Zaznacz" }).click();
  await expect.poll(() => drawnHighlights(page)).toBe(1);

  await page.getByLabel("Notatka do tej lekcji").fill("Sprawdzić jeszcze raz wariancję.");
  await page.getByRole("button", { name: "Dodaj zakładkę" }).click();
  await expect(page.getByRole("button", { name: "Usuń zakładkę" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.reload();
  await hydrated(page);
  await expect.poll(() => drawnHighlights(page)).toBe(1);
  await expect(page.getByLabel("Notatka do tej lekcji")).toHaveValue(
    "Sprawdzić jeszcze raz wariancję.",
  );
  await expect(page.getByRole("button", { name: "Usuń zakładkę" })).toBeVisible();
  const list = page.getByRole("region", { name: "Twoje notatki" });
  await expect(list.locator("q")).toHaveText("pojedyncze wyniki przestają mieć znaczenie");

  await page.goto("/pl/notatki");
  const entry = page.locator('li[data-lesson="przyklad-wartosc-oczekiwana"]');
  await expect(entry.getByRole("heading", { level: 2 })).toHaveText(
    "Przykład: wartość oczekiwana zakładu",
  );
  await expect(entry).toContainText("Zakładka");
  await expect(entry).toContainText("1 zaznaczenie");
  await expect(entry).toContainText("Sprawdzić jeszcze raz wariancję.");
  await expect(entry.locator("q")).toHaveText("pojedyncze wyniki przestają mieć znaczenie");
});

test("a highlight can be removed, and an empty lesson leaves the list", async ({ page }) => {
  await page.goto(SAMPLE);
  await hydrated(page);
  await select(page, "Średnio wypada");
  await page.getByRole("button", { name: "Zaznacz" }).click();
  await expect.poll(() => drawnHighlights(page)).toBe(1);
  await page.getByRole("button", { name: /^Usuń zaznaczenie: Średnio wypada/ }).click();
  await expect.poll(() => drawnHighlights(page)).toBe(0);
  await page.goto("/pl/notatki");
  await expect(page.getByText("Nic tu jeszcze nie ma.")).toBeVisible();
});

test("stub lessons have no notes or highlighting", async ({ page }) => {
  await page.goto("/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Notatka do tej lekcji")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dodaj zakładkę" })).toHaveCount(0);
});

test("a video loads nothing from YouTube until play is pressed", async ({ page }) => {
  const thirdParty: string[] = [];
  await page.route(/youtube|ytimg|googlevideo|tiktok/, (route) => {
    thirdParty.push(route.request().url());
    return route.abort();
  });
  await page.goto("/pl/styleguide");
  const play = page.getByRole("button", { name: /^Odtwórz: Przykładowe wideo/ });
  await play.scrollIntoViewIfNeeded();
  await expect(play).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(thirdParty).toEqual([]);

  await play.click();
  const frame = page.locator('iframe[title="Przykładowe wideo (demonstracja komponentu)"]');
  await expect(frame).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?autoplay=1",
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: notes page with entries (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(
          "qla:notes:v1",
          JSON.stringify({
            version: 1,
            lessons: {
              "kelly-criterion": {
                note: "Notatka testowa.",
                bookmarked: true,
                highlights: [],
                updatedAt: "2026-11-01T10:00:00Z",
              },
            },
          }),
        );
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/notatki");
    await expect(page.locator('li[data-lesson="kelly-criterion"]')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}
