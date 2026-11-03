import { describe, expect, it } from "vitest";

import { validateVideos, type VideoRef } from "./validate";

const known = {
  sims: new Set(["kelly"]),
  exercises: new Set(["a", "b", "c"]),
  lessons: new Set(["ev"]),
  debunk: new Set(["guru"]),
};
const ok: VideoRef = {
  id: "kelly-half",
  slug: "kelly",
  file: "content/videos/kelly-half.yaml",
  urls: { youtube: "https://youtu.be/abcdefghijk" },
  formula: String.raw`f^{*} = p - \frac{1-p}{b}`,
  simulation: "kelly",
  exercises: ["a", "b", "c"],
  nextLesson: "ev",
  debunk: "guru",
};

describe("video landing pages", () => {
  it("a complete file passes", () => {
    expect(validateVideos([ok], known)).toEqual([]);
  });

  it("names every broken reference, with file and field", () => {
    const errors = validateVideos(
      [
        {
          ...ok,
          urls: { tiktok: "https://youtu.be/abcdefghijk" },
          formula: String.raw`\frac{1`,
          simulation: "nope",
          exercises: ["a", "a", "zzz"],
          nextLesson: "gone",
          debunk: "missing",
        },
      ],
      known,
    );
    const f = "content/videos/kelly-half.yaml";
    expect(errors).toContain(`${f}: urls.tiktok: not a tiktok video link`);
    expect(errors.some((e) => e.startsWith(`${f}: formula: `))).toBe(true);
    expect(errors).toContain(`${f}: simulation: no simulation "nope"`);
    expect(errors).toContain(`${f}: exercises: ids repeat`);
    expect(errors).toContain(`${f}: exercises: no exercise "zzz"`);
    expect(errors).toContain(`${f}: nextLesson: no lesson "gone"`);
    expect(errors).toContain(`${f}: debunk: no debunk entry "missing"`);
  });

  it("needs a link, exactly three exercises, and unique ids and slugs", () => {
    const errors = validateVideos(
      [
        { ...ok, urls: {}, exercises: ["a", "b"] },
        { ...ok, file: "content/videos/copy.yaml" },
      ],
      known,
    );
    expect(errors).toContain(`${ok.file}: urls: give a tiktok or youtube link`);
    expect(errors).toContain(`${ok.file}: exercises: list exactly 3 exercise ids`);
    expect(errors).toContain(
      `content/videos/copy.yaml: id: "kelly-half" is already used by ${ok.file}`,
    );
    expect(errors).toContain(
      `content/videos/copy.yaml: slug: "kelly" is already used by ${ok.file}`,
    );
  });
});
