import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/display";
import { requirePage } from "@/features/admin/server";
import { renderMarkdown } from "@/features/community/markdown";
import {
  BanForm,
  CorrectionActions,
  HeldPostActions,
  ReportActions,
  UnbanButton,
} from "@/features/community/ui/admin-actions";

/**
 * The community moderation queue (Phase 17b), for moderators and admins (others get a
 * 403 from the proxy; `requirePage` checks again).
 * Content error reports first (they fix the course), then reports, held posts, bans
 * and the audit log (admins only, by RLS). Every action here is written to the log.
 */
export default function AdminCommunityPage() {
  return (
    <div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Queue />
      </Suspense>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} data-queue={id} className="grid gap-3">
      <h2 id={`${id}-title`} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

const itemClass = "grid gap-2 rounded-md border border-rule px-4 py-3";

function Body({ source }: { source: string }) {
  return (
    <div
      className="community-body font-serif text-reading"
      // Escape-first renderer (markdown.ts); links shown as text in the queue.
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source, { links: false }) }}
    />
  );
}

async function Queue() {
  await connection();
  const { session } = await requirePage("community");
  const db = session.supabase;
  const t = await getTranslations("community.admin");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  const [corrections, reports, heldComments, heldSolutions, bans, audit] = await Promise.all([
    db
      .from("content_error_reports")
      .select("id, content_type, content_id, body, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(200),
    db
      .from("reports")
      .select("id, target_type, target_id, reason, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(200),
    db
      .from("comments")
      .select("id, user_id, target_type, target_id, body, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(200),
    db
      .from("shared_solutions")
      .select("id, user_id, exercise_id, body, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(200),
    db
      .from("bans")
      .select("user_id, reason, until, created_at")
      .order("created_at", { ascending: false }),
    db
      .from("audit_log")
      .select("id, action, target, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // The reported posts themselves, so a moderator can judge them here.
  const reported = reports.data ?? [];
  const ids = (type: string) =>
    reported
      .filter((r) => r.target_type === type)
      .map((r) => Number(r.target_id))
      .filter(Number.isSafeInteger);
  const [rc, rs] = await Promise.all([
    db.from("comments").select("id, user_id, body, status").in("id", ids("comment")),
    db.from("shared_solutions").select("id, user_id, body, status").in("id", ids("solution")),
  ]);
  type ReportedPost = { id: number; user_id: string | null; body: string };
  const posts = new Map<string, ReportedPost>([
    ...(rc.data ?? []).map((p): [string, ReportedPost] => [`comment:${String(p.id)}`, p]),
    ...(rs.data ?? []).map((p): [string, ReportedPost] => [`solution:${String(p.id)}`, p]),
  ]);
  const empty = <p className="text-ink-muted">{t("empty")}</p>;

  return (
    <div className="grid gap-10">
      <h1 className="text-3xl">{t("title")}</h1>

      <Section id="corrections" title={t("corrections")}>
        {(corrections.data ?? []).length === 0 ? empty : null}
        <ul className="grid gap-3">
          {(corrections.data ?? []).map((c) => (
            <li key={c.id} data-correction={c.id} className={itemClass}>
              <p className="font-sans text-xs text-ink-muted">
                {t("target")}: {c.content_type}/{c.content_id} · {date(c.created_at)}
              </p>
              <p className="font-serif text-reading whitespace-pre-wrap">{c.body}</p>
              <CorrectionActions id={c.id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="reports" title={t("reports")}>
        {reported.length === 0 ? empty : null}
        <ul className="grid gap-3">
          {reported.map((r) => {
            const post =
              r.target_type === "profile"
                ? undefined
                : posts.get(`${r.target_type}:${r.target_id}`);
            const kind = r.target_type === "solution" ? "solution" : "comment";
            const authorId = r.target_type === "profile" ? r.target_id : post?.user_id;
            return (
              <li key={r.id} data-report={r.id} className={itemClass}>
                <p className="font-sans text-xs text-ink-muted">
                  {t("target")}: {r.target_type} {r.target_id} · {date(r.created_at)}
                </p>
                <p className="font-sans text-sm">{r.reason}</p>
                {post ? <Body source={post.body} /> : null}
                <ReportActions id={r.id} post={post ? { kind, id: post.id } : null} />
                {authorId ? <BanForm userId={authorId} /> : null}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="held" title={t("held")}>
        {(heldComments.data ?? []).length + (heldSolutions.data ?? []).length === 0 ? empty : null}
        <ul className="grid gap-3">
          {(heldComments.data ?? []).map((c) => (
            <li
              key={`c${String(c.id)}`}
              data-held={`comment:${String(c.id)}`}
              className={itemClass}
            >
              <p className="font-sans text-xs text-ink-muted">
                {t("target")}: {c.target_type}/{c.target_id} · {date(c.created_at)}
              </p>
              <Body source={c.body} />
              <HeldPostActions kind="comment" id={c.id} />
              {c.user_id ? <BanForm userId={c.user_id} /> : null}
            </li>
          ))}
          {(heldSolutions.data ?? []).map((s) => (
            <li
              key={`s${String(s.id)}`}
              data-held={`solution:${String(s.id)}`}
              className={itemClass}
            >
              <p className="font-sans text-xs text-ink-muted">
                {t("target")}: exercise/{s.exercise_id} · {date(s.created_at)}
              </p>
              <Body source={s.body} />
              <HeldPostActions kind="solution" id={s.id} />
              {s.user_id ? <BanForm userId={s.user_id} /> : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="bans" title={t("bans")}>
        {(bans.data ?? []).length === 0 ? empty : null}
        <ul className="grid gap-3">
          {(bans.data ?? []).map((b) => (
            <li key={b.user_id} className={itemClass}>
              <p className="font-sans text-sm">
                {b.user_id} · {b.until ? t("until", { date: date(b.until) }) : t("forever")}
              </p>
              <p className="font-sans text-sm text-ink-muted">{b.reason}</p>
              <div>
                <UnbanButton userId={b.user_id} />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="audit" title={t("audit")}>
        {(audit.data ?? []).length === 0 ? empty : null}
        <ul className="grid gap-1 font-sans text-sm">
          {(audit.data ?? []).map((a) => (
            <li key={a.id} data-audit={a.action}>
              <span className="text-ink-muted">{date(a.created_at)}</span> · {a.action} · {a.target}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
