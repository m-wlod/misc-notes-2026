import { siteConfig } from "@/config/site";

// Honest placeholder until Phase 2 builds the real shell. Polish copy here is
// temporary; from Phase 2 every user-facing string goes through next-intl.
export default function HomePage() {
  return (
    <main>
      <h1>{siteConfig.name}</h1>
      <p>W budowie.</p>
    </main>
  );
}
