"use client";

import { useTheme } from "next-themes";
import { RadioGroup } from "radix-ui";
import { useSyncExternalStore } from "react";

type ThemeSwitchProps = {
  /** Localised labels (next-intl arrives in Phase 2). */
  labels: { group: string; system: string; light: string; dark: string };
};

const subscribe = () => () => undefined;
const THEMES = ["system", "light", "dark"] as const;

/** System / light / dark as a segmented radio group (arrow keys move between options). */
export function ThemeSwitch({ labels }: ThemeSwitchProps) {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; render with nothing selected until mounted.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <RadioGroup.Root
      aria-label={labels.group}
      orientation="horizontal"
      value={mounted ? (theme ?? "system") : ""}
      onValueChange={setTheme}
      className="inline-flex rounded border border-rule-strong"
    >
      {THEMES.map((value) => (
        <RadioGroup.Item
          key={value}
          value={value}
          className="px-3 py-1.5 text-sm text-ink-muted transition-[color] hover:text-ink data-[state=checked]:bg-ink data-[state=checked]:text-bg"
        >
          {labels[value]}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
