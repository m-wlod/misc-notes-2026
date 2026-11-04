import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => null }));

const { logMailer } = await import("@/features/notify/email");
const { sendAlert } = await import("./send");

/** Phase 22a "Done when": alerts fire in a test (e-mail and Sentry), once a day per key. */
describe("sendAlert", () => {
  const alert = { key: "ai-budget-80", subject: "AI budget at 80%", text: "4.00 of 5.00 USD" };

  it("e-mails and reports to Sentry once per key per day", async () => {
    const claimed = new Set<string>();
    const claim = (day: string, a: { key: string }) => {
      const k = `${day}:${a.key}`;
      const first = !claimed.has(k);
      claimed.add(k);
      return Promise.resolve(first);
    };
    const { mailer, sent } = logMailer();
    const reported: string[] = [];
    const report = (a: { key: string }) => {
      reported.push(a.key);
      return Promise.resolve();
    };
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deps = { claim, mailer, to: "owner@example.pl", report, now: new Date("2026-11-10") };

    expect(await sendAlert(alert, deps)).toBe(true);
    expect(await sendAlert(alert, deps)).toBe(false);
    expect(await sendAlert(alert, { ...deps, now: new Date("2026-11-11") })).toBe(true);

    expect(sent.map((e) => [e.to, e.subject])).toEqual([
      ["owner@example.pl", "AI budget at 80%"],
      ["owner@example.pl", "AI budget at 80%"],
    ]);
    expect(sent[0]?.html).toBe("<p>4.00 of 5.00 USD</p>");
    expect(reported).toEqual(["ai-budget-80", "ai-budget-80"]);
    log.mockRestore();
  });

  it("without a database the alert still goes out (no silent failures)", async () => {
    const { mailer, sent } = logMailer();
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendAlert(alert, { mailer, to: "o@example.pl", report: async () => {} })).toBe(
      true,
    );
    expect(sent).toHaveLength(1);
    log.mockRestore();
  });

  it("no recipient or mailer: only the log (and Sentry when configured)", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendAlert(alert, { mailer: null, to: null, report: async () => {} })).toBe(true);
    expect(log).toHaveBeenCalledWith("[alert] ai-budget-80: AI budget at 80%");
    log.mockRestore();
  });
});
