import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/config/theme";

/**
 * Account pages on a deployment without Supabase (Vercel previews, and local dev until a
 * dev project exists). Everything must degrade to a clear note or a redirect, never crash.
 * The signed-in flows (magic link → onboarding → profile, merge, export, delete) need a
 * Supabase project and are tracked in docs/PROGRESS.md.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

test("sign-in explains that accounts are not enabled, in both locales", async ({ page }) => {
  await page.goto("/pl/logowanie");
  await expect(page.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Konta nie są jeszcze włączone");
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.goto("/en/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Accounts aren’t enabled");
});

for (const [from, to] of [
  ["/pl/ustawienia", /\/pl\/logowanie$/],
  ["/pl/pierwsze-kroki", /\/pl\/logowanie$/],
  ["/en/settings", /\/en\/sign-in$/],
] as const) {
  test(`${from} sends a signed-out visitor to sign-in`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  });
}

test("the profile page explains that accounts are not enabled", async ({ page }) => {
  await page.goto("/pl/profil");
  await expect(page).toHaveURL(/\/pl\/profil$/);
  await expect(page.getByText("Konta nie są jeszcze włączone")).toBeVisible();
});

test("account endpoints refuse a signed-out request", async ({ request }) => {
  const exported = await request.get("/api/me/export");
  expect(exported.status()).toBe(401);

  const callback = await request.get("/api/auth/callback?code=forged&next=/pl/profil", {
    maxRedirects: 0,
  });
  expect(callback.status()).toBe(307);
  expect(callback.headers().location).toMatch(/\/pl\/logowanie\?error=callback$/);
});

test("the callback never redirects off-site", async ({ request }) => {
  const res = await request.get("/api/auth/callback?next=//evil.example/x", { maxRedirects: 0 });
  const location = new URL(res.headers().location ?? "", "http://localhost");
  expect(location.hostname).toBe("localhost");
});

test.describe("placement quiz (signed out, graded on the server)", () => {
  // Answers in the learner's own notation: comma decimals, percentages, fractions.
  const ANSWERS: Record<string, string> = {
    "drawdown-recovery": "100%",
    "die-expected-value": "3,5",
    "three-losses": "0,091",
    "variance-of-difference": "13",
    "kelly-even-money": "1/5",
    "sharpe-t-stat": "1", // wrong on purpose: the t-stat is 2
    "gbm-log-return": "8%",
    "lognormal-mean": "1,6487", // "1,649" would be ambiguous (thousands separator)
  };

  test("grades every answer and suggests a level", async ({ page }) => {
    await page.goto("/pl/test-poziomujacy");
    const inputs = page.locator('form input[id^="a-"]');
    await expect(inputs).toHaveCount(Object.keys(ANSWERS).length);
    for (const [id, value] of Object.entries(ANSWERS)) {
      await page.locator(`input[name="${id}"]`).fill(value);
    }
    await page.getByRole("button", { name: "Sprawdź odpowiedzi" }).click();

    const result = page.getByRole("status").filter({ hasText: "Twój wynik" });
    await expect(result).toContainText("7 z 8");
    await expect(page.getByText("źle", { exact: true })).toHaveCount(1);
    await expect(inputs.first()).toBeDisabled();
  });

  test("the expected answers never reach the browser", async ({ page }) => {
    const bodies: string[] = [];
    page.on("response", async (res) => {
      if (res.request().resourceType() === "script" || res.url().includes("test-poziomujacy")) {
        bodies.push(await res.text().catch(() => ""));
      }
    });
    await page.goto("/pl/test-poziomujacy");
    await page.waitForLoadState("networkidle");
    const all = bodies.join("\n");
    expect(all).not.toContain("0.091125");
    expect(all).not.toContain("tolerance");
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: sign-in and placement (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    for (const path of ["/pl/logowanie", "/en/sign-in", "/pl/test-poziomujacy", "/en/placement"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });
}
