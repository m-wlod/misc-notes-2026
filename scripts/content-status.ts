// pnpm content:status: every lesson and exercise with its review state.
import { loadExercises } from "@/features/content/pipeline/load";
import { loadLessonSources } from "@/features/content/pipeline/qa";
import { statusTable, type StatusRow } from "@/features/content/pipeline/status";

import { curriculum } from "../content/curriculum";

const lessons = loadLessonSources("content");
const { exercises } = loadExercises("content");
const order = curriculum.flatMap((t) => t.modules.flatMap((m) => m.lessons));
const rank = (id: string) => {
  const i = order.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

const rows: StatusRow[] = [
  ...[...new Set(lessons.map((l) => l.id))]
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => {
      const versions = lessons.filter((l) => l.id === id);
      const pl = versions.find((l) => l.locale === "pl");
      return {
        kind: "lesson" as const,
        id,
        status: pl?.status ?? "?",
        level: "",
        detail: `${versions.map((l) => l.locale).join(", ")}${pl?.isStub ? " · stub" : ""}`,
      };
    }),
  ...exercises.map(({ exercise }) => ({
    kind: "exercise" as const,
    id: exercise.id,
    status: exercise.status,
    level: exercise.level,
    detail: `${exercise.type} · ${exercise.lessonIds.join(", ")}`,
  })),
];
console.log(statusTable(rows));
