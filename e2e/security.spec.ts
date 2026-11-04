import { expect, test, type Page } from "./test";

/**
 * Phase 21: security headers on pages and API routes, and no Content-Security-Policy
 * violation where the policy is tightest: the simulations (canvas, a worker) and the
 * click-to-load video player. Python under the policy (Pyodide from jsDelivr,
 * WebAssembly, a worker) is covered by python.spec.ts, which runs real code.
 */
test.skip(({ isMobile }) => isMobile, "headers don't depend on the viewport");

const violations = (page: Page) => {
  const found: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) found.push(m.text());
  });
  return found;
};

test("pages and API routes send the security headers", async ({ request }) => {
  for (const path of ["/pl", "/pl/praktyka/przyklad-liczba", "/api/og?kind=page&id=home&lang=pl"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"], path).toContain("max-age=");
    expect(h["x-frame-options"], path).toBe("DENY");
  }
});

test("no CSP violation: a simulation, the video player and the sample lesson", async ({ page }) => {
  const found = violations(page);
  await page.goto("/pl/laboratorium/symulacje/ruch-browna");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/pl/v/przyklad");
  await page.getByRole("button", { name: /Odtwórz: / }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.goto("/pl/dev/content-preview?id=przyklad-wartosc-oczekiwana");
  await page.waitForLoadState("networkidle");
  expect(found).toEqual([]);
});

test("percent-encoded paths don't slip past the admin and internal-tool gates", async ({
  request,
}) => {
  const admin = await request.get("/pl/%61dmin", { maxRedirects: 0 });
  expect(admin.status()).toBe(403);
  const internal = await request.get("/pl/%73tyleguide", { maxRedirects: 0 });
  // e2e builds open the style guide on purpose (ENABLE_STYLEGUIDE=1): it must resolve
  // exactly like the plain path, not differently.
  expect(internal.status()).toBe((await request.get("/pl/styleguide")).status());
});

test("no X-Powered-By header", async ({ request }) => {
  expect((await request.get("/pl")).headers()["x-powered-by"]).toBeUndefined();
});
