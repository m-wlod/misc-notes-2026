"use client";

import { ThemeSwitch } from "@/components/theme/theme-switch";

export function ThemeControl() {
  return (
    <ThemeSwitch labels={{ group: "Motyw", system: "System", light: "Jasny", dark: "Ciemny" }} />
  );
}
