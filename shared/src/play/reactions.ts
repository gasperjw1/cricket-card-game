/**
 * /play table reactions — pure helpers shared by the server (validation) and
 * the client (reaction bar), so the emoji allowlist can't drift between them.
 * No Node/React/DOM dependencies.
 */

export const REACTION_EMOJIS = ["😂", "🔥", "😱", "👏", "🙄", "💀", "🎉", "😈"] as const;

export type ReactionKind = "emoji" | "gif";

/** Per-user sliding window: at most `max` reactions in any `windowMs` span. */
export const REACTION_LIMIT = { max: 5, windowMs: 10_000 } as const;

export function isAllowedEmoji(value: unknown): value is (typeof REACTION_EMOJIS)[number] {
  return typeof value === "string" && (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** Only https URLs on Tenor's own CDN — the GIF search proxy hands these out. */
export function isAllowedGifUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 300) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && (u.hostname === "tenor.com" || u.hostname.endsWith(".tenor.com"));
  } catch {
    return false;
  }
}
