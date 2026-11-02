"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { saveNotificationPrefs, setPush } from "./settings-actions";

/**
 * Notification settings (Phase 15): each email kind on/off, browser push, quiet hours.
 * `demo` (style guide) saves nothing.
 */
export type NotificationPrefsView = {
  streak: boolean;
  weekly: boolean;
  league: boolean;
  push: boolean;
  quietStart: string | null;
  quietEnd: string | null;
};

const b64ToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function NotificationSettings({
  initial,
  vapidKey,
  demo = false,
}: {
  initial: NotificationPrefsView;
  vapidKey: string | null;
  demo?: boolean;
}) {
  const t = useTranslations("notify.settings");
  const id = useId();
  const [p, setP] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "failed" | "denied">("idle");
  const [pending, startTransition] = useTransition();
  const pushSupported =
    !!vapidKey &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const togglePush = (on: boolean) => {
    if (demo || !vapidKey) return;
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        let sub = await reg.pushManager.getSubscription();
        if (on && !sub) {
          if ((await Notification.requestPermission()) !== "granted") {
            setStatus("denied");
            return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: b64ToBytes(vapidKey),
          });
        }
        const json = sub?.toJSON();
        const row =
          json?.endpoint && json.keys?.p256dh && json.keys.auth
            ? { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
            : null;
        if (!on) await sub?.unsubscribe();
        const res = await setPush({ on, sub: row });
        if (res.ok) setP((x) => ({ ...x, push: on }));
        setStatus(res.ok ? "saved" : "failed");
      } catch {
        setStatus("failed");
      }
    });
  };

  const box = (key: "streak" | "weekly" | "league") => (
    <label key={key} className="flex items-start gap-3 font-sans text-sm text-ink">
      <input
        type="checkbox"
        checked={p[key]}
        onChange={(e) => {
          setP((x) => ({ ...x, [key]: e.target.checked }));
        }}
        className="mt-0.5 size-4 accent-(--accent)"
      />
      {t(key)}
    </label>
  );

  return (
    <form
      data-notification-settings=""
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (demo) {
          setStatus("saved");
          return;
        }
        startTransition(async () => {
          const res = await saveNotificationPrefs({
            streak: p.streak,
            weekly: p.weekly,
            league: p.league,
            quietStart: p.quietStart || null,
            quietEnd: p.quietEnd || null,
          });
          setStatus(res.ok ? "saved" : "failed");
        });
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg">{t("title")}</legend>
        {box("streak")}
        {box("weekly")}
        {box("league")}
        {pushSupported || demo ? (
          <label className="flex items-start gap-3 font-sans text-sm text-ink">
            <input
              type="checkbox"
              checked={p.push}
              disabled={pending}
              onChange={(e) => {
                if (demo) setP((x) => ({ ...x, push: e.target.checked }));
                else togglePush(e.target.checked);
              }}
              className="mt-0.5 size-4 accent-(--accent)"
            />
            {t("push")}
          </label>
        ) : (
          <p className="font-sans text-xs text-ink-muted">{t("pushUnavailable")}</p>
        )}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-sans text-sm font-semibold text-ink">{t("quiet")}</legend>
        <div className="flex flex-wrap items-center gap-3 font-sans text-sm">
          <label htmlFor={`${id}-from`}>{t("quietFrom")}</label>
          <input
            id={`${id}-from`}
            type="time"
            value={p.quietStart ?? ""}
            onChange={(e) => {
              setP((x) => ({ ...x, quietStart: e.target.value || null }));
            }}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          />
          <label htmlFor={`${id}-to`}>{t("quietTo")}</label>
          <input
            id={`${id}-to`}
            type="time"
            value={p.quietEnd ?? ""}
            onChange={(e) => {
              setP((x) => ({ ...x, quietEnd: e.target.value || null }));
            }}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          />
        </div>
        <p className="font-sans text-xs text-ink-muted">{t("quietNote")}</p>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        <p role="status" className="font-sans text-sm empty:hidden">
          {status === "saved"
            ? t("saved")
            : status === "failed"
              ? t("failed")
              : status === "denied"
                ? t("pushDenied")
                : ""}
        </p>
      </div>
    </form>
  );
}
