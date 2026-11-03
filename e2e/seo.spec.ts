import { expect, test, type Page } from "./test";

/**
 * Phase 19b: what Lighthouse's SEO audits check, on the landing, a lesson, a debunk entry
 * and a video page, in both languages: a real status, `lang`, title and description,
 * canonical and hreflang, indexability rules, link texts and image alts, structured
 * data of the right type, and a link-preview image that renders.
 * (The Lighthouse run itself is a Phase 23 check.)
 */
const PAGES = [
  { pl: "/pl", en: "/en", type: "WebSite", indexable: true },
  {
    // A stub lesson: everything is there, but it stays out of search until it's written.
    pl: "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly",
    en: "/en/learn/expected-value/betting/kelly-criterion",
    type: "LearningResource",
    indexable: false,
  },
  {
    pl: "/pl/debunk/przyklad-90-procent-skutecznosci",
    en: "/en/debunk/sample-90-percent-win-rate",
    type: "FAQPage",
    indexable: false,
  },
  { pl: "/pl/v/przyklad", en: "/en/v/przyklad", type: "Quiz", indexable: false },
] as const;

const meta = (page: Page, sel: string) => page.locator(sel).first().getAttribute("content");

for (const p of PAGES) {
  for (const lang of ["pl", "en"] as const) {
    const path = p[lang];
    test(`SEO basics: ${path}`, async ({ page, request }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      expect((await page.title()).length).toBeGreaterThan(5);
      expect((await meta(page, 'meta[name="description"]'))?.length ?? 0).toBeGreaterThan(20);

      const ends = (x: string) => new RegExp(`^https?://[^/]+${x}$`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", ends(path));
      await expect(page.locator('link[rel="alternate"][hreflang="pl"]')).toHaveAttribute(
        "href",
        ends(p.pl),
      );
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
        "href",
        ends(p.en),
      );
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
      const robotsTag = page.locator('meta[name="robots"]');
      const robots =
        (await robotsTag.count()) > 0 ? await robotsTag.first().getAttribute("content") : null;
      if (p.indexable) expect(robots ?? "").not.toContain("noindex");
      else expect(robots).toContain("noindex");

      // Every link has a text (or a label); every image has an alt.
      const unnamed = await page
        .locator("a[href]")
        .evaluateAll((as) =>
          as
            .filter((a) => !(a.textContent.trim() || a.getAttribute("aria-label")))
            .map((a) => a.outerHTML.slice(0, 80)),
        );
      expect(unnamed).toEqual([]);
      expect(await page.locator("img:not([alt])").count()).toBe(0);

      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((ss) => ss.map((s) => JSON.parse(s.textContent) as unknown));
      expect(blocks.map((b) => (b as { "@type"?: string })["@type"])).toContain(p.type);

      const image = await meta(page, 'meta[property="og:image"]');
      expect(image).toBeTruthy();
      const img = await request.get(new URL(image ?? "").pathname + new URL(image ?? "").search);
      expect(img.status()).toBe(200);
      expect(img.headers()["content-type"]).toBe("image/png");
      expect(await meta(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
    });
  }
}

test("preview images: both languages, every kind, refused for what doesn't exist", async ({
  request,
}) => {
  for (const lang of ["pl", "en"]) {
    for (const q of [
      "kind=page&id=home",
      "kind=page&id=lab",
      "kind=lesson&id=kelly-criterion",
      "kind=track&id=expected-value",
      "kind=sim&id=gbm",
      "kind=video&id=przyklad",
    ]) {
      const res = await request.get(`/api/og?${q}&lang=${lang}`);
      expect(res.status(), q).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
    }
  }
  expect((await request.get("/api/og?kind=lesson&id=nie-ma&lang=pl")).status()).toBe(404);
  expect((await request.get("/api/og?kind=page&id=admin&lang=pl")).status()).toBe(404);
  expect((await request.get("/api/og?kind=nope&id=x")).status()).toBe(400);
});

test("internal links: a lesson lists the video that leads to it", async ({ page }) => {
  await page.goto("/pl/nauka/wartosc-oczekiwana/podstawy/wartosc-oczekiwana");
  await expect(page.locator("[data-related-video='przyklad'] a")).toHaveAttribute(
    "href",
    "/pl/v/przyklad",
  );
});
