import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";
import { LOCAL_PROGRESS_KEY } from "../src/features/progress/schema";

/**
 * Phase 5a: the learning path, textbook, and track and module pages, with node state
 * driven by prerequisites and the progress saved in this browser.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

function seedProgress(
  page: Page,
  lessons: Record<string, "in_progress" | "completed" | "mastered">,
) {
  return page.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key, payload);
    },
    [
      LOCAL_PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        attempts: [],
        lessons: Object.fromEntries(
          Object.entries(lessons).map(([id, status]) => [
            id,
            { status, updatedAt: "2026-11-01T10:00:00Z" },
          ]),
        ),
      }),
    ] as const,
  );
}

const node = (page: Page, id: string) => page.locator(`li[data-lesson="${id}"]`);

test("the path shows all 13 tracks and every lesson", async ({ page }) => {
  await page.goto("/pl/nauka");
  await expect(page.getByRole("heading", { level: 1, name: "Ścieżka nauki" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(13);
  await expect(page.locator("li[data-lesson]")).toHaveCount(68);
  await expect(page.getByText("w przygotowaniu", { exact: true }).first()).toBeVisible();
});

test("with no progress, lessons without prerequisites are available and the rest locked", async ({
  page,
}) => {
  await page.goto("/pl/nauka");
  await expect(node(page, "percentages-compounding")).toHaveAttribute("data-state", "available");
  await expect(node(page, "log-returns")).toHaveAttribute("data-state", "locked");
  await expect(node(page, "kelly-criterion")).toHaveAttribute("data-state", "locked");
});

test("finishing prerequisites unlocks their dependants", async ({ page }) => {
  await seedProgress(page, {
    "percentages-compounding": "completed",
    "exp-log": "mastered",
    "drawdown-recovery": "in_progress",
  });
  await page.goto("/pl/nauka");
  await expect(node(page, "percentages-compounding")).toHaveAttribute("data-state", "done");
  await expect(node(page, "exp-log")).toHaveAttribute("data-state", "mastered");
  await expect(node(page, "drawdown-recovery")).toHaveAttribute("data-state", "in_progress");
  // Both prerequisites finished → available. Needs log returns too → still locked.
  await expect(node(page, "log-returns")).toHaveAttribute("data-state", "available");
  await expect(node(page, "kelly-criterion")).toHaveAttribute("data-state", "locked");
});

test("a locked lesson stays open and says what to do first", async ({ page }) => {
  await seedProgress(page, { "expected-value": "completed" });
  await page.goto("/pl/nauka");
  await expect(node(page, "kelly-criterion")).toHaveAttribute("data-state", "locked");
  const title = page.getByRole("button", { name: "Kryterium Kelly'ego" });
  await title.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Kryterium Kelly'ego" });
  // Only the unfinished prerequisite is listed.
  await expect(panel).toContainText("Zalecane po: Stopy logarytmiczne");
  await expect(panel).toContainText("Lekcja 3.2.3");
  await expect(panel).toContainText("Treść pojawi się stopniowo");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("the node panel opens on tap", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await page.goto("/pl/nauka");
  await expect(node(page, "bayes")).not.toHaveAttribute("data-state", "unknown"); // hydrated
  await page.getByRole("button", { name: "Wzór Bayesa" }).tap();
  await expect(page.getByRole("dialog", { name: "Wzór Bayesa" })).toBeVisible();
});

test("track and module pages use each language's slugs, with progress", async ({ page }) => {
  await seedProgress(page, { "percentages-compounding": "completed", "exp-log": "completed" });
  await page.goto("/pl/nauka/fundamenty");
  await expect(page.getByRole("heading", { level: 1, name: "Fundamenty" })).toBeVisible();
  await expect(page.getByTestId("unit-progress")).toHaveText("Ukończone: 2 z 6");
  await page.getByRole("link", { name: "Stopy zwrotu i procent składany" }).click();
  await expect(page).toHaveURL(/\/pl\/nauka\/fundamenty\/stopy-zwrotu$/);
  // Next keeps the previous page mounted but hidden after client navigation.
  await expect(page.getByTestId("unit-progress").filter({ visible: true })).toHaveText(
    "Ukończone: 2 z 4",
  );

  // The language switcher keeps the page; the proxy maps the slugs (308).
  // Top bar on desktop ("EN"), footer on mobile ("English").
  await page
    .getByRole("link", { name: /^(EN|English)$/ })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/learn\/foundations\/returns$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Returns and compounding" }),
  ).toBeVisible();
});

test("slugs from the other language redirect; unknown ones are a real 404", async ({ request }) => {
  const moved = await request.get("/en/learn/fundamenty", { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  expect(moved.headers().location).toMatch(/\/en\/learn\/foundations$/);
  expect((await request.get("/pl/nauka/nie-ma-takiego")).status()).toBe(404);
  expect((await request.get("/en/learn/foundations/no-such-module")).status()).toBe(404);
});

test("the textbook numbers every chapter 1–13 and lessons n.m.k", async ({ page }) => {
  await page.goto("/pl/podrecznik");
  await expect(page.getByRole("heading", { level: 1, name: "Podręcznik" })).toBeVisible();
  const chapters = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(chapters).toHaveCount(13);
  await expect(chapters.first()).toHaveText(/^1\s*Fundamenty$/);
  await expect(chapters.last()).toHaveText(/^13\s*Łamigłówki quanta$/);
  await expect(page.getByText("3.2.3", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Podręcznik", exact: true }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the English path uses English titles", async ({ page }) => {
  await page.goto("/en/learn");
  await expect(page.getByRole("heading", { level: 1, name: "Learning path" })).toBeVisible();
  await expect(page.getByRole("button", { name: "The Kelly criterion" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: path, track, module and textbook (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    for (const path of [
      "/pl/nauka",
      "/pl/nauka/wartosc-oczekiwana",
      "/en/learn/options/pricing-models",
      "/pl/podrecznik",
    ]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });
}

test.describe("prerequisite map", () => {
  const map = (page: Page) => page.getByTestId("curriculum-map");
  const transform = (page: Page) => map(page).locator("g").first().getAttribute("transform");

  test("renders every lesson as a link to its place in the curriculum", async ({ page }) => {
    await page.goto("/pl/mapa");
    await expect(map(page).locator("a[data-lesson]")).toHaveCount(68);
    const kelly = map(page).locator('a[data-lesson="kelly-criterion"]');
    await expect(kelly).toHaveAttribute(
      "href",
      "/pl/nauka/wartosc-oczekiwana/zaklady#kelly-criterion",
    );
    await expect(kelly).toHaveAttribute("aria-label", /^Kryterium Kelly'ego, lekcja 3\.2\.3, /);
  });

  test("filters dim the lessons outside the chosen track and levels", async ({ page }) => {
    await page.goto("/pl/mapa");
    await expect.poll(() => transform(page)).toMatch(/scale/); // hydrated
    await page.getByRole("combobox", { name: "Dział" }).selectOption("expected-value");
    await expect(page.getByRole("status").filter({ hasText: "Wyróżnione" })).toHaveText(
      "Wyróżnione: 6 z 68",
    );
    await expect(map(page).locator("a[data-dimmed]")).toHaveCount(62);
    await page.getByRole("button", { name: "Poziom 3" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Wyróżnione" })).toHaveText(
      "Wyróżnione: 4 z 68",
    );
  });

  test("zooms with the buttons and the keyboard, and resets", async ({ page }) => {
    await page.goto("/pl/mapa");
    await expect.poll(() => transform(page)).toMatch(/scale/);
    const start = await transform(page);
    await page.getByRole("button", { name: "Przybliż" }).click();
    await expect.poll(() => transform(page)).not.toBe(start);
    await page.getByRole("button", { name: "Pokaż całość" }).click();
    await expect.poll(() => transform(page)).toBe(start);

    await page.getByRole("group", { name: /^Mapa wymagań/ }).focus();
    await page.keyboard.press("+");
    await expect.poll(() => transform(page)).not.toBe(start);
    await page.keyboard.press("0");
    await expect.poll(() => transform(page)).toBe(start);
  });

  test("node state follows progress here too", async ({ page }) => {
    await seedProgress(page, { counting: "completed" });
    await page.goto("/en/map");
    await expect(map(page).locator('a[data-lesson="counting"]')).toHaveAttribute(
      "data-state",
      "done",
    );
    await expect(map(page).locator('a[data-lesson="probability-basics"]')).toHaveAttribute(
      "data-state",
      "available",
    );
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: map (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/mapa");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
