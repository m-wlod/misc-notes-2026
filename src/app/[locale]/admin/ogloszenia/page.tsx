import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { announcementState } from "@/features/admin/platform";
import { requirePage } from "@/features/admin/server";
import { AnnouncementActions, NewAnnouncementForm } from "@/features/admin/ui/platform-forms";

/** The announcement banner (Phase 18c): publish, schedule, end, delete; audited. */
export default function AdminAnnouncementsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  await connection();
  const { admin } = await requirePage("announcements");
  const t = await getTranslations("admin.announcements");
  const format = await getFormatter();
  const { data } = await admin
    .from("announcements")
    .select("id, body_pl, body_en, starts_at, ends_at")
    .order("id", { ascending: false })
    .limit(50);
  const now = new Date();
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Warsaw",
    });
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="max-w-prose text-sm text-ink-muted">{t("note")}</p>
      <section aria-labelledby="new-announcement" className="grid gap-3">
        <h2 id="new-announcement" className="text-xl">
          {t("new")}
        </h2>
        <NewAnnouncementForm />
      </section>
      <section aria-labelledby="all-announcements" className="grid gap-3">
        <h2 id="all-announcements" className="text-xl">
          {t("list")}
        </h2>
        {(data ?? []).length === 0 ? <p className="text-ink-muted">{t("empty")}</p> : null}
        <ul className="grid gap-3">
          {(data ?? []).map((a) => {
            const state = announcementState(a, now);
            return (
              <li
                key={a.id}
                data-admin-announcement={a.id}
                data-state={state}
                className="grid gap-2 rounded-md border border-rule px-4 py-3"
              >
                <p className="font-sans text-xs text-ink-muted">
                  {t(`state.${state}`)} · {when(a.starts_at)}
                  {a.ends_at ? ` – ${when(a.ends_at)}` : ""}
                </p>
                <p lang="pl">{a.body_pl}</p>
                <p lang="en" className="text-ink-muted">
                  {a.body_en}
                </p>
                <AnnouncementActions id={a.id} ended={state === "ended"} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
