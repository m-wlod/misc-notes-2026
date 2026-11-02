import "server-only";

import type { Exercise } from "@/features/exercises/schema";

import { XP } from "../config";
import { encodeRef } from "../facts";
import { exerciseXp, xpKey } from "../xp";
import { award, claim, rateAttempt, type Rewards } from "./award";
import { gamificationStore, lookups } from "./index";

/**
 * What server actions call after something worth XP happened (Phase 14). All of them
 * take the user id from the session (never from the client) and do nothing without a
 * database. Failures never break the action that called them: the grade still counts.
 */
async function safely<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export function onExerciseGraded(
  userId: string,
  ex: Exercise,
  attempt: { score: number; hintsUsed: number; firstTry: boolean },
): Promise<Rewards | null> {
  return safely(async () => {
    const store = gamificationStore();
    if (!store) return null;
    await rateAttempt(store, userId, { topics: ex.topics, level: ex.level, score: attempt.score });
    if (attempt.score < 1) return null;
    return award(
      store,
      userId,
      {
        reason: "exercise",
        amount: exerciseXp({ level: ex.level, ...attempt, correct: true }),
        key: xpKey.exercise(ex.id),
        ref: encodeRef({
          id: ex.id,
          l: ex.level,
          t: ex.type,
          h: attempt.hintsUsed,
          f: attempt.firstTry,
        }),
      },
      lookups,
    );
  });
}

export function onLessonCompleted(userId: string, lessonId: string): Promise<Rewards | null> {
  return safely(async () => {
    const store = gamificationStore();
    if (!store) return null;
    return award(
      store,
      userId,
      {
        reason: "lesson",
        amount: XP.lessonCompleted,
        key: xpKey.lesson(lessonId),
        ref: encodeRef({ id: lessonId }),
      },
      lookups,
    );
  });
}

export function onInterviewSaved(
  userId: string,
  session: { id: string; kind: string; personalBest: boolean; pnl: number | null },
): Promise<Rewards | null> {
  return safely(async () => {
    const store = gamificationStore();
    if (!store) return null;
    return award(
      store,
      userId,
      {
        reason: "interview",
        amount: XP.interviewSession,
        dailyCap: XP.interviewSessionsPerDay,
        key: xpKey.interview(session.id),
        ref: encodeRef({
          kind: session.kind,
          pb: session.personalBest,
          profit: (session.pnl ?? 0) > 0,
        }),
      },
      lookups,
    );
  });
}

export function onClaim(userId: string, achievementId: string): Promise<boolean | null> {
  return safely(async () => {
    const store = gamificationStore();
    return store ? claim(store, userId, achievementId) : false;
  });
}
