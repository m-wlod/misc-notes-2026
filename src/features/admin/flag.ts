import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { getSession } from "@/lib/db/session";

import { flagOn } from "./platform";

/**
 * Whether a feature flag is on for the current viewer (Phase 18c). Flags are managed in
 * /admin/flagi; partial rollouts bucket signed-in users deterministically. Without a
 * database every flag is off. Reads the session, so call it inside a dynamic boundary.
 */
export async function flag(key: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("feature_flags")
    .select("enabled, rollout_percent")
    .eq("key", key)
    .maybeSingle();
  if (!data?.enabled) return false;
  const session = await getSession();
  return flagOn(data, key, session?.user.id ?? null);
}
