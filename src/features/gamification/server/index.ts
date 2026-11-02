import "server-only";

import { allExercises } from "@/features/exercises/data";
import { createAdminClient } from "@/lib/db/admin";

import type { Lookups } from "./award";
import { supabaseStore } from "./supabase-store";
import { curriculum } from "../../../../content/curriculum";

/**
 * The gamification store for server actions, or null when there's no database (today,
 * accounts are off). Callers have already checked the session.
 */
export function gamificationStore() {
  const admin = createAdminClient();
  return admin ? supabaseStore(admin) : null;
}

const MODULES = curriculum.flatMap((t) => t.modules.map((m) => m.lessons as readonly string[]));

export const lookups: Lookups = {
  topicsOf: (id) => allExercises().find((e) => e.id === id)?.topics ?? [],
  modulesCompleted: (done) =>
    MODULES.filter((lessons) => lessons.length > 0 && lessons.every((l) => done.has(l))).length,
};
