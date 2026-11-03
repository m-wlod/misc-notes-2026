import { describe, expect, it } from "vitest";

import { filterSocial, uncovered } from "@/features/admin/social";

import {
  confirmEmail,
  isConfirmToken,
  pickOfWeek,
  signSubscriber,
  unsubscribeQuery,
  verifySubscriber,
  weekIndex,
  weeklyEmail,
} from "./core";

describe("newsletter tokens", () => {
  it("a signed subscriber id verifies; anything else doesn't", () => {
    const s = signSubscriber("secret", 42);
    expect(verifySubscriber("secret", "42", s)).toBe(42);
    expect(verifySubscriber("other", "42", s)).toBeNull();
    expect(verifySubscriber("secret", "43", s)).toBeNull();
    expect(verifySubscriber(undefined, "42", s)).toBeNull();
    expect(verifySubscriber("secret", "042", s)).toBeNull();
    expect(verifySubscriber("secret", "42", `${s}x`)).toBeNull();
    expect(new URLSearchParams(unsubscribeQuery("secret", 42)).get("i")).toBe("42");
  });

  it("confirmation tokens are UUIDs", () => {
    expect(isConfirmToken("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isConfirmToken("3f2504e0")).toBe(false);
    expect(isConfirmToken(undefined)).toBe(false);
  });
});

describe("the week's picks", () => {
  const items = [{ id: "c" }, { id: "a" }, { id: "b" }];

  it("count weeks from Monday 5 January 2026", () => {
    expect(weekIndex("2026-01-05")).toBe(0);
    expect(weekIndex("2026-01-12")).toBe(1);
    expect(weekIndex("2026-11-02")).toBe(43);
  });

  it("rotate through everything before repeating, the same all week", () => {
    const weeks = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"];
    expect(weeks.map((w) => pickOfWeek(items, w)?.id)).toEqual(["a", "b", "c", "a"]);
    expect(pickOfWeek(items, "2026-01-05")).toEqual(pickOfWeek([...items].reverse(), "2026-01-05"));
    expect(pickOfWeek([], "2026-01-05")).toBeNull();
    expect(pickOfWeek(items, "2025-12-29")?.id).toBe("c");
  });
});

describe("newsletter emails", () => {
  it("the confirmation is a one-off: no unsubscribe link or headers", () => {
    const e = confirmEmail(
      "a@b.pl",
      { subject: "S", lines: ["L1"], cta: "Potwierdź", footer: "F" },
      "https://x/pl/newsletter/potwierdz?t=1",
    );
    expect(e.headers).toEqual({});
    expect(e.text).toContain("Potwierdź: https://x/pl/newsletter/potwierdz?t=1");
    expect(e.html).not.toContain("Wypisz");
  });

  it("the weekly issue has the problem, the entry and one-click unsubscribe", () => {
    const e = weeklyEmail({
      to: "a@b.pl",
      words: {
        subject: "S",
        intro: "I",
        problem: "Problem tygodnia",
        debunk: "Debunk Lab",
        cta: "Rozwiąż",
        footer: "F",
        unsubscribe: "Wypisz się",
      },
      problem: { text: "Ile to 2+2?", url: "https://x/p" },
      debunk: { claim: "90% <b>to</b> zysk", url: "https://x/d" },
      homeUrl: "https://x/",
      unsubscribe: { page: "https://x/u", post: "https://x/api/u" },
    });
    expect(e.text).toContain("Problem tygodnia: Ile to 2+2?");
    expect(e.text).toContain("Wypisz się: https://x/u");
    expect(e.html).toContain("90% &lt;b&gt;to&lt;/b&gt; zysk");
    expect(e.headers).toEqual({
      "List-Unsubscribe": "<https://x/api/u>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

describe("video calendar", () => {
  const rows = uncovered({
    lessons: [
      { id: "ev", title: "EV", status: "draft", simulationPath: "/pl/laboratorium/symulacje/ev" },
      { id: "kelly", title: "Kelly", status: "published", simulationPath: null },
      { id: "var", title: "Var", status: "review", simulationPath: null },
    ],
    debunk: [
      { id: "d1", claim: "C1", status: "draft", path: "/pl/debunk/d1", hasVideo: false },
      { id: "d2", claim: "C2", status: "draft", path: "/pl/debunk/d2", hasVideo: true },
      { id: "d3", claim: "C3", status: "draft", path: "/pl/debunk/d3", hasVideo: false },
    ],
    videos: [{ nextLesson: "kelly", debunk: "d3" }],
  });

  it("lists what no video covers, with where to record it", () => {
    expect(rows.map((r) => [r.kind, r.id, r.recording])).toEqual([
      ["lesson", "ev", "/pl/laboratorium/symulacje/ev?nagranie=1"],
      ["lesson", "var", null],
      ["debunk", "d1", "/pl/debunk/d1?nagranie=1"],
    ]);
  });

  it("filters by type and status", () => {
    expect(filterSocial(rows, { kind: "debunk" }).map((r) => r.id)).toEqual(["d1"]);
    expect(filterSocial(rows, { status: "review" }).map((r) => r.id)).toEqual(["var"]);
  });
});
