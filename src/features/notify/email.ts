import type { EmailKind } from "./rules";

/**
 * Notification emails (Phase 15): plain, accessible HTML plus a text part, in the
 * learner's language. Every email carries a visible unsubscribe link and the RFC 8058
 * headers, so mail apps offer one-click unsubscribe too.
 */
export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

export type EmailData =
  | { kind: "streak"; days: number }
  | { kind: "weekly"; xp: number; goalDays: number; solved: number }
  | {
      kind: "league";
      tier: string;
      rank: number;
      size: number;
      outcome: "promoted" | "stayed" | "demoted";
    };

/** The words, from messages (`notify.email.*`), injected so this stays pure. */
export type EmailWords = {
  subject: string;
  lines: string[];
  cta: string;
  footer: string;
  unsubscribe: string;
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

export function buildEmail(input: {
  to: string;
  kind: EmailKind;
  words: EmailWords;
  ctaUrl: string;
  /** The page link (opens /wypisz) and the one-click POST endpoint. */
  unsubscribePage: string;
  unsubscribePost: string;
}): Email {
  return renderEmail({
    to: input.to,
    words: input.words,
    ctaUrl: input.ctaUrl,
    unsubscribe: { page: input.unsubscribePage, post: input.unsubscribePost },
  });
}

/**
 * The shared email layout (Phase 15, generalised in Phase 19c): lines, one call to
 * action, and, for anything sent repeatedly, an unsubscribe link plus RFC 8058
 * one-click headers. A one-off message (a sign-up confirmation) has none.
 */
export function renderEmail(input: {
  to: string;
  words: Omit<EmailWords, "unsubscribe"> & { unsubscribe?: string };
  ctaUrl: string;
  unsubscribe: { page: string; post: string } | null;
}): Email {
  const { words, unsubscribe } = input;
  const optOut =
    unsubscribe && words.unsubscribe ? { ...unsubscribe, label: words.unsubscribe } : null;
  const text = [
    ...words.lines,
    "",
    `${words.cta}: ${input.ctaUrl}`,
    "",
    words.footer,
    ...(optOut ? [`${optOut.label}: ${optOut.page}`] : []),
  ].join("\n");
  const footer = optOut
    ? `${esc(words.footer)} <a href="${esc(optOut.page)}" style="color:#5d6472">${esc(optOut.label)}</a>`
    : esc(words.footer);
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f1e7;color:#1b2230;font-family:Georgia,serif;font-size:17px;line-height:1.6">
<div style="max-width:560px;margin:0 auto">
${words.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("\n")}
<p style="margin:20px 0"><a href="${esc(input.ctaUrl)}" style="color:#a33d0c">${esc(words.cta)}</a></p>
<hr style="border:none;border-top:1px solid #ddd4c3;margin:24px 0">
<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#5d6472">${footer}</p>
</div></body></html>`;
  return {
    to: input.to,
    subject: words.subject,
    text,
    html,
    headers: optOut
      ? {
          "List-Unsubscribe": `<${optOut.post}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : {},
  };
}

export interface Mailer {
  send(email: Email): Promise<boolean>;
}

/** Resend's HTTP API (no SDK needed). Only used when RESEND_API_KEY exists. */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
        }),
      });
      return res.ok;
    },
  };
}

/** Records instead of sending: dev without a key, and tests. */
export function logMailer() {
  const sent: Email[] = [];
  const mailer: Mailer = {
    send(email) {
      sent.push(email);
      return Promise.resolve(true);
    },
  };
  return { mailer, sent };
}
