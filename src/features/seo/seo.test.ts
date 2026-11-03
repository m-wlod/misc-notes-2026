import { describe, expect, it } from "vitest";

import { polyline, seedOf, series } from "./chart";
import { faqPage, learningResource, organization, plainText, quiz, serialize } from "./jsonld";
import { ogMeta, ogUrl } from "./og";

describe("preview charts", () => {
  it("are deterministic per page and differ between pages", () => {
    expect(series("gbm", seedOf("lesson:gbm"))).toEqual(series("gbm", seedOf("lesson:gbm")));
    expect(series("gbm", seedOf("lesson:a"))).not.toEqual(series("gbm", seedOf("lesson:b")));
  });

  it("draw the models they claim", () => {
    const walk = series("walk", 1, 50);
    expect(walk[0]).toBe(0);
    for (let i = 1; i < walk.length; i++) {
      expect(Math.abs((walk[i] ?? 0) - (walk[i - 1] ?? 0))).toBe(1);
    }
    const kelly = series("kelly", 2, 50);
    expect(kelly[0]).toBe(100);
    // Even-money bets at f* = 10%: wealth moves by ×1.1 or ×0.9 each step.
    for (let i = 1; i < kelly.length; i++) {
      const r = (kelly[i] ?? 0) / (kelly[i - 1] ?? 1);
      expect([1.1, 0.9].some((x) => Math.abs(r - x) < 1e-12)).toBe(true);
    }
    const gbm = series("gbm", 3, 252);
    expect(gbm[0]).toBe(100);
    expect(gbm.every((v) => v > 0)).toBe(true);
  });

  it("fit the box", () => {
    const pts = polyline([5, 10, 0], 100, 50)
      .split(" ")
      .map((p) => p.split(",").map(Number));
    expect(pts).toEqual([
      [0, 25],
      [50, 0],
      [100, 50],
    ]);
    expect(polyline([3, 3], 10, 10)).toBe("0.0,10.0 10.0,10.0");
  });
});

describe("structured data", () => {
  const provider = organization("Site", "https://example.test/", "About");

  it("escapes anything that could end the script tag", () => {
    const out = serialize({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("a lesson is a free LearningResource inside its course", () => {
    expect(
      learningResource({
        name: "Kelly",
        description: "d",
        url: "https://example.test/pl/l",
        locale: "pl",
        level: 3,
        minutes: 14.6,
        course: { name: "EV", url: "https://example.test/pl/t" },
        provider,
      }),
    ).toMatchObject({
      "@type": "LearningResource",
      inLanguage: "pl-PL",
      educationalLevel: "3/5",
      timeRequired: "PT15M",
      isAccessibleForFree: true,
      isPartOf: { "@type": "Course", name: "EV" },
    });
  });

  it("a quiz lists questions as plain text, never answers", () => {
    const q = quiz({
      name: "Kelly",
      url: "https://example.test/pl/v/kelly",
      locale: "en",
      questions: [
        plainText(
          '<p>Ile to <span class="katex"><math><annotation encoding="application/x-tex">2+2</annotation></math>4</span>&nbsp;?</p>',
        ),
      ],
    });
    expect(q.hasPart).toEqual([{ "@type": "Question", name: "Ile to 4 ?" }]);
    expect(JSON.stringify(q)).not.toMatch(/acceptedAnswer|suggestedAnswer/);
  });

  it("a debunk entry is an FAQ: the claim and the verdict", () => {
    expect(
      faqPage({ url: "u", locale: "pl", question: "90% to zysk", answer: "Fałsz. Bo…" }).mainEntity,
    ).toEqual([
      {
        "@type": "Question",
        name: "90% to zysk",
        acceptedAnswer: { "@type": "Answer", text: "Fałsz. Bo…" },
      },
    ]);
  });
});

describe("link previews", () => {
  it("point at the image route in the page's language", () => {
    expect(ogUrl("lesson", "kelly-criterion", "en")).toBe(
      "/api/og?kind=lesson&id=kelly-criterion&lang=en",
    );
    const m = ogMeta({ kind: "video", id: "kelly", locale: "pl", title: "T" });
    expect(m.openGraph).toMatchObject({
      locale: "pl_PL",
      images: [{ url: "/api/og?kind=video&id=kelly&lang=pl", width: 1200, height: 630 }],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
