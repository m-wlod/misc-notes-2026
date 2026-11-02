import { describe, expect, it } from "vitest";

import { buildEmail, logMailer, type EmailData, type EmailWords } from "./email";
import { DEFAULT_PREFS, inQuietHours, localTime, streakReminderDue, type Prefs } from "./rules";
import { runNotifications, type NotifyStore, type PushSender, type Recipient } from "./run";
import { signToken, unsubscribeQuery, verifyToken } from "./token";
import { applyUnsubscribe, type PrefsStore } from "./unsubscribe";

const SECRET = "test-secret-0123456789";
const USER = "0b9e7c1e-1d2a-4f5b-9c8d-1234567890ab";

describe("quiet hours and reminder rules", () => {
  it("local time per zone, also across DST", () => {
    expect(localTime(new Date("2026-01-14T21:30:00Z"), "Europe/Warsaw")).toBe("22:30");
    expect(localTime(new Date("2026-07-14T21:30:00Z"), "Europe/Warsaw")).toBe("23:30");
    expect(localTime(new Date("2026-07-14T21:30:00Z"), "America/New_York")).toBe("17:30");
  });

  it("windows inside a day and across midnight; none when unset or empty", () => {
    expect(inQuietHours("13:00", "12:00", "14:00")).toBe(true);
    expect(inQuietHours("14:00", "12:00", "14:00")).toBe(false); // end is exclusive
    expect(inQuietHours("23:30", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("06:59", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("07:00", "22:00", "07:00")).toBe(false);
    expect(inQuietHours("12:00", "22:00", "07:00")).toBe(false);
    expect(inQuietHours("12:00", null, "07:00")).toBe(false);
    expect(inQuietHours("12:00", "09:00", "09:00")).toBe(false);
    expect(inQuietHours("12:00", "09:00:00", "18:00:00")).toBe(true); // DB time format
  });

  it("a streak reminder needs a streak at risk, the pref on, and no quiet hours", () => {
    const at = { current: 4, atRisk: true };
    expect(streakReminderDue(DEFAULT_PREFS, at, "19:00")).toBe(true);
    expect(streakReminderDue(DEFAULT_PREFS, { current: 0, atRisk: false }, "19:00")).toBe(false);
    expect(streakReminderDue(DEFAULT_PREFS, { current: 4, atRisk: false }, "19:00")).toBe(false);
    expect(streakReminderDue({ ...DEFAULT_PREFS, streak: false }, at, "19:00")).toBe(false);
    const quiet: Prefs = { ...DEFAULT_PREFS, quietStart: "18:00", quietEnd: "08:00" };
    expect(streakReminderDue(quiet, at, "19:00")).toBe(false);
  });
});

describe("unsubscribe tokens", () => {
  it("verify only for the same user, kind and secret", () => {
    const s = signToken(SECRET, USER, "streak");
    expect(verifyToken(SECRET, USER, "streak", s)).toBe(true);
    expect(verifyToken(SECRET, USER, "weekly", s)).toBe(false);
    expect(verifyToken("other-secret", USER, "streak", s)).toBe(false);
    expect(verifyToken(SECRET, USER.replace("0b", "0c"), "streak", s)).toBe(false);
    expect(verifyToken(SECRET, USER, "streak", `${s}x`)).toBe(false);
    expect(verifyToken(undefined, USER, "streak", s)).toBe(false);
    expect(verifyToken(SECRET, USER, "everything", s)).toBe(false);
    expect(unsubscribeQuery(SECRET, USER, "league")).toBe(
      `u=${USER}&k=league&s=${signToken(SECRET, USER, "league")}`,
    );
  });

  it("one click switches that kind off; anything forged changes nothing", async () => {
    const calls: [string, string, boolean][] = [];
    const store: PrefsStore = {
      setEmail: (u, k, on) => {
        calls.push([u, k, on]);
        return Promise.resolve(true);
      },
    };
    const s = signToken(SECRET, USER, "weekly");
    expect(await applyUnsubscribe(store, SECRET, { u: USER, k: "weekly", s })).toEqual({
      ok: true,
      kind: "weekly",
    });
    expect(await applyUnsubscribe(store, SECRET, { u: USER, k: "weekly", s }, true)).toEqual({
      ok: true,
      kind: "weekly",
    });
    expect(await applyUnsubscribe(store, SECRET, { u: USER, k: "streak", s })).toEqual({
      ok: false,
    });
    expect(await applyUnsubscribe(store, SECRET, { u: USER, k: "weekly", s: null })).toEqual({
      ok: false,
    });
    expect(await applyUnsubscribe(null, SECRET, { u: USER, k: "weekly", s })).toEqual({
      ok: false,
    });
    expect(calls).toEqual([
      [USER, "weekly", false],
      [USER, "weekly", true],
    ]);
  });
});

const words = (d: EmailData): Promise<EmailWords> =>
  Promise.resolve({
    subject: `subject ${d.kind}`,
    lines: [`line <${d.kind}>`],
    cta: "Open",
    footer: "Footer",
    unsubscribe: "Unsubscribe",
  });

describe("emails", () => {
  it("carry the one-click headers and a visible, escaped unsubscribe link", () => {
    const e = buildEmail({
      to: "a@example.com",
      kind: "streak",
      words: {
        subject: "S",
        lines: ['Tom & "Jerry" <b>'],
        cta: "Go",
        footer: "F",
        unsubscribe: "Stop",
      },
      ctaUrl: "https://x.test/",
      unsubscribePage: "https://x.test/pl/wypisz?u=1&k=streak&s=t",
      unsubscribePost: "https://x.test/api/unsubscribe?u=1&k=streak&s=t",
    });
    expect(e.headers).toEqual({
      "List-Unsubscribe": "<https://x.test/api/unsubscribe?u=1&k=streak&s=t>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(e.html).toContain("Tom &amp; &quot;Jerry&quot; &lt;b&gt;");
    expect(e.html).toContain('href="https://x.test/pl/wypisz?u=1&amp;k=streak&amp;s=t"');
    expect(e.text).toContain("Stop: https://x.test/pl/wypisz?u=1&k=streak&s=t");
  });
});

describe("the daily run", () => {
  const recipient = (over: Partial<Recipient> = {}): Recipient => ({
    userId: USER,
    email: "a@example.com",
    locale: "pl",
    timeZone: "Europe/Warsaw",
    prefs: DEFAULT_PREFS,
    streak: { current: 5, atRisk: true },
    weekly: { xp: 300, goalDays: 4, solved: 9 },
    league: { tier: "gauss", rank: 3, size: 28, outcome: "promoted" },
    ...over,
  });
  function memory(recipients: Recipient[]) {
    const sentKeys = new Set<string>();
    const dropped: string[] = [];
    const store: NotifyStore = {
      recipients: () => Promise.resolve(recipients),
      sent: (u, k) => Promise.resolve(sentKeys.has(`${u}|${k}`)),
      markSent: (u, k) => {
        sentKeys.add(`${u}|${k}`);
        return Promise.resolve();
      },
      pushSubscriptions: () =>
        Promise.resolve([
          { endpoint: "https://push.test/ok", p256dh: "p".repeat(20), auth: "a".repeat(20) },
          { endpoint: "https://push.test/gone", p256dh: "p".repeat(20), auth: "a".repeat(20) },
        ]),
      dropSubscription: (endpoint) => {
        dropped.push(endpoint);
        return Promise.resolve();
      },
    };
    return { store, sentKeys, dropped };
  }
  const links = {
    cta: () => "https://x.test/",
    unsubscribe: () => ({
      page: "https://x.test/pl/wypisz?x",
      post: "https://x.test/api/unsubscribe?x",
    }),
  };
  const push: PushSender = {
    send: (sub) => Promise.resolve(sub.endpoint.endsWith("gone") ? "gone" : "ok"),
  };
  // Monday 2026-11-09, 17:00 UTC = 18:00 in Warsaw.
  const monday = new Date("2026-11-09T17:00:00Z");
  const tuesday = new Date("2026-11-10T17:00:00Z");

  it("Monday: streak reminder, weekly summary and league result, each once", async () => {
    const { store } = memory([recipient()]);
    const { mailer, sent } = logMailer();
    const first = await runNotifications({ store, mailer, push: null, words, links, now: monday });
    expect(first.email).toBe(3);
    expect(sent.map((e) => e.subject).sort()).toEqual([
      "subject league",
      "subject streak",
      "subject weekly",
    ]);
    expect(
      sent.every((e) => e.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click"),
    ).toBe(true);
    // A second run the same day sends nothing again.
    const again = await runNotifications({ store, mailer, push: null, words, links, now: monday });
    expect(again.email).toBe(0);
  });

  it("other days only the streak reminder; switched-off kinds and quiet hours are respected", async () => {
    const { mailer, sent } = logMailer();
    await runNotifications({
      store: memory([recipient()]).store,
      mailer,
      push: null,
      words,
      links,
      now: tuesday,
    });
    expect(sent.map((e) => e.subject)).toEqual(["subject streak"]);

    const off = logMailer();
    await runNotifications({
      store: memory([
        recipient({ prefs: { ...DEFAULT_PREFS, streak: false, weekly: false, league: false } }),
      ]).store,
      mailer: off.mailer,
      push: null,
      words,
      links,
      now: monday,
    });
    expect(off.sent).toEqual([]);

    const quiet = logMailer();
    const res = await runNotifications({
      store: memory([
        recipient({ prefs: { ...DEFAULT_PREFS, quietStart: "17:00", quietEnd: "20:00" } }),
      ]).store,
      mailer: quiet.mailer,
      push: null,
      words,
      links,
      now: monday,
    });
    expect(quiet.sent).toEqual([]);
    expect(res.skippedQuiet).toBe(1);
  });

  it("no unsubscribe link, no email; push goes out and gone subscriptions are dropped", async () => {
    const m = memory([recipient({ prefs: { ...DEFAULT_PREFS, push: true } })]);
    const { mailer, sent } = logMailer();
    const res = await runNotifications({
      store: m.store,
      mailer,
      push,
      words,
      links: { ...links, unsubscribe: () => null },
      now: tuesday,
    });
    expect(sent).toEqual([]);
    expect(res.push).toBe(1);
    expect(m.dropped).toEqual(["https://push.test/gone"]);
    expect(m.sentKeys.size).toBe(1); // delivered by push: recorded once
  });
});
