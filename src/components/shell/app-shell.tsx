import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { StatTicker } from "@/components/content/data";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { AnalyticsBoot, AnalyticsUser } from "@/features/analytics/boot";
import { AnnouncementBanner } from "@/features/announcements/banner";
import { ConsentBanner } from "@/features/consent/consent-ui";
import { Celebration } from "@/features/gamification/celebration";
import { readMe } from "@/features/gamification/server/read";
import { NewsletterForm } from "@/features/newsletter/form";
import { UtmBeacon } from "@/features/utm/beacon";
import { Link } from "@/i18n/navigation";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

import { AccountLink, AccountLinkFallback } from "./account-link";
import { LocaleSwitch, SearchButton, ThemeControl } from "./controls";
import { LEGAL_NAV, MORE_NAV } from "./nav-items";
import { BottomNav, PrimaryNav } from "./nav-links";

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <>
      <a
        href="#content"
        className="sr-only z-(--z-toast) rounded bg-ink px-3 py-2 text-sm text-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToContent")}
      </a>
      <AnnouncementBanner />
      <TopBar />
      <main id="content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      <BottomNav />
      <Celebration />
      <UtmBeacon />
      <ConsentBanner analyticsConfigured={Boolean(env.NEXT_PUBLIC_POSTHOG_KEY)} />
      <AnalyticsBoot
        posthogKey={env.NEXT_PUBLIC_POSTHOG_KEY ?? null}
        host={env.NEXT_PUBLIC_POSTHOG_HOST}
      />
    </>
  );
}

async function TopBar() {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-rule bg-bg print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="font-sans text-base font-semibold tracking-[0.02em] text-ink">
          {siteConfig.name}
        </Link>
        <PrimaryNav />
        <div className="ml-auto flex items-center gap-4">
          <div
            aria-label={t("common.stats.label")}
            role="group"
            className="hidden items-center gap-4 md:flex"
          >
            <Suspense fallback={<SignedOutStats />}>
              <HeaderStats />
            </Suspense>
          </div>
          <SearchButton />
          <div className="hidden sm:block">
            <LocaleSwitch compact />
          </div>
          {/* Mounted on phones too (only hidden), so signed-in progress still merges there. */}
          <div className="hidden sm:block">
            <Suspense fallback={<AccountLinkFallback />}>
              <AccountLink />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}

async function SignedOutStats() {
  const t = await getTranslations("common.stats");
  return (
    <>
      <StatTicker label={t("streak")} value="—" />
      <StatTicker label={t("xp")} value="—" />
      <span className="text-2xs text-ink-muted">{t("signedOut")}</span>
    </>
  );
}

/** Streak and XP for a signed-in learner (Phase 14); the signed-out dashes otherwise. */
async function HeaderStats() {
  if (!isSupabaseConfigured()) return <SignedOutStats />;
  const session = await getSession();
  const me = session ? await readMe(session) : null;
  if (!session || !me) {
    return (
      <>
        <SignedOutStats />
        <AnalyticsUser userId={null} />
      </>
    );
  }
  const t = await getTranslations("common.stats");
  return (
    <>
      <AnalyticsUser userId={session.user.id} />
      <StatTicker label={t("streak")} value={String(me.streak.current)} />
      <StatTicker label={t("xp")} value={String(me.totalXp)} />
    </>
  );
}

async function Footer() {
  const t = await getTranslations();
  const channels = (["tiktok", "youtube", "discord"] as const).map((key) => ({
    key,
    url: siteConfig.social[key],
  }));

  // On phones the fixed bottom bar (h-14 + safe area) would cover the last footer row.
  return (
    <footer className="mt-24 mb-[calc(3.5rem+env(safe-area-inset-bottom))] border-t border-rule sm:mb-0 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="grid content-start gap-3">
          <p className="font-sans text-sm font-semibold">{siteConfig.name}</p>
          <p className="text-sm text-ink-muted">{t("common.disclaimer")}</p>
          <NewsletterForm compact />
        </div>
        <FooterList heading={t("nav.about")}>
          {MORE_NAV.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} className="text-ink-muted hover:text-ink">
                {t(`nav.${key}`)}
              </Link>
            </li>
          ))}
        </FooterList>
        <FooterList heading={t("common.footer.legal")}>
          {LEGAL_NAV.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} className="text-ink-muted hover:text-ink">
                {t(`nav.${key}`)}
              </Link>
            </li>
          ))}
        </FooterList>
        <FooterList heading={t("common.footer.channels")}>
          {channels.map(({ key, url }) => (
            <li key={key}>
              {url ? (
                <a href={url} rel="noopener" className="text-ink-muted hover:text-ink">
                  {t(`common.social.${key}`)}
                </a>
              ) : (
                <span className="text-ink-muted">
                  {t(`common.social.${key}`)}{" "}
                  <span className="text-2xs">· {t("common.footer.channelSoon")}</span>
                </span>
              )}
            </li>
          ))}
        </FooterList>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-rule px-4 py-5 sm:px-6">
        <LocaleSwitch />
        <ThemeControl />
      </div>
    </footer>
  );
}

function FooterList({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-sans text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
        {heading}
      </h2>
      <ul className="grid gap-2 text-sm">{children}</ul>
    </div>
  );
}
