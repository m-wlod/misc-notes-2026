import { env } from "@/env";

/**
 * Supabase settings, or null when this deployment has none (e.g. a Vercel preview
 * before the cloud project exists). Callers render a "not configured" state instead
 * of crashing; the build never requires these.
 */
export function supabasePublicConfig(): { url: string; publishableKey: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export function isSupabaseConfigured(): boolean {
  return supabasePublicConfig() !== null;
}
