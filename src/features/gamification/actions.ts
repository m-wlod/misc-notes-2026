"use server";

import { z } from "zod";

import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { onClaim } from "./server/hooks";

/**
 * Achievements the browser claims (Phase 14), e.g. after running a simulation. Only ids
 * marked `client` in the catalog are accepted, they give no XP, and only a signed-in
 * user can claim (for themselves). Signed out it does nothing.
 */
export async function claimAchievement(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ id: z.string().regex(/^[a-z0-9-]{2,60}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  if (!(await allowWrite("claimAchievement", session.user.id))) return { ok: false };
  return { ok: (await onClaim(session.user.id, parsed.data.id)) === true };
}
