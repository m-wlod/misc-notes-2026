import { expect, test } from "./test";

/**
 * Phase 22a: what the uptime monitor (Better Stack) watches, and the Sentry launch check.
 * This build has no database, so both health checks report the database and jobs as off.
 */
test.skip(({ isMobile }) => isMobile, "API checks don't depend on the viewport");

test("health checks answer, uncached", async ({ request }) => {
  const app = await request.get("/api/health");
  expect(app.status()).toBe(200);
  expect(await app.json()).toEqual({ status: "ok", db: "off" });
  expect(app.headers()["cache-control"]).toContain("no-store");

  const crons = await request.get("/api/health/crons");
  expect(crons.status()).toBe(200);
  expect(await crons.json()).toEqual({ status: "off" });
});

test("the forced Sentry test error is for admins only", async ({ request }) => {
  const res = await request.get("/api/debug/sentry-test");
  expect(res.status()).toBe(403);
});
