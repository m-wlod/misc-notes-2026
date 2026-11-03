import type { Browser } from "@playwright/test";

import { admin, createUser, deleteUsers, signIn, type User } from "./users";
import { expect, test, type Page } from "../e2e/test";

/**
 * Phase 18c "done when", signed in against a real database:
 * - every moderation queue works end to end, each leaving its audit row (community
 *   reports are covered in community.spec.ts, disputes in admin.spec.ts);
 * - the AI budget, a feature flag and an announcement are changed in the panel and
 *   audited; the announcement shows in the site banner and can be closed;
 * - the system page shows the cron runs.
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

const auditOf = async (actor: User, action: string) => {
  const { data } = await admin()
    .from("audit_log")
    .select("action, target, details")
    .eq("actor_id", actor.id)
    .eq("action", action);
  return data ?? [];
};

const FLAG = `e2e-flag-${String(Date.now())}`;
let announcementIds: number[] = [];

test.beforeAll(async () => {
  boss = await createUser("platform-boss", "admin");
  mod = await createUser("platform-mod", "moderator");
  learner = await createUser("platform-learner");
});

test.afterAll(async () => {
  for (const p of opened) await p.context().close();
  const db = admin();
  const actors = [boss, mod].flatMap((u) => (u ? [u.id] : []));
  await db.from("audit_log").delete().in("actor_id", actors);
  await db.from("feature_flags").delete().eq("key", FLAG);
  await db.from("app_settings").delete().eq("key", "ai");
  if (announcementIds.length > 0) await db.from("announcements").delete().in("id", announcementIds);
  await db
    .from("content_error_reports")
    .delete()
    .eq("user_id", learner?.id ?? "");
  await db
    .from("debunk_submissions")
    .delete()
    .eq("user_id", learner?.id ?? "");
  await deleteUsers([boss, mod, learner]);
});

test("a moderator works the content-error, held-post and Debunk queues; each is audited", async ({
  browser,
}) => {
  const db = admin();
  const id = (learner as User).id;
  const [correction, held, claim] = await Promise.all([
    db
      .from("content_error_reports")
      .insert({
        user_id: id,
        content_type: "lesson",
        content_id: "przyklad-wartosc-oczekiwana",
        body: "W drugim przykładzie brakuje nawiasu.",
      })
      .select("id")
      .single(),
    db
      .from("comments")
      .insert({
        user_id: id,
        target_type: "lesson",
        target_id: "przyklad-wartosc-oczekiwana",
        body: "Wstrzymany wpis do zatwierdzenia.",
        status: "pending",
      })
      .select("id")
      .single(),
    db
      .from("debunk_submissions")
      .insert({ user_id: id, claim: "Ta strategia zawsze wygrywa w ruletce." })
      .select("id")
      .single(),
  ]);
  for (const r of [correction, held, claim]) if (r.error) throw r.error;
  const correctionId = correction.data?.id ?? 0;
  const heldId = held.data?.id ?? 0;
  const claimId = claim.data?.id ?? 0;

  const page = await pageAs(browser, mod as User);
  await page.goto("/pl/admin/kolejki");
  for (const q of ["corrections", "comments", "claims"]) {
    await expect(page.locator(`[data-queue='${q}'] [data-count]`)).not.toHaveText("0");
  }

  await page.goto("/pl/admin/community");
  const c = page.locator(`[data-correction='${String(correctionId)}']`);
  await c.getByRole("button", { name: "Przyjmij (+50 XP)" }).click();
  await expect(c).toContainText("Gotowe.");
  const h = page.locator(`[data-held='comment:${String(heldId)}']`);
  await h.getByRole("button", { name: "Zatwierdź" }).click();
  await expect(h).toContainText("Gotowe.");

  await page.goto("/pl/admin/debunk");
  const d = page.locator(`[data-claim='${String(claimId)}']`);
  await d.getByRole("button", { name: "Przyjmij" }).click();
  await expect(d.getByRole("button")).toHaveCount(0);

  await expect
    .poll(async () => (await auditOf(mod as User, "debunk.approved")).map((a) => a.target))
    .toEqual([`debunk_submission:${String(claimId)}`]);
  expect((await auditOf(mod as User, "correction.approved")).map((a) => a.target)).toEqual([
    `correction:${String(correctionId)}`,
  ]);
  expect((await auditOf(mod as User, "comment.approved")).map((a) => a.target)).toEqual([
    `comment:${String(heldId)}`,
  ]);
  const [{ data: xp }, { data: comment }, { data: sub }] = await Promise.all([
    db
      .from("xp_events")
      .select("amount, reason")
      .eq("idempotency_key", `${id}:correction:${String(correctionId)}`),
    db.from("comments").select("status").eq("id", heldId).single(),
    db.from("debunk_submissions").select("status, reviewed_by").eq("id", claimId).single(),
  ]);
  expect(xp).toEqual([{ amount: 50, reason: "correction" }]);
  expect(comment?.status).toBe("approved");
  expect(sub).toEqual({ status: "approved", reviewed_by: (mod as User).id });
});

test("an admin sets the AI budget; the page shows it in force and it is audited", async ({
  browser,
}) => {
  const page = await pageAs(browser, boss as User);
  await page.goto("/pl/admin/ai");
  const form = page.locator("[data-ai-settings]");
  await form.getByLabel("Dzienny budżet (USD)").fill("2,5");
  await form.getByLabel("Ocen na osobę dziennie").fill("7");
  await form.getByRole("button", { name: "Zapisz" }).click();
  await expect(form.getByRole("status")).toHaveText("Zapisano.");
  await expect(page.locator("[data-ai-current]")).toContainText("budżet 2,5 USD, 7 ocen na osobę");
  const [entry] = await auditOf(boss as User, "settings.ai");
  expect(entry?.target).toBe("settings:ai");
  expect((entry?.details as { after: unknown }).after).toMatchObject({
    dailyBudgetUsd: 2.5,
    userDailyQuota: 7,
  });
});

test("an admin creates and switches on a feature flag; both are audited", async ({ browser }) => {
  const page = await pageAs(browser, boss as User);
  await page.goto("/pl/admin/flagi");
  const add = page.getByRole("form", { name: "Nowa flaga" });
  await add.getByLabel("Klucz").fill(FLAG);
  await add.getByLabel("Opis").fill("Flaga z testu e2e");
  await add.getByRole("button", { name: "Dodaj" }).click();
  const row = page.locator(`[data-flag='${FLAG}']`);
  await expect(row).toBeVisible();
  await row.getByLabel("Włączona").check();
  await row.getByLabel("Wdrożenie (%)").fill("25");
  await row.getByRole("button", { name: "Zapisz" }).click();
  await expect(row.getByRole("status")).toHaveText("Zapisano.");
  const { data } = await admin()
    .from("feature_flags")
    .select("enabled, rollout_percent, description")
    .eq("key", FLAG)
    .single();
  expect(data).toEqual({ enabled: true, rollout_percent: 25, description: "Flaga z testu e2e" });
  expect((await auditOf(boss as User, "flag.create")).map((a) => a.target)).toEqual([
    `flag:${FLAG}`,
  ]);
  expect((await auditOf(boss as User, "flag.update")).map((a) => a.target)).toEqual([
    `flag:${FLAG}`,
  ]);
});

test("an announcement appears in the banner on public pages, closes, and ends", async ({
  browser,
}) => {
  const page = await pageAs(browser, boss as User);
  const text = `Przerwa techniczna ${String(Date.now())}`;
  await page.goto("/pl/admin/ogloszenia");
  const form = page.getByRole("form", { name: "Nowe ogłoszenie" });
  await form.getByLabel("Treść (PL)").fill(text);
  await form.getByLabel("Treść (EN)").fill(`Maintenance ${text}`);
  await form.getByRole("button", { name: "Opublikuj" }).click();
  await expect(form.getByRole("status")).toHaveText("Gotowe.");
  const { data: rows } = await admin().from("announcements").select("id").eq("body_pl", text);
  announcementIds = (rows ?? []).map((r) => r.id);
  expect(announcementIds).toHaveLength(1);
  const id = String(announcementIds[0]);
  expect((await auditOf(boss as User, "announcement.create")).map((a) => a.target)).toEqual([
    `announcement:${id}`,
  ]);

  // A static public page, seen by a signed-out visitor.
  const visitor = await (await browser.newContext()).newPage();
  opened.push(visitor);
  await visitor.goto("/pl");
  const banner = visitor.locator(`[data-announcement='${id}']`);
  await expect(banner).toHaveText(text);
  await visitor.goto("/en");
  await expect(banner).toHaveText(`Maintenance ${text}`);
  await banner.getByRole("button", { name: "Dismiss announcement" }).click();
  await expect(banner).toHaveCount(0);
  await visitor.reload();
  await expect(visitor.locator("main")).toBeVisible();
  await expect(banner).toHaveCount(0);

  await page.reload();
  const item = page.locator(`[data-admin-announcement='${id}']`);
  await item.getByRole("button", { name: "Zakończ teraz" }).click();
  await expect(item).toHaveAttribute("data-state", "ended");
  expect((await auditOf(boss as User, "announcement.end")).map((a) => a.target)).toEqual([
    `announcement:${id}`,
  ]);
  const fresh = await (await browser.newContext()).newPage();
  opened.push(fresh);
  await fresh.goto("/pl");
  await expect(fresh.locator("main")).toBeVisible();
  await expect(fresh.locator(`[data-announcement='${id}']`)).toHaveCount(0);
});

test("the system page shows each cron job's last run", async ({ browser }) => {
  const db = admin();
  const { data: run, error } = await db
    .from("cron_runs")
    .insert({
      job: "calibrate",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      ok: true,
      details: { status: 200 },
    })
    .select("id")
    .single();
  if (error) throw error;
  try {
    const page = await pageAs(browser, boss as User);
    await page.goto("/pl/admin/system");
    await expect(page.locator("[data-cron='calibrate']")).toHaveAttribute("data-ok", "true");
    await expect(page.locator("[data-cron='calibrate']")).toContainText("OK");
    await expect(page.locator("[data-league='members']")).toBeVisible();
  } finally {
    await db.from("cron_runs").delete().eq("id", run.id);
  }
});
