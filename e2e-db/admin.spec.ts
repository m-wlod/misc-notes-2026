import type { Browser } from "@playwright/test";

import { admin, createUser, deleteUsers, signIn, type User } from "./users";
import { expect, test, type Page } from "../e2e/test";
import { canAccess, NAV, sectionPath } from "../src/features/admin/access";

/**
 * Phase 18 "done when", signed in against a real database:
 * - a learner (and a moderator, on admin-only sections) gets 403 on every admin page
 *   and API route;
 * - the dashboard shows the same numbers as a direct count;
 * - role changes and data exports work and are audited.
 */
test.describe.configure({ mode: "serial" });

let boss: User | undefined;
let mod: User | undefined;
let learner: User | undefined;
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
  const actors = [boss, mod].flatMap((u) => (u ? [u.id] : []));
  await admin().from("audit_log").delete().in("actor_id", actors);
  await deleteUsers([boss, mod, learner]);
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
      // Allowed sections pass the proxy (some are only built in 18b/18c).
      if (canAccess(roles, section)) expect(res.status(), label).not.toBe(403);
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
