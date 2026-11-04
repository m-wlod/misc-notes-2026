import "server-only";

import { checkBotId } from "botid/server";

import { env } from "@/env";

/**
 * Vercel BotID (Phase 21c): an invisible check on the endpoints bots abuse most (sign-in
 * links, newsletter sign-ups, AI grading, anonymous submissions). It works only on
 * Vercel: elsewhere (local builds, tests) there is nothing to ask, so it passes. On
 * Vercel an error in the check itself fails open and is logged: a misconfiguration
 * must not lock people out of signing in; the rate limits still apply.
 */
export async function isBot(): Promise<boolean> {
  if (!env.VERCEL_ENV) return false;
  try {
    return (await checkBotId()).isBot;
  } catch (error) {
    console.error("BotID check failed; allowing the request", error);
    return false;
  }
}
