import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { answerText } from "@/features/admin/analytics";
import { requirePage } from "@/features/admin/server";
import { DisputeActions } from "@/features/admin/ui/dispute-actions";
import { Link } from "@/i18n/navigation";
import { aiGradeSchema } from "@/lib/ai/grade-schema";

/**
 * AI-grading disputes (Phase 18b): a learner reported an unfair AI grade on an open
 * answer. Moderators see the answer, the AI's feedback and score, and uphold (with a
 * new score) or reject.
 */
export default function AdminDisputesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Disputes />
    </Suspense>
  );
}

async function Disputes() {
  await connection();
  const { admin } = await requirePage("disputes");
  const t = await getTranslations("admin.disputes");
  const format = await getFormatter();
  const { data: disputes } = await admin
    .from("grading_disputes")
    .select("id, attempt_id, reason, created_at")
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  const attemptIds = (disputes ?? []).map((d) => d.attempt_id);
  const { data: attempts } =
    attemptIds.length > 0
      ? await admin
          .from("exercise_attempts")
          .select("id, exercise_id, answer, score, feedback")
          .in("id", attemptIds)
      : { data: [] };
  const byId = new Map((attempts ?? []).map((a) => [a.id, a]));

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      {(disputes ?? []).length === 0 ? <p className="text-ink-muted">{t("empty")}</p> : null}
      <ul className="grid gap-4">
        {(disputes ?? []).map((d) => {
          const a = byId.get(d.attempt_id);
          const grade = aiGradeSchema.safeParse(a?.feedback);
          const points = Math.round((a?.score ?? 0) * 4);
          const answer =
            a && typeof a.answer === "object" && !Array.isArray(a.answer)
              ? answerText(a.answer)
              : "";
          return (
            <li
              key={d.id}
              data-dispute={d.id}
              className="grid gap-3 rounded-md border border-rule px-4 py-3"
            >
              <p className="font-sans text-xs text-ink-muted">
                {a ? (
                  <Link href={{ pathname: "/admin/zadania/[id]", params: { id: a.exercise_id } }}>
                    {a.exercise_id}
                  </Link>
                ) : null}
                {" · "}
                {format.dateTime(new Date(d.created_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {" · "}
                {t("score", { points })}
              </p>
              <div className="grid gap-1">
                <h2 className="font-sans text-sm text-ink-muted">{t("reason")}</h2>
                <p className="font-serif text-reading">{d.reason}</p>
              </div>
              <div className="grid gap-1">
                <h2 className="font-sans text-sm text-ink-muted">{t("answer")}</h2>
                <p className="font-serif whitespace-pre-wrap">{answer}</p>
              </div>
              {grade.success ? (
                <div className="grid gap-1">
                  <h2 className="font-sans text-sm text-ink-muted">{t("feedback")}</h2>
                  <p className="font-serif">{grade.data.feedback}</p>
                </div>
              ) : null}
              <DisputeActions id={d.id} points={points} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
