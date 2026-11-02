import { expect, test } from "./test";

// A Polish browser. Accept-Language routing for other locales is covered in shell.spec.ts.
test.use({ locale: "pl-PL" });

test("root redirects a Polish browser to the Polish home page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/pl$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
