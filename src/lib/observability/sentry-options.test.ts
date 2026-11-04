import { describe, expect, it } from "vitest";

import { scrubEvent, sentryOptions } from "./sentry-options";

describe("Sentry privacy (Phase 22a)", () => {
  it("drops query strings, cookies, headers and anything about the user but the id", () => {
    const e = scrubEvent({
      request: {
        url: "https://x.pl/pl/newsletter/potwierdz?t=secret-token#a",
        query_string: "t=secret-token",
        cookies: { "sb-auth": "jwt" },
        headers: { "x-forwarded-for": "1.2.3.4" },
      },
      user: { id: "u1", email: "a@b.pl", ip_address: "1.2.3.4" },
      breadcrumbs: [{ data: { url: "/api/unsubscribe?i=1&s=sig" } }, {}],
    });
    expect(e.request).toEqual({ url: "https://x.pl/pl/newsletter/potwierdz" });
    expect(e.user).toEqual({ id: "u1" });
    expect(e.breadcrumbs[0]?.data?.url).toBe("/api/unsubscribe");
    expect(JSON.stringify(e)).not.toMatch(/secret-token|a@b\.pl|1\.2\.3\.4|jwt|sig/);
  });

  it("errors only: no tracing, no default personal data", () => {
    const o = sentryOptions({ dsn: "https://k@o1.ingest.de.sentry.io/1" });
    expect(o.sendDefaultPii).toBe(false);
    expect(o.tracesSampleRate).toBe(0);
    expect(o.environment).toBe("development");
  });
});
