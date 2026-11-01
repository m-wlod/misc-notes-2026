"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Supabase client for Client Components (RLS applies). Configuration is passed in from
 * the server so the client bundle doesn't depend on env validation.
 */
export function createClient(config: { url: string; publishableKey: string }) {
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
