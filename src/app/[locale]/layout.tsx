import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import "../globals.css";

import { AppShell } from "@/components/shell/app-shell";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { DEPTH_SCRIPT } from "@/config/depth";
import { resolveSiteUrl } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { OG_SIZE, ogUrl } from "@/features/seo/og";
import { routing } from "@/i18n/routing";

import { mono, sans, serif } from "./fonts";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: resolveSiteUrl(env),
    title: { template: `%s · ${siteConfig.name}`, default: siteConfig.name },
    description: t("siteDescription"),
    // The site card; pages with their own preview (lessons, videos, …) replace it.
    openGraph: {
      siteName: siteConfig.name,
      locale: locale === "pl" ? "pl_PL" : "en_GB",
      type: "website",
      images: [{ url: ogUrl("page", "home", locale), ...OG_SIZE, alt: siteConfig.name }],
    },
    twitter: { card: "summary_large_image", images: [ogUrl("page", "home", locale)] },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
      // next-themes sets data-theme before hydration; the mismatch is expected.
      suppressHydrationWarning
    >
      <body>
        {/* Lesson depth before first paint (no flash); see src/config/depth.ts. */}
        <script dangerouslySetInnerHTML={{ __html: DEPTH_SCRIPT }} />
        <NextIntlClientProvider>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
