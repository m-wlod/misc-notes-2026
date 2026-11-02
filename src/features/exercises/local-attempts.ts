import {
  emptyLocalProgress,
  LOCAL_PROGRESS_KEY,
  localProgressSchema,
  type LocalProgress,
} from "@/features/progress/schema";
import { store } from "@/features/reader/storage";

/**
 * Signed-out attempts live in qla:progress:v1 (the sign-in merge imports them as
 * `anonymous_import`, which never earns XP). The score comes from the server's grade.
 */
export type LocalAttempt = LocalProgress["attempts"][number];
const MAX = 1000;

export function withAttempt(raw: string | null, attempt: LocalAttempt): string {
  let progress: LocalProgress = emptyLocalProgress();
  if (raw) {
    try {
      const parsed = localProgressSchema.safeParse(JSON.parse(raw));
      if (parsed.success) progress = parsed.data;
    } catch {
      // keep the empty state
    }
  }
  progress.attempts = [...progress.attempts, attempt].slice(-MAX);
  return JSON.stringify(progress);
}

export function recordAttempt(attempt: Omit<LocalAttempt, "clientId" | "createdAt">): void {
  store(LOCAL_PROGRESS_KEY, (raw) =>
    withAttempt(raw, {
      ...attempt,
      clientId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }),
  );
}

/** Exercise ids answered correctly (score 1) in this browser. */
export function solvedIds(progress: LocalProgress | null): Set<string> {
  return new Set((progress?.attempts ?? []).filter((a) => a.score >= 1).map((a) => a.exerciseId));
}
