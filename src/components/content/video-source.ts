/**
 * Embeddable video sources. YouTube plays from youtube-nocookie.com; TikTok from its
 * embed player. Anything else is shown as a plain link. Pure, so it is unit-tested.
 */
export type VideoSource = { platform: "youtube" | "tiktok"; id: string; embedUrl: string };

const YT_ID = /^[\w-]{11}$/;

export function videoSource(url: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | undefined;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id =
      u.searchParams.get("v") ??
      /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname)?.[1] ??
      undefined;
  }
  if (id && YT_ID.test(id)) {
    return {
      platform: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
    };
  }
  if (host === "tiktok.com") {
    const tid = /\/video\/(\d{8,25})/.exec(u.pathname)?.[1];
    if (tid)
      return { platform: "tiktok", id: tid, embedUrl: `https://www.tiktok.com/embed/v2/${tid}` };
  }
  return null;
}
