import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./test";
import { DEPTH_STORAGE_KEY } from "../src/config/depth";
import { THEME_STORAGE_KEY } from "../src/config/theme";
import { LOCAL_PROGRESS_KEY } from "../src/features/progress/schema";

/**
 * Phase 6a: the lesson reader. The sample lesson (internal preview) is the only lesson
 * with a body until content work starts; curriculum lessons are "in preparation" stubs.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const SAMPLE = "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana";
const STUB = "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly";

const statusOf = (page: Page) =>
  page.evaluate(
    ([key, lesson]) => {
      const raw = localStorage.getItem(key);
      const data = raw
        ? (JSON.parse(raw) as { lessons: Record<string, { status: string } | undefined> })
        : null;
      return data?.lessons[lesson]?.status ?? null;
    },
    [LOCAL_PROGRESS_KEY, "przyklad-wartosc-oczekiwana"] as const,
  );

const hydrated = (page: Page) =>
  expect(page.getByRole("radio", { name: "Po ludzku" })).toBeChecked();

test("read → complete → next", async ({ page, isMobile }) => {
  await page.goto(SAMPLE);
  await hydrated(page);
  const bar = page.getByRole("progressbar", { name: "Postęp czytania" });
  await expect(bar).toHaveAttribute("aria-valuenow", "0");
  expect(await statusOf(page)).toBeNull();

  // Reading: the bar fills, the contents follow, and the lesson counts as started.
  await page.locator("#rozrzut-wyników").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);
  await expect.poll(async () => Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  if (!isMobile) {
    // Wide screens: the side contents marks the section on screen.
    const toc = page.getByRole("navigation", { name: "Spis treści" }).filter({ visible: true });
    await expect(toc.getByRole("link", { name: "Rozrzut wyników" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  }
  await expect.poll(() => statusOf(page)).toBe("in_progress");

  // Complete: stored, then the next lesson is offered and opens.
  await page.getByRole("button", { name: "Oznacz jako zrozumiane" }).click();
  await expect(page.getByText("Lekcja ukończona")).toBeVisible();
  expect(await statusOf(page)).toBe("completed");
  const next = page.getByRole("status").getByRole("link", { name: "Procenty i procent składany" });
  await next.click();
  await expect(page).toHaveURL(
    /\/pl\/nauka\/fundamenty\/stopy-zwrotu\/procenty-i-procent-skladany$/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procenty i procent składany");
});

test("coming back offers the section where you stopped", async ({ page }) => {
  await page.goto(SAMPLE);
  await hydrated(page);
  await page.locator("#strategia-podwajania-stawki").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("qla:reading:v1") ?? ""))
    .toContain("strategia-podwajania-stawki");
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Czytaj dalej od: Strategia podwajania/ }),
  ).toBeVisible();
});

test("a stub lesson page: in preparation, noindex, prerequisites and navigation", async ({
  page,
}) => {
  await page.goto(STUB);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kryterium Kelly'ego");
  await expect(page.getByText("Ta lekcja jest w przygotowaniu.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: "Oznacz jako zrozumiane" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Stopy logarytmiczne" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Nawigacja między lekcjami" });
  await nav.getByRole("link", { name: /Następna/ }).click();
  await expect(page).toHaveURL(/\/pl\/nauka\/wartosc-oczekiwana\/zaklady\/ryzyko-ruiny$/);
});

test("lesson URLs switch language and redirect slugs from the other one", async ({
  page,
  request,
}) => {
  const moved = await request.get("/en/learn/expected-value/betting/kryterium-kelly", {
    maxRedirects: 0,
  });
  expect(moved.status()).toBe(308);
  expect(moved.headers().location).toMatch(
    /\/en\/learn\/expected-value\/betting\/kelly-criterion$/,
  );
  expect((await request.get("/pl/nauka/wartosc-oczekiwana/zaklady/nie-ma")).status()).toBe(404);

  await page.goto(STUB);
  await page
    .getByRole("link", { name: /^(EN|English)$/ })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/learn\/expected-value\/betting\/kelly-criterion$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Kelly criterion");
});

test("the path opens a lesson page", async ({ page }) => {
  await page.goto("/pl/nauka");
  await expect(page.locator('li[data-lesson="bayes"]')).not.toHaveAttribute(
    "data-state",
    "unknown",
  );
  await page.getByRole("button", { name: "Wzór Bayesa" }).click();
  await page
    .getByRole("dialog", { name: "Wzór Bayesa" })
    .getByRole("link", { name: "Otwórz lekcję" })
    .click();
  await expect(page).toHaveURL(/\/pl\/nauka\/prawdopodobienstwo\/warunkowe\/wzor-bayesa$/);
});

test("check yourself: instant, forgiving input, nothing recorded", async ({ page }) => {
  await page.goto(SAMPLE);
  await hydrated(page);
  // Reading progress may be recorded (scrolling to the field counts as reading); answers
  // and attempts must not be.
  const stored = () => page.evaluate(() => JSON.stringify(localStorage));
  const numeric = page.getByRole("group", { name: /uczciwa moneta wypada orłem/ });
  const input = numeric.getByLabel("Twoja odpowiedź");
  await input.fill("0,4");
  await numeric.getByRole("button", { name: "Sprawdź" }).click();
  await expect(numeric.getByRole("status")).toContainText("Jeszcze nie");
  await input.fill("1/2");
  await numeric.getByRole("button", { name: "Sprawdź" }).click();
  await expect(numeric.getByRole("status")).toContainText("Dobrze.");
  await input.fill("0,5");
  await numeric.getByRole("button", { name: "Sprawdź" }).click();
  await expect(numeric.getByRole("status")).toContainText("Odpowiedź: 0.5");

  const choice = page.getByRole("group", { name: /strategia podwajania zmienia/ });
  await choice.getByLabel("Rośnie").check();
  await choice.getByRole("button", { name: "Sprawdź" }).click();
  await choice.getByRole("button", { name: "Pokaż odpowiedź" }).click();
  await expect(choice.getByRole("status")).toContainText("Odpowiedź: Nie zmienia się");
  const after = await stored();
  for (const answer of ["0,4", "1/2", "0,5", "Rośnie"]) expect(after).not.toContain(answer);
  const attempts = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { attempts: unknown[] }).attempts.length : 0;
  }, LOCAL_PROGRESS_KEY);
  expect(attempts).toBe(0);
});

test.describe("phones", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("no horizontal scroll at 360 px, and margin notes open on tap or key", async ({ page }) => {
    for (const path of [SAMPLE, STUB, "/pl/nauka", "/pl/mapa"]) {
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        path,
      ).toBeLessThanOrEqual(360);
    }
    await page.goto(SAMPLE);
    await hydrated(page);
    const toggle = page.getByRole("button", { name: "Przypis 1" });
    const note = page.getByRole("note").filter({ hasText: "nie musi być wynikiem" });
    await expect(note).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(note).toBeVisible();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(note).toBeHidden();
    // The contents sit above the text, collapsed.
    await page.locator("summary", { hasText: "Spis treści" }).click();
    await expect(page.getByRole("navigation", { name: "Spis treści" }).first()).toBeVisible();
  });
});

test("print: no site chrome, margin notes printed in place", async ({ page }) => {
  await page.goto(SAMPLE);
  await hydrated(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header").first()).toBeHidden();
  await expect(page.locator("footer").last()).toBeHidden();
  await expect(page.getByRole("progressbar")).toBeHidden();
  await expect(page.getByRole("button", { name: "Oznacz jako zrozumiane" })).toBeHidden();
  await expect(page.getByRole("note").filter({ hasText: "nie musi być wynikiem" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const depth of ["easy", "formal"] as const) {
    test(`axe: reader (${theme}, ${depth})`, async ({ page }) => {
      await page.addInitScript(
        ([themeKey, themeValue, depthKey, depthValue]) => {
          window.localStorage.setItem(themeKey, themeValue);
          window.localStorage.setItem(depthKey, depthValue);
        },
        [THEME_STORAGE_KEY, theme, DEPTH_STORAGE_KEY, depth] as const,
      );
      for (const path of [SAMPLE, STUB]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(
          violations.map(
            (v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
          ),
        ).toEqual([]);
      }
    });
  }
}
