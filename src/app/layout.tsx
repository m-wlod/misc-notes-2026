import type { Metadata } from "next";

import "./globals.css";

import { siteConfig } from "@/config/site";
import { env } from "@/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: siteConfig.name,
};

// Phase 0 skeleton. Phase 1 adds fonts and tokens; Phase 2 moves this under [locale]
// with next-intl, at which point `lang` comes from the route.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={siteConfig.defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
