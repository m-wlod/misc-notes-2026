import { describe, expect, it } from "vitest";
import { z } from "zod";

import { clientSchema, serverSchema } from "./env.schema";

const client = z.object(clientSchema);
const server = z.object(serverSchema);

describe("env schema", () => {
  it("accepts an empty environment and applies defaults", () => {
    expect(client.parse({})).toMatchObject({
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    });
    expect(server.parse({})).toMatchObject({ AI_USER_DAILY_QUOTA: 10, AI_DAILY_BUDGET_USD: 5 });
  });

  it("rejects a malformed site URL and an unknown styleguide flag", () => {
    expect(server.safeParse({ ENABLE_STYLEGUIDE: "yes" }).success).toBe(false);
    expect(client.safeParse({ NEXT_PUBLIC_SITE_URL: "not a url" }).success).toBe(false);
  });

  it("coerces numeric limits from strings and rejects nonsense", () => {
    expect(server.parse({ AI_USER_DAILY_QUOTA: "25" }).AI_USER_DAILY_QUOTA).toBe(25);
    expect(server.safeParse({ AI_DAILY_BUDGET_USD: "-1" }).success).toBe(false);
    expect(server.safeParse({ AI_USER_DAILY_QUOTA: "2.5" }).success).toBe(false);
  });
});
