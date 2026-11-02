import "server-only";

import { exercises as files } from "#content";

import { exerciseSchema, type Exercise } from "./schema";
import { isVisible } from "./visibility";

/**
 * Exercises for server code only (pages, server actions). Answers, hints and solutions
 * never leave the server except through publicView() and the hint/solution actions.
 * Files were validated at build time; parsing again here gives typed data and defaults.
 */
let cache: Exercise[] | null = null;

export function allExercises(): Exercise[] {
  cache ??= files.map((f) => exerciseSchema.parse(f.data));
  return cache;
}

export function getExercise(id: string, internal: boolean): Exercise | undefined {
  const ex = allExercises().find((e) => e.id === id);
  return ex && isVisible(ex, internal) ? ex : undefined;
}

export function listExercises(internal: boolean): Exercise[] {
  return allExercises().filter((e) => isVisible(e, internal));
}
