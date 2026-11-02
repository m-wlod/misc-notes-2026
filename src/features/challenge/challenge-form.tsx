"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { submitChallenge } from "./actions";

export function ChallengeForm({ challengeId }: { challengeId: string }) {
  const t = useTranslations("challenge");
  const id = useId();
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "failed" | "short">("idle");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid max-w-(--measure) gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim().length < 40) {
          setState("short");
          return;
        }
        startTransition(async () => {
          const res = await submitChallenge({ challengeId, body });
          setState(res.ok ? "sent" : "failed");
        });
      }}
    >
      <label htmlFor={id} className="font-sans text-sm text-ink">
        {t("solution")}
      </label>
      <textarea
        id={id}
        rows={10}
        value={body}
        disabled={pending || state === "sent"}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        className="rounded border border-rule-strong bg-surface px-3 py-2 font-serif text-base text-ink"
      />
      <div>
        <Button type="submit" disabled={pending || state === "sent"}>
          {t("submit")}
        </Button>
      </div>
      <p role="status" className="font-sans text-sm empty:hidden">
        {state === "sent"
          ? t("sent")
          : state === "failed"
            ? t("failed")
            : state === "short"
              ? t("tooShort")
              : ""}
      </p>
    </form>
  );
}
