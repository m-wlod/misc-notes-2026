import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { canAccess, type Section } from "@/features/admin/access";
import { requirePage } from "@/features/admin/server";
import { XpFlagActions } from "@/features/community/ui/admin-actions";
import { Link } from "@/i18n/navigation";

/** Every moderation queue with what's waiting in it (Phase 18b). */
export default function AdminQueuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Queues />
    </Suspense>
  );
}

type Queue = {
  key:
    | "reports"
    | "comments"
    | "solutions"
    | "corrections"
    | "claims"
    | "debunkCorrections"
    | "disputes";
  section: Section;
  href: "/admin/community" | "/admin/debunk" | "/admin/spory";
  count: number | null;
};

async function Queues() {
  await connection();
  const { admin, roles } = await requirePage("queues");
  const t = await getTranslations("admin.queues");
  type Table =
    "reports" | "comments" | "shared_solutions" | "debunk_submissions" | "grading_disputes";
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await q;
    return error ? null : (n ?? 0);
  };
  const pending = (table: Table) =>
    count(admin.from(table).select("id", { count: "exact", head: true }).eq("status", "pending"));
  // Content error reports: Debunk Lab corrections have their own queue page.
  const errors = (debunk: boolean) => {
    const q = admin
      .from("content_error_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return count(debunk ? q.eq("content_type", "debunk") : q.neq("content_type", "debunk"));
  };
  const [reports, comments, solutions, corrections, claims, debunkCorrections, disputes] =
    await Promise.all([
      pending("reports"),
      pending("comments"),
      pending("shared_solutions"),
      errors(false),
      pending("debunk_submissions"),
      errors(true),
      pending("grading_disputes"),
    ]);
  const queues: Queue[] = [
    { key: "reports", section: "community", href: "/admin/community", count: reports },
    { key: "comments", section: "community", href: "/admin/community", count: comments },
    { key: "solutions", section: "community", href: "/admin/community", count: solutions },
    { key: "corrections", section: "community", href: "/admin/community", count: corrections },
    { key: "claims", section: "debunk", href: "/admin/debunk", count: claims },
    {
      key: "debunkCorrections",
      section: "debunk",
      href: "/admin/debunk",
      count: debunkCorrections,
    },
    { key: "disputes", section: "disputes", href: "/admin/spory", count: disputes },
  ];

  // Unusual XP (Phase 21c): flags from the daily check, for moderators.
  const showXp = canAccess(roles, "community");
  const { data: flags } = showXp
    ? await admin
        .from("xp_flags")
        .select("id, user_id, day, xp, reason")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const { data: people } =
    flags && flags.length > 0
      ? await admin
          .from("profiles")
          .select("id, handle")
          .in(
            "id",
            flags.map((f) => f.user_id),
          )
      : { data: [] };
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {queues
          .filter((q) => canAccess(roles, q.section))
          .map((q) => (
            <li key={q.key} data-queue={q.key} className="rounded-md border border-rule px-4 py-3">
              <Link href={q.href} className="grid gap-1 no-underline">
                <span className="font-sans text-sm text-ink-muted">{t(q.key)}</span>
                <span className="font-sans text-3xl text-ink tabular-nums" data-count>
                  {q.count === null ? "–" : q.count}
                </span>
              </Link>
            </li>
          ))}
      </ul>
      {showXp ? (
        <section aria-labelledby="xp-flags" data-xp-flags className="grid gap-2">
          <h2 id="xp-flags" className="text-xl">
            {t("xp.title")}
          </h2>
          <p className="max-w-(--measure) font-sans text-sm text-ink-muted">{t("xp.lead")}</p>
          {flags && flags.length > 0 ? (
            <table className="w-full font-sans text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th scope="col">{t("xp.col.user")}</th>
                  <th scope="col">{t("xp.col.day")}</th>
                  <th scope="col">{t("xp.col.xp")}</th>
                  <th scope="col">{t("xp.col.reason")}</th>
                  <th scope="col">{t("xp.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.id} data-xp-flag={f.id} className="border-t border-rule">
                    <td className="py-2">
                      <Link
                        href={{ pathname: "/admin/uzytkownicy/[id]", params: { id: f.user_id } }}
                      >
                        {handle.get(f.user_id) ?? f.user_id}
                      </Link>
                    </td>
                    <td className="tabular-nums">{f.day}</td>
                    <td className="tabular-nums">{f.xp}</td>
                    <td>{f.reason === "burst" ? t("xp.burst") : t("xp.volume")}</td>
                    <td>
                      <XpFlagActions id={f.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="font-sans text-sm text-ink-muted">{t("xp.empty")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
