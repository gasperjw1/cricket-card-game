/**
 * Persistent user settings (localStorage-backed).
 *
 * Settings are loaded synchronously at module-import time so the UI can
 * read them without an async hop. Mutations write through to localStorage
 * immediately.
 *
 * Schema is versioned via SETTINGS_VERSION — bump the number whenever
 * the shape changes so old keys are discarded cleanly.
 */

const SETTINGS_KEY = "swipe-sixer-settings-v1";

export type CommentaryStyle = "classic" | "modern" | "off";
export type StorySpeed = "slow" | "normal" | "fast";

export interface UserSettings {
  sfxEnabled: boolean;
  commentaryStyle: CommentaryStyle;
  storySpeed: StorySpeed;
}

const DEFAULTS: UserSettings = {
  sfxEnabled: true,
  commentaryStyle: "classic",
  storySpeed: "normal",
};

function load(): UserSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

let current: UserSettings = load();

const listeners = new Set<(s: UserSettings) => void>();

export function getSettings(): UserSettings {
  return current;
}

export function setSettings(patch: Partial<UserSettings>): UserSettings {
  current = { ...current, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
    } catch {
      /* quota / private mode — silently ignore */
    }
  }
  for (const fn of listeners) fn(current);
  return current;
}

export function subscribeSettings(fn: (s: UserSettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
