import "server-only";

import { getExercise } from "@/features/exercises/data";
import { createAdminClient } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/db/config";

import { badgesFor } from "../policy";

/**
 * A public profile (Phase 17b): only for accounts that opted in (`public_profiles`,
 * readable by anyone). The rest is read with the secret key for that one user and
 * limited to what the profile shows: no email, no attempts, no solution bodies.
 */
export type PublicProfile = {
  id: string;
  handle: string;
  name: string | null;
  level: number | null;
  joined: string;
  streak: { current: number; longest: number };
  achievements: Set<string>;
  ratings: { topic: string; rating: number }[];
  certificates: { id: string; trackId: string; issuedAt: string }[];
  /** Exercise ids; `published` ones get a link. */
  solutions: { exerciseId: string; published: boolean }[];
  reputation: number;
  badges: string[];
};

const HANDLE = /^[a-z0-9_]{3,24}$/;

export async function readPublicProfile(handle: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured() || !HANDLE.test(handle)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: p } = await admin
    .from("public_profiles")
    .select("id, handle, display_name, placement_level, created_at")
    .eq("handle", handle)
    .maybeSingle();
  if (!p?.id) return null;
  const id = p.id;
  const [streak, achievements, ratings, certificates, solutions, reputation] = await Promise.all([
    admin.from("streaks").select("current_days, longest_days").eq("user_id", id).maybeSingle(),
    admin.from("user_achievements").select("achievement_id").eq("user_id", id),
    admin.from("topic_ratings").select("topic, rating").eq("user_id", id),
    admin.from("certificates").select("id, track_id, issued_at").eq("user_id", id),
    admin
      .from("shared_solutions")
      .select("exercise_id")
      .eq("user_id", id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50),
    admin.rpc("reputation", { uid: id }),
  ]);
  const rep = reputation.data ?? 0;
  return {
    id,
    handle: p.handle,
    name: p.display_name,
    level: p.placement_level,
    joined: p.created_at,
    streak: {
      current: streak.data?.current_days ?? 0,
      longest: streak.data?.longest_days ?? 0,
    },
    achievements: new Set((achievements.data ?? []).map((a) => a.achievement_id)),
    ratings: ratings.data ?? [],
    certificates: (certificates.data ?? []).map((c) => ({
      id: c.id,
      trackId: c.track_id,
      issuedAt: c.issued_at,
    })),
    // Listed by exercise only: the bodies stay behind each exercise's spoiler gate.
    solutions: [...new Set((solutions.data ?? []).map((s) => s.exercise_id))].map((exerciseId) => ({
      exerciseId,
      published: getExercise(exerciseId, false) !== undefined,
    })),
    reputation: rep,
    badges: badgesFor(rep),
  };
}
