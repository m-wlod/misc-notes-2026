import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";
import { INTERVIEW_KEY } from "../src/features/interview/store";

/**
 * Phase 11a: the interview room. Mental math and market making run entirely in the
 * browser, so both are played with the network switched off after the page loads.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

/** The result of a question like "7 × 8 =" or "120 − 45 =". */
function solve(label: string): string {
  const m = /^\s*(\d+)\s*([+−×÷])\s*(\d+)/.exec(
    label.replace(/\s/g, " ").replace(/(\d)\s(?=\d{3})/g, "$1"),
  );
  if (!m) throw new Error(`unexpected question: ${label}`);
  const [a, b] = [Number(m[1]), Number(m[3])];
  const r = m[2] === "+" ? a + b : m[2] === "−" ? a - b : m[2] === "×" ? a * b : a / b;
  return String(r);
}

const hydrated = async (page: Page) => {
  await expect(page.getByRole("radio", { checked: true }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
};

test("the hub lists the five session types; two are playable", async ({ page }) => {
  await page.goto("/pl/rozmowa");
  await expect(page.getByRole("heading", { level: 1, name: "Rozmowa rekrutacyjna" })).toBeVisible();
  await expect(page.locator("li[data-kind]")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Liczenie w pamięci" })).toHaveAttribute(
    "href",
    "/pl/rozmowa/matematyka-w-pamieci",
  );
  await expect(page.getByRole("link", { name: "Market making" })).toBeVisible();
  await axe(page);
});

test("mental math offline: answer, time runs out, scorecard, personal best, history", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T10:00:00Z") });
  await page.goto("/pl/rozmowa/matematyka-w-pamieci");
  await hydrated(page);
  await context.setOffline(true);

  await page.getByRole("radio", { name: "Poziom 1" }).check();
  await page.getByRole("button", { name: "Start" }).click();
  const field = page.locator("#mm-answer");
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(`Działanie ${String(i + 1)} z 80`)).toBeVisible();
    const label = await page.locator('label[for="mm-answer"]').innerText();
    await field.fill(solve(label));
    await field.press("Enter");
  }
  await field.fill("-1");
  await field.press("Enter");
  await expect(page.getByText("Działanie 5 z 80")).toBeVisible();
  await expect(page.getByText("Zostało")).toBeVisible();

  // Eight minutes later the session ends by itself.
  await page.clock.fastForward(8 * 60_000);
  await expect(page.getByRole("heading", { name: "Karta wyników" })).toBeVisible();
  await expect(page.getByText("Poprawnie: 3 z 80")).toBeVisible();
  await expect(page.getByText("Odpowiedzi: 4 z 80")).toBeVisible();
  await expect(
    page.getByText("Nowy rekord osobisty na tym poziomie.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Przegląd odpowiedzi" })).toBeVisible();
  await axe(page);

  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown,
    INTERVIEW_KEY,
  );
  expect(stored).toMatchObject({
    sessions: [
      { kind: "mental_math", level: 1, correct: 3, answered: 4, total: 80, personalBest: true },
    ],
    best: { "mental_math:1": 0.0375 },
  });

  await context.setOffline(false);
  await page.goto("/pl/rozmowa/historia");
  await expect(
    page.getByRole("img", { name: /Liczenie w pamięci: 1 sesji, ostatni wynik 4%/ }),
  ).toBeVisible();
  await expect(page.getByRole("row").nth(1)).toContainText(/4%\s*\(rekord\)/);
});

test("market making offline: quote, trade, P&L and the expected-value reasoning", async ({
  page,
  context,
}) => {
  await page.goto("/pl/rozmowa/market-making");
  await hydrated(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Runda 1 z 5")).toBeVisible();
  await axe(page);

  // A crossed quote is refused in words.
  await page.getByLabel("Bid: po ile kupisz").fill("12");
  await page.getByLabel("Ask: po ile sprzedasz").fill("10");
  await page.getByRole("button", { name: "Wystaw kwotowanie" }).click();
  await expect(page.getByText("Bid musi być niższy niż ask.")).toHaveAttribute("role", "alert");

  // A very wide quote always contains the expected value.
  await page.getByLabel("Bid: po ile kupisz").fill("0");
  await page.getByLabel("Ask: po ile sprzedasz").fill("100");
  await page.getByRole("button", { name: "Wystaw kwotowanie" }).click();
  await expect(page.getByText(/Wynik rundy \(P&L\)/)).toBeVisible();
  await expect(page.getByText(/Wartość oczekiwana: /)).toBeVisible();
  await expect(page.getByText(/Wartość oczekiwana mieści się w Twoim kwotowaniu/)).toBeVisible();
  await expect(page.getByText("Ocena kwotowania: 50%.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Następna runda" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Runda 2 z 5")).toBeVisible();
  await page.getByRole("button", { name: "Zakończ teraz" }).click();
  await expect(page.getByRole("heading", { name: "Karta wyników" })).toBeVisible();
  await expect(page.getByText(/Łączny P&L/)).toBeVisible();
  await expect(page.getByText("Odpowiedzi: 1 z 5")).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: interview history with a chart (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([themeKey, theme, key]) => {
        window.localStorage.setItem(themeKey, theme);
        const entry = (id: string, score: number, day: number) => ({
          id,
          kind: "mental_math",
          level: 3,
          finishedAt: `2026-11-0${String(day)}T10:00:00.000Z`,
          score,
          correct: Math.round(score * 80),
          answered: 70,
          total: 80,
          avgMs: 5000,
          durationMs: 480000,
          review: [],
        });
        window.localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            sessions: [entry("a", 0.5, 1), entry("b", 0.6, 2), entry("c", 0.55, 3)],
            best: { "mental_math:3": 0.6 },
          }),
        );
      },
      [THEME_STORAGE_KEY, theme, INTERVIEW_KEY] as const,
    );
    await page.goto("/pl/rozmowa/historia");
    await expect(
      page.getByRole("img", { name: /3 sesji, ostatni wynik 55%, najlepszy 60%/ }),
    ).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(4);
    await axe(page);
  });
}
