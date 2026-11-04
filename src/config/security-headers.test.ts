import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "./security-headers";

describe("security headers (Phase 21)", () => {
  it("locks down the policy in production", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", dev: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain(
      "connect-src 'self' https://cdn.jsdelivr.net https://abc.supabase.co wss://abc.supabase.co",
    );
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("the dev server gets eval and websockets for hot reload, nothing else", () => {
    const csp = contentSecurityPolicy({ dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("sends the standard hardening headers", () => {
    const keys = securityHeaders({ dev: false }).map((h) => h.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "X-Frame-Options",
    ]);
  });
});

describe("Sentry in the CSP (Phase 22a)", () => {
  it("adds the DSN's ingest host only when Sentry is configured", () => {
    const dsn = "https://abc@o1.ingest.de.sentry.io/123";
    expect(contentSecurityPolicy({ sentryDsn: dsn, dev: false })).toContain(
      "https://o1.ingest.de.sentry.io",
    );
    expect(contentSecurityPolicy({ dev: false })).not.toContain("sentry");
  });
});
