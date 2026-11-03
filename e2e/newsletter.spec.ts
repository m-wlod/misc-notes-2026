import { expect, test } from "./test";

/**
 * Phase 19c without a database (as on production today): the sign-up form says sign-ups
 * aren't open yet, and links without a valid token change nothing. The full flow runs
 * against a database in e2e-db/newsletter.spec.ts.
 */
test("the sign-up form answers honestly when sign-ups aren't open", async ({ page }) => {
  await page.goto("/pl");
  const form = page.locator("main [data-newsletter-form]");
  await form.getByLabel("Adres e-mail").fill("ktos@example.com");
  await form.getByRole("button", { name: "Zapisz mnie" }).click();
  await expect(form.getByRole("alert")).toHaveText("Zapisy jeszcze nie działają. Wróć wkrótce.");
  // The footer form is on every page.
  await expect(page.locator("footer [data-newsletter-form]")).toBeVisible();
});

test("confirmation and unsubscribe links without a valid token change nothing", async ({
  page,
}) => {
  await page.goto("/pl/newsletter/potwierdz?t=nie-token");
  await expect(page.locator("[data-newsletter-result='invalid']")).toBeVisible();
  await page.goto("/pl/newsletter/potwierdz?t=3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  await page.getByRole("button", { name: "Potwierdzam zapis" }).click();
  await expect(page.locator("[data-newsletter-result='failed']")).toBeVisible();
  await page.goto("/en/newsletter/unsubscribe?i=1&s=forged");
  await expect(page.locator("[data-newsletter-result='invalid']")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("one-click unsubscribe refuses forged links", async ({ request }) => {
  const res = await request.post("/api/newsletter/unsubscribe?i=1&s=forged", {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(res.status()).toBe(400);
});
