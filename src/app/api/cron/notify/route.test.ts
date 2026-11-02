import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type State = {
  env: Record<string, string | undefined>;
  admin: object | null;
  runs: { mailer: unknown; push: unknown }[];
};
const state = vi.hoisted((): State => ({ env: {}, admin: null, runs: [] }));

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: new Proxy({}, { get: (_, k: string) => state.env[k] }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => state.admin }));
vi.mock("@/features/notify/supabase-store", () => ({ supabaseNotifyStore: () => ({}) }));
vi.mock("@/features/notify/words", () => ({ emailWords: () => Promise.resolve({}) }));
vi.mock("@/features/notify/push", () => ({ webPushSender: () => ({ push: true }) }));
vi.mock("@/features/notify/run", () => ({
  runNotifications: (input: { mailer: unknown; push: unknown }) => {
    state.runs.push({ mailer: input.mailer, push: input.push });
    return Promise.resolve({ email: 2, push: 0, skippedQuiet: 0 });
  },
}));
vi.mock("@/i18n/navigation", () => ({ getPathname: () => "/" }));

const { GET } = await import("./route");
const call = (auth?: string) =>
  GET(
    new NextRequest("http://localhost/api/cron/notify", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

describe("notify cron", () => {
  beforeEach(() => {
    state.env = {};
    state.admin = null;
    state.runs = [];
  });

  it("is dormant without a secret or database, refuses wrong tokens", async () => {
    expect((await call("Bearer x")).status).toBe(503);
    state.env.CRON_SECRET = "s3cret";
    expect((await call("Bearer s3cret")).status).toBe(503);
    state.admin = {};
    expect((await call("Bearer nope")).status).toBe(401);
    expect(state.runs).toEqual([]);
  });

  it("sends email only with Resend, a sender and the unsubscribe secret", async () => {
    state.env = { CRON_SECRET: "s3cret", RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.test" };
    state.admin = {};
    expect((await call("Bearer s3cret")).status).toBe(200);
    expect(state.runs[0]?.mailer).toBeNull(); // no EMAIL_TOKEN_SECRET: no email
    state.env.EMAIL_TOKEN_SECRET = "tok";
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ email: 2, push: 0, skippedQuiet: 0 });
    expect(state.runs[1]?.mailer).not.toBeNull();
    expect(state.runs[1]?.push).toBeNull(); // no VAPID keys
  });
});
