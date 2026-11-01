import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

// WCAG 2.1 A/AA plus axe best practices (landmarks, region, heading order): review M8.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function openWithTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
  await page.goto("/pl/styleguide");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.evaluate(() => document.fonts.ready);
}

async function axeViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  const results = await (include ? builder.include(include) : builder).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)})`);
}

/** Resolve a CSS custom property to the browser's computed rgb() string. */
async function cssVarAsRgb(page: Page, name: string) {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  }, name);
}

for (const theme of ["light", "dark"] as const) {
  test(`style guide has no axe violations (${theme})`, async ({ page }) => {
    await openWithTheme(page, theme);
    expect(await axeViolations(page)).toEqual([]);
  });

  test(`open dialog and popover have no axe violations (${theme})`, async ({ page }) => {
    await openWithTheme(page, theme);

    await page.getByRole("button", { name: "Pokaż rozwiązanie" }).click();
    const dialog = page.getByRole("dialog", { name: "Rozwiązanie" });
    await expect(dialog).toBeVisible();
    expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Martyngał" }).click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toBeVisible();
    expect(await axeViolations(page, "[data-radix-popper-content-wrapper]")).toEqual([]);
    await page.keyboard.press("Escape");
  });
}

test("dialog traps focus and returns it to the trigger", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "keyboard behaviour is a desktop concern");
  await openWithTheme(page, "light");
  const trigger = page.getByRole("button", { name: "Pokaż rozwiązanie" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("select highlights the active option with the focus colour", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "keyboard behaviour is a desktop concern");
  await openWithTheme(page, "light");
  await page.getByRole("combobox", { name: "Poziom" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  // Re-resolve the highlighted option on every retry: Radix may move the highlight
  // between finding the element and reading its style.
  const active = page.locator('[role="option"][data-highlighted]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveCSS("outline-style", "solid");
  await expect(active).toHaveCSS("outline-width", "2px");
  await expect(active).toHaveCSS("outline-color", await cssVarAsRgb(page, "--focus"));
  await page.keyboard.press("Escape");
});

test("stored dark theme applies before first paint (no flash)", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "dark");
    // Runs before any page script: record the theme the first frame is painted with.
    requestAnimationFrame(() => {
      (window as unknown as { firstFrameTheme: string | null }).firstFrameTheme =
        document.documentElement.getAttribute("data-theme");
    });
  }, THEME_STORAGE_KEY);
  await page.goto("/pl/styleguide");
  await page.waitForFunction(() => "firstFrameTheme" in window);
  const first = await page.evaluate(
    () => (window as unknown as { firstFrameTheme: string | null }).firstFrameTheme,
  );
  expect(first).toBe("dark");
});

test("theme switch changes and remembers the theme", async ({ page }) => {
  // No init script here: it would re-seed the stored theme on reload.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/pl/styleguide");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "Ciemny" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("every focusable element shows a 2px focus ring in the focus colour", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "keyboard focus is a desktop concern");
  await openWithTheme(page, "light");
  const focusRgb = await cssVarAsRgb(page, "--focus");
  await page.locator("body").click({ position: { x: 1, y: 1 } });

  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        id: `${el.tagName}#${el.id}.${el.textContent.trim().slice(0, 30)}`,
        style: s.outlineStyle,
        width: parseFloat(s.outlineWidth),
        color: s.outlineColor,
      };
    });
    if (!info) continue;
    if (seen.has(info.id)) break; // wrapped around
    seen.add(info.id);
    expect(info.style, `no outline on ${info.id}`).not.toBe("none");
    expect(info.width, `outline too thin on ${info.id}`).toBeGreaterThanOrEqual(2);
    expect(info.color, `outline colour on ${info.id}`).toBe(focusRgb);
  }
  expect(seen.size).toBeGreaterThan(15);
});

test("Polish diacritics render in the self-hosted fonts", async ({ page }) => {
  await openWithTheme(page, "light");
  for (const family of ["Newsreader", "IBM Plex Sans", "IBM Plex Mono"]) {
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

test("number input accepts Polish decimals and explains bad input in words", async ({ page }) => {
  await openWithTheme(page, "light");
  const input = page.getByLabel("Odpowiedź liczbowa");
  await expect(page.getByText("0,25 (decimal)")).toBeVisible();
  await input.fill("12,5%");
  await expect(page.getByText("0,125 (percent)")).toBeVisible();
  await input.fill("1,000");
  await input.blur();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Niejednoznaczny zapis");
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
