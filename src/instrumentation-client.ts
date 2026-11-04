import { initBotId } from "botid/client/core";

import { env } from "@/env";

/**
 * Vercel BotID in the browser (Phase 21c): attaches its invisible challenge to POST
 * requests. `*` matches any path, and every server action posts to its page (the
 * newsletter form is in every footer), so one rule covers them; the server checks the
 * verdict only where `isBot()` is called (src/lib/bot/check.ts). Only on Vercel: the
 * challenge is served through Vercel, so elsewhere it would only fail.
 */
if (env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({ protect: [{ path: "/*", method: "POST" }] });
}
