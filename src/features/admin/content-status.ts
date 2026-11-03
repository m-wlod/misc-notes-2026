import { flags, type ExerciseStat, type Flag } from "@/features/grading/calibrate";

/**
 * Content status for the admin panel (Phase 18b): every lesson, exercise and debunk
 * entry with its status, whether the English version is missing, how many
 * `TODO(verify)` markers its source still has, and the calibration verdict for
 * exercises. Pure; the page feeds it Velite data, the build-time marker counts and
 * `exercise_stats`.
 */
export type ContentKind = "lesson" | "exercise" | "debunk";
export type Status = "draft" | "review" | "published";

export type ContentRow = {
  kind: ContentKind;
  id: string;
  title: string;
  status: Status;
  track: string | null;
  missingEn: boolean;
  todos: number;
  calibration: Flag["verdict"] | null;
};

type LessonIn = {
  id: string;
  locale: string;
  title: string;
  status: Status;
  file: string;
};
type ExerciseIn = {
  id: string;
  level: number;
  status: Status;
  lessonIds: readonly string[];
  promptPl: string;
  hasEn: boolean;
  file: string;
};
type DebunkIn = { id: string; locale: string; claim: string; status: Status; file: string };

export type ContentInput = {
  lessons: readonly LessonIn[];
  exercises: readonly ExerciseIn[];
  debunk: readonly DebunkIn[];
  /** Track id per lesson id (from the curriculum outline). */
  trackOf: ReadonlyMap<string, string>;
  /** `TODO(verify)` markers per source file. */
  todos: Readonly<Record<string, number>>;
  stats: readonly ExerciseStat[];
};

const TITLE_MAX = 80;
const short = (s: string) => (s.length > TITLE_MAX ? `${s.slice(0, TITLE_MAX - 1)}…` : s);

/** Localised items come as one file per locale: one row per id, Polish first. */
function byId<T extends { id: string; locale: string; file: string }>(items: readonly T[]) {
  const groups = new Map<string, [T, ...T[]]>();
  for (const item of items) {
    const group = groups.get(item.id);
    if (group) group.push(item);
    else groups.set(item.id, [item]);
  }
  return [...groups.values()].map((group) => {
    const main = group.find((g) => g.locale === "pl") ?? group[0];
    return { main, group, missingEn: !group.some((g) => g.locale === "en") };
  });
}

const todosIn = (files: readonly string[], todos: Readonly<Record<string, number>>) =>
  files.reduce((sum, f) => sum + (todos[f] ?? 0), 0);

export function contentRows(input: ContentInput): ContentRow[] {
  const levels = new Map(input.exercises.map((e) => [e.id, e.level]));
  const verdicts = new Map(
    flags(input.stats, (id) => levels.get(id)).map((f) => [f.exerciseId, f.verdict]),
  );
  const rows: ContentRow[] = [
    ...byId(input.lessons).map(({ main, group, missingEn }) => ({
      kind: "lesson" as const,
      id: main.id,
      title: short(main.title),
      status: main.status,
      track: input.trackOf.get(main.id) ?? null,
      missingEn,
      todos: todosIn(
        group.map((g) => g.file),
        input.todos,
      ),
      calibration: null,
    })),
    ...input.exercises.map((e) => ({
      kind: "exercise" as const,
      id: e.id,
      title: short(e.promptPl),
      status: e.status,
      track: e.lessonIds.map((l) => input.trackOf.get(l)).find((t) => t !== undefined) ?? null,
      missingEn: !e.hasEn,
      todos: todosIn([e.file], input.todos),
      calibration: verdicts.get(e.id) ?? null,
    })),
    ...byId(input.debunk).map(({ main, group, missingEn }) => ({
      kind: "debunk" as const,
      id: main.id,
      title: short(main.claim),
      status: main.status,
      track: null,
      missingEn,
      todos: todosIn(
        group.map((g) => g.file),
        input.todos,
      ),
      calibration: null,
    })),
  ];
  return rows;
}

export type ContentFilter = {
  kind?: ContentKind | undefined;
  status?: Status | undefined;
  track?: string | undefined;
  /** Only rows that need attention: missing EN, open TODOs or a calibration flag. */
  attention?: boolean | undefined;
};

export const needsAttention = (r: ContentRow) =>
  r.missingEn || r.todos > 0 || r.calibration !== null;

export function filterRows(rows: readonly ContentRow[], f: ContentFilter): ContentRow[] {
  return rows.filter(
    (r) =>
      (!f.kind || r.kind === f.kind) &&
      (!f.status || r.status === f.status) &&
      (!f.track || r.track === f.track) &&
      (!f.attention || needsAttention(r)),
  );
}

export type Summary = Record<Status, number> & {
  missingEn: number;
  todos: number;
  flagged: number;
};

export function summarize(rows: readonly ContentRow[]): Summary {
  return {
    draft: rows.filter((r) => r.status === "draft").length,
    review: rows.filter((r) => r.status === "review").length,
    published: rows.filter((r) => r.status === "published").length,
    missingEn: rows.filter((r) => r.missingEn).length,
    todos: rows.reduce((s, r) => s + r.todos, 0),
    flagged: rows.filter((r) => r.calibration !== null).length,
  };
}

/** Counts `TODO(verify)` markers in a source file's text. */
export const countTodos = (source: string) => source.match(/TODO\(verify\)/g)?.length ?? 0;
