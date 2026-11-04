import { initBotId } from "botid/client/core";

/**
 * Browser start-up hooks.
 *
 * Vercel BotID (Phase 21c): attaches its invisible challenge to POST requests. `*`
 * matches any path, and every server action posts to its page (the newsletter form is in
 * every footer), so one rule covers them; the server checks the verdict only where
 * `isBot()` is called (src/lib/bot/check.ts). Only on Vercel: the challenge is served
 * through Vercel, so elsewhere it would only fail.
 *
 * Sentry (Phase 22a): only with a DSN, and loaded after the page is idle so it never
 * counts toward the first load.
 *
 * Public variables are read directly rather than through `@/env`: importing the env
 * module here would ship the names of every server variable in this client bundle
 * (caught by `pnpm check:client-secrets`). Next inlines NEXT_PUBLIC_* at build time.
 */
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({ protect: [{ path: "/*", method: "POST" }] });
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  const start = () => {
    void Promise.all([import("@sentry/nextjs"), import("@/lib/observability/sentry-options")]).then(
      ([Sentry, { sentryOptions }]) => {
        Sentry.init(
          sentryOptions({
            dsn,
            environment: process.env.NEXT_PUBLIC_VERCEL_ENV,
            release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
          }),
        );
      },
    );
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(start);
  else setTimeout(start, 2000);
}
