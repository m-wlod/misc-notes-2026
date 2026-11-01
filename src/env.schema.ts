import { z } from "zod";

/**
 * Env schemas, kept separate from `env.ts` so they can be unit-tested without
 * triggering validation of the real process environment.
 *
 * Variables for features built in later phases are optional here; each phase that
 * starts depending on one tightens it to required (and updates .env.example).
 */

const optionalString = z.string().min(1).optional();
const optionalUrl = z.url().optional();

export const serverSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase (Phase 3)
  SUPABASE_SECRET_KEY: optionalString,

  // AI grading (Phase 10)
  ANTHROPIC_API_KEY: optionalString,
  AI_GRADER_MODEL: optionalString,
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(5),
  AI_USER_DAILY_QUOTA: z.coerce.number().int().nonnegative().default(10),

  // Rate limiting (Phase 8/10)
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  // Email (Phase 3 SMTP via Supabase, Phase 15 app email)
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,

  // Web push (Phase 15), cron auth (Phase 14)
  VAPID_PRIVATE_KEY: optionalString,
  CRON_SECRET: optionalString,

  // Observability (Phase 22), bot protection (Phase 21)
  SENTRY_AUTH_TOKEN: optionalString,
  TURNSTILE_SECRET_KEY: optionalString,
};

export const clientSchema = {
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,

  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
};
