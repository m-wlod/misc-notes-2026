import type { Instrumentation } from "next";

/**
 * Server and edge error reporting (Phase 22a). Sentry loads only when a DSN is set; until
 * then nothing is imported and nothing leaves the server.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const [Sentry, { sentryOptions }] = await Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/observability/sentry-options"),
  ]);
  Sentry.init(
    sentryOptions({
      dsn,
      environment: process.env.VERCEL_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    }),
  );
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
