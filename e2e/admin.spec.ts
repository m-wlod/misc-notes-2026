import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./test";
import { THEME_STORAGE_KEY } from "../src/config/theme";
import { NAV, sectionPath } from "../src/features/admin/access";

/**
 * Phase 18: every admin page and API route answers 403 to visitors (here without a
 * database, as on production today). Signed-in roles are covered in e2e-db/admin.spec.ts.
 */
test("every admin page is a 403 with the localised page, in both locales", async ({ request }) => {
  for (const locale of ["pl", "en"] as const) {
    for (const section of NAV) {
      const res = await request.get(`/${locale}${sectionPath(section)}`, { maxRedirects: 0 });
      expect(res.status(), `${locale} ${section}`).toBe(403);
      expect(await res.text()).toContain(locale === "pl" ? "Brak dostępu" : "No access");
    }
  }
  const unknown = await request.get("/pl/admin/nie-ma-takiej-sekcji", { maxRedirects: 0 });
  expect(unknown.status()).toBe(403);
});

test("admin API routes are a 403", async ({ request }) => {
  const res = await request.get("/api/admin/users/00000000-0000-0000-0000-000000000000/export");
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({ error: "forbidden" });
});

for (const theme of ["light", "dark"] as const) {
  test(`the 403 page passes axe (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await page.goto("/pl/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Brak dostępu" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
