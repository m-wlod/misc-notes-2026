import { createHmac, timingSafeEqual } from "node:crypto";

import { EMAIL_KINDS, type EmailKind } from "./rules";

/**
 * One-click unsubscribe tokens (Phase 15): HMAC-SHA256 of `userId.kind` with a server
 * secret. The token is the only authorisation an email link carries, so it is checked in
 * constant time, and a missing secret means nothing can be switched off by link.
 */
const mac = (secret: string, userId: string, kind: string) =>
  createHmac("sha256", secret).update(`${userId}.${kind}`).digest("base64url");

export function signToken(secret: string, userId: string, kind: EmailKind): string {
  return mac(secret, userId, kind);
}

export function verifyToken(
  secret: string | undefined,
  userId: string,
  kind: string,
  token: string,
): kind is EmailKind {
  if (!secret || !(EMAIL_KINDS as readonly string[]).includes(kind)) return false;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const expected = Buffer.from(mac(secret, userId, kind));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The query string an email's unsubscribe link and List-Unsubscribe header carry. */
export const unsubscribeQuery = (secret: string, userId: string, kind: EmailKind) =>
  new URLSearchParams({ u: userId, k: kind, s: signToken(secret, userId, kind) }).toString();
