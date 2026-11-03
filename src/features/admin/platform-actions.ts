"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { aiSettingsSchema } from "@/features/ai-grading/quota";
import { ANNOUNCEMENTS_TAG } from "@/features/announcements/tag";

import { FLAG_KEY, warsawLocalToIso } from "./platform";
import { audit, staffFor } from "./server";

/**
 * Platform controls (Phase 18c), admins only: AI budget, feature flags, announcements.
 * Each checks the role, writes with the secret key and leaves an audit row with the
 * before and after values.
 */
export type ActionResult = { ok: boolean };

export async function saveAiSettings(input: unknown): Promise<ActionResult> {
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("ai");
  if (!who) return { ok: false };
  const { data: before } = await who.admin
    .from("app_settings")
    .select("value")
    .eq("key", "ai")
    .maybeSingle();
  const { error } = await who.admin.from("app_settings").upsert({
    key: "ai",
    value: parsed.data,
    updated_by: who.actor,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, "settings.ai", "settings:ai", {
      before: before?.value ?? null,
      after: parsed.data,
    }),
  };
}

const flagInput = z.object({
  key: z.string().regex(FLAG_KEY),
  enabled: z.boolean(),
  rollout: z.number().int().min(0).max(100),
  description: z.string().trim().max(300),
});

export async function saveFlag(input: unknown): Promise<ActionResult> {
  const parsed = flagInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("flags");
  if (!who) return { ok: false };
  const { key, enabled, rollout, description } = parsed.data;
  const { data: before } = await who.admin
    .from("feature_flags")
    .select("enabled, rollout_percent, description")
    .eq("key", key)
    .maybeSingle();
  const after = { enabled, rollout_percent: rollout, description: description || null };
  const { error } = await who.admin.from("feature_flags").upsert({ key, ...after });
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, before ? "flag.update" : "flag.create", `flag:${key}`, {
      before,
      after,
    }),
  };
}

export async function deleteFlag(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ key: z.string().regex(FLAG_KEY) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("flags");
  if (!who) return { ok: false };
  const { data: before } = await who.admin
    .from("feature_flags")
    .select("enabled, rollout_percent, description")
    .eq("key", parsed.data.key)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } = await who.admin.from("feature_flags").delete().eq("key", parsed.data.key);
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, "flag.delete", `flag:${parsed.data.key}`, { before }),
  };
}

const announcementInput = z.object({
  bodyPl: z.string().trim().min(1).max(500),
  bodyEn: z.string().trim().min(1).max(500),
  /** `datetime-local` values, Warsaw time; empty start = now, empty end = until ended. */
  startsAt: z.string().max(20),
  endsAt: z.string().max(20),
});

export async function createAnnouncement(input: unknown): Promise<ActionResult> {
  const parsed = announcementInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("announcements");
  if (!who) return { ok: false };
  const { bodyPl, bodyEn, startsAt, endsAt } = parsed.data;
  const starts = startsAt ? warsawLocalToIso(startsAt) : new Date().toISOString();
  const ends = endsAt ? warsawLocalToIso(endsAt) : null;
  if (starts === null || (endsAt && ends === null)) return { ok: false };
  if (ends !== null && new Date(ends) <= new Date(starts)) return { ok: false };
  const row = { body_pl: bodyPl, body_en: bodyEn, starts_at: starts, ends_at: ends };
  const { data, error } = await who.admin
    .from("announcements")
    .insert({ ...row, created_by: who.actor })
    .select("id")
    .single();
  if (error) return { ok: false };
  updateTag(ANNOUNCEMENTS_TAG);
  return {
    ok: await audit(
      who.admin,
      who.actor,
      "announcement.create",
      `announcement:${String(data.id)}`,
      row,
    ),
  };
}

/** End now (keeps the row for the record) or delete outright. */
export async function closeAnnouncement(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.number().int().positive(), mode: z.enum(["end", "delete"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("announcements");
  if (!who) return { ok: false };
  const { id, mode } = parsed.data;
  const { data: before } = await who.admin
    .from("announcements")
    .select("body_pl, body_en, starts_at, ends_at")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } =
    mode === "end"
      ? await who.admin
          .from("announcements")
          .update({ ends_at: new Date().toISOString() })
          .eq("id", id)
      : await who.admin.from("announcements").delete().eq("id", id);
  if (error) return { ok: false };
  updateTag(ANNOUNCEMENTS_TAG);
  return {
    ok: await audit(who.admin, who.actor, `announcement.${mode}`, `announcement:${String(id)}`, {
      before,
    }),
  };
}
