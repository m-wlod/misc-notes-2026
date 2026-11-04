// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
  identify: vi.fn(),
  get_property: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: ph }));
vi.mock("next/navigation", () => ({ usePathname: () => "/pl" }));

const { AnalyticsBoot } = await import("./boot");
const { __resetForTests, track } = await import("./client");
const { saveConsent } = await import("@/features/consent/use-consent");

/** Phase 22b: PostHog starts only with a key and consent, and stops when it's withdrawn. */
describe("AnalyticsBoot", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetForTests();
    for (const fn of Object.values(ph)) fn.mockClear();
  });
  const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

  it("without consent nothing loads, whatever happens on the page", async () => {
    render(<AnalyticsBoot posthogKey="phc_test" host="https://eu.i.posthog.com" />);
    track("lesson_completed", { lesson_id: "l1" });
    await flush();
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("without a key nothing loads, even with consent", async () => {
    saveConsent({ analytics: true });
    render(<AnalyticsBoot posthogKey={null} host="https://eu.i.posthog.com" />);
    await flush();
    expect(ph.init).not.toHaveBeenCalled();
  });

  it("consent starts it (EU host, no cookies, no autocapture), with the queued events", async () => {
    render(<AnalyticsBoot posthogKey="phc_test" host="https://eu.i.posthog.com" />);
    track("video_landing_viewed", { slug: "kelly" });
    await act(async () => {
      saveConsent({ analytics: true });
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(ph.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        persistence: "localStorage",
        autocapture: false,
        disable_session_recording: true,
      }),
    );
    const events = ph.capture.mock.calls.map((c) => c[0] as string);
    expect(events).toContain("video_landing_viewed");
    expect(events).toContain("$pageview");
  });

  it("withdrawing consent stops capturing and forgets the browser", async () => {
    saveConsent({ analytics: true });
    render(<AnalyticsBoot posthogKey="phc_test" host="https://eu.i.posthog.com" />);
    await flush();
    expect(ph.init).toHaveBeenCalled();
    await act(async () => {
      saveConsent({ analytics: false });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ph.opt_out_capturing).toHaveBeenCalled();
    expect(ph.reset).toHaveBeenCalled();
  });
});
