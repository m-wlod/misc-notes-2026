import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 12: the simulation framework and the Lab. Each simulation plays, pauses, steps
 * and resets; the URL reproduces a run; PNG export has the right size (1080×1920 in
 * recording mode); the GBM case is timed under 4× CPU throttling.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const SIMS = [
  ["rzut-moneta-czy-formacja", "Rzut monetą czy formacja?"],
  ["prawo-wielkich-liczb-i-ctg", "Prawo wielkich liczb i centralne twierdzenie graniczne"],
  ["ruch-browna", "Ruch Browna i geometryczny ruch Browna"],
  ["monte-carlo", "Metoda Monte Carlo"],
] as const;

const frame = (page: Page) => page.getByText(/^Klatka \d+ z \d+$/);
const frameNumber = async (page: Page) =>
  Number(/Klatka (\d+)/.exec(await frame(page).innerText())?.[1]);

async function ready(page: Page) {
  await expect(page.getByRole("button", { name: "Odtwórz" })).toBeEnabled({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("the Lab lists the simulations", async ({ page }) => {
  await page.goto("/pl/laboratorium");
  await expect(page.locator("li[data-sim]")).toHaveCount(SIMS.length);
  for (const [, title] of SIMS) await expect(page.getByRole("link", { name: title })).toBeVisible();
  await axe(page);
});

for (const [slug, title] of SIMS) {
  test(`${slug}: play, pause, step, reset`, async ({ page }) => {
    await page.goto(`/pl/laboratorium/symulacje/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await ready(page);
    await expect(frame(page)).toHaveText(/^Klatka 0 z \d+$/);
    await page.getByRole("button", { name: "Odtwórz" }).click();
    await expect.poll(() => frameNumber(page)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Pauza" }).click();
    const paused = await frameNumber(page);
    await page.getByRole("button", { name: "Krok" }).click();
    expect(await frameNumber(page)).toBeGreaterThan(paused);
    await page.getByRole("button", { name: "Wyzeruj" }).click();
    await expect(frame(page)).toHaveText(/^Klatka 0 z \d+$/);
    // The chart is described in words for screen readers.
    await expect(page.getByRole("img").first()).toHaveAttribute("aria-label", /\d/);
  });
}

test("the URL reproduces a run: params, seed and frame", async ({ page }) => {
  await page.goto("/pl/laboratorium/symulacje/ruch-browna?seed=7");
  await ready(page);
  const paths = page.getByRole("spinbutton", { name: "Liczba ścieżek" });
  await paths.fill("300");
  await paths.press("Enter");
  await expect(page).toHaveURL(/paths=300/);
  await expect(page).toHaveURL(/seed=7/);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Krok" }).click();
  const at = await frameNumber(page);
  const summary = await page.getByRole("img").first().getAttribute("aria-label");
  await page.getByRole("button", { name: "Kopiuj link do tego przebiegu" }).click();
  await expect(page).toHaveURL(new RegExp(`t=${String(at)}`));

  await page.reload();
  await ready(page);
  await expect(page.getByRole("spinbutton", { name: "Liczba ścieżek" })).toHaveValue("300");
  expect(await frameNumber(page)).toBe(at);
  await expect(page.getByRole("img").first()).toHaveAttribute("aria-label", summary ?? "");
});

test("bad values in the link fall back to valid ones", async ({ page }) => {
  await page.goto("/pl/laboratorium/symulacje/ruch-browna?paths=999999&sigma=abc&model=evil");
  await ready(page);
  await expect(page.getByRole("spinbutton", { name: "Liczba ścieżek" })).toHaveValue("1000");
  await expect(page.getByRole("spinbutton", { name: "Zmienność σ (rocznie)" })).toHaveValue("0.2");
});

test("PNG export, and a 1080×1920 frame in recording mode", async ({ page }) => {
  await page.goto("/pl/laboratorium/symulacje/rzut-moneta-czy-formacja?seed=5&t=120");
  await ready(page);
  const [normal] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Zapisz PNG" }).click(),
  ]);
  expect(pngSize(await readFile(await normal.path()))).toEqual({ width: 1600, height: 960 });

  await page.getByRole("link", { name: "Tryb nagrywania 9:16" }).click();
  await expect(page).toHaveURL(/nagranie=1/);
  await ready(page);
  const [vertical] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Zapisz klatkę 1080×1920" }).click(),
  ]);
  expect(vertical.suggestedFilename()).toMatch(/-9x16\.png$/);
  expect(pngSize(await readFile(await vertical.path()))).toEqual({ width: 1080, height: 1920 });
});

test("keyboard: Space plays and pauses, → steps, R resets", async ({ page }) => {
  await page.goto("/pl/laboratorium/symulacje/prawo-wielkich-liczb-i-ctg");
  await ready(page);
  await page
    .getByRole("region", { name: "Prawo wielkich liczb i centralne twierdzenie graniczne" })
    .focus();
  await page.keyboard.press("ArrowRight");
  expect(await frameNumber(page)).toBeGreaterThan(0);
  await page.keyboard.press("r");
  expect(await frameNumber(page)).toBe(0);
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: "Pauza" })).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: "Odtwórz" })).toBeVisible();
});

test("a lesson embeds a simulation with <Simulation id=… />", async ({ page }) => {
  await page.goto("/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana");
  const embed = page.locator('figure[data-simulation="lln-clt"]');
  await expect(embed.getByRole("button", { name: "Odtwórz" })).toBeEnabled({ timeout: 15_000 });
  await expect(embed.getByText("Parametry")).toHaveCount(0); // compact: no parameter panel
  // A simulation that doesn't exist yet keeps its placeholder.
  await expect(page.locator('figure[data-simulation="martingale-bankroll"]')).toContainText(
    "Symulacja",
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: simulation page (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/laboratorium/symulacje/monte-carlo?t=2000");
    await ready(page);
    await axe(page);
  });
}

test("performance: 1,000 GBM paths × 250 steps under 4× CPU throttling", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "measured on the mobile profile");
  await page.goto("/pl/laboratorium/symulacje/ruch-browna?seed=1&paths=1000&steps=250");
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.getByRole("button", { name: "Odtwórz" }).click();
  const intervals = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = performance.now();
        const loop = (now: number) => {
          out.push(now - last);
          last = now;
          if (out.length < 180) requestAnimationFrame(loop);
          else resolve(out);
        };
        requestAnimationFrame(loop);
      }),
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const sorted = [...intervals.slice(5)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  console.log(
    `GBM 1000×250, 4× CPU throttling: median frame ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
  );
  info.annotations.push({
    type: "perf",
    description: `median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
  });
  expect(median).toBeLessThan(34); // at least ~30 fps on a throttled CPU
});
