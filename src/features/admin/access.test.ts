import { describe, expect, it } from "vitest";

import { canAccess, NAV, SECTIONS, sectionFor, sectionPath } from "./access";

describe("admin access map", () => {
  it("maps paths to sections in both locales, denying unknown ones by default", () => {
    expect(sectionFor("/pl/admin")).toBe("dashboard");
    expect(sectionFor("/en/admin/")).toBe("dashboard");
    expect(sectionFor("/pl/admin/community")).toBe("community");
    expect(sectionFor("/en/admin/uzytkownicy/abc")).toBe("users");
    expect(sectionFor("/pl/admin/nie-ma-takiej")).toBe("dashboard");
    expect(sectionFor("/api/admin/users/x/export")).toBe("users");
    expect(sectionFor("/api/admin/whatever")).toBe("dashboard");
    expect(sectionFor("/pl/administracja")).toBeNull();
    expect(sectionFor("/api/administrator")).toBeNull();
    expect(sectionFor("/pl/admin?x=1")).toBe("dashboard");
    expect(sectionFor("/pl/nauka/admin")).toBeNull();
    expect(sectionFor("/api/me/export")).toBeNull();
  });

  it("admins open everything; moderators the queues and content; reviewers content only", () => {
    for (const s of NAV) expect(canAccess(["admin"], s)).toBe(true);
    for (const s of NAV) expect(canAccess([], s)).toBe(false);
    expect(canAccess(["moderator"], "community")).toBe(true);
    expect(canAccess(["moderator"], "disputes")).toBe(true);
    expect(canAccess(["moderator"], "content")).toBe(true);
    expect(canAccess(["moderator"], "users")).toBe(false);
    expect(canAccess(["moderator"], "dashboard")).toBe(false);
    expect(canAccess(["reviewer"], "exercises")).toBe(true);
    expect(canAccess(["reviewer"], "debunk")).toBe(false);
    expect(canAccess(["reviewer"], "ai")).toBe(false);
  });

  it("every section has a distinct path that maps back to it", () => {
    const paths = NAV.map(sectionPath);
    expect(new Set(paths).size).toBe(NAV.length);
    for (const s of NAV) expect(sectionFor(`/pl${sectionPath(s)}`)).toBe(s);
    expect(Object.keys(SECTIONS).sort()).toEqual([...NAV].sort());
  });
});
