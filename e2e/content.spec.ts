import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { DEPTH_STORAGE_KEY } from "../src/config/depth";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * The content engine, through the internal preview (Phase 4 Done-when: the sample lesson
 * uses every component and renders in both themes and both depth modes).
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const SAMPLE = "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana";

test("the preview lists lessons, drafts included", async ({ page }) => {
  await page.goto("/pl/dev/content-preview");
  await expect(page.getByRole("heading", { level: 1, name: "Podgląd treści" })).toBeVisible();
  await page.getByRole("link", { name: "Przykład: wartość oczekiwana zakładu" }).click();
  await expect(page).toHaveURL(/id=przyklad-wartosc-oczekiwana/);
});

test("the sample lesson renders every building block", async ({ page, isMobile }) => {
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
  if (isMobile) {
    // Phones: notes are collapsed behind their number until tapped (Phase 6).
    await expect(page.getByRole("button", { name: "Przypis 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Przypis 2" })).toBeVisible();
  } else {
    await expect(page.getByRole("note").filter({ hasText: "Przypis 1:" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "Przypis 2:" })).toBeVisible();
  }
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
  // Wait for hydration: the depth radio is only checked once React is attached.
  await expect(page.getByRole("radio", { name: "Po ludzku" })).toBeChecked();
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

const EASY = "Wyobraź sobie dwa zakłady";
const FORMAL = "drugi moment centralny";

test("the depth toggle swaps passages and remembers the choice", async ({ page }) => {
  await page.goto(SAMPLE);
  const group = page.getByRole("radiogroup", { name: "Sposób wyjaśniania" });
  await expect(group.getByRole("radio", { name: "Po ludzku" })).toBeChecked();
  await expect(page.getByText(EASY)).toBeVisible();
  await expect(page.getByText(FORMAL)).toBeHidden();
  // Shared content shows in both modes.
  await expect(page.getByText("Sama średnia nie mówi")).toBeVisible();

  await group.getByRole("radio", { name: "Podręcznik" }).click();
  await expect(page.getByText(FORMAL)).toBeVisible();
  await expect(page.getByText(EASY)).toBeHidden();
  await expect(page.getByText("Sama średnia nie mówi")).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-depth", "formal");
  await expect(page.getByRole("radio", { name: "Podręcznik" })).toBeChecked();
  await expect(page.getByText(FORMAL)).toBeVisible();
});

test("the toggle works from the keyboard", async ({ page }) => {
  await page.goto(SAMPLE);
  // Checked only after hydration (the server can't know the stored depth).
  await expect(page.getByRole("radio", { name: "Po ludzku" })).toBeChecked();
  await page.getByRole("radio", { name: "Po ludzku" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Podręcznik" })).toBeChecked();
  await expect(page.getByText(FORMAL)).toBeVisible();
});

test("stored depth applies before first paint (no flash)", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "formal");
    requestAnimationFrame(() => {
      (window as unknown as { firstFrameDepth: string | null }).firstFrameDepth =
        document.documentElement.getAttribute("data-depth");
    });
  }, DEPTH_STORAGE_KEY);
  await page.goto(SAMPLE);
  await page.waitForFunction(() => "firstFrameDepth" in window);
  const first = await page.evaluate(
    () => (window as unknown as { firstFrameDepth: string | null }).firstFrameDepth,
  );
  expect(first).toBe("formal");
});

test("a glossary term opens its definition by keyboard and links to the glossary", async ({
  page,
}) => {
  await page.goto(SAMPLE);
  // Wait for hydration: the depth radio is only checked once React is attached.
  await expect(page.getByRole("radio", { name: "Po ludzku" })).toBeChecked();
  const term = page.getByRole("button", { name: "wariancja", exact: true });
  await term.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: "wariancja" });
  await expect(card).toContainText("Średni kwadrat odchylenia");
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(term).toBeFocused();

  await term.click();
  await card.getByRole("link", { name: "Zobacz w słowniczku" }).click();
  await expect(page).toHaveURL(/\/pl\/slowniczek#variance$/);
});

test("a glossary term opens on tap", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: "martyngał" }).tap();
  await expect(page.getByRole("dialog", { name: /martyngał/ })).toBeVisible();
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
    const comment = // Shiki splits a comment into "#" and the text; take the text token.
      page.locator('pre.shiki span[style*="--code-token-comment"]', { hasText: "0.0103" });
    await expect(comment).toHaveCSS(
      "color",
      theme === "light" ? "rgb(93, 100, 114)" : "rgb(154, 161, 174)",
    );

    await page.locator("summary", { hasText: "Dowód" }).click();
    for (const depth of ["Po ludzku", "Podręcznik"]) {
      await page.getByRole("radio", { name: depth }).click();
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${depth} ${v.id}: ${v.help}`)).toEqual([]);
    }
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
