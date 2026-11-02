import "server-only";

import { env } from "@/env";
import { createAdminClient } from "@/lib/db/admin";

import type { EmailKind } from "./rules";
import type { PrefsStore } from "./unsubscribe";

/** Preferences written with the secret key: the signed link is the authorisation. */
export function prefsStore(): PrefsStore | null {
  const admin = createAdminClient();
  if (!admin) return null;
  return {
    async setEmail(userId: string, kind: EmailKind, on: boolean) {
      const base = { user_id: userId };
      const { error } =
        kind === "streak"
          ? await admin
              .from("notification_prefs")
              .upsert({ ...base, email_streak: on }, { onConflict: "user_id" })
          : kind === "weekly"
            ? await admin
                .from("notification_prefs")
                .upsert({ ...base, email_weekly: on }, { onConflict: "user_id" })
            : await admin
                .from("notification_prefs")
                .upsert({ ...base, email_league: on }, { onConflict: "user_id" });
      return !error;
    },
  };
}

export const tokenSecret = () => env.EMAIL_TOKEN_SECRET;
