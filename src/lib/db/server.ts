import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabasePublicConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers, acting as
 * the signed-in user (RLS applies). Reads cookies, so callers in pages must sit inside
 * a <Suspense> boundary to keep the rest of the page static (Cache Components).
 * Returns null when Supabase isn't configured on this deployment.
 */
export async function createClient() {
  const config = supabasePublicConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy
          // refreshes the session cookie on the next request, so this is safe to ignore.
        }
      },
    },
  });
}
