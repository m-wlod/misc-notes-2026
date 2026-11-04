import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { admin, createUser, deleteUsers, signIn, type User } from "./users";
import { expect, test, type Page } from "../e2e/test";

/**
 * Phase 20: the signed-in core journeys, in both languages (and, through the db config,
 * on desktop and a phone): sign-up by the emailed link, then onboarding; the streak
 * growing when today's goal is met; a community post; settings, then deleting the
 * account. Public journeys are in e2e/journeys.spec.ts.
 */
type Locale = "pl" | "en";
const LOCALES: Locale[] = ["pl", "en"];

type Messages = Record<string, unknown>;
const cache = new Map<string, Messages>();
/** A message from messages/<locale>/<namespace>.json, by dotted key ("auth.submit"). */
function msg(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const [ns, ...path] = key.split(".");
  const file = `messages/${locale}/${ns ?? ""}.json`;
  let json = cache.get(file);
  if (!json) {
    json = JSON.parse(readFileSync(file, "utf8")) as Messages;
    cache.set(file, json);
  }
  let v: unknown = json;
  for (const p of path) v = (v as Messages)[p];
  if (typeof v !== "string") throw new Error(`no message ${locale}:${key}`);
  return v.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

const PATHS = {
  signIn: { pl: "/pl/logowanie", en: "/en/sign-in" },
  settings: { pl: "/pl/ustawienia", en: "/en/settings" },
  lesson: {
    pl: "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly",
    en: "/en/learn/expected-value/betting/kelly-criterion",
  },
  exercise: { pl: "/pl/praktyka/przyklad-liczba", en: "/en/practice/przyklad-liczba" },
} as const;

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** The sign-in link from the newest email to `to`, from the local stack's mail catcher. */
async function magicLink(to: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const found = (await search.json()) as { messages?: { ID: string }[] };
        const id = found.messages?.[0]?.ID;
        if (!id) return false;
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
          HTML?: string;
          Text?: string;
        };
        const body = `${message.HTML ?? ""} ${message.Text ?? ""}`;
        link = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/.exec(body)?.[0];
        return !!link;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  return (link ?? "").replaceAll("&amp;", "&");
}

/** The calendar day in Warsaw (the profiles' default time zone), `n` days from now. */
function warsawDay(n = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(
    new Date(Date.now() + n * 86_400_000),
  );
}

const streakCard = (page: Page) => page.locator("[data-dashboard='streak'] p").first();

for (const locale of LOCALES) {
  test.describe(`signed-in journeys (${locale})`, () => {
    test.describe.configure({ mode: "serial" });

    const users: User[] = [];
    test.afterAll(async () => {
      await deleteUsers(users);
    });

    test("sign-up: the emailed link, then onboarding", async ({ page }) => {
      const email = `e2e-signup-${locale}-${randomUUID().slice(0, 8)}@test.local`;
      await page.goto(PATHS.signIn[locale]);
      // The footer has the newsletter form's e-mail field too.
      await page.locator("main").getByLabel(msg(locale, "auth.email")).fill(email);
      await page
        .locator("main")
        .getByRole("button", { name: msg(locale, "auth.submit") })
        .click();
      await expect(page.getByText(msg(locale, "auth.sentTitle"))).toBeVisible();

      await page.goto(await magicLink(email));
      // A new account goes to onboarding first.
      await expect(page.getByText(msg(locale, "onboarding.goal.title"))).toBeVisible();
      const created = await admin().auth.admin.listUsers({ perPage: 200 });
      const user = created.data.users.find((u) => u.email === email);
      expect(user, "the account exists").toBeTruthy();
      if (user) users.push({ id: user.id, email, password: "" });

      await page.getByRole("radio", { name: msg(locale, "onboarding.goal.curiosity") }).check();
      await page.getByRole("button", { name: msg(locale, "onboarding.next") }).click();
      await page.getByRole("radio", { name: /^1 · / }).check();
      await page.getByRole("button", { name: msg(locale, "onboarding.next") }).click();
      await page
        .getByRole("radio", { name: msg(locale, "onboarding.daily.minutes", { minutes: 5 }) })
        .check();
      await page.getByRole("button", { name: msg(locale, "onboarding.finish") }).click();
      await expect(page.getByText(msg(locale, "onboarding.done.title"))).toBeVisible();

      const { data: profile } = await admin()
        .from("profiles")
        .select("onboarded_at, daily_goal_minutes, goal, locale")
        .eq("id", user?.id ?? "")
        .single();
      expect(profile).toMatchObject({ daily_goal_minutes: 5, goal: "curiosity", locale });
      expect(profile?.onboarded_at).toBeTruthy();
    });

    test("streak: yesterday's goal counts, meeting today's makes it 2", async ({ browser }) => {
      const user = await createUser(`streak-${locale}`);
      users.push(user);
      const db = admin();
      await db.from("profiles").update({ daily_goal_minutes: 5, locale }).eq("id", user.id);
      const yesterday = warsawDay(-1);
      const { error } = await db.from("xp_events").insert({
        user_id: user.id,
        amount: 20,
        reason: "daily_goal",
        ref: `day=${yesterday}`,
        idempotency_key: `${user.id}:goal:${yesterday}`,
      });
      if (error) throw error;

      const context = await browser.newContext();
      await signIn(context, user);
      const page = await context.newPage();
      await page.goto(`/${locale}`);
      await expect(streakCard(page)).toHaveText(/^1\b/);

      // Two level-1 samples (15 XP each with the first-try bonus) meet a 5-minute goal.
      await page.goto(PATHS.exercise[locale]);
      await page.getByLabel(msg(locale, "exercises.answer")).fill("5");
      await page.getByRole("button", { name: msg(locale, "exercises.submit") }).click();
      await expect(page.getByText(msg(locale, "exercises.result.correct")).first()).toBeVisible();
      await page.goto(PATHS.exercise[locale].replace("przyklad-liczba", "przyklad-wybor"));
      await page.getByRole("radio", { name: "4" }).check();
      await page.getByRole("button", { name: msg(locale, "exercises.submit") }).click();
      await expect(page.getByText(msg(locale, "exercises.result.correct")).first()).toBeVisible();

      await page.goto(`/${locale}`);
      await expect(streakCard(page)).toHaveText(/^2\b/);
      await context.close();
    });

    test("community: post under a lesson and see it", async ({ browser }) => {
      const user = await createUser(`post-${locale}`);
      users.push(user);
      await admin().from("profiles").update({ locale }).eq("id", user.id);
      const context = await browser.newContext();
      await signIn(context, user);
      const page = await context.newPage();
      await page.goto(PATHS.lesson[locale]);
      const d = page.locator("section[data-discussion]");
      await expect(d).toHaveAttribute("data-discussion", "open");
      const text = `Journey ${locale} ${String(Date.now())}: $E[X]$`;
      await d.getByLabel(msg(locale, "community.composer.label")).fill(text);
      await d.getByRole("button", { name: msg(locale, "community.composer.submit") }).click();
      await expect(d.locator("[data-comment]", { hasText: `Journey ${locale}` })).toBeVisible();
      await context.close();
    });

    test("settings, then deleting the account signs out and removes it", async ({ browser }) => {
      const user = await createUser(`delete-${locale}`);
      users.push(user);
      await admin().from("profiles").update({ locale }).eq("id", user.id);
      const context = await browser.newContext();
      await signIn(context, user);
      const page = await context.newPage();
      await page.goto(PATHS.settings[locale]);
      await page.getByLabel(msg(locale, "account.settings.displayName")).fill("Journey");
      await page.getByRole("button", { name: msg(locale, "account.settings.save") }).click();
      await expect(page.getByText(msg(locale, "account.settings.saved"))).toBeVisible();
      const { data: saved } = await admin()
        .from("profiles")
        .select("display_name, handle")
        .eq("id", user.id)
        .single();
      expect(saved?.display_name).toBe("Journey");

      const handle = saved?.handle ?? "";
      await page.getByRole("button", { name: msg(locale, "account.settings.delete") }).click();
      await page
        .getByLabel(msg(locale, "account.settings.deleteConfirmLabel", { handle }))
        .fill(handle);
      await page
        .getByRole("button", { name: msg(locale, "account.settings.deleteConfirm") })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      const gone = await admin().auth.admin.getUserById(user.id);
      expect(gone.data.user).toBeNull();
      // Signed out: the settings page sends the visitor to sign-in.
      await page.goto(PATHS.settings[locale]);
      await expect(page).toHaveURL(new RegExp(PATHS.signIn[locale]));
      await context.close();
    });
  });
}
