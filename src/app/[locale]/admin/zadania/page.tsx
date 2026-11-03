import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import { requirePage } from "@/features/admin/server";
import { allExercises } from "@/features/exercises/data";
import { Link } from "@/i18n/navigation";

/** Every exercise with its calibration numbers, linking to its analytics (Phase 18b). */
export default function AdminExercisesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Exercises />
    </Suspense>
  );
}

async function Exercises() {
  await connection();
  const { admin } = await requirePage("exercises");
  const t = await getTranslations("admin.exercises");
  const { data: stats } = await admin
    .from("exercise_stats")
    .select("exercise_id, attempts, success_rate");
  const byId = new Map((stats ?? []).map((s) => [s.exercise_id, s]));
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "–" : `${String(Math.round(v * 100))}%`;

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="max-w-prose text-ink-muted">{t("note")}</p>
      <Table label={t("title")}>
        <thead>
          <tr>
            <Th>{t("id")}</Th>
            <Th>{t("type")}</Th>
            <Th>{t("level")}</Th>
            <Th>{t("status")}</Th>
            <Th>{t("attempts")}</Th>
            <Th>{t("successRate")}</Th>
          </tr>
        </thead>
        <tbody>
          {allExercises().map((e) => {
            const s = byId.get(e.id);
            return (
              <tr key={e.id} data-exercise={e.id}>
                <Td>
                  <Link href={{ pathname: "/admin/zadania/[id]", params: { id: e.id } }}>
                    {e.id}
                  </Link>
                </Td>
                <Td>{e.type}</Td>
                <Td>{e.level}</Td>
                <Td>{e.status}</Td>
                <Td>{s?.attempts ?? 0}</Td>
                <Td>{pct(s?.success_rate)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
