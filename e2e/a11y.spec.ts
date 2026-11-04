import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 20b: one axe sweep over every public page type, in both languages and both
 * themes (the per-feature specs keep their own axe checks). Internal build, so the
 * labelled samples (lesson preview, exercises, debunk entries, video) are reachable.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Simulation slugs, [Polish, English] (src/features/sims/defs). */
const SIMS: [string, string][] = [
  ["bayes-skutecznosc-strategii", "bayes-win-rate"],
  ["rzut-moneta-czy-formacja", "coin-flip-or-pattern"],
  ["mapa-wartosci-oczekiwanej", "expected-value-map"],
  ["fourier-i-widmo", "fourier-spectrum"],
  ["ruch-browna", "brownian-motion"],
  ["kryterium-kelly-ego", "kelly-criterion"],
  ["prawo-wielkich-liczb-i-ctg", "law-of-large-numbers-and-clt"],
  ["martyngal-podwajanie-stawki", "martingale-doubling"],
  ["monte-carlo", "monte-carlo"],
  ["kreator-opcji", "option-payoff-builder"],
  ["przeuczony-backtest", "backtest-overfitting"],
  ["zmiennosc-zjada-zyski", "volatility-drag"],
];

/** [name, Polish path, English path] */
const ROUTES: [string, string, string][] = [
  ["landing", "/pl", "/en"],
  ["learn", "/pl/nauka", "/en/learn"],
  ["track", "/pl/nauka/fundamenty", "/en/learn/foundations"],
  ["module", "/pl/nauka/fundamenty/stopy-zwrotu", "/en/learn/foundations/returns"],
  [
    "lesson (in preparation)",
    "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly",
    "/en/learn/expected-value/betting/kelly-criterion",
  ],
  [
    "lesson (sample)",
    "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana",
    "/en/dev/content-preview?id=przyklad-wartosc-oczekiwana",
  ],
  ["textbook", "/pl/podrecznik", "/en/textbook"],
  ["map", "/pl/mapa", "/en/map"],
  ["notes", "/pl/notatki", "/en/notes"],
  ["practice", "/pl/praktyka", "/en/practice"],
  ["exercise: number", "/pl/praktyka/przyklad-liczba", "/en/practice/przyklad-liczba"],
  ["exercise: choice", "/pl/praktyka/przyklad-wybor", "/en/practice/przyklad-wybor"],
  ["exercise: slider", "/pl/praktyka/przyklad-suwak", "/en/practice/przyklad-suwak"],
  ["exercise: code", "/pl/praktyka/przyklad-kod", "/en/practice/przyklad-kod"],
  ["interview", "/pl/rozmowa", "/en/interview"],
  ["interview: mental maths", "/pl/rozmowa/matematyka-w-pamieci", "/en/interview/mental-math"],
  ["interview: market making", "/pl/rozmowa/market-making", "/en/interview/market-making"],
  ["interview history", "/pl/rozmowa/historia", "/en/interview/history"],
  ["interview roadmap", "/pl/rozmowa/plan-przygotowan", "/en/interview/roadmap"],
  ["debunk", "/pl/debunk", "/en/debunk"],
  [
    "debunk entry",
    "/pl/debunk/przyklad-90-procent-skutecznosci",
    "/en/debunk/sample-90-percent-win-rate",
  ],
  ["video", "/pl/v/przyklad", "/en/v/przyklad"],
  ["links", "/pl/links", "/en/links"],
  ["glossary", "/pl/slowniczek", "/en/glossary"],
  ["lab", "/pl/laboratorium", "/en/lab"],
  ["notebook", "/pl/laboratorium/notatnik", "/en/lab/notebook"],
  ["league", "/pl/liga", "/en/league"],
  ["review", "/pl/powtorka", "/en/review"],
  ["challenge", "/pl/wyzwanie", "/en/challenge"],
  ["about", "/pl/o-projekcie", "/en/about"],
  ["privacy", "/pl/prywatnosc", "/en/privacy"],
  ["terms", "/pl/regulamin", "/en/terms"],
  ["cookies", "/pl/cookies", "/en/cookies"],
  ["disclaimer", "/pl/zastrzezenia", "/en/disclaimer"],
  ["community guidelines", "/pl/zasady-spolecznosci", "/en/community-guidelines"],
  ["corrections", "/pl/korekty", "/en/corrections"],
  ["sign-in", "/pl/logowanie", "/en/sign-in"],
  ["placement", "/pl/test-poziomujacy", "/en/placement"],
  ["newsletter confirm", "/pl/newsletter/potwierdz", "/en/newsletter/confirm"],
  ["newsletter unsubscribe", "/pl/newsletter/wypisz", "/en/newsletter/unsubscribe"],
  ["not found", "/pl/nie-ma-takiej-strony", "/en/no-such-page"],
  ...SIMS.map(([pl, en]): [string, string, string] => [
    `simulation: ${en}`,
    `/pl/laboratorium/symulacje/${pl}`,
    `/en/lab/sims/${en}`,
  ]),
];

async function violations(page: Page, path: string, notFound: boolean): Promise<string[]> {
  const res = await page.goto(path);
  // A wrong path would only test the 404 page.
  if (!notFound) {
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("main h1").first(), path).not.toHaveText(
      /Nie ma takiej strony|No such page/,
    );
  }
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return result.violations.map(
    (v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

for (const [name, pl, en] of ROUTES) {
  for (const [locale, path] of [
    ["pl", pl],
    ["en", en],
  ] as const) {
    test(`axe: ${name} (${locale}, light and dark)`, async ({ page }) => {
      const found: string[] = [];
      for (const theme of ["light", "dark"] as const) {
        await page.addInitScript(
          ([key, value]) => {
            window.localStorage.setItem(key, value);
          },
          [THEME_STORAGE_KEY, theme] as const,
        );
        found.push(
          ...(await violations(page, path, name === "not found")).map((v) => `[${theme}] ${v}`),
        );
      }
      expect(found).toEqual([]);
    });
  }
}
