import type { EmailKind } from "./rules";
import { verifyToken } from "./token";

/**
 * Switching one email kind off (or back on) by link (Phase 15). The signed token is the
 * authorisation, so this works signed out, from any mail app. Pure over a prefs store.
 */
export interface PrefsStore {
  setEmail(userId: string, kind: EmailKind, on: boolean): Promise<boolean>;
}

export type UnsubscribeResult = { ok: true; kind: EmailKind } | { ok: false };

export async function applyUnsubscribe(
  store: PrefsStore | null,
  secret: string | undefined,
  params: { u?: string | null; k?: string | null; s?: string | null },
  on = false,
): Promise<UnsubscribeResult> {
  const { u, k, s } = params;
  if (!store || !u || !k || !s || !verifyToken(secret, u, k, s)) return { ok: false };
  return (await store.setEmail(u, k, on)) ? { ok: true, kind: k } : { ok: false };
}
