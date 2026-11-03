import { createClient } from "@supabase/supabase-js";
import { connection, NextResponse } from "next/server";

import { supabasePublicConfig } from "@/lib/db/config";
import type { Database } from "@/lib/db/database.types";

/**
 * GET /api/announcements (Phase 18c): the announcements live right now, for the site
 * banner. Read with the publishable key (RLS returns only live ones) and cached by the
 * CDN for a minute, so public pages stay static and the database sees few reads.
 */
export async function GET() {
  await connection();
  // The CDN keeps it for a minute; browsers always ask (no stale copies or background
  // revalidation in the page).
  const headers = {
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  };
  const config = supabasePublicConfig();
  if (!config) return NextResponse.json([], { headers });
  try {
    const db = createClient<Database>(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await db
      .from("announcements")
      .select("id, body_pl, body_en")
      .order("id", { ascending: false })
      .limit(3);
    return NextResponse.json(data ?? [], { headers });
  } catch {
    return NextResponse.json([], { headers });
  }
}
