// Mobile Lighthouse against a running production server (local tool, not run in CI).
// Usage: pnpm build && pnpm start  (in another terminal), then:
//   pnpm lighthouse [url ...]      default: a lesson page and the sample lesson preview
// The preview needs ENABLE_STYLEGUIDE=1 on the server. Uses Playwright's Chromium.
import { spawnSync } from "node:child_process";

import { chromium } from "@playwright/test";

const base = process.env.LH_BASE ?? "http://localhost:3000";
const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      `${base}/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly`,
      `${base}/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana`,
    ];

let failed = false;
for (const url of urls) {
  const result = spawnSync(
    "pnpm",
    [
      "dlx",
      "lighthouse@12",
      url,
      "--quiet",
      "--output=json",
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-sandbox",
    ],
    {
      encoding: "utf8",
      shell: true,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
    },
  );
  if (result.status !== 0) {
    console.error(url, result.stderr.slice(-2000));
    failed = true;
    continue;
  }
  const report = JSON.parse(result.stdout);
  const score = (k) => Math.round((report.categories[k]?.score ?? 0) * 100);
  const lcp = report.audits["largest-contentful-paint"]?.displayValue;
  const tbt = report.audits["total-blocking-time"]?.displayValue;
  const cls = report.audits["cumulative-layout-shift"]?.displayValue;
  console.log(
    `${url}\n  performance ${score("performance")} · accessibility ${score("accessibility")} · best practices ${score("best-practices")} · SEO ${score("seo")}\n  LCP ${lcp} · TBT ${tbt} · CLS ${cls}`,
  );
  if (score("performance") < 90) failed = true;
}
process.exit(failed ? 1 : 0);
