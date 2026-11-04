import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { securityHeaders } from "./src/config/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Content (Velite): `pnpm build` runs `velite build` first; in `next dev` we start it in
// watch mode here, as Velite documents for Turbopack, so MDX edits rebuild .velite/.
if (process.argv.includes("dev") && !process.env.VELITE_STARTED) {
  process.env.VELITE_STARTED = "1";
  void import("velite").then((velite) => velite.build({ watch: true }));
}

const nextConfig: NextConfig = {
  // The signed-in e2e suite (scripts/e2e-db.ts) builds against the local database into
  // its own folder, so it never replaces the regular build.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  poweredByHeader: false,
  // Security headers on every response (Phase 21, src/config/security-headers.ts).
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV === "development",
        }),
      },
    ]);
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// BotID (Phase 21c): rewrites its challenge scripts through this origin on Vercel.
export default withBotId(withNextIntl(nextConfig));
