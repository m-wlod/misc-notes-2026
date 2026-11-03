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

test.describe("entries (16b, labelled samples on internal deployments)", () => {
  const ENTRY = "/pl/debunk/przyklad-90-procent-skutecznosci";

  test("index lists the samples and filters by category and verdict", async ({ page }) => {
    await page.goto("/pl/debunk");
    await expect(page.getByRole("heading", { level: 1, name: "Debunk Lab" })).toBeVisible();
    const list = page.locator("[data-debunk-list] [data-entry]");
    await expect(list).toHaveCount(2);
    await page.getByLabel("Kategoria").selectOption("course-economics");
    await page.getByRole("button", { name: "Pokaż" }).click();
    await expect(page).toHaveURL(/kategoria=course-economics/);
    await expect(list).toHaveCount(1);
    await expect(list.first()).toContainText("kurs sam się zwróci");
    await page.goto("/pl/debunk?werdykt=false");
    await expect(page.getByText("Brak wpisów dla tych filtrów.")).toBeVisible();
    await page.goto("/pl/debunk?werdykt=misleading&kategoria=nonsense");
    await expect(list).toHaveCount(2); // unknown values are ignored
  });

  test("an entry: verdict, the maths in both depths, a working checker, sources", async ({
    page,
  }) => {
    await page.goto(ENTRY);
    const article = page.locator("[data-debunk-entry='przyklad-skutecznosc']");
    await expect(article.getByRole("heading", { level: 1 })).toContainText("90% skuteczności");
    await expect(article.locator("[data-verdict-badge='misleading']").first()).toContainText(
      "Wprowadza w błąd",
    );
    await expect(article.locator("[data-block='the-math']")).toContainText("średnio tracisz");
    await page.getByRole("radio", { name: "Podręcznik" }).check();
    await expect(article.locator("[data-block='the-math'] .katex").first()).toBeVisible();
    const checker = article.locator("[data-checker='ev']");
    await checker.getByLabel("Średnia strata").fill("5");
    await expect(
      checker.locator("dt", { hasText: "Wartość oczekiwana na transakcję" }).locator("+ dd"),
    ).toHaveText("7,5");
    await expect(article.locator("[data-block='instead']")).toBeVisible();
    await expect(article.getByText("Hasło sformułowane ogólnie")).toBeVisible();
  });

  test("share card, recording layout and the English entry", async ({ page, request }) => {
    for (const [format, w, h] of [
      ["og", 1200, 630],
      ["story", 1080, 1920],
    ] as const) {
      const res = await request.get(
        `/api/share/debunk?id=przyklad-skutecznosc&lang=pl&format=${format}`,
      );
      expect(res.status()).toBe(200);
      const body = await res.body();
      expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([w, h]);
    }
    expect((await request.get("/api/share/debunk?id=nie-ma&lang=pl")).status()).toBe(404);
    expect((await request.get("/api/share/debunk?id=../x")).status()).toBe(400);
    await page.goto(`${ENTRY}?nagranie=1`);
    const frame = page.locator("[data-recording]");
    await expect(frame.locator("[data-checker='ev']")).toBeVisible();
    await expect(frame.getByRole("link", { name: /1080×1920/ })).toHaveAttribute(
      "href",
      /format=story/,
    );
    await page.goto("/en/debunk/sample-90-percent-win-rate");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("90% win rate");
  });

  test("submissions and corrections say honestly they need accounts here", async ({ page }) => {
    await page.goto("/pl/debunk");
    const form = page.locator("[data-submit-claim]");
    await form.getByLabel("Hasło").fill("Ten wskaźnik ma 95% trafności, tak piszą w reklamie.");
    await form.getByRole("button", { name: "Wyślij" }).click();
    await expect(form.getByRole("status")).toHaveText(
      "Zgłoszenia ruszą razem z kontami w tej wersji aplikacji.",
    );
    await form.getByLabel("Hasło").fill("krótko");
    await form.getByRole("button", { name: "Wyślij" }).click();
    await expect(form.getByRole("status")).toContainText("co najmniej 10 znaków");

    await page.goto(ENTRY);
    await page.getByRole("button", { name: "Zgłoś poprawkę" }).click();
    const correction = page.locator("[data-correction]");
    await correction
      .getByLabel("Co jest nie tak i jak to poprawić?")
      .fill("Próg zera to 91,8%, nie 92%.");
    await correction.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
    await expect(correction.getByRole("status")).toHaveText(
      "Zgłoszenia ruszą razem z kontami w tej wersji aplikacji.",
    );
  });

  test("the admin queue is a 403 for visitors and shows nothing of the queue", async ({ page }) => {
    const res = await page.goto("/pl/admin/debunk");
    expect(res?.status()).toBe(403);
    await expect(page.getByRole("heading", { level: 1, name: "Brak dostępu" })).toBeVisible();
    await expect(page.getByText("Kolejka Debunk Lab")).toHaveCount(0);
    await expect(page.locator(`meta[name="robots"]`).first()).toHaveAttribute("content", /noindex/);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`index and entry pass axe (${theme})`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value);
        },
        [THEME_STORAGE_KEY, theme] as const,
      );
      await page.goto("/pl/debunk");
      await axe(page, "main");
      await page.goto(ENTRY);
      await page.getByRole("button", { name: "Zgłoś poprawkę" }).click();
      await axe(page, "main");
    });
  }
});
