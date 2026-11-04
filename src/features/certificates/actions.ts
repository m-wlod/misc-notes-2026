"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/db/admin";
import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { eligible } from "./eligibility";
import { readTrackProgress, TRACK_IDS } from "./server";

/**
 * Issues the certificate for a track (Phase 15) when the server agrees the learner has
 * earned it; once per track (a second claim returns the first certificate).
 */
export async function claimCertificate(
  input: unknown,
): Promise<
  { ok: true; id: string } | { ok: false; reason: "invalid" | "not-eligible" | "failed" }
> {
  const parsed = z.object({ trackId: z.string().max(80) }).safeParse(input);
  if (!parsed.success || !TRACK_IDS.includes(parsed.data.trackId)) {
    return { ok: false, reason: "invalid" };
  }
  const session = await getSession();
  const admin = createAdminClient();
  if (!session || !admin) return { ok: false, reason: "invalid" };
  if (!(await allowWrite("claimCertificate", session.user.id))) {
    return { ok: false, reason: "failed" };
  }
  const progress = (await readTrackProgress(session)).get(parsed.data.trackId);
  if (!progress || !eligible(progress)) return { ok: false, reason: "not-eligible" };

  const { data: existing } = await admin
    .from("certificates")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("track_id", parsed.data.trackId)
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const { data, error } = await admin
    .from("certificates")
    .insert({
      user_id: session.user.id,
      track_id: parsed.data.trackId,
      score: progress.mastery,
    })
    .select("id")
    .single();
  return error ? { ok: false, reason: "failed" } : { ok: true, id: data.id };
}
