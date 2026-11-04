import "server-only";

import { env } from "@/env";
import { resendMailer, type Mailer } from "@/features/notify/email";
import { createAdminClient } from "@/lib/db/admin";

/**
 * Operational alerts (Phase 22a): an e-mail to `ALERT_EMAIL` (through Resend) and a Sentry
 * message, each at most once per key per day. The day's key is claimed in `alert_log`
 * first, so two instances can't both send it. Without a database, Resend or Sentry the
 * matching part is skipped; an alert is always printed to the server log.
 */
export type Alert = { key: string; subject: string; text: string };

export type AlertDeps = {
  /** Claims the key for today; false when it was already sent. */
  claim?: (day: string, a: Alert) => Promise<boolean>;
  mailer?: Mailer | null;
  to?: string | null;
  report?: (a: Alert) => Promise<void>;
  now?: Date;
};

async function claimInDb(day: string, a: Alert): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;
  const { data, error } = await admin
    .from("alert_log")
    .upsert(
      { day, key: a.key, subject: a.subject },
      { onConflict: "day,key", ignoreDuplicates: true },
    )
    .select("key");
  // A failing log must not swallow the alert: send it rather than stay silent.
  return error ? true : data.length > 0;
}

async function reportToSentry(a: Alert): Promise<void> {
  if (!env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureMessage(`${a.subject}: ${a.text}`, { level: "warning", tags: { alert: a.key } });
}

export async function sendAlert(a: Alert, deps: AlertDeps = {}): Promise<boolean> {
  const day = (deps.now ?? new Date()).toISOString().slice(0, 10);
  const first = await (deps.claim ?? claimInDb)(day, a);
  if (!first) return false;
  console.warn(`[alert] ${a.key}: ${a.subject}`);
  const to = deps.to === undefined ? (env.ALERT_EMAIL ?? null) : deps.to;
  const mailer =
    deps.mailer === undefined
      ? env.RESEND_API_KEY && env.EMAIL_FROM
        ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM)
        : null
      : deps.mailer;
  await Promise.all([
    to && mailer
      ? mailer
          .send({
            to,
            subject: a.subject,
            text: a.text,
            html: `<p>${escapeHtml(a.text)}</p>`,
            headers: {},
          })
          .catch(() => false)
      : null,
    (deps.report ?? reportToSentry)(a).catch(() => undefined),
  ]);
  return true;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
