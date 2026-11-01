/**
 * Pure decisions that depend on the deployment environment. Callers pass `env`
 * (from src/env.ts) so these stay unit-testable.
 */

type DeployEnv = {
  NODE_ENV?: "development" | "test" | "production" | undefined;
  VERCEL_ENV?: "development" | "preview" | "production" | undefined;
  ENABLE_STYLEGUIDE?: "1" | undefined;
};

/**
 * The /styleguide page is an internal tool. Shown in local development, on Vercel
 * previews, or when ENABLE_STYLEGUIDE=1 (used by e2e against a production build).
 * Never on Vercel production, whatever else is set. Evaluated per request, not at
 * build time, so promoting a preview build to production hides it (review M11).
 */
export function isStyleguideEnabled(env: DeployEnv): boolean {
  if (env.VERCEL_ENV === "production") return false;
  return (
    env.NODE_ENV === "development" || env.VERCEL_ENV === "preview" || env.ENABLE_STYLEGUIDE === "1"
  );
}

type UrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  VERCEL_ENV?: "development" | "preview" | "production" | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
};

/**
 * Absolute site URL for metadata, OG images and emails (review L6).
 * Explicit NEXT_PUBLIC_SITE_URL wins; on Vercel fall back to the production domain
 * (production) or the deployment URL (previews); localhost only when nothing is known.
 */
export function resolveSiteUrl(env: UrlEnv): URL {
  if (env.NEXT_PUBLIC_SITE_URL) return new URL(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (env.VERCEL_URL) return new URL(`https://${env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}
