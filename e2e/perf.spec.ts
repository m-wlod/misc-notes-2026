import { expect, test, type Page } from "./test";

/**
 * Phase 20c: the weight of each key page and what loads lazily.
 * - Budgets: compressed JavaScript per page (what a phone on 4G downloads). Measured
 *   2026-11-09 at 250–276 kB and set with ~15% headroom: a jump means something heavy got
 *   bundled in (as KaTeX was, through the post composer's preview, until 20c).
 * - Lazy: the Python runtime (Pyodide, from jsDelivr, inside a worker), the code editor
 *   (CodeMirror) and the simulation worker load only where and when they are needed.
 */
test.skip(({ isMobile }) => isMobile, "byte counts don't depend on the viewport");

/** [name, path, budget in kB of compressed JS] */
const BUDGETS: [string, string, number][] = [
  ["landing", "/pl", 320],
  ["lesson", "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly", 310],
  ["sample lesson", "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana", 310],
  ["exercise", "/pl/praktyka/przyklad-liczba", 310],
  ["debunk entry", "/pl/debunk/przyklad-90-procent-skutecznosci", 310],
  ["simulation", "/pl/laboratorium/symulacje/ruch-browna", 300],
];

type Load = { jsBytes: number; urls: string[] };

/**
 * The page's own JavaScript: scripts requested until the `load` event. After that Next
 * prefetches the code of links on screen, which depends on how many links a page has.
 */
async function load(page: Page, path: string): Promise<Load> {
  const scripts: Promise<number>[] = [];
  const urls: string[] = [];
  let loaded = false;
  page.on("load", () => {
    loaded = true;
  });
  page.on("requestfinished", (req) => {
    urls.push(req.url());
    if (!loaded && req.resourceType() === "script") {
      scripts.push(req.sizes().then((s) => s.responseBodySize));
    }
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const sizes = await Promise.all(scripts);
  return { jsBytes: sizes.reduce((a, b) => a + b, 0), urls };
}

/** CodeMirror's chunk carries its CSS class names; nothing else does. */
async function editorLoaded(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.querySelector(".cm-editor"));
}

for (const [name, path, budget] of BUDGETS) {
  test(`budget: ${name} ships at most ${String(budget)} kB of JavaScript`, async ({
    page,
  }, info) => {
    const { jsBytes, urls } = await load(page, path);
    const kb = Math.round(jsBytes / 1024);
    info.annotations.push({ type: "js", description: `${name}: ${String(kb)} kB` });
    console.log(`[perf] ${name}: ${String(kb)} kB JS`);
    expect(kb).toBeLessThanOrEqual(budget);
    // Never on a page without code cells.
    expect(urls.filter((u) => u.includes("pyodide"))).toEqual([]);
    expect(page.workers().filter((w) => w.url().includes("py.worker"))).toEqual([]);
  });
}

test("lazy: no editor, no Python and no simulation worker on a plain lesson", async ({ page }) => {
  await load(page, "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly");
  expect(await editorLoaded(page)).toBe(false);
  expect(page.workers()).toEqual([]);
});

test("lazy: Python starts only when a cell is run", async ({ page }) => {
  const { urls } = await load(page, "/pl/laboratorium/notatnik");
  expect(urls.filter((u) => u.includes("pyodide"))).toEqual([]);
  expect(page.workers()).toEqual([]);
  await page.getByRole("button", { name: /Uruchom komórkę 1/ }).click();
  await expect.poll(() => page.workers().length, { timeout: 15_000 }).toBeGreaterThan(0);
});

test("lazy: the simulation worker starts only on a page with a heavy simulation", async ({
  page,
}) => {
  await load(page, "/pl/praktyka/przyklad-liczba");
  expect(page.workers()).toEqual([]);
  await page.goto("/pl/laboratorium/symulacje/ruch-browna");
  await expect.poll(() => page.workers().length, { timeout: 15_000 }).toBeGreaterThan(0);
});
