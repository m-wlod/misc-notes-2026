// Screenshots each exploration: desktop light, desktop dark (1440px) and mobile light (390px).
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "shots");
mkdirSync(out, { recursive: true });

const shots = [
  { name: "desktop-light", width: 1440, height: 1000, theme: "light", scale: 1 },
  { name: "desktop-dark", width: 1440, height: 1000, theme: "dark", scale: 1 },
  { name: "mobile-light", width: 390, height: 844, theme: "light", scale: 2 },
];

const browser = await chromium.launch();
for (const key of ["a", "b", "c"]) {
  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.scale,
    });
    await page.goto(pathToFileURL(join(here, `${key}.html`)).href, { waitUntil: "networkidle" });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), s.theme);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector(".katex-display");
    const file = join(out, `${key}-${s.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    await page.close();
  }
}
await browser.close();
