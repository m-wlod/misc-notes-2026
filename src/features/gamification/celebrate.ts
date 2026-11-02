import type { Rewards } from "./server/award";

/**
 * Hands rewards from a server action to the celebration toast in the app shell
 * (Phase 14), whichever component or module got them. Nothing happens for null (signed
 * out, or the reward was already given) or for an award worth nothing new.
 */
export const CELEBRATE_EVENT = "qla:celebrate";

export function worthCelebrating(r: Rewards | null | undefined): r is Rewards {
  return !!r && (r.xp > 0 || r.goalMet || r.repaired || r.achievements.length > 0);
}

export function celebrate(rewards: Rewards | null | undefined): void {
  if (typeof window === "undefined" || !worthCelebrating(rewards)) return;
  window.dispatchEvent(new CustomEvent<Rewards>(CELEBRATE_EVENT, { detail: rewards }));
}

export const SOUND_KEY = "qla:sound:v1";

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

/** A short two-note chime (WebAudio, no file to load). Quiet, under half a second. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext as typeof AudioContext | undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // no audio: the toast is enough
  }
}
