import type { Metadata } from "next";

import "./globals.css";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { resolveSiteUrl } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";

import { mono, sans, serif } from "./fonts";

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(env),
  title: siteConfig.name,
};

// Phase 2 moves this under [locale] with next-intl, at which point `lang` comes from the route.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={siteConfig.defaultLocale}
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
      // next-themes sets data-theme before hydration; the mismatch is expected.
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
