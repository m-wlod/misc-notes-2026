"use server";

import { z } from "zod";

import { prefsStore, tokenSecret } from "./server";
import { applyUnsubscribe, type UnsubscribeResult } from "./unsubscribe";

/** The /wypisz page: switches the kind off on load, and back on with its button. */
export async function setEmailByLink(input: unknown): Promise<UnsubscribeResult> {
  const parsed = z
    .object({
      u: z.string().max(64),
      k: z.string().max(20),
      s: z.string().max(100),
      on: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  return applyUnsubscribe(prefsStore(), tokenSecret(), parsed.data, parsed.data.on);
}
