import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import { supabasePublicConfig } from "@/lib/db/config";
import type { Database } from "@/lib/db/database.types";

import { DismissibleAnnouncement } from "./dismissible";
import { ANNOUNCEMENTS_TAG } from "./tag";

/**
 * The site-wide announcement banner (Phase 18c). Cached and tagged, so public pages
 * stay static: an admin change updates the tag, and scheduled starts and ends show up
 * within the cache's few minutes. Reads with the publishable key; RLS returns only the
 * announcements that are live. Without a database there are none.
 */
type Announcement = { id: number; body_pl: string; body_en: string };

async function liveAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheTag(ANNOUNCEMENTS_TAG);
  cacheLife("minutes");
  const config = supabasePublicConfig();
  if (!config) return [];
  try {
    const db = createClient<Database>(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await db
      .from("announcements")
      .select("id, body_pl, body_en")
      .order("id", { ascending: false })
      .limit(3);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function AnnouncementBanner({ locale }: { locale: string }) {
  const rows = await liveAnnouncements();
  if (rows.length === 0) return null;
  return (
    <div className="print:hidden">
      {rows.map((a) => (
        <DismissibleAnnouncement
          key={a.id}
          id={a.id}
          text={locale === "en" ? a.body_en : a.body_pl}
        />
      ))}
    </div>
  );
}
