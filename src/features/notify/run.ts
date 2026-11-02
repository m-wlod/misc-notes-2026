import { leagueWeek, localDate, weekday } from "@/features/gamification/days";

import type { EmailData, EmailWords, Mailer } from "./email";
import { buildEmail } from "./email";
import { inQuietHours, localTime, streakReminderDue, type EmailKind, type Prefs } from "./rules";

/**
 * The daily notification run (Phase 15), with the store, mailer and push sender
 * injected so it is unit-testable. Each notification has a key (kind + day or week) and
 * is recorded once sent, so a repeated run sends nothing twice. Quiet hours hold back
 * every kind; preferences switch each kind off.
 */
export type Recipient = {
  userId: string;
  email: string | null;
  locale: "pl" | "en";
  timeZone: string;
  prefs: Prefs;
  streak: { current: number; atRisk: boolean };
  weekly: { xp: number; goalDays: number; solved: number };
  league: {
    tier: string;
    rank: number;
    size: number;
    outcome: "promoted" | "stayed" | "demoted";
  } | null;
};

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

export interface NotifyStore {
  recipients(now: Date): Promise<Recipient[]>;
  sent(userId: string, key: string): Promise<boolean>;
  markSent(
    userId: string,
    key: string,
    kind: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
  pushSubscriptions(userId: string): Promise<PushSubscriptionRow[]>;
  dropSubscription(endpoint: string): Promise<void>;
}

export interface PushSender {
  send(
    sub: PushSubscriptionRow,
    message: { title: string; body: string; url: string },
  ): Promise<"ok" | "gone" | "error">;
}

export type Links = {
  cta: (kind: EmailKind, locale: "pl" | "en") => string;
  unsubscribe: (
    userId: string,
    kind: EmailKind,
    locale: "pl" | "en",
  ) => { page: string; post: string } | null;
};

export async function runNotifications(input: {
  store: NotifyStore;
  mailer: Mailer | null;
  push: PushSender | null;
  words: (data: EmailData, locale: "pl" | "en") => Promise<EmailWords>;
  links: Links;
  now: Date;
}) {
  const { store, mailer, push, words, links, now } = input;
  const counts = { email: 0, push: 0, skippedQuiet: 0 };
  const week = leagueWeek(now);
  const monday = weekday(localDate(now, "Europe/Warsaw")) === 1;

  for (const r of await store.recipients(now)) {
    const local = localTime(now, r.timeZone);
    const today = localDate(now, r.timeZone);
    if (inQuietHours(local, r.prefs.quietStart, r.prefs.quietEnd)) {
      counts.skippedQuiet += 1;
      continue;
    }
    const due: { kind: EmailKind; key: string; data: EmailData; push: boolean }[] = [];
    if (streakReminderDue(r.prefs, r.streak, local)) {
      due.push({
        kind: "streak",
        key: `streak:${today}`,
        data: { kind: "streak", days: r.streak.current },
        push: true,
      });
    }
    if (monday && r.prefs.weekly && r.weekly.xp > 0) {
      due.push({
        kind: "weekly",
        key: `weekly:${week}`,
        data: { kind: "weekly", ...r.weekly },
        push: false,
      });
    }
    if (monday && r.prefs.league && r.league) {
      due.push({
        kind: "league",
        key: `league:${week}`,
        data: { kind: "league", ...r.league },
        push: false,
      });
    }

    for (const n of due) {
      if (await store.sent(r.userId, n.key)) continue;
      const w = await words(n.data, r.locale);
      let delivered = false;
      const unsub = links.unsubscribe(r.userId, n.kind, r.locale);
      // Email only with a working unsubscribe link: every email must be one click away
      // from never coming again.
      if (mailer && r.email && unsub) {
        const ok = await mailer.send(
          buildEmail({
            to: r.email,
            kind: n.kind,
            words: w,
            ctaUrl: links.cta(n.kind, r.locale),
            unsubscribePage: unsub.page,
            unsubscribePost: unsub.post,
          }),
        );
        if (ok) {
          counts.email += 1;
          delivered = true;
        }
      }
      if (push && n.push && r.prefs.push) {
        for (const sub of await store.pushSubscriptions(r.userId)) {
          const res = await push.send(sub, {
            title: w.subject,
            body: w.lines[0] ?? "",
            url: links.cta(n.kind, r.locale),
          });
          if (res === "ok") {
            counts.push += 1;
            delivered = true;
          } else if (res === "gone") {
            await store.dropSubscription(sub.endpoint);
          }
        }
      }
      if (delivered) await store.markSent(r.userId, n.key, n.kind, { ...n.data });
    }
  }
  return counts;
}
