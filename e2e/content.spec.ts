import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * The content engine, through the internal preview (Phase 4 Done-when: the sample lesson
 * uses every component and renders in both themes). Depth modes arrive in Phase 4b.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const SAMPLE = "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana";

test("the preview lists lessons, drafts included", async ({ page }) => {
  await page.goto("/pl/dev/content-preview");
  await expect(page.getByRole("heading", { level: 1, name: "Podgląd treści" })).toBeVisible();
  await page.getByRole("link", { name: "Przykład: wartość oczekiwana zakładu" }).click();
  await expect(page).toHaveURL(/id=przyklad-wartosc-oczekiwana/);
});

test("the sample lesson renders every building block", async ({ page }) => {
  await page.goto(SAMPLE);
  await expect(page.getByText("Lekcja przykładowa.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Przykład: wartość oczekiwana zakładu",
  );
  for (const label of [
    "Intuicja",
    "Definicja",
    "Przykład",
    "Twierdzenie",
    "Kluczowy wzór",
    "Mit z rynku",
    "Symulacja",
    "Python",
    "Na rozmowie rekrutacyjnej",
    "Zadanie",
  ]) {
    await expect(page.getByText(new RegExp(`^${label}( ·|$)`)).first(), label).toBeVisible();
  }
  await expect(page.getByText("Dlaczego to nie działa")).toBeVisible();
  await expect(page.getByText("Rys. 1")).toBeVisible();
  await expect(page.getByRole("img", { name: /błądzenia losowego/ })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Przypis 1:" })).toBeAttached();
  await expect(page.getByRole("note").filter({ hasText: "Przypis 2:" })).toBeAttached();
});

test("equations are numbered, cross-referenced and exposed as MathML", async ({ page }) => {
  await page.goto(SAMPLE);
  for (const n of [1, 2, 3, 4, 5]) {
    await expect(page.getByRole("group", { name: `Równanie (${String(n)})` })).toBeVisible();
  }
  const refs = page.getByRole("link", { name: /^równanie \d$/ });
  await expect(refs).toHaveText(["(1)", "(3)"]);
  await expect(refs.first()).toHaveAttribute("href", "#eq-1");
  expect(await page.locator("math").count()).toBeGreaterThan(5);
  // KaTeX rendered at build time: no visible raw TeX. The TeX source stays only in the
  // hidden MathML <annotation>, which is correct.
  await expect(page.getByText("\\mathbb").filter({ visible: true })).toHaveCount(0);
});

test("the proof opens from the keyboard", async ({ page }) => {
  await page.goto(SAMPLE);
  const summary = page.locator("summary", { hasText: "Dowód" });
  const proofText = page.getByText("Rozwijamy kwadrat");
  await expect(proofText).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(proofText).toBeVisible();
});

test("heading anchors link to their section", async ({ page }) => {
  await page.goto(SAMPLE);
  const anchor = page.getByRole("link", { name: "Link do sekcji: Rozrzut wyników" });
  await expect(anchor).toHaveAttribute("href", "#rozrzut-wyników");
});

for (const theme of ["light", "dark"] as const) {
  test(`code is highlighted with theme colours, and axe passes (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto(SAMPLE);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const keyword = page.locator("pre.shiki span", { hasText: "print" }).first();
    await expect(keyword).toBeVisible();
    const comment = page.locator("pre.shiki span:not(.line)", { hasText: "# 0.0103" });
    await expect(comment).toHaveCSS(
      "color",
      theme === "light" ? "rgb(93, 100, 114)" : "rgb(154, 161, 174)",
    );

    await page.locator("summary", { hasText: "Dowód" }).click();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)})`)).toEqual([]);
  });
}

test("a missing English translation falls back to Polish with a notice", async ({ page }) => {
  await page.goto("/en/dev/content-preview?id=przyklad-wartosc-oczekiwana");
  await expect(page.getByText("This lesson isn’t available in English yet")).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Przykład: wartość oczekiwana zakładu",
  );
});

test("an unknown lesson id says so", async ({ page }) => {
  await page.goto("/pl/dev/content-preview?id=nie-ma-takiej");
  await expect(page.getByText("Nie ma lekcji o identyfikatorze „nie-ma-takiej”.")).toBeVisible();
});
