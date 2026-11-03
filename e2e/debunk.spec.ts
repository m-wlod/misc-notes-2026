import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 16a: the four Debunk Lab claim checkers, driven in the browser (on the style
 * guide until 16b gives them entry pages). Numbers checked against hand calculations.
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

const checker = (page: Page, id: string) => page.locator(`[data-specimen='checker-${id}']`);

test.beforeEach(async ({ page }) => {
  await page.goto("/pl/styleguide#checkers");
});

test("EV checker: 90% win rate, wins of 10, losses of 100, cost 1 → −2 per trade", async ({
  page,
}) => {
  const c = checker(page, "ev");
  const ev = c.locator("dt", { hasText: "Wartość oczekiwana na transakcję" }).locator("+ dd");
  await expect(ev).toHaveText("-2");
  await expect(c.locator("[data-verdict='negative']")).toContainText("91,8%");
  // Make losses small: 0,9·10 − 0,1·5 − 1 = 7,5 per trade, with a Polish decimal comma.
  const loss = c.getByLabel("Średnia strata");
  await loss.fill("5");
  await expect(ev).toHaveText("7,5");
  await c.getByLabel("Skuteczność (win rate)").fill("0,5");
  await expect(ev).toHaveText("1,5"); // 5 − 2,5 − 1
  await expect(c.locator("[data-verdict='positive']")).toBeVisible();
  await expect(c.getByRole("img", { name: /Rozkład kapitału po 200 transakcjach/ })).toBeVisible();
});

test("luck checker: 8 wins out of 10 at 50% is 5,5% by luck alone", async ({ page }) => {
  const c = checker(page, "luck");
  await c.getByLabel("Liczba transakcji").fill("10");
  await c.getByLabel("Wygrane").fill("8");
  await c.getByLabel("Ile strategii lub osób próbowało").fill("1");
  const tail = c
    .locator("dt", { hasText: "Szansa na co najmniej 8 wygranych z 10" })
    .locator("+ dd");
  await expect(tail).toHaveText("5,5%"); // 56/1024
  await c.getByLabel("Ile strategii lub osób próbowało").fill("20");
  const any = c
    .locator("dt", { hasText: "Szansa, że choć jedna z 20 prób" })
    .first()
    .locator("+ dd");
  await expect(any).toHaveText("67,5%"); // 1 − (1 − 56/1024)^20
});

test("MLM checker: bring 10 each and Poland runs out at level 8", async ({ page }) => {
  const c = checker(page, "mlm");
  await c.getByLabel("Ile osób musi przyprowadzić każdy uczestnik").fill("10");
  await expect(
    c.locator("dt", { hasText: "Poziom, na którym zabraknie ludzi" }).locator("+ dd"),
  ).toHaveText("poziom 8");
  await expect(c.locator("dt", { hasText: "Uczestnicy na dole" }).locator("+ dd")).toHaveText(
    "90%",
  );
});

test("indicator checker: signals on random walks are a coin flip", async ({ page }) => {
  const c = checker(page, "indicators");
  const rate = Number(await c.locator("[data-hit-rate]").getAttribute("data-hit-rate"));
  expect(rate).toBeGreaterThan(0.45);
  expect(rate).toBeLessThan(0.55);
  const chart = c.getByRole("img", { name: /Losowe błądzenie z sygnałami/ });
  await expect(chart).toHaveAttribute("data-seed", "42");
  await c.getByRole("button", { name: "Nowe błądzenie losowe" }).click();
  await expect(chart).toHaveAttribute("data-seed", "43");
  await c.getByLabel("Wskaźnik").selectOption("rsi");
  await expect(c.locator("[data-hit-rate]")).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`checkers pass axe (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/styleguide#checkers");
    await axe(page, "#checkers");
  });
}
