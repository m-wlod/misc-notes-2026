import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const env: { VERCEL_ENV?: string } = {};
vi.mock("@/env", () => ({ env }));

const checkBotId = vi.fn();
vi.mock("botid/server", () => ({ checkBotId }));

const { isBot } = await import("./check");

describe("isBot (Vercel BotID, Phase 21c)", () => {
  beforeEach(() => {
    checkBotId.mockReset();
    delete env.VERCEL_ENV;
  });

  it("off Vercel there is nothing to ask: it passes without calling BotID", async () => {
    expect(await isBot()).toBe(false);
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("on Vercel the verdict decides", async () => {
    env.VERCEL_ENV = "production";
    checkBotId.mockResolvedValueOnce({ isBot: true });
    expect(await isBot()).toBe(true);
    checkBotId.mockResolvedValueOnce({ isBot: false });
    expect(await isBot()).toBe(false);
  });

  it("an error in the check fails open (logged): sign-in must not break", async () => {
    env.VERCEL_ENV = "production";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    checkBotId.mockRejectedValueOnce(new Error("VERCEL_OIDC_TOKEN is not set"));
    expect(await isBot()).toBe(false);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
