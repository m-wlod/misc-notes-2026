import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Phase 15b, signed out and without a database: certificate verification answers "not
 * found" honestly, the PDF 404s, unsubscribe links without a valid token change nothing,
 * and the signed-in pieces render as style guide specimens.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const ID = "0b9e7c1e-1d2a-4f5b-9c8d-1234567890ab";

async function axe(page: Page, include: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include(include)
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test("certificate verification: unknown or malformed ids are not found; no PDF", async ({
  page,
  request,
}) => {
  await page.goto(`/pl/verify/${ID}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Weryfikacja certyfikatu" }),
  ).toBeVisible();
  await expect(page.locator("[data-verify='not-found']")).toContainText(
    "Nie znaleźliśmy takiego certyfikatu.",
  );
  await page.goto("/en/verify/not-a-uuid");
  await expect(page.locator("[data-verify='not-found']")).toBeVisible();
  expect((await request.get(`/api/certificates/${ID}/pdf`)).status()).toBe(404);
});

test("unsubscribe: a forged link changes nothing and says so", async ({ page, request }) => {
  await page.goto(`/pl/wypisz?u=${ID}&k=streak&s=forged`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Wypisanie z powiadomień" }),
  ).toBeVisible();
  await expect(page.locator("[data-unsubscribe='invalid']")).toBeVisible();
  const res = await request.post(`/api/unsubscribe?u=${ID}&k=streak&s=forged`, {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(res.status()).toBe(400);
  expect(await res.json()).toEqual({ ok: false });
});

test.describe("style guide specimens", () => {
  test("certificates list and notification settings", async ({ page }) => {
    await page.goto("/pl/styleguide#gamification");
    const certs = page.locator("[data-specimen='certificates']");
    await expect(certs.locator("[data-track='foundations']")).toContainText("Zobacz certyfikat");
    await expect(certs.locator("[data-track='probability']")).toContainText("Lekcje: 4 z 9");
    await expect(certs).toContainText("Nie jest kwalifikacją zawodową");
    const n = page.locator("[data-specimen='notifications']");
    const weekly = n.getByLabel("Podsumowanie tygodnia (poniedziałek)");
    await expect(weekly).not.toBeChecked();
    await weekly.check();
    await expect(n.getByLabel("Od", { exact: true })).toHaveValue("22:00");
    await n.getByRole("button", { name: "Zapisz powiadomienia" }).click();
    await expect(n.getByRole("status")).toHaveText("Zapisano.");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`certificates and notification settings pass axe (${theme})`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value);
        },
        [THEME_STORAGE_KEY, theme] as const,
      );
      await page.goto("/pl/styleguide#gamification");
      await expect(page.locator("[data-specimen='notifications'] form")).toBeVisible();
      await axe(page, "[data-specimen='certificates']");
      await axe(page, "[data-specimen='notifications']");
    });
  }
});
