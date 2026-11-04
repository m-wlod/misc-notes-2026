import { describe, expect, expectTypeOf, it } from "vitest";

import { ALLOWED_PROPERTIES, type Events } from "./events";

/** Phase 22b: events carry no personal data. A new property must be added on purpose. */
describe("analytics events", () => {
  it("no property could identify a person", () => {
    // Whole name parts ("context" is fine, "user_email" is not).
    const forbidden = /(^|_)(e?mail|name|handle|ip|phone|answer|text|body|address|token)($|_)/i;
    expect(ALLOWED_PROPERTIES.filter((p) => forbidden.test(p))).toEqual([]);
  });

  it("every event uses allowed properties only", () => {
    type Keys = { [E in keyof Events]: keyof Events[E] }[keyof Events];
    expectTypeOf<Keys>().toExtend<(typeof ALLOWED_PROPERTIES)[number]>();
  });
});
