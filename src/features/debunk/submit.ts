import { z } from "zod";

/**
 * Submissions to moderated queues (Phase 16): "test this claim" and "suggest a
 * correction". Pure validation and the decision of how to write, so it is unit-tested;
 * the server actions supply the session, database and rate limiter.
 */
export const claimInput = z.object({
  claim: z.string().trim().min(10).max(2000),
  sourceUrl: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || /^https?:\/\/\S+$/.test(u), "http(s) URL")
    .transform((u) => (u === "" ? null : u)),
  /** Honeypot: people never see it, bots fill it. */
  website: z.string().max(200).default(""),
});

export const correctionInput = z.object({
  entryId: z.string().regex(/^[a-z0-9-]{1,120}$/),
  body: z.string().trim().min(10).max(5000),
  website: z.string().max(200).default(""),
});

export type SubmitResult =
  { ok: true } | { ok: false; reason: "invalid" | "rate-limited" | "unavailable" | "failed" };

export type Writer = {
  /** Writes the row: as the signed-in user (RLS) or, signed out, with the secret key. */
  insert: (row: Record<string, unknown>, userId: string | null) => Promise<boolean>;
};

export async function submit(
  parse: () =>
    { success: true; row: Record<string, unknown>; honeypot: string } | { success: false },
  deps: {
    writer: Writer | null;
    userId: string | null;
    allowed: () => Promise<boolean>;
  },
): Promise<SubmitResult> {
  const parsed = parse();
  if (!parsed.success) return { ok: false, reason: "invalid" };
  // A filled honeypot gets the same answer as a success and is dropped silently.
  if (parsed.honeypot.trim() !== "") return { ok: true };
  if (!deps.writer) return { ok: false, reason: "unavailable" };
  if (!(await deps.allowed())) return { ok: false, reason: "rate-limited" };
  const ok = await deps.writer.insert(parsed.row, deps.userId);
  return ok ? { ok: true } : { ok: false, reason: "failed" };
}
