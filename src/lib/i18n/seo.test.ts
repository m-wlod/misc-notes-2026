import { describe, expect, it } from "vitest";

import { localeAlternates } from "./seo";

const paths = { pl: "/pl/nauka", en: "/en/learn" } as const;

describe("localeAlternates", () => {
  it("builds canonical and hreflang links from the localised paths", () => {
    const alt = localeAlternates({
      locale: "en",
      locales: ["pl", "en"],
      defaultLocale: "pl",
      pathFor: (l) => paths[l],
      base: new URL("https://quant.example.pl"),
    });
    expect(alt).toEqual({
      canonical: "https://quant.example.pl/en/learn",
      languages: {
        pl: "https://quant.example.pl/pl/nauka",
        en: "https://quant.example.pl/en/learn",
        "x-default": "https://quant.example.pl/pl/nauka",
      },
    });
  });
});
