import { expect, test, type Page } from "./test";

/**
 * Phase 20b: the keyboard pass on the lesson, exercise and simulation pages. The skip
 * link works; Tab reaches the footer without getting stuck; every stop shows a focus
 * ring; a simulation runs, pauses, steps, resets and takes new parameters from the
 * keyboard alone, and tells screen readers the result once it stops.
 */
test.skip(({ isMobile }) => isMobile, "keyboard navigation: desktop only");

const PAGES = [
  ["lesson", "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana"],
  ["exercise", "/pl/praktyka/przyklad-liczba"],
  ["simulation", "/pl/laboratorium/symulacje/rzut-moneta-czy-formacja"],
] as const;

type Stop = { tag: string; text: string; inFooter: boolean; ring: boolean; visible: boolean };

const focused = (page: Page) =>
  page.evaluate((): Stop | null => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const css = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`,
      text: (el.getAttribute("aria-label") ?? el.textContent).trim().slice(0, 40),
      inFooter: !!el.closest("footer"),
      // The global :focus-visible outline, or a component's own ring.
      ring:
        (css.outlineStyle !== "none" && parseFloat(css.outlineWidth) > 0) ||
        css.boxShadow !== "none",
      visible: r.width > 0 && r.height > 0,
    };
  });

for (const [name, path] of PAGES) {
  test(`keyboard: ${name} page, skip link, no trap, a visible ring on every stop`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Tab");
    expect((await focused(page))?.text).toBe("Przejdź do treści");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("content");

    const stops: Stop[] = [];
    for (let i = 0; i < 250; i++) {
      await page.keyboard.press("Tab");
      const s = await focused(page);
      if (!s) continue;
      stops.push(s);
      if (s.inFooter) break;
    }
    expect(stops.at(-1)?.inFooter, `Tab reaches the footer: ${JSON.stringify(stops.at(-1))}`).toBe(
      true,
    );
    // The same element twice in a row would mean Tab is captured (e.g. by an editor).
    const prev = (i: number) => stops[i - 1];
    const stuck = stops.filter(
      (s, i) => i > 0 && s.tag === prev(i)?.tag && s.text === prev(i)?.text,
    );
    expect(stuck).toEqual([]);
    expect(stops.filter((s) => !s.ring || !s.visible)).toEqual([]);
  });
}

test("keyboard: a simulation runs, steps, resets and changes a parameter", async ({ page }) => {
  await page.goto("/pl/laboratorium/symulacje/rzut-moneta-czy-formacja");
  await page.waitForLoadState("networkidle");
  const play = page.getByRole("button", { name: /^(Odtwórz|Od nowa)$/ });
  await expect(play).toBeEnabled({ timeout: 15_000 });
  const announce = page.locator("[data-sim-announce]");
  await expect(announce).toHaveText("");

  await play.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pauza" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^(Odtwórz|Od nowa)$/ })).toBeFocused();
  // Stopped: the result is announced once.
  await expect(announce).toContainText("Dzień");

  await page.keyboard.press("Tab");
  const step = page.getByRole("button", { name: "Krok" });
  if (await step.isEnabled()) {
    await expect(step).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
  }
  await expect(page.getByRole("button", { name: "Wyzeruj" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(announce).toContainText("Dzień 0");

  const range = page.getByRole("slider", { name: "Liczba wykresów" });
  const before = await range.inputValue();
  await range.focus();
  await page.keyboard.press("ArrowRight");
  await expect(range).not.toHaveValue(before);

  // The data table lists the parameters in force.
  const details = page.locator("[data-sim-data]");
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(details.getByRole("table")).toBeVisible();
  await expect(details.getByRole("row", { name: /Liczba wykresów/ })).toContainText(
    await range.inputValue(),
  );
});
