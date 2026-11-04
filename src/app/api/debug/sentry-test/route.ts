import { connection } from "next/server";

import { requireApi } from "@/features/admin/server";

/**
 * GET /api/debug/sentry-test (Phase 22a): throws on purpose, so the launch check can see
 * a real error arrive in Sentry with a readable stack trace and the release. Admins only.
 */
class SentryTestError extends Error {
  constructor() {
    super("Sentry test error: thrown on purpose from /api/debug/sentry-test");
    this.name = "SentryTestError";
  }
}

export async function GET() {
  await connection();
  const staff = await requireApi("system");
  if (staff instanceof Response) return staff;
  throw new SentryTestError();
}
