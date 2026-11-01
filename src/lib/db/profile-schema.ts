import { z } from "zod";

/** Fields a user may change about themselves. Everything else is server-owned. */
export const profileUpdateSchema = z
  .object({
    display_name: z.string().trim().min(1).max(60).nullable(),
    handle: z.string().regex(/^[a-z0-9_]{3,24}$/),
    locale: z.enum(["pl", "en"]),
    goal: z.enum(["trading", "interviews", "university", "curiosity"]),
    self_level: z.number().int().min(1).max(5),
    daily_goal_minutes: z.union([z.literal(5), z.literal(10), z.literal(20)]),
    timezone: z.string().min(1).max(64),
    is_public: z.boolean(),
    league_opt_out: z.boolean(),
  })
  .partial();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
