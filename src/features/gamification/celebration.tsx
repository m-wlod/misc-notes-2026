"use client";

import { useTranslations } from "next-intl";
import { Toast as RadixToast } from "radix-ui";
import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

import { CELEBRATE_EVENT, chime, setSound, soundOn } from "./celebrate";
import type { Rewards } from "./server/award";

/**
 * What a reward looks like (Phase 14): XP, the goal, the streak, new achievements. A
 * short scale-in on the XP figure (none with reduced motion), a quiet chime that can be
 * muted (kept in this browser). No confetti. Also rendered in /styleguide.
 */
export function CelebrationBody({
  rewards,
  sound,
  onSound,
  animate = true,
}: {
  rewards: Rewards;
  sound: boolean;
  onSound: (on: boolean) => void;
  animate?: boolean;
}) {
  const t = useTranslations("gamification");
  return (
    <div className="grid gap-1">
      <p
        className={cx(
          "font-mono text-lg font-semibold text-accent-text",
          animate && "origin-left motion-safe:animate-pop",
        )}
      >
        {t("celebrate.xp", { xp: rewards.xp })}
      </p>
      <ul className="grid gap-0.5 font-sans text-sm text-ink">
        {rewards.goalMet ? <li>{t("celebrate.goalMet")}</li> : null}
        {rewards.repaired ? <li>{t("celebrate.repaired")}</li> : null}
        {rewards.streak > 0 && (rewards.goalMet || rewards.repaired) ? (
          <li>{t("celebrate.streak", { days: rewards.streak })}</li>
        ) : null}
        {rewards.achievements.map((id) => (
          <li key={id}>
            {t("celebrate.achievement", {
              name: t(`achievements.${id}.name` as "achievements.kelly.name"),
            })}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-1 justify-self-start font-sans text-xs text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        aria-pressed={!sound}
        onClick={() => {
          onSound(!sound);
        }}
      >
        {sound ? t("celebrate.soundOn") : t("celebrate.soundOff")}
      </button>
    </div>
  );
}

/** Mounted once in the app shell; shows each reward a server action hands to `celebrate`. */
export function Celebration() {
  const t = useTranslations("gamification");
  const [queue, setQueue] = useState<(Rewards & { n: number })[]>([]);
  const [sound, setSoundState] = useState(true);

  useEffect(() => {
    let n = 0;
    const onReward = (e: Event) => {
      const rewards = (e as CustomEvent<Rewards>).detail;
      const on = soundOn();
      setSoundState(on);
      if (on) chime();
      setQueue((q) => [...q.slice(-2), { ...rewards, n: n++ }]);
    };
    window.addEventListener(CELEBRATE_EVENT, onReward);
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onReward);
    };
  }, []);

  return (
    <RadixToast.Provider duration={6000} label={t("celebrate.label")}>
      {queue.map((r) => (
        <RadixToast.Root
          key={r.n}
          data-celebration=""
          className="grid grid-cols-[1fr_auto] items-start gap-x-4 rounded border border-l-2 border-rule-strong border-l-accent bg-surface p-3 text-ink"
          onOpenChange={(open) => {
            if (!open) setQueue((q) => q.filter((x) => x.n !== r.n));
          }}
        >
          <RadixToast.Title className="sr-only">{t("celebrate.label")}</RadixToast.Title>
          <RadixToast.Description asChild>
            <div>
              <CelebrationBody
                rewards={r}
                sound={sound}
                onSound={(on) => {
                  setSound(on);
                  setSoundState(on);
                }}
              />
            </div>
          </RadixToast.Description>
          <RadixToast.Close
            aria-label={t("celebrate.close")}
            className="rounded-sm text-ink-muted hover:text-ink"
          >
            <CloseIcon />
          </RadixToast.Close>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport
        label={t("celebrate.label")}
        className="fixed right-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-(--z-toast) m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 sm:bottom-0"
      />
    </RadixToast.Provider>
  );
}
