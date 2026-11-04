import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Request } from "@playwright/test";

import { expect, test, type Page } from "./test";

/**
 * Phase 20a: the five public core journeys, in both locales. Each one moves through the
 * app like a visitor (clicking links and buttons; `goto` only for the first page) and
 * must finish without console errors, page errors or failed same-origin requests.
 * Visible strings come from messages/<locale>/*.json, never hard-coded per language.
 */

const LOCALES = ["pl", "en"] as const;
type Locale = (typeof LOCALES)[number];

type Tree = { [key: string]: string | Tree };

function loadMessages(locale: Locale): Tree {
  const dir = path.join(process.cwd(), "messages", locale);
  const tree: Tree = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    tree[file.replace(/\.json$/, "")] = JSON.parse(
      readFileSync(path.join(dir, file), "utf8"),
    ) as Tree;
  }
  return tree;
}

const MESSAGES: Record<Locale, Tree> = { pl: loadMessages("pl"), en: loadMessages("en") };

/** A message by dotted key ("reader.complete"), with simple `{name}` values filled in. */
function msg(locale: Locale, key: string, values: Record<string, string | number> = {}): string {
  let node: string | Tree | undefined = MESSAGES[locale];
  for (const part of key.split(".")) {
    node = typeof node === "object" ? node[part] : undefined;
  }
  if (typeof node !== "string") throw new Error(`no message ${locale}:${key}`);
  return node.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in values ? String(values[name]) : all,
  );
}

/** A frontmatter field of a content file (titles in English live in content/, not messages/). */
function frontmatter(file: string, field: string): string {
  const text = readFileSync(path.join(process.cwd(), "content", file), "utf8");
  const m = new RegExp(`^${field}:\\s*"?(.*?)"?\\s*$`, "m").exec(text);
  if (!m?.[1]) throw new Error(`no ${field} in ${file}`);
  return m[1];
}

/** The first lesson in the curriculum: what the sample lesson offers as "next". */
const nextLesson = (locale: Locale) => ({
  title: frontmatter(`${locale}/tracks/foundations/returns/percentages-compounding.mdx`, "title"),
  slug: frontmatter(`${locale}/tracks/foundations/returns/percentages-compounding.mdx`, "slug"),
});

/**
 * Settled: the shell's theme switch has hydrated (it renders a checked radio) and Next
 * has finished prefetching. Clicking earlier can lose the navigation (docs/PROGRESS.md,
 * "Known issue: Next.js hydration race on early clicks").
 */
async function settled(page: Page) {
  await expect(page.getByRole("radio", { checked: true }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// Console errors, page errors and failed same-origin requests, per test.
let problems: string[] = [];

test.beforeEach(async ({ page, baseURL }) => {
  problems = [];
  const origin = new URL(baseURL ?? "http://localhost").origin;
  const sameOrigin = (url: string) => url.startsWith(origin);
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  const answered = new Set<Request>();
  page.on("response", (r) => {
    answered.add(r.request());
    if (sameOrigin(r.url()) && r.status() >= 400) problems.push(`${String(r.status())} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (!sameOrigin(r.url())) return;
    const error = r.failure()?.errorText ?? "";
    // Known harmless: Next.js cancels the rest of a streamed RSC body once it has what it
    // needs (navigation fetches with `rsc: 1`, server action POSTs with `next-action`).
    // Chrome reports that as ERR_ABORTED although the response (status < 400, checked
    // above) arrived and the UI updated. A request aborted before any response still fails.
    const headers = r.headers();
    const nextStream = headers.rsc === "1" || headers["next-action"] !== undefined;
    if (error === "net::ERR_ABORTED" && nextStream && answered.has(r)) return;
    problems.push(`requestfailed: ${r.method()} ${r.url()} ${error}`);
  });
  // Grading is rate-limited per client IP: each test acts as its own client.
  const ip = `10.1.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

for (const locale of LOCALES) {
  test.describe(`journeys (${locale})`, () => {
    test("first visit: landing → sample exercise → into the app", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(msg(locale, "home.title"));
      await expect(page.locator("[data-landing-sim] canvas").first()).toBeVisible({
        timeout: 15_000,
      });
      await settled(page);

      const exercise = page.locator("[data-landing-exercise='przyklad-wybor']");
      await exercise.getByRole("radio", { name: "4" }).check();
      await exercise.getByRole("button", { name: msg(locale, "exercises.submit") }).click();
      await expect(
        exercise.getByRole("status").filter({ hasText: msg(locale, "exercises.result.correct") }),
      ).toBeVisible();

      // Into the app from the "what you'll find here" list (in the page, so no menu on mobile).
      await page
        .getByRole("region", { name: msg(locale, "home.sectionsHeading") })
        .getByRole("link", { name: msg(locale, "sections.practice.title") })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/(praktyka|practice)$`), {
        timeout: 15_000,
      });
      await expect(
        page.getByRole("heading", { level: 1, name: msg(locale, "exercises.hub.title") }),
      ).toBeVisible();
      await expect(page.locator("li[data-exercise]").first()).toBeVisible();
    });

    test("lesson: read → mark as understood → next lesson", async ({ page }) => {
      // Internal preview of the sample lesson: no public page links to it, so goto.
      await page.goto(`/${locale}/dev/content-preview?id=przyklad-wartosc-oczekiwana`);
      await expect(
        page.getByRole("radio", { name: msg(locale, "content.depth.easy") }),
      ).toBeChecked();
      await page.waitForLoadState("networkidle");

      const bar = page.getByRole("progressbar", { name: msg(locale, "reader.progress") });
      await expect(bar).toHaveAttribute("aria-valuenow", "0");
      await page.locator("#rozrzut-wyników").scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 200);
      await expect
        .poll(async () => Number(await bar.getAttribute("aria-valuenow")))
        .toBeGreaterThan(0);

      await page.getByRole("button", { name: msg(locale, "reader.complete") }).click();
      await expect(page.getByText(msg(locale, "reader.completed"))).toBeVisible();

      const next = nextLesson(locale);
      await page.getByRole("status").getByRole("link", { name: next.title }).click();
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/(nauka|learn)/[a-z-]+/[a-z-]+/${next.slug}$`),
        {
          timeout: 15_000,
        },
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(next.title);
    });

    test("practice: hub → exercise → answer → feedback", async ({ page }) => {
      await page.goto(locale === "pl" ? "/pl/praktyka" : "/en/practice");
      await expect(
        page.getByRole("heading", { level: 1, name: msg(locale, "exercises.hub.title") }),
      ).toBeVisible();
      await settled(page);

      await page.locator("li[data-exercise='przyklad-wybor']").getByRole("link").click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/(praktyka|practice)/przyklad-wybor$`), {
        timeout: 15_000,
      });
      const card = page.locator("article[data-exercise='przyklad-wybor']");
      await expect(card).toBeVisible();
      await settled(page);

      // A wrong answer first, then the right one: both get feedback.
      await card.getByRole("radio", { name: "3" }).check();
      await card.getByRole("button", { name: msg(locale, "exercises.submit") }).click();
      await expect(
        card.getByRole("status").filter({ hasText: msg(locale, "exercises.result.wrong") }),
      ).toBeVisible();
      await card.getByRole("button", { name: msg(locale, "exercises.tryAgain") }).click();
      await card.getByRole("radio", { name: "4" }).check();
      await card.getByRole("button", { name: msg(locale, "exercises.submit") }).click();
      await expect(
        card.getByRole("status").filter({ hasText: msg(locale, "exercises.result.correct") }),
      ).toBeVisible();
    });

    test("interview: hub → mental math → answer → scorecard", async ({ page }) => {
      await page.goto(locale === "pl" ? "/pl/rozmowa" : "/en/interview");
      await expect(
        page.getByRole("heading", { level: 1, name: msg(locale, "interview.hub.title") }),
      ).toBeVisible();
      await settled(page);

      await page
        .getByRole("link", { name: msg(locale, "interview.kinds.mental_math.title") })
        .click();
      const levelOne = page.getByRole("radio", {
        name: msg(locale, "interview.setup.levelN", { level: 1 }),
      });
      await expect(levelOne).toBeVisible({ timeout: 15_000 });
      await settled(page);
      await levelOne.check();
      await page.getByRole("button", { name: msg(locale, "interview.setup.start") }).click();

      const field = page.locator("#mm-answer");
      for (let i = 1; i <= 2; i++) {
        await expect(
          page.getByText(msg(locale, "interview.player.question", { n: i, total: 80 })),
        ).toBeVisible();
        await field.fill("1");
        await field.press("Enter");
      }
      await expect(
        page.getByText(msg(locale, "interview.player.question", { n: 3, total: 80 })),
      ).toBeVisible();
      await page.getByRole("button", { name: msg(locale, "interview.player.finish") }).click();

      await expect(
        page.getByRole("heading", { name: msg(locale, "interview.score.title") }),
      ).toBeVisible();
      await expect(
        page.getByText(msg(locale, "interview.score.answered", { answered: 2, total: 80 })),
      ).toBeVisible();
    });

    test("debunk: index → entry → the checker changes the verdict", async ({ page }) => {
      await page.goto(`/${locale}/debunk`);
      await expect(
        page.getByRole("heading", { level: 1, name: msg(locale, "debunk.index.title") }),
      ).toBeVisible();
      await settled(page);

      const claim = frontmatter(`${locale}/debunk/przyklad-skutecznosc.mdx`, "claim");
      const slug = frontmatter(`${locale}/debunk/przyklad-skutecznosc.mdx`, "slug");
      await page
        .locator("[data-debunk-list] [data-entry='przyklad-skutecznosc']")
        .getByRole("link")
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/debunk/${slug}$`), { timeout: 15_000 });
      const article = page.locator("[data-debunk-entry='przyklad-skutecznosc']");
      await expect(article.getByRole("heading", { level: 1 })).toContainText(claim);
      await settled(page);

      // 90% wins of 10, losses of 100: negative. Losses of 5 make it positive.
      const checker = article.locator("[data-checker='ev']");
      await expect(checker.locator("[data-verdict='negative']")).toBeVisible();
      await checker.getByLabel(msg(locale, "debunk.ev.loss")).fill("5");
      await expect(checker.locator("[data-verdict='positive']")).toBeVisible();
      await expect(checker.locator("[data-verdict='negative']")).toHaveCount(0);
      await expect(
        checker.locator("dt", { hasText: msg(locale, "debunk.ev.ev") }).locator("+ dd"),
      ).toHaveText(locale === "pl" ? "7,5" : "7.5");
    });
  });
}
