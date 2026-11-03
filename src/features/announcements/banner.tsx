"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { DismissibleAnnouncement } from "./dismissible";

/**
 * The site-wide announcement banner (Phase 18c). Loaded in the browser from
 * /api/announcements (edge-cached for a minute), so every public page stays static.
 * Without a database the list is empty and nothing renders.
 */
type Announcement = { id: number; body_pl: string; body_en: string };

export function AnnouncementBanner() {
  const locale = useLocale();
  const [rows, setRows] = useState<Announcement[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/announcements", { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Announcement[]>) : []))
      .then((list) => {
        setRows(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, []);
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
