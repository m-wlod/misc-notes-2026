import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 13a: Python in the browser. Pyodide comes from jsDelivr. Each test has a fresh
 * browser context (an empty HTTP cache), so tests serve the CDN files from a disk cache
 * that fills on first use; only the browser-cache test downloads for real.
 * Runs that execute Python are desktop-only; the mobile project checks the read-only view.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const LESSON = "/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana";
const NOTEBOOK = "/pl/laboratorium/notatnik";
const LOAD = 120_000;
const CDN_CACHE = path.join("test-results", ".cdn-cache");

const desktopOnly = (name: string) => {
  test.skip(name !== "desktop", "runs Python: desktop only");
};

/** Serves Pyodide files from disk (fetched once per machine), including worker requests. */
async function cacheCdn(context: BrowserContext) {
  await mkdir(CDN_CACHE, { recursive: true });
  await context.route("https://cdn.jsdelivr.net/pyodide/**", async (route) => {
    const url = route.request().url();
    const key = createHash("sha256").update(url).digest("hex");
    const body = path.join(CDN_CACHE, key);
    const meta = `${body}.json`;
    try {
      const headers = JSON.parse(await readFile(meta, "utf8")) as Record<string, string>;
      await route.fulfill({ status: 200, headers, body: await readFile(body) });
      return;
    } catch {
      // not cached yet
    }
    const res = await route.fetch();
    if (res.ok()) {
      // The body is stored decoded, so drop the encoding headers.
      const headers = Object.fromEntries(
        Object.entries(res.headers()).filter(
          ([name]) => name !== "content-encoding" && name !== "content-length",
        ),
      );
      await writeFile(body, await res.body());
      await writeFile(meta, JSON.stringify(headers));
    }
    await route.fulfill({ response: res });
  });
}

test.beforeEach(async ({ context }, info) => {
  if (!info.title.includes("browser cache")) await cacheCdn(context);
});

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

/** Replaces an editor's text without CodeMirror's typing aids (indent, brackets). */
async function setEditor(page: Page, scope: ReturnType<Page["locator"]>, code: string) {
  const content = scope.locator(".cm-content");
  await expect(content).toBeVisible({ timeout: 15_000 });
  await content.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

test("lesson cells run, plot, edit with Ctrl+Enter and reset", async ({ page }, info) => {
  desktopOnly(info.project.name);
  test.setTimeout(LOAD * 2);
  await page.goto(LESSON);
  const cells = page.locator("[data-python-cell]");
  await expect(cells).toHaveCount(2);
  const first = cells.nth(0);
  const second = cells.nth(1);

  // Nothing is loaded until the reader asks.
  expect(
    await page.evaluate(() =>
      performance.getEntriesByType("resource").some((e) => e.name.includes("pyodide")),
    ),
  ).toBe(false);

  await first.getByRole("button", { name: "Uruchom" }).click();
  await expect(first.locator("[data-stream]")).toHaveText("0.0103 -0.316\n", { timeout: LOAD });
  await expect(first.getByText(/Gotowe w/)).toBeVisible();

  // The second cell loads numpy and pandas, reads a sample dataset and draws two plots.
  await second.getByRole("button", { name: "Uruchom" }).click();
  await expect(second.locator("figure[data-plot='line']")).toBeVisible({ timeout: LOAD });
  await expect(second.locator("figure[data-plot='hist']")).toBeVisible();
  await expect(
    second.getByRole("img", { name: /^Cena\. Wykres liniowy, 750 punktów\.$/ }),
  ).toBeVisible();
  await expect(
    second.getByRole("img", { name: /^Dzienne zwroty\. Histogram 749 wartości w 40/ }),
  ).toBeVisible();

  // Edit: the editor replaces the code; Ctrl+Enter runs; Reset restores the lesson's code.
  await first.getByRole("button", { name: "Edytuj" }).click();
  await setEditor(page, first, "print(6 * 7)");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(first.locator("[data-stream]")).toHaveText("42\n", { timeout: 30_000 });
  await first.getByRole("button", { name: "Przywróć" }).click();
  await expect(first.locator(".cm-content")).toContainText("p_ruin = q**7");
  await expect(first.getByRole("button", { name: "Przywróć" })).toBeDisabled();

  // Errors show the learner's own lines, not Pyodide's internals.
  await setEditor(page, first, "x = 1\n1 / 0");
  await page.keyboard.press("ControlOrMeta+Enter");
  const error = first.locator("[data-error]");
  await expect(error).toContainText("ZeroDivisionError: division by zero", { timeout: 30_000 });
  await expect(error).toContainText('File "<cell>", line 2');
  await expect(error).not.toContainText("_pyodide");
});

test("the time limit stops a runaway loop and the next run works", async ({ page }, info) => {
  desktopOnly(info.project.name);
  test.setTimeout(LOAD * 2);
  await page.goto(NOTEBOOK);
  const cell = page.locator("[data-cell]").first();
  await setEditor(page, cell, "x = 5\nwhile True:\n    pass");
  await cell.getByRole("button", { name: "Uruchom komórkę 1" }).click();
  await expect(cell.getByText(/Przekroczony limit czasu/)).toBeVisible({ timeout: LOAD });

  // A fresh Python: earlier variables are gone, new code runs.
  await setEditor(page, cell, "print('x' in globals())");
  await cell.getByRole("button", { name: "Uruchom komórkę 1" }).click();
  await expect(cell.locator("[data-stream]")).toHaveText("False\n", { timeout: LOAD });
});

test("Stop interrupts a run; matplotlib gets a pointer to show()", async ({ page }, info) => {
  desktopOnly(info.project.name);
  test.setTimeout(LOAD * 2);
  await page.goto(NOTEBOOK);
  const cell = page.locator("[data-cell]").first();
  await setEditor(page, cell, "import time\ntime.sleep(30)");
  await cell.getByRole("button", { name: "Uruchom komórkę 1" }).click();
  await expect(cell.getByText("Działa…")).toBeVisible({ timeout: LOAD });
  await cell.getByRole("button", { name: "Zatrzymaj" }).click();
  await expect(cell.getByText(/^Przerwano\./)).toBeVisible();

  await setEditor(page, cell, "import matplotlib.pyplot as plt");
  await cell.getByRole("button", { name: "Uruchom komórkę 1" }).click();
  await expect(cell.getByText(/Matplotlib nie jest tu dostępny/)).toBeVisible({ timeout: LOAD });
});

test("the second Pyodide load comes from the browser cache", async ({ page }, info) => {
  desktopOnly(info.project.name);
  // A real download on a fresh profile: allow for a slow connection.
  test.setTimeout(LOAD * 4);
  const runOnce = async () => {
    await page.goto(NOTEBOOK);
    const cell = page.locator("[data-cell]").first();
    await setEditor(page, cell, "print(1 + 1)");
    await cell.getByRole("button", { name: "Uruchom komórkę 1" }).click();
    await expect(cell.locator("[data-stream]")).toHaveText("2\n", { timeout: LOAD * 2 });
  };
  await runOnce();
  await expect(page.getByText("Python gotowy", { exact: true })).toBeVisible();
  // A new page, same browser: the worker reports every runtime file came from the cache
  // (it reads its own resource timings, which the page can't see).
  await runOnce();
  await expect(page.getByText("Python gotowy (wczytany z pamięci przeglądarki)")).toBeVisible();
});

test("the notebook keeps cells after a reload and exports a .py file", async ({ page }, info) => {
  desktopOnly(info.project.name);
  await page.goto(NOTEBOOK);
  await expect(page.locator("[data-cell]")).toHaveCount(2);
  await page.getByRole("button", { name: "Dodaj komórkę pod komórką 2" }).click();
  await expect(page.locator("[data-cell]")).toHaveCount(3);
  await setEditor(page, page.locator("[data-cell]").nth(2), "wynik = 2 ** 10");
  await page.reload();
  await expect(page.locator("[data-cell]")).toHaveCount(3);
  await expect(page.locator("[data-cell]").nth(2).locator(".cm-content")).toHaveText(
    "wynik = 2 ** 10",
    { timeout: 15_000 },
  );

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz .py" }).click();
  const file = await (await download).path();
  const text = await readFile(file, "utf8");
  expect(text.match(/^# %%$/gm)).toHaveLength(3);
  expect(text).toContain("wynik = 2 ** 10");

  // Moving and deleting.
  await page.getByRole("button", { name: "Przesuń komórkę 3 w górę" }).click();
  await expect(page.locator("[data-cell]").nth(1).locator(".cm-content")).toHaveText(
    "wynik = 2 ** 10",
  );
  await page.getByRole("button", { name: "Usuń komórkę 2" }).click();
  await expect(page.locator("[data-cell]")).toHaveCount(2);
});

test("sample datasets download as CSV", async ({ page }) => {
  await page.goto(NOTEBOOK);
  const res = await page.request.get("/datasets/ceny-gbm.csv");
  expect(res.ok()).toBe(true);
  expect((await res.text()).split("\n")[0]).toBe("date,close");
  await expect(page.locator("[data-dataset='ceny-gbm'] a")).toHaveAttribute(
    "href",
    "/datasets/ceny-gbm.csv",
  );
});

test("mobile: notebook code is read-only until Edit, with no sideways scroll", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "mobile layout");
  await page.goto(NOTEBOOK);
  const cell = page.locator("[data-cell]").first();
  await expect(cell.locator("pre")).toContainText('qla.load("ceny-gbm")');
  await expect(cell.locator(".cm-content")).toHaveCount(0);
  await expect(cell.getByRole("button", { name: "Uruchom komórkę 1" })).toBeVisible();
  await cell.getByRole("button", { name: "Edytuj" }).click();
  await expect(cell.locator(".cm-content")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.goto(LESSON);
  await expect(
    page.locator("[data-python-cell]").first().getByRole("button", { name: "Uruchom" }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: notebook with output (${theme})`, async ({ page }, info) => {
    desktopOnly(info.project.name);
    test.setTimeout(LOAD * 2);
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto(NOTEBOOK);
    await page.getByRole("button", { name: "Uruchom wszystko" }).click();
    await expect(page.locator("figure[data-plot='hist']")).toBeVisible({ timeout: LOAD });
    // Package loading is progress, not output: the first cell prints nothing.
    await expect(page.locator("[data-cell]").first().locator("[data-stream]")).toHaveCount(0);
    await axe(page);
  });
}
