import { describe, expect, it } from "vitest";

import { videoSource } from "./video-source";

describe("videoSource", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("YouTube %s → nocookie embed", (url) => {
    expect(videoSource(url)).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
    });
  });

  it("TikTok → embed player", () => {
    expect(videoSource("https://www.tiktok.com/@kanal/video/7300000000000000000")).toMatchObject({
      platform: "tiktok",
      embedUrl: "https://www.tiktok.com/embed/v2/7300000000000000000",
    });
  });

  it.each([
    "not a url",
    "https://vimeo.com/123",
    "https://youtube.com/watch?v=short",
    "javascript:alert(1)",
  ])("%s is not embedded", (url) => {
    expect(videoSource(url)).toBeNull();
  });
});
