import type { LessonStatus } from "@/features/progress/schema";

/**
 * A lesson node's state on the path. Progress comes from the browser today and from the
 * account once accounts are enabled; both arrive as id → status.
 * Locked lessons stay readable (the app is free): "locked" only means "recommended after".
 */
export const NODE_STATES = ["locked", "available", "in_progress", "done", "mastered"] as const;
export type NodeState = (typeof NODE_STATES)[number];

export type Statuses = ReadonlyMap<string, LessonStatus>;

const isFinished = (status: LessonStatus | undefined) =>
  status === "completed" || status === "mastered";

export function nodeState(
  lessonId: string,
  prerequisites: readonly string[],
  statuses: Statuses,
): NodeState {
  const own = statuses.get(lessonId);
  if (own === "mastered") return "mastered";
  if (own === "completed") return "done";
  if (own === "in_progress") return "in_progress";
  return prerequisites.every((p) => isFinished(statuses.get(p))) ? "available" : "locked";
}

/** Prerequisites not finished yet, in their original order ("recommended after …"). */
export function missingPrerequisites(
  prerequisites: readonly string[],
  statuses: Statuses,
): string[] {
  return prerequisites.filter((p) => !isFinished(statuses.get(p)));
}

/** Finished lessons out of a list, for module and track progress bars. */
export function finishedCount(lessonIds: readonly string[], statuses: Statuses): number {
  return lessonIds.filter((id) => isFinished(statuses.get(id))).length;
}
