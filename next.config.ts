import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

export default withNextIntl(nextConfig);
