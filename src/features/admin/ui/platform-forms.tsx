"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";

import {
  closeAnnouncement,
  createAnnouncement,
  deleteFlag,
  saveAiSettings,
  saveFlag,
  type ActionResult,
} from "../platform-actions";

/**
 * Forms of the platform controls (Phase 18c). Each one calls its server action (role
 * check, write, audit) and refreshes the page to show what was saved.
 */
const field = "rounded border border-rule-strong bg-surface px-2 py-1";

function useAction(okText: string, failText: string) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, onOk?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const r = await action().catch(() => ({ ok: false }));
      setMessage({ ok: r.ok, text: r.ok ? okText : failText });
      if (r.ok) {
        onOk?.();
        router.refresh();
      }
    });
  };
  const status: ReactNode = message ? (
    <p
      role={message.ok ? "status" : "alert"}
      className={message.ok ? "text-xs text-ink-muted" : "text-xs text-wrong"}
    >
      {message.text}
    </p>
  ) : null;
  return { run, pending, status };
}

const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

const num = (form: FormData, name: string) => {
  const v = text(form, name).trim();
  return v === "" ? undefined : Number(v.replace(",", "."));
};

export function AiSettingsForm({
  defaults,
}: {
  defaults: { dailyBudgetUsd: number; userDailyQuota: number; ipDailyLimit: number };
}) {
  const t = useTranslations("admin.ai");
  const { run, pending, status } = useAction(t("saved"), t("failed"));
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      saveAiSettings({
        dailyBudgetUsd: num(f, "budget") ?? defaults.dailyBudgetUsd,
        userDailyQuota: num(f, "quota") ?? defaults.userDailyQuota,
        ipDailyLimit: num(f, "ip") ?? defaults.ipDailyLimit,
      }),
    );
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 font-sans text-sm"
      data-ai-settings
    >
      <label className="grid gap-1">
        {t("budget")}
        <input
          name="budget"
          inputMode="decimal"
          defaultValue={defaults.dailyBudgetUsd}
          className={`${field} w-32`}
        />
      </label>
      <label className="grid gap-1">
        {t("userQuota")}
        <input
          name="quota"
          inputMode="numeric"
          defaultValue={defaults.userDailyQuota}
          className={`${field} w-32`}
        />
      </label>
      <label className="grid gap-1">
        {t("ipLimit")}
        <input
          name="ip"
          inputMode="numeric"
          defaultValue={defaults.ipDailyLimit}
          className={`${field} w-32`}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {t("save")}
      </Button>
      <div className="w-full">{status}</div>
    </form>
  );
}

export function FlagRowForm({
  flag,
}: {
  flag: { key: string; enabled: boolean; rollout_percent: number; description: string | null };
}) {
  const t = useTranslations("admin.flags");
  const { run, pending, status } = useAction(t("saved"), t("failed"));
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      saveFlag({
        key: flag.key,
        enabled: f.get("enabled") === "on",
        rollout: num(f, "rollout") ?? 100,
        description: text(f, "description"),
      }),
    );
  };
  return (
    <form
      onSubmit={submit}
      data-flag={flag.key}
      aria-label={flag.key}
      className="grid gap-2 rounded-md border border-rule px-4 py-3 font-sans text-sm"
    >
      <p className="font-mono">{flag.key}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 py-1">
          <input type="checkbox" name="enabled" defaultChecked={flag.enabled} />
          {t("enabled")}
        </label>
        <label className="grid gap-1">
          {t("rollout")}
          <input
            name="rollout"
            type="number"
            min={0}
            max={100}
            defaultValue={flag.rollout_percent}
            className={`${field} w-24`}
          />
        </label>
        <label className="grid min-w-48 flex-1 gap-1">
          {t("description")}
          <input
            name="description"
            maxLength={300}
            defaultValue={flag.description ?? ""}
            className={field}
          />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {t("save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            run(() => deleteFlag({ key: flag.key }));
          }}
        >
          {t("delete")}
        </Button>
      </div>
      {status}
    </form>
  );
}

export function NewFlagForm() {
  const t = useTranslations("admin.flags");
  const { run, pending, status } = useAction(t("saved"), t("failed"));
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    run(
      () =>
        saveFlag({
          key: text(f, "key").trim(),
          enabled: false,
          rollout: 100,
          description: text(f, "description"),
        }),
      () => {
        form.reset();
      },
    );
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 font-sans text-sm"
      aria-label={t("add")}
    >
      <label className="grid gap-1">
        {t("key")}
        <input
          name="key"
          required
          pattern="[a-z0-9_.\-]{2,60}"
          title={t("keyHint")}
          className={`${field} w-56 font-mono`}
        />
      </label>
      <label className="grid min-w-48 flex-1 gap-1">
        {t("description")}
        <input name="description" maxLength={300} className={field} />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {t("create")}
      </Button>
      <div className="w-full">{status}</div>
    </form>
  );
}

export function NewAnnouncementForm() {
  const t = useTranslations("admin.announcements");
  const { run, pending, status } = useAction(t("saved"), t("failed"));
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    run(
      () =>
        createAnnouncement({
          bodyPl: text(f, "bodyPl"),
          bodyEn: text(f, "bodyEn"),
          startsAt: text(f, "startsAt"),
          endsAt: text(f, "endsAt"),
        }),
      () => {
        form.reset();
      },
    );
  };
  return (
    <form
      onSubmit={submit}
      className="grid max-w-2xl gap-3 font-sans text-sm"
      aria-label={t("new")}
    >
      <label className="grid gap-1">
        {t("bodyPl")}
        <textarea name="bodyPl" required maxLength={500} rows={2} className={field} />
      </label>
      <label className="grid gap-1">
        {t("bodyEn")}
        <textarea name="bodyEn" required maxLength={500} rows={2} className={field} />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1">
          {t("startsAt")}
          <input name="startsAt" type="datetime-local" className={field} />
        </label>
        <label className="grid gap-1">
          {t("endsAt")}
          <input name="endsAt" type="datetime-local" className={field} />
        </label>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("create")}
        </Button>
      </div>
      {status}
    </form>
  );
}

export function AnnouncementActions({ id, ended }: { id: number; ended: boolean }) {
  const t = useTranslations("admin.announcements");
  const { run, pending, status } = useAction(t("saved"), t("failed"));
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        {ended ? null : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              run(() => closeAnnouncement({ id, mode: "end" }));
            }}
          >
            {t("end")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            run(() => closeAnnouncement({ id, mode: "delete" }));
          }}
        >
          {t("delete")}
        </Button>
      </div>
      {status}
    </div>
  );
}
