import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  secret: undefined as string | undefined,
  admin: null as object | null,
  rolled: [] as unknown[],
  calls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: {
    get CRON_SECRET() {
      return state.secret;
    },
  },
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => state.admin }));
vi.mock("@/features/gamification/server/supabase-store", () => ({ supabaseStore: () => ({}) }));
vi.mock("@/features/gamification/server/roll", () => ({
  rollFinishedWeeks: () => {
    state.calls += 1;
    return Promise.resolve(state.rolled);
  },
}));

const { GET } = await import("./route");
const call = (auth?: string) =>
  GET(
    new NextRequest("http://localhost/api/cron/leagues", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

describe("league cron", () => {
  beforeEach(() => {
    state.secret = undefined;
    state.admin = null;
    state.calls = 0;
  });

  it("is dormant (503) without a secret or a database", async () => {
    expect((await call("Bearer x")).status).toBe(503);
    state.secret = "s3cret";
    expect((await call("Bearer s3cret")).status).toBe(503);
    expect(state.calls).toBe(0);
  });

  it("refuses a wrong or missing token", async () => {
    state.secret = "s3cret";
    state.admin = {};
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(state.calls).toBe(0);
  });

  it("rolls and reports what it closed", async () => {
    state.secret = "s3cret";
    state.admin = {};
    state.rolled = [{ week: "2026-11-02", mode: "shared", members: 3, next: 2 }];
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rolled: state.rolled });
    expect(state.calls).toBe(1);
  });
});
