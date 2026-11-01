"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ThemeControl } from "@/components/shell/controls";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";

import { deleteAccount, saveSettings, type DeleteState, type SettingsState } from "./actions";

export type SettingsProfile = {
  display_name: string | null;
  handle: string;
  locale: string;
  daily_goal_minutes: number;
  timezone: string;
  is_public: boolean;
  league_opt_out: boolean;
};

const ZONES = [
  "Europe/Warsaw",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Dublin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function SettingsForm({ profile }: { profile: SettingsProfile }) {
  const t = useTranslations("account.settings");
  const lang = useTranslations("common.language");
  const days = useTranslations("onboarding.daily");
  const locale = useLocale();
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {
    status: "idle",
  });
  const zones = ZONES.includes(profile.timezone) ? ZONES : [profile.timezone, ...ZONES];

  return (
    <div className="grid max-w-xl gap-14">
      <section aria-labelledby="s-profile">
        <h2 id="s-profile" className="mb-6 border-b border-rule pb-2 text-xl">
          {t("profileSection")}
        </h2>
        <form action={action} className="grid gap-6">
          <input type="hidden" name="currentLocale" value={locale} />
          <Field id="display_name" label={t("displayName")}>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              maxLength={60}
            />
          </Field>
          <Field id="handle" label={t("handle")} hint={t("handleHint")}>
            <Input
              id="handle"
              name="handle"
              defaultValue={profile.handle}
              required
              pattern="[a-z0-9_]{3,24}"
              aria-describedby="handle-hint"
              className="num"
            />
          </Field>
          <Field id="locale" label={t("language")}>
            <Select
              id="locale"
              name="locale"
              defaultValue={profile.locale}
              options={[
                { value: "pl", label: lang("pl") },
                { value: "en", label: lang("en") },
              ]}
            />
          </Field>
          <Field id="daily_goal_minutes" label={t("dailyGoal")}>
            <Select
              id="daily_goal_minutes"
              name="daily_goal_minutes"
              defaultValue={String(profile.daily_goal_minutes)}
              options={[5, 10, 20].map((m) => ({
                value: String(m),
                label: days("minutes", { minutes: m }),
              }))}
            />
          </Field>
          <Field id="timezone" label={t("timezone")} hint={t("timezoneHint")}>
            <Select
              id="timezone"
              name="timezone"
              defaultValue={profile.timezone}
              aria-describedby="timezone-hint"
              options={zones.map((z) => ({ value: z, label: z.replace("_", " ") }))}
            />
          </Field>
          <CheckField
            id="is_public"
            label={t("public")}
            hint={t("publicHint")}
            defaultChecked={profile.is_public}
          />
          <CheckField
            id="league_opt_out"
            label={t("leagueOptOut")}
            defaultChecked={profile.league_opt_out}
          />

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
            <p role="status" className="text-sm">
              {state.status === "saved" ? <span className="text-correct">{t("saved")}</span> : null}
            </p>
          </div>
          {state.status === "error" ? <FieldError>{t(`errors.${state.error}`)}</FieldError> : null}
        </form>
      </section>

      <section aria-labelledby="s-appearance">
        <h2 id="s-appearance" className="mb-6 border-b border-rule pb-2 text-xl">
          {t("appearance")}
        </h2>
        <ThemeControl />
      </section>

      <section aria-labelledby="s-data" className="grid gap-8">
        <h2 id="s-data" className="border-b border-rule pb-2 text-xl">
          {t("data")}
        </h2>
        <div>
          <h3 className="mb-1 font-sans text-base font-medium">{t("exportTitle")}</h3>
          <p className="mb-3 text-sm text-ink-muted">{t("exportBody")}</p>
          {/* A plain link: the route handler responds with a file download. */}
          <a href="/api/me/export" className={buttonClass("secondary")} download>
            {t("export")}
          </a>
        </div>
        <div>
          <h3 className="mb-1 font-sans text-base font-medium">{t("deleteTitle")}</h3>
          <p className="mb-3 text-sm text-ink-muted">{t("deleteBody")}</p>
          <DeleteAccount handle={profile.handle} />
        </div>
      </section>
    </div>
  );
}

function DeleteAccount({ handle }: { handle: string }) {
  const t = useTranslations("account.settings");
  const locale = useLocale();
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {
    status: "idle",
  });
  const [typed, setTyped] = useState("");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="border-wrong text-wrong">
          {t("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("deleteTitle")} description={t("deleteBody")} closeLabel={t("close")}>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <Label htmlFor="confirm">{t("deleteConfirmLabel", { handle })}</Label>
          <Input
            id="confirm"
            name="confirm"
            autoComplete="off"
            className="num"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
          />
          {state.status === "error" ? <FieldError>{t(`errors.${state.error}`)}</FieldError> : null}
          <div className="mt-2 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">{t("cancel")}</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || typed.trim().toLowerCase() !== handle.toLowerCase()}
              className="bg-wrong text-bg"
            >
              {pending ? t("deleting") : t("deleteConfirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}

function CheckField({
  id,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} name={id} defaultChecked={defaultChecked} className="mt-0.5" />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
    </div>
  );
}
