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

test("the hub lists the five session types, all playable, and the roadmap", async ({ page }) => {
  await page.goto("/pl/rozmowa");
  await expect(page.getByRole("heading", { level: 1, name: "Rozmowa rekrutacyjna" })).toBeVisible();
  await expect(page.locator("li[data-kind]")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Liczenie w pamięci" })).toHaveAttribute(
    "href",
    "/pl/rozmowa/matematyka-w-pamieci",
  );
  for (const name of [
    "Market making",
    "Sprint z prawdopodobieństwa",
    "Łamigłówki",
    "Pytanie o modelowanie",
  ]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
  await axe(page);
  await page.getByRole("link", { name: "Plan przygotowań" }).click();
  await expect(page).toHaveURL(/\/pl\/rozmowa\/plan-przygotowan$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { level: 2, name: /Prawdopodobieństwo i kombinatoryka/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Prawdopodobieństwo" }).first()).toHaveAttribute(
    "href",
    /\/pl\/nauka\//,
  );
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

/** Answers whatever auto-graded question is shown (the pick is seeded, the type varies). */
async function answerAny(page: Page) {
  const number = page.getByLabel("Twoja odpowiedź");
  const expression = page.getByLabel("Wyrażenie");
  if (await number.count()) await number.fill("1");
  else if (await expression.count()) await expression.fill("x");
  else if (await page.getByRole("radio").count()) await page.getByRole("radio").first().check();
  else if (await page.getByRole("checkbox").count())
    await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Sprawdź" }).click();
}

test("probability sprint on the samples: one way only, scorecard, review with solutions", async ({
  page,
}) => {
  // Grading is rate-limited per client; this test is its own client.
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.1.${String(Math.floor(Math.random() * 250))}.1`,
  });
  await page.goto("/pl/rozmowa/sprint-prawdopodobienstwa");
  await hydrated(page);
  await expect(page.getByText(/Na razie ta sesja ma \d+ z 10 pytań/)).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByText(/Pytanie 1 z \d+/)).toBeVisible();
  await answerAny(page);
  await expect(page.getByText(/Pytanie 2 z \d+/)).toBeVisible();
  // No feedback during the sprint, and no way back.
  await expect(page.getByText("Dobrze!")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Wstecz|Poprzednie/ })).toHaveCount(0);
  await answerAny(page);
  await expect(page.getByText(/Pytanie 3 z \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Zakończ teraz" }).click();

  await expect(page.getByRole("heading", { name: "Karta wyników" })).toBeVisible();
  await expect(page.getByText(/Odpowiedzi: 2 z \d+/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Przegląd odpowiedzi" })).toBeVisible();
  await page.getByRole("button", { name: "Pokaż rozwiązanie" }).first().click();
  await expect(page.getByRole("button", { name: "Pokaż rozwiązanie" })).toHaveCount(
    (await page.locator("ol > li").count()) - 1,
  );
  await axe(page);
});

test("brainteasers without AI: answer, self-check, next, scorecard", async ({ page }) => {
  await page.goto("/pl/rozmowa/lamiglowki");
  await hydrated(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Pytanie 1 z 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zadaj mi pytanie dodatkowe" })).toHaveCount(0);
  await page.getByLabel("Twoja odpowiedź").fill("22 razy, bo 11 razy na 12 godzin.");
  await page.getByRole("button", { name: "Porównaj z rozwiązaniem" }).click();
  await page.getByLabel("Podaje 22").check();
  await page.getByLabel("Wyjaśnia, że w 12 godzin wskazówki pokrywają się 11 razy").check();
  await page.getByRole("button", { name: "Zapisz samoocenę" }).click();
  await page.getByRole("button", { name: "Dalej" }).click();
  await expect(page.getByRole("heading", { name: "Karta wyników" })).toBeVisible();
  await expect(page.getByText("Wynik: 100%")).toBeVisible();
});

test("the follow-up route needs an account", async ({ request }) => {
  const res = await request.post("/api/interview/follow-up", {
    data: { exerciseId: "przyklad-otwarte", version: 0, locale: "pl", answer: "Test." },
  });
  expect(res.status()).toBe(401);
});
