import { describe, expect, it } from "vitest";

import { authOrigin } from "@/config/runtime";

import { mayBan, rankOf } from "./access";

/** Phase 21: who may ban whom, and where sign-in links may send people. */
describe("ban hierarchy", () => {
  it("ranks roles", () => {
    expect(rankOf([])).toBe(0);
    expect(rankOf(["reviewer", "moderator"])).toBe(2);
    expect(rankOf(["unknown"])).toBe(0);
  });

  it("only someone who outranks the target bans; admins may act on admins", () => {
    expect(mayBan(["moderator"], [])).toBe(true);
    expect(mayBan(["moderator"], ["reviewer"])).toBe(true);
    expect(mayBan(["moderator"], ["moderator"])).toBe(false);
    expect(mayBan(["moderator"], ["admin"])).toBe(false);
    expect(mayBan(["admin"], ["admin"])).toBe(true);
  });
});

describe("sign-in link origin", () => {
  const site = { NEXT_PUBLIC_SITE_URL: "https://example.pl" };

  it("production always uses the site URL, whatever the request says", () => {
    const prod = { ...site, VERCEL_ENV: "production" as const };
    expect(authOrigin(prod, "https://evil.example")).toBe("https://example.pl");
    expect(authOrigin(prod, "http://localhost:3000")).toBe("https://example.pl");
  });

  it("elsewhere only known hosts are used", () => {
    const preview = { ...site, VERCEL_ENV: "preview" as const, VERCEL_URL: "app-abc.vercel.app" };
    expect(authOrigin(preview, "https://app-abc.vercel.app")).toBe("https://app-abc.vercel.app");
    expect(authOrigin(preview, "https://evil.example")).toBe("https://example.pl");
    expect(authOrigin({}, "http://localhost:3200")).toBe("http://localhost:3200");
    expect(authOrigin({}, "not a url")).toBe("http://localhost:3000");
    expect(authOrigin(site, null)).toBe("https://example.pl");
  });
});
