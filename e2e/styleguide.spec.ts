import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const THEME_KEY = "theme"; // next-themes storageKey (src/components/theme/theme-provider.tsx)

async function openWithTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [THEME_KEY, theme] as const,
  );
  await page.goto("/styleguide");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of ["light", "dark"] as const) {
  test(`style guide has no axe violations (${theme})`, async ({ page }) => {
    await openWithTheme(page, theme);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)})`)).toEqual(
      [],
    );
  });
}

test("stored dark theme applies before first paint (no flash)", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "dark");
    // Runs before any page script: record the theme the first frame is painted with.
    requestAnimationFrame(() => {
      (window as unknown as { firstFrameTheme: string | null }).firstFrameTheme =
        document.documentElement.getAttribute("data-theme");
    });
  }, THEME_KEY);
  await page.goto("/styleguide");
  await page.waitForFunction(() => "firstFrameTheme" in window);
  const first = await page.evaluate(
    () => (window as unknown as { firstFrameTheme: string | null }).firstFrameTheme,
  );
  expect(first).toBe("dark");
});

test("theme switch changes and remembers the theme", async ({ page }) => {
  // No init script here: it would re-seed the stored theme on reload.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/styleguide");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "Ciemny" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("every focusable element shows a visible focus indicator", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "keyboard focus is a desktop concern");
  test.skip(browserName !== "chromium");
  await openWithTheme(page, "light");
  await page.locator("body").click({ position: { x: 1, y: 1 } });

  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const id = `${el.tagName}#${el.id}.${el.textContent.trim().slice(0, 30)}`;
      const visible = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
      return { id, visible };
    });
    if (!info) continue;
    if (seen.has(info.id)) break; // wrapped around
    seen.add(info.id);
    expect(info.visible, `no visible focus on ${info.id}`).toBe(true);
  }
  expect(seen.size).toBeGreaterThan(15);
});

test("Polish diacritics render in the self-hosted fonts", async ({ page }) => {
  await openWithTheme(page, "light");
  const families = ["Newsreader", "IBM Plex Sans", "IBM Plex Mono"];
  for (const family of families) {
    // document.fonts.check() is vacuously true for unknown families, so assert the
    // latin-ext face (U+0100–02BA covers ą ć ę ł ń ś ź ż) was actually loaded.
    const loaded = await page.evaluate(
      (f) =>
        [...document.fonts].some(
          (face) =>
            face.family.replace(/"/g, "") === f &&
            face.status === "loaded" &&
            face.unicodeRange.toUpperCase().includes("U+100-2BA"),
        ),
      family,
    );
    expect(loaded, `${family} latin-ext face loaded`).toBe(true);
  }
});

test("number input accepts Polish decimals and flags garbage", async ({ page }) => {
  await openWithTheme(page, "light");
  const input = page.getByLabel("Odpowiedź liczbowa");
  await input.fill("12,5%");
  await expect(page.getByText("0,125 (percent)")).toBeVisible();
  await input.fill("1.234,5");
  await input.blur();
  await expect(input).toHaveAttribute("aria-invalid", "true");
});

test("capture style guide screenshots", async ({ page }, testInfo) => {
  test.skip(!process.env.CAPTURE, "set CAPTURE=1 to refresh docs/design screenshots");
  for (const theme of ["light", "dark"] as const) {
    await openWithTheme(page, theme);
    await page.screenshot({
      path: `docs/design/styleguide-${theme}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
});
