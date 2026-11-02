import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";
import { LOCAL_PROGRESS_KEY } from "../src/features/progress/schema";

/**
 * Phase 8a: the exercise engine on the labelled sample exercises (visible on internal
 * deployments only). Grading happens on the server; attempts are kept in this browser.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const url = (id: string, v?: number) =>
  `/pl/praktyka/${id}${v === undefined ? "" : `?v=${String(v)}`}`;

/** The card is interactive once the theme switch (shell) and the card have hydrated. */
async function open(page: Page, id: string, v?: number) {
  await page.goto(url(id, v));
  await expect(page.getByRole("radio", { checked: true }).first()).toBeVisible();
  await expect(page.locator(`article[data-exercise="${id}"]`)).toBeVisible();
}

// Grading is rate-limited per client IP (30/min). Each test acts as its own client, so
// the desktop and mobile runs don't use up one shared "local" budget.
test.beforeEach(async ({ page }) => {
  const ip = `10.0.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

const status = (page: Page) =>
  page.getByRole("status").filter({ hasText: /Dobrze|Częściowo|Jeszcze nie|Za dużo|Nie / });
const attempts = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw
      ? (JSON.parse(raw) as { attempts: { exerciseId: string; score: number }[] }).attempts
      : [];
  }, LOCAL_PROGRESS_KEY);

test("wrong answer → hint (H) → solution → similar exercise (N) → correct", async ({ page }) => {
  await open(page, "przyklad-liczba");
  const input = page.getByLabel("Twoja odpowiedź");
  await input.fill("6");
  await input.press("Enter");
  await expect(status(page)).toContainText("Jeszcze nie.");
  expect(await attempts(page)).toEqual([
    expect.objectContaining({ exerciseId: "przyklad-liczba", score: 0 }),
  ]);

  await page.locator("body").press("h");
  await expect(page.getByText("Podpowiedź 1 z 2")).toBeVisible();
  await expect(page.getByText("Dodaj obie liczby.")).toBeVisible();

  await page.getByRole("button", { name: "Pokaż rozwiązanie" }).click();
  await expect(page.getByRole("region", { name: "Rozwiązanie" })).toContainText("Dodajemy");

  // "Podobne zadanie": the next variant of the same exercise.
  await page.getByRole("button", { name: "Podobne zadanie" }).click();
  await expect(page).toHaveURL(/przyklad-liczba\?v=1$/, { timeout: 15_000 });
  await expect(page.locator("article").getByText("Przykład: ile wynosi suma liczb")).toContainText(
    "4",
  );
  await page.getByLabel("Twoja odpowiedź").fill("11");
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(status(page)).toContainText("Dobrze!");
  expect((await attempts(page)).at(-1)).toMatchObject({ exerciseId: "przyklad-liczba", score: 1 });

  // N: the next exercise in the set (here: all exercises, by level then id).
  await page.waitForLoadState("networkidle");
  await page.locator("body").press("n");
  await expect(page).toHaveURL(/\/pl\/praktyka\/przyklad-losowe$/, { timeout: 15_000 });
});

test("every gradable type can be solved", async ({ page }) => {
  // numeric with a Polish decimal comma is covered above; here: the rest.
  await open(page, "przyklad-szacowanie");
  await page.getByLabel("Twoja odpowiedź").fill("432000");
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(status(page)).toContainText("Częściowo dobrze (50%).");

  await open(page, "przyklad-suwak");
  const slider = page.getByRole("slider", { name: "Wartość" });
  await slider.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Wybrano: 5")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("Dobrze!");

  await open(page, "przyklad-wyrazenie");
  await page.getByLabel("Wyrażenie").fill("x^2 + 2x + 1");
  await expect(page.getByTestId("expression-preview").locator("math")).toBeAttached();
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(status(page)).toContainText("Dobrze!");

  await open(page, "przyklad-wybor");
  await page.getByRole("radio", { name: "4" }).check();
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("Dobrze!");

  await open(page, "przyklad-wielokrotny");
  await page.getByRole("checkbox", { name: "2" }).check();
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(status(page)).toContainText("Częściowo dobrze (50%).");
  await page.getByRole("button", { name: "Spróbuj ponownie" }).click();
  await page.getByRole("checkbox", { name: "5" }).check();
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(status(page)).toContainText("Dobrze!");

  expect((await attempts(page)).map((a) => a.score)).toEqual([0.5, 1, 1, 1, 0.5, 1]);
});

test("ordering by keyboard, with each move announced", async ({ page }) => {
  await open(page, "przyklad-kolejnosc");
  const items = page.locator("li[data-option]");
  const ids = async () => items.evaluateAll((els) => els.map((e) => e.getAttribute("data-option")));
  // Bubble the list into b, a, c with the move buttons only.
  for (let pass = 0; pass < 3; pass++) {
    const order = await ids();
    for (let i = 0; i < order.length - 1; i++) {
      const rank = { b: 0, a: 1, c: 2 } as Record<string, number>;
      const current = await ids();
      const [x, y] = [current[i] ?? "", current[i + 1] ?? ""];
      if ((rank[x] ?? 0) > (rank[y] ?? 0)) {
        await items
          .nth(i)
          .getByRole("button", { name: /^Przesuń niżej/ })
          .click();
      }
    }
  }
  expect(await ids()).toEqual(["b", "a", "c"]);
  await expect(page.getByText(/jest teraz na pozycji/)).toBeAttached();
  await page.getByRole("button", { name: "Sprawdź" }).click();
  await expect(status(page)).toContainText("Dobrze!");
});

test("the answer is not in the page before submitting", async ({ page }) => {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() === "document" || res.request().resourceType() === "fetch") {
      bodies.push(await res.text().catch(() => ""));
    }
  });
  await open(page, "przyklad-kolejnosc");
  const all = bodies.join("\n") + (await page.content());
  // The ordering answer, the hint and the solution must not be shipped up front.
  expect(all).not.toContain('"answer"');
  expect(all).not.toContain("Zamień wszystko na ułamki dziesiętne");
  expect(all).not.toContain("0{,}1 &lt; 0{,}5");
  expect(
    await page
      .locator("li[data-option]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-option"))),
  ).not.toEqual(["b", "a", "c"]);
});

test("code exercises render with an honest note and no grading yet", async ({ page }) => {
  await open(page, "przyklad-kod");
  await expect(page.getByLabel("Kod")).toHaveValue(/def double\(x\):/);
  await expect(
    page.getByText("Uruchamianie i sprawdzanie kodu pojawi się razem z Laboratorium."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sprawdź" })).toHaveCount(0);
});

test.describe("open answers (Phase 10, AI switched off)", () => {
  test("write, compare with the solution, tick the rubric, save a self-assessment", async ({
    page,
  }) => {
    const bodies: string[] = [];
    page.on("response", async (res) => {
      const type = res.request().resourceType();
      if (type === "document" || type === "fetch") bodies.push(await res.text().catch(() => ""));
    });
    await open(page, "przyklad-otwarte");
    // Neither the solution nor the rubric is shipped before the learner asks.
    const before = bodies.join("\n") + (await page.content());
    expect(before).not.toContain("Średnia to suma wartości");
    expect(before).not.toContain("Mówi, że wartości się sumuje");

    await expect(
      page.getByText("Ocena przez AI jest jeszcze wyłączona.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Oceń odpowiedź" })).toHaveCount(0);
    const answer = page.getByLabel("Twoja odpowiedź");
    await answer.fill("Sumuję wszystkie liczby i dzielę przez ich ilość.");
    await expect(page.getByText("8 słów z 1500")).toBeVisible();

    await page.getByRole("button", { name: "Porównaj z rozwiązaniem" }).click();
    await expect(
      page.getByText("Średnia to suma wartości podzielona przez ich liczbę."),
    ).toBeVisible();
    await page.getByLabel("Mówi, że wartości się sumuje").check();
    await page.getByRole("button", { name: "Zapisz samoocenę" }).click();
    await expect(
      page.getByText("Samoocena zapisana w tej przeglądarce: 1 z 2.", { exact: false }),
    ).toBeVisible();
    expect((await attempts(page)).at(-1)).toMatchObject({
      exerciseId: "przyklad-otwarte",
      score: 0.5,
    });
  });

  test("the word limit is shown and enforced by the server", async ({ page, request }) => {
    await open(page, "przyklad-lamiglowka");
    await page
      .getByLabel("Twoja odpowiedź")
      .fill(Array.from({ length: 1501 }, () => "x").join(" "));
    await expect(page.getByText("Za długo: odpowiedź może mieć najwyżej 1500 słów.")).toBeVisible();

    const post = (answer: string) =>
      request.post("/api/grade/open", {
        data: { exerciseId: "przyklad-otwarte", version: 0, locale: "pl", answer },
      });
    expect((await post(Array.from({ length: 1501 }, () => "x").join(" "))).status()).toBe(400);
    // Signed out: no AI grading (it needs an account), the card falls back to self-check.
    const signedOut = await post("Sumuję i dzielę.");
    expect(signedOut.status()).toBe(401);
    expect(await signedOut.json()).toMatchObject({ fallback: true });
  });
});

test("an unknown exercise is a 404", async ({ request }) => {
  const res = await request.get("/pl/praktyka/nie-ma-takiego-zadania");
  // Soft 404 under partial prerendering: the not-found page renders inside the shell.
  expect(await res.text()).toContain("noindex");
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: exercise card after grading (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await open(page, "przyklad-wielokrotny");
    await page.getByRole("checkbox", { name: "2" }).check();
    await page.getByRole("button", { name: "Sprawdź" }).click();
    await expect(status(page)).toBeVisible();
    await page.getByRole("button", { name: "Podpowiedź" }).click();
    await expect(page.getByText("Podpowiedź 1 z 1")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}

test.describe("random params (Phase 9)", () => {
  const numbers = async (page: Page) => {
    const parts = await page
      .locator('article[data-exercise="przyklad-losowe"] .text-reading .katex-html')
      .allInnerTexts();
    const [k, r] = parts.map((p) => Number(p.replace(/[^\d.]/g, "")));
    return { k: k ?? NaN, r: r ?? NaN };
  };

  test("each attempt has its own numbers and is graded on them", async ({ page }) => {
    const bodies: string[] = [];
    page.on("response", async (res) => {
      const type = res.request().resourceType();
      if (type === "document" || type === "fetch") bodies.push(await res.text().catch(() => ""));
    });
    await open(page, "przyklad-losowe");
    const first = await numbers(page);
    expect(first.k).toBeGreaterThanOrEqual(100);
    // Neither the formula nor the answer for these numbers is shipped before submitting.
    const answer = first.k * (1 + first.r / 100);
    const all = bodies.join("\n") + (await page.content());
    expect(all).not.toContain("1 + r / 100");
    expect(all).not.toContain("Dodaj go do kwoty");

    // The common mistake (the growth alone) gets targeted feedback.
    await page
      .getByLabel("Twoja odpowiedź")
      .fill(String((first.k * first.r) / 100).replace(".", ","));
    await page.getByRole("button", { name: "Sprawdź" }).click();
    await expect(page.getByTestId("mistake-feedback")).toContainText("To sam wzrost.");
    await page.getByRole("button", { name: "Spróbuj ponownie" }).click();
    await page.getByLabel("Twoja odpowiedź").fill(String(answer).replace(".", ","));
    await page.getByRole("button", { name: "Sprawdź" }).click();
    await expect(status(page)).toContainText("Dobrze!");

    // "Podobne zadanie" moves to the next attempt: new numbers, same learner cookie.
    const seen = new Set([JSON.stringify(first)]);
    for (let n = 1; n <= 3; n++) {
      await page.goto(`/pl/praktyka/przyklad-losowe?n=${String(n)}`);
      await expect(page.locator('article[data-exercise="przyklad-losowe"]')).toBeVisible();
      seen.add(JSON.stringify(await numbers(page)));
    }
    expect(seen.size).toBeGreaterThan(1);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "qla_sid")).toMatchObject({ httpOnly: true });
  });
});

test("the calibration job is dormant without a database", async ({ request }) => {
  const res = await request.get("/api/cron/calibrate");
  expect([401, 503]).toContain(res.status());
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: open answer with the self-check list (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await open(page, "przyklad-otwarte");
    await page.getByLabel("Twoja odpowiedź").fill("Sumuję i dzielę.");
    await page.getByRole("button", { name: "Porównaj z rozwiązaniem" }).click();
    await expect(page.getByRole("heading", { name: "Sprawdź się sam" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}
