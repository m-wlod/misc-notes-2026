import { admin, createUser, deleteUsers, signIn, type User } from "./users";
import { expect, test } from "../e2e/test";
import { signSubscriber } from "../src/features/newsletter/core";

/**
 * Phase 19c with a database: double opt-in from the landing page, confirmation by click,
 * one-click unsubscribe from the link every issue carries; and the admin's video
 * calendar lists what has no video yet.
 */
test.describe.configure({ mode: "serial" });

const email = `e2e-nl-${String(Date.now())}@test.local`;
let boss: User | undefined;

test.afterAll(async () => {
  await admin().from("newsletter_subscribers").delete().eq("email", email);
  await deleteUsers([boss]);
});

const subscriber = async () => {
  const { data } = await admin()
    .from("newsletter_subscribers")
    .select("id, locale, confirm_token, confirmed_at, unsubscribed_at")
    .eq("email", email)
    .single();
  return data;
};

test("subscribe, confirm by click, unsubscribe in one click", async ({ page, request }) => {
  await page.goto("/pl");
  const form = page.locator("main [data-newsletter-form]");
  await form.getByLabel("Adres e-mail").fill(email);
  await form.getByRole("button", { name: "Zapisz mnie" }).click();
  await expect(page.locator("main [data-newsletter='sent']")).toBeVisible();
  const first = await subscriber();
  expect(first).toMatchObject({ locale: "pl", confirmed_at: null });

  // Signing up again says the same and reveals nothing; still one row.
  await page.reload();
  await form.getByLabel("Adres e-mail").fill(email.toUpperCase());
  await form.getByRole("button", { name: "Zapisz mnie" }).click();
  await expect(page.locator("main [data-newsletter='sent']")).toBeVisible();
  const again = await subscriber();
  expect(again?.id).toBe(first?.id);

  // Opening the link alone confirms nothing; the click does.
  await page.goto(`/pl/newsletter/potwierdz?t=${again?.confirm_token ?? ""}`);
  await expect(page.getByRole("button", { name: "Potwierdzam zapis" })).toBeVisible();
  expect((await subscriber())?.confirmed_at).toBeNull();
  await page.getByRole("button", { name: "Potwierdzam zapis" }).click();
  await expect(page.locator("[data-newsletter-result='ok']")).toBeVisible();
  const confirmed = await subscriber();
  expect(confirmed?.confirmed_at).not.toBeNull();
  expect(confirmed?.unsubscribed_at).toBeNull();

  const id = first?.id ?? 0;
  const s = signSubscriber("e2e-email-token-secret", id);
  const res = await request.post(`/api/newsletter/unsubscribe?i=${String(id)}&s=${s}`, {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(res.status()).toBe(200);
  expect((await subscriber())?.unsubscribed_at).not.toBeNull();
});

test("the video calendar lists what has no video, with where to record it", async ({ browser }) => {
  boss = await createUser("social-boss", "admin");
  const context = await browser.newContext();
  await signIn(context, boss);
  const page = await context.newPage();
  await page.goto("/pl/admin/social");
  // The sample video leads to expected-value, so that lesson is covered.
  await expect(page.locator("[data-social='lesson:expected-value']")).toHaveCount(0);
  const kelly = page.locator("[data-social='lesson:kelly-criterion'] a[data-recording-link]");
  await expect(kelly).toHaveAttribute(
    "href",
    /\/pl\/laboratorium\/symulacje\/[a-z-]+\?nagranie=1$/,
  );
  await page.goto("/pl/admin/social?typ=debunk");
  await expect(page.locator("[data-social^='lesson:']")).toHaveCount(0);
  await expect(page.locator("[data-social='debunk:przyklad-kurs-sie-zwroci']")).toBeVisible();
  // The sample video names this entry, so it's covered too.
  await expect(page.locator("[data-social='debunk:przyklad-skutecznosc']")).toHaveCount(0);
  await context.close();
});
