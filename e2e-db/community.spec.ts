import { randomUUID } from "node:crypto";

import type { Browser } from "@playwright/test";

import { admin, createUser, deleteUsers, signIn, type User } from "./users";
import { expect, test, type BrowserContext, type Page } from "../e2e/test";

/**
 * Phase 17 "done when": Playwright covers post, report and moderate, and the spoiler
 * gate holds, signed in against a real database. One flow, steps in order.
 */
const LESSON = "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly";
const LESSON_ID = "kelly-criterion";
const EXERCISE = "/pl/praktyka/przyklad-liczba";
const EXERCISE_ID = "przyklad-liczba";
const tag = randomUUID().slice(0, 8);
const LESSON_POST = `Komentarz testowy ${tag}: wartość oczekiwana $E[X]$.`;
const EXERCISE_POST = `Wskazówka testowa ${tag}.`;

test.describe.configure({ mode: "serial" });

let author: User | undefined;
let reader: User | undefined;
let mod: User | undefined;
const pages = new Map<string, { context: BrowserContext; page: Page }>();

async function as(browser: Browser, who: "author" | "reader" | "mod") {
  const existing = pages.get(who);
  if (existing) return existing.page;
  const user = { author, reader, mod }[who] as User;
  const context = await browser.newContext();
  await signIn(context, user);
  const page = await context.newPage();
  pages.set(who, { context, page });
  return page;
}

test.beforeAll(async () => {
  author = await createUser("author");
  reader = await createUser("reader");
  mod = await createUser("mod", "moderator");
  // The author solved the exercise in the app, so they may post under it.
  const db = admin();
  const { error } = await db.from("exercise_attempts").insert({
    user_id: author.id,
    exercise_id: EXERCISE_ID,
    answer: {},
    score: 1,
    grader: "auto",
    source: "app",
  });
  if (error) throw error;
});

test.afterAll(async () => {
  for (const { context } of pages.values()) await context.close();
  if (mod) await admin().from("audit_log").delete().eq("actor_id", mod.id);
  await deleteUsers([author, reader, mod]);
});

const discussion = (page: Page) => page.locator("section[data-discussion]");

test("a signed-in learner posts under a lesson and sees it", async ({ browser }) => {
  const page = await as(browser, "author");
  await page.goto(LESSON);
  const d = discussion(page);
  await expect(d).toHaveAttribute("data-discussion", "open");
  await d.getByLabel("Twój komentarz").fill(LESSON_POST);
  await d.getByRole("button", { name: "Wyślij" }).click();
  const post = d.locator("[data-comment]", { hasText: `Komentarz testowy ${tag}` });
  await expect(post).toBeVisible();
  await expect(post.locator(".katex")).toBeVisible();
});

test("the exercise thread stays locked until the reader reveals the solution", async ({
  browser,
}) => {
  // The author's post under the exercise (through the real form).
  const authorPage = await as(browser, "author");
  await authorPage.goto(EXERCISE);
  const ad = discussion(authorPage);
  await expect(ad).toHaveAttribute("data-discussion", "open");
  await ad.getByLabel("Twój komentarz").fill(EXERCISE_POST);
  await ad.getByRole("button", { name: "Wyślij" }).click();
  await expect(ad.getByText(EXERCISE_POST)).toBeVisible();

  const page = await as(browser, "reader");
  await page.goto(EXERCISE);
  const d = discussion(page);
  await expect(d).toHaveAttribute("data-discussion", "locked");
  await expect(page.getByText(EXERCISE_POST)).toHaveCount(0);
  // A wrong answer is recorded but doesn't open the thread; revealing the solution does.
  const answer = page.getByLabel("Twoja odpowiedź");
  await answer.fill("6");
  await answer.press("Enter");
  await expect(page.getByText("Jeszcze nie.")).toBeVisible();
  await d.getByRole("button", { name: /Pokaż dyskusję/ }).click();
  await expect(d).toHaveAttribute("data-discussion", "locked");
  await page.getByRole("button", { name: "Pokaż rozwiązanie" }).click();
  await expect(page.getByRole("region", { name: "Rozwiązanie" })).toBeVisible();
  await d.getByRole("button", { name: /Pokaż dyskusję/ }).click();
  await expect(d).toHaveAttribute("data-discussion", "open");
  await expect(d.getByText(EXERCISE_POST)).toBeVisible();
});

test("the reader reports the author's lesson comment", async ({ browser }) => {
  const page = await as(browser, "reader");
  await page.goto(LESSON);
  const post = discussion(page).locator("[data-comment]", { hasText: `Komentarz testowy ${tag}` });
  await post.getByRole("button", { name: "Zgłoś" }).click();
  await post.getByLabel("Co jest nie tak?").fill("Test zgłoszenia");
  await post.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(post.getByText("Dziękujemy, moderator to sprawdzi.")).toBeVisible();
});

test("a moderator hides it from the queue; the hide and a ban are audited", async ({ browser }) => {
  const db = admin();
  const { data: comment } = await db
    .from("comments")
    .select("id")
    .eq("target_type", "lesson")
    .eq("target_id", LESSON_ID)
    .eq("user_id", (author as User).id)
    .single();
  const commentId = comment?.id ?? 0;
  const { data: rep } = await db
    .from("reports")
    .select("id")
    .eq("target_type", "comment")
    .eq("target_id", String(commentId))
    .single();

  const page = await as(browser, "mod");
  await page.goto("/pl/admin/community");
  const item = page.locator(`[data-report='${String(rep?.id ?? 0)}']`);
  await expect(item).toContainText(`Komentarz testowy ${tag}`);
  await item.locator("[data-action='hide-reported']").click();
  await expect(item.getByText("Gotowe.")).toBeVisible();

  // Shadow-hidden: the author still sees it, the reader doesn't.
  const readerPage = await as(browser, "reader");
  await readerPage.goto(LESSON);
  await expect(readerPage.getByText(`Komentarz testowy ${tag}`)).toHaveCount(0);
  const authorPage = await as(browser, "author");
  await authorPage.goto(LESSON);
  await expect(
    discussion(authorPage).locator("[data-comment][data-status='hidden']", {
      hasText: `Komentarz testowy ${tag}`,
    }),
  ).toBeVisible();

  // Ban the author from the same report.
  await item.getByRole("button", { name: "Zablokuj autora" }).click();
  await item.getByLabel("Powód blokady").fill("Test blokady");
  await item.getByLabel("Dni (puste = bezterminowo)").fill("1");
  await item.getByRole("button", { name: "Zablokuj autora" }).click();
  await expect(item.getByText("Gotowe.")).toHaveCount(2);

  const { data: audit } = await db
    .from("audit_log")
    .select("action, target, actor_id")
    .eq("actor_id", (mod as User).id)
    .order("id");
  expect(audit?.map((a) => `${a.action} ${a.target ?? ""}`)).toEqual([
    `comment.hidden comment:${String(commentId)}`,
    `report.approved report:${String(rep?.id ?? 0)}`,
    `user.ban user:${(author as User).id}`,
  ]);
});

test("a banned user gets no composer and nothing new is written", async ({ browser }) => {
  const page = await as(browser, "author");
  await page.goto(LESSON);
  const d = discussion(page);
  await expect(d.getByText("Twoje konto ma blokadę pisania.")).toBeVisible();
  await expect(d.locator("[data-composer]")).toHaveCount(0);
  const { count } = await admin()
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", (author as User).id);
  expect(count).toBe(2);
});
