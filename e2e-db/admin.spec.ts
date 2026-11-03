import type { Browser } from "@playwright/test";

import { admin, createUser, deleteUsers, signIn, type User } from "./users";
import { expect, test, type Page } from "../e2e/test";
import { canAccess, NAV, sectionPath } from "../src/features/admin/access";

/**
 * Phase 18 "done when", signed in against a real database:
 * - a learner (and a moderator, on admin-only sections) gets 403 on every admin page
 *   and API route;
 * - the dashboard shows the same numbers as a direct count;
 * - role changes and data exports work and are audited;
 * - an AI-grading dispute is upheld end to end (score, XP, audit) (18b);
 * - content status and exercise analytics open for reviewers and show the database's numbers.
 */
test.describe.configure({ mode: "serial" });

let boss: User | undefined;
let mod: User | undefined;
let learner: User | undefined;
let reviewer: User | undefined;
const opened: Page[] = [];

async function pageAs(browser: Browser, user: User) {
  const context = await browser.newContext();
  await signIn(context, user);
  const page = await context.newPage();
  opened.push(page);
  return page;
}

// A quiet week long ago, so only this test's rows are in it.
const FROM = "2019-03-04";
const TO = "2019-03-10";

test.beforeAll(async () => {
  boss = await createUser("boss", "admin");
  mod = await createUser("mod", "moderator");
  learner = await createUser("learner");
  reviewer = await createUser("reviewer", "reviewer");
  const { error } = await admin()
    .from("exercise_attempts")
    .insert(
      ["2019-03-05T10:00:00Z", "2019-03-05T11:00:00Z", "2019-03-07T09:00:00Z"].map((t) => ({
        user_id: (learner as User).id,
        exercise_id: "przyklad-liczba",
        answer: {},
        score: 1,
        grader: "auto" as const,
        created_at: t,
      })),
    );
  if (error) throw error;
});

test.afterAll(async () => {
  for (const p of opened) await p.context().close();
  const actors = [boss, mod, reviewer].flatMap((u) => (u ? [u.id] : []));
  await admin().from("audit_log").delete().in("actor_id", actors);
  await deleteUsers([boss, mod, learner, reviewer]);
});

test("403 on every admin page and API for a learner; moderators only where allowed", async ({
  browser,
}) => {
  for (const [user, roles] of [
    [learner, []],
    [mod, ["moderator"]],
  ] as const) {
    const page = await pageAs(browser, user as User);
    for (const section of NAV) {
      const res = await page.request.get(`/pl${sectionPath(section)}`, { maxRedirects: 0 });
      const label = `${roles.join() || "learner"} ${section}`;
      // Every section exists now: allowed ones load, the rest are a 403.
      if (canAccess(roles, section)) expect(res.status(), label).toBe(200);
      else expect(res.status(), label).toBe(403);
    }
    const api = await page.request.get(`/api/admin/users/${(learner as User).id}/export`);
    expect(api.status()).toBe(403);
  }
});

test("the dashboard shows what the tables say", async ({ browser }) => {
  const page = await pageAs(browser, boss as User);
  await page.goto(`/pl/admin?od=${FROM}&do=${TO}`);
  const { count } = await admin()
    .from("exercise_attempts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${FROM}T00:00:00+01:00`)
    .lt("created_at", "2019-03-11T00:00:00+01:00");
  expect(count).toBe(3);
  await expect(page.locator("[data-metric='attempts']")).toHaveText(String(count));
  await page.getByText("Dane dzienne").click();
  await expect(page.locator("tr[data-day='2019-03-05'] td").nth(1)).toHaveText("1");
  await expect(page.locator("tr[data-day='2019-03-05'] td").nth(5)).toHaveText("2");
});

test("an admin grants a role and downloads a user's data; both are audited", async ({
  browser,
}) => {
  const page = await pageAs(browser, boss as User);
  const id = (learner as User).id;
  await page.goto(`/pl/admin/uzytkownicy?q=${encodeURIComponent((learner as User).email)}`);
  await page.locator(`tr[data-user='${id}'] a`).click();
  await expect(page.locator(`[data-admin-user='${id}']`)).toBeVisible();
  await page.locator("[data-role='reviewer']").click();
  await expect(page.locator("[data-role='reviewer'][data-has]")).toBeVisible();

  const res = await page.request.get(`/api/admin/users/${id}/export`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { user_id: string; exercise_attempts: unknown[] };
  expect(body.user_id).toBe(id);
  expect(body.exercise_attempts).toHaveLength(3);

  const { data: roles } = await admin().from("user_roles").select("role").eq("user_id", id);
  expect(roles).toEqual([{ role: "reviewer" }]);
  const { data: log } = await admin()
    .from("audit_log")
    .select("action, target")
    .eq("actor_id", (boss as User).id)
    .order("id");
  expect(log).toEqual([
    { action: "role.grant", target: `user:${id}` },
    { action: "user.export", target: `user:${id}` },
  ]);
});

test("a moderator upholds an AI-grading dispute: new score, XP and an audit row", async ({
  browser,
}) => {
  const db = admin();
  const id = (learner as User).id;
  const feedback = {
    score: 2,
    verdict: "partial",
    rubricItems: [],
    feedback: "Brakuje uzasadnienia.",
    misconceptions: [],
    nextStep: "Dopisz uzasadnienie.",
  };
  const { data: attempt, error } = await db
    .from("exercise_attempts")
    .insert({
      user_id: id,
      exercise_id: "przyklad-otwarte",
      answer: { kind: "text", value: "Moja pełna odpowiedź z uzasadnieniem." },
      score: 0.5,
      grader: "ai",
      feedback,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: dispute, error: disputeError } = await db
    .from("grading_disputes")
    .insert({ user_id: id, attempt_id: attempt.id, reason: "Uzasadnienie jest w drugim zdaniu." })
    .select("id")
    .single();
  if (disputeError) throw disputeError;

  const page = await pageAs(browser, mod as User);
  await page.goto("/pl/admin/kolejki");
  await expect(page.locator("[data-queue='disputes'] [data-count]")).not.toHaveText("0");
  await page.goto("/pl/admin/spory");
  const item = page.locator(`[data-dispute='${String(dispute.id)}']`);
  await expect(item).toContainText("Uzasadnienie jest w drugim zdaniu.");
  await expect(item).toContainText("Brakuje uzasadnienia.");
  await item.getByLabel("Nowa ocena").selectOption("4");
  await item.getByRole("button", { name: "Uznaj" }).click();
  // Level 2, no hints, not a first try: 2 × 10 XP.
  await expect(item.getByRole("status")).toHaveText("Uznano, przyznano 20 XP.");

  const [{ data: after }, { data: resolved }, { data: xp }, { data: log }] = await Promise.all([
    db.from("exercise_attempts").select("score").eq("id", attempt.id).single(),
    db.from("grading_disputes").select("status, resolved_by").eq("id", dispute.id).single(),
    db
      .from("xp_events")
      .select("amount, reason")
      .eq("idempotency_key", `${id}:exercise:przyklad-otwarte`),
    db
      .from("audit_log")
      .select("action, target, details")
      .eq("actor_id", (mod as User).id)
      .eq("action", "dispute.approved"),
  ]);
  expect(after?.score).toBe(1);
  expect(resolved).toEqual({ status: "approved", resolved_by: (mod as User).id });
  expect(xp).toEqual([{ amount: 20, reason: "exercise" }]);
  expect(log).toEqual([
    {
      action: "dispute.approved",
      target: `dispute:${String(dispute.id)}`,
      details: {
        attempt: attempt.id,
        exercise: "przyklad-otwarte",
        before: 0.5,
        after: 1,
        xp: 20,
      },
    },
  ]);
});

test("a reviewer sees content status and an exercise's analytics from the database", async ({
  browser,
}) => {
  const page = await pageAs(browser, reviewer as User);
  await page.goto("/pl/admin/tresci?typ=exercise");
  await expect(page.locator("[data-content='exercise:przyklad-liczba']")).toBeVisible();
  await expect(page.locator("[data-content^='lesson:']")).toHaveCount(0);

  const { count } = await admin()
    .from("exercise_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", "przyklad-liczba");
  await page.goto("/pl/admin/zadania/przyklad-liczba");
  await expect(page.locator("[data-stat='attempts']")).toHaveText(String(count));
  // Not an admin: the dashboard and users stay closed.
  expect((await page.request.get("/pl/admin", { maxRedirects: 0 })).status()).toBe(403);
});

test("a campaign landing shows in the dashboard's campaign table (Phase 19)", async ({
  browser,
}) => {
  const source = `e2e-${String(Date.now() % 1_000_000)}`;
  const visitor = await (await browser.newContext()).newPage();
  opened.push(visitor);
  const counted = visitor.waitForResponse((r) => r.url().endsWith("/api/utm"));
  await visitor.goto(`/pl/laboratorium?utm_source=${source}&utm_medium=video&utm_campaign=kelly`);
  expect((await counted).status()).toBe(204);
  try {
    const page = await pageAs(browser, boss as User);
    await page.goto("/pl/admin");
    const row = page.locator(`tr[data-campaign='${source}|video|kelly|/pl/laboratorium']`);
    await expect(row.locator("td").last()).toHaveText("1");
  } finally {
    await admin().from("utm_visits").delete().eq("source", source);
  }
});
