/**
 * Sound-effect loader + player.
 *
 * iOS Safari (and to a lesser extent mobile Chrome) blocks audio that
 * isn't initiated by a user gesture. The first call to playSfx() after
 * the user has tapped will initialize the audio pool — until then,
 * playSfx() is a no-op.
 *
 * Sound files live under client/public/sfx/. If a file is missing the
 * audio element 404s on .play() — we catch the rejection and silently
 * skip, so the game keeps working even before sounds are sourced.
 *
 * Settings: respects sfxEnabled from settings.ts.
 */

import { getSettings } from "./settings.ts";

/** Canonical SFX names. Keep in sync with docs/sfx-sources.md. */
export type SfxName =
  | "bat-thwack-light"
  | "bat-thwack-heavy"
  | "stumps-shatter"
  | "glove-catch"
  | "crowd-cheer"
  | "crowd-gasp"
  | "umpire-whistle"
  | "card-flip"
  | "timer-tick"
  | "match-end-sting";

const SFX_PATHS: Record<SfxName, string> = {
  "bat-thwack-light": "/sfx/bat-thwack-light.webm",
  "bat-thwack-heavy": "/sfx/bat-thwack-heavy.webm",
  "stumps-shatter": "/sfx/stumps-shatter.webm",
  "glove-catch": "/sfx/glove-catch.webm",
  "crowd-cheer": "/sfx/crowd-cheer.webm",
  "crowd-gasp": "/sfx/crowd-gasp.webm",
  "umpire-whistle": "/sfx/umpire-whistle.webm",
  "card-flip": "/sfx/card-flip.webm",
  "timer-tick": "/sfx/timer-tick.webm",
  "match-end-sting": "/sfx/match-end-sting.webm",
};

const pool = new Map<SfxName, HTMLAudioElement>();
let initialized = false;

/** Eagerly create + preload Audio objects for every SFX. Safe to call
 *  multiple times — only the first call does work. */
export function initSfx(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  for (const name of Object.keys(SFX_PATHS) as SfxName[]) {
    const audio = new Audio(SFX_PATHS[name]);
    audio.preload = "auto";
    pool.set(name, audio);
  }
  initialized = true;
}

/** Play a sound effect. Silently skipped when sfx are disabled or
 *  uninitialized, or when the file is missing. */
export function playSfx(name: SfxName): void {
  if (!getSettings().sfxEnabled) return;
  if (!initialized) return;
  const audio = pool.get(name);
  if (!audio) return;
  // Reset playhead so rapid repeat plays restart from 0.
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {
      /* file missing or autoplay blocked — silently skip */
    });
  } catch {
    /* ignore */
  }
}

/** Play one of several sounds at random. Useful for variation
 *  (e.g. multiple bat-thwack samples to avoid the same clip every time). */
export function playSfxRandom(...names: SfxName[]): void {
  if (names.length === 0) return;
  playSfx(names[Math.floor(Math.random() * names.length)]!);
}
