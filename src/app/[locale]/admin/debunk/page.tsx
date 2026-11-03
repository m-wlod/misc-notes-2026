import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { QueueActions } from "@/features/debunk/queue-actions";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * The Debunk Lab moderation queue (Phase 16): submitted claims and suggested
 * corrections. Staff only (`is_staff()`); everyone else gets a 404, so the page doesn't
 * even reveal that it exists. The full admin area comes in Phase 18.
 */
export default function AdminDebunkPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Queue />
      </Suspense>
    </div>
  );
}

async function Queue() {
  await connection();
  if (!isSupabaseConfigured()) notFound();
  const session = await getSession();
  if (!session) notFound();
  const { data: staff } = await session.supabase.rpc("is_staff");
  if (!staff) notFound();
  const t = await getTranslations("debunk.admin");
  const format = await getFormatter();
  const [claims, corrections] = await Promise.all([
    session.supabase
      .from("debunk_submissions")
      .select("id, claim, source_url, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(200),
    session.supabase
      .from("content_error_reports")
      .select("id, content_id, body, created_at")
      .eq("content_type", "debunk")
      .eq("status", "pending")
      .order("created_at")
      .limit(200),
  ]);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="grid gap-10">
      <h1 className="text-3xl">{t("title")}</h1>
      <section aria-labelledby="claims-title" className="grid gap-3">
        <h2 id="claims-title" className="text-xl">
          {t("submissions")}
        </h2>
        {(claims.data ?? []).length === 0 ? <p className="text-ink-muted">{t("empty")}</p> : null}
        <ul className="grid gap-3">
          {(claims.data ?? []).map((c) => (
            <li key={c.id} className="grid gap-2 rounded-md border border-rule px-4 py-3">
              <p className="font-serif text-reading">{c.claim}</p>
              <p className="font-sans text-xs text-ink-muted">
                {date(c.created_at)}
                {c.source_url ? (
                  <>
                    {" · "}
                    <a href={c.source_url} rel="nofollow noopener noreferrer">
                      {c.source_url}
                    </a>
                  </>
                ) : null}
              </p>
              <QueueActions table="debunk_submissions" id={c.id} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="corrections-title" className="grid gap-3">
        <h2 id="corrections-title" className="text-xl">
          {t("corrections")}
        </h2>
        {(corrections.data ?? []).length === 0 ? (
          <p className="text-ink-muted">{t("empty")}</p>
        ) : null}
        <ul className="grid gap-3">
          {(corrections.data ?? []).map((c) => (
            <li key={c.id} className="grid gap-2 rounded-md border border-rule px-4 py-3">
              <p className="font-sans text-xs text-ink-muted">
                {t("entry")}: {c.content_id} · {date(c.created_at)}
              </p>
              <p className="font-serif text-reading">{c.body}</p>
              <QueueActions table="content_error_reports" id={c.id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
