/**
 * v1 game constants. Keep these in shared/ so client and server agree on numbers.
 */

export const HAND_SIZE = 4 as const;

/**
 * Match formats. Each format is N overs per innings (T1 = 1 over, T3 = 3, etc).
 * Engine code that needs balls/wickets/deck-size should read these from
 * MATCH_FORMATS[match.format] rather than a top-level constant.
 */
export type MatchFormat = "T1" | "T3";

export interface FormatConfig {
  /** Display label ("1 over", "3 overs"). */
  label: string;
  /** Short blurb shown in the format picker. */
  blurb: string;
  oversPerInnings: number;
  /** Convenience: oversPerInnings * 6. */
  ballsPerInnings: number;
  wicketsPerInnings: number;
  /** Total cards in each per-role deck (player cards + situations). */
  deckSize: number;
  /** Cards per tier in each per-role deck (sums to deckSize - situationCount). */
  tierDistribution: Record<"Elite" | "Gold" | "Silver" | "Bronze", number>;
  situationCount: number;
}

export const MATCH_FORMATS: Record<MatchFormat, FormatConfig> = {
  T1: {
    label: "T1 — 1 over",
    blurb: "Lightning. 6 balls, 2 wickets, blink-and-it's-done.",
    oversPerInnings: 1,
    ballsPerInnings: 6,
    wicketsPerInnings: 2,
    deckSize: 20,
    // 2+3+7+3 = 15 player cards + 5 situations = 20.
    // Single-nation Silver pool is only 3, so the buildDeck fallback pulls
    // 4 more Silvers from the associate pool. See server/src/innings.ts.
    tierDistribution: { Elite: 2, Gold: 3, Silver: 7, Bronze: 3 },
    situationCount: 5,
  },
  T3: {
    label: "T3 — 3 overs",
    blurb: "Room for a real innings: partnerships, comeback wickets, finisher.",
    oversPerInnings: 3,
    ballsPerInnings: 18,
    wicketsPerInnings: 5,
    deckSize: 26,
    // 2+3+8+7 = 20 player cards + 6 situations = 26.
    // Each Test nation has E2/G3/S3/B5 per role. Silver pulls from own (3)
    // + associate pool (8) = 11 candidates for 8 slots. Bronze pulls from
    // own (5) + needs 2 from other Test nations' Bronze. See buildDeck
    // fallback in server/src/innings.ts — it already handles arbitrary
    // tier shortfalls.
    tierDistribution: { Elite: 2, Gold: 3, Silver: 8, Bronze: 7 },
    situationCount: 6,
  },
};

/** Default format when not specified (back-compat for older clients). */
export const DEFAULT_MATCH_FORMAT: MatchFormat = "T1";

export const TURN_TIMER_SECONDS = 30 as const;
export const DRAFT_ROUND_TIMER_SECONDS = 15 as const;

// Coin toss
export const COIN_TOSS_COUNTDOWN_SECONDS = 10 as const;
export const COIN_TOSS_CALL_TIMER_SECONDS = 30 as const;
export const COIN_TOSS_CHOOSE_TIMER_SECONDS = 30 as const;
export const COIN_TOSS_FLIP_VISUAL_MS = 1500 as const;

// Mid-ball swap pick (Mankad / Retired Out / Cramps)
export const SWAP_PICK_TIMER_SECONDS = 15 as const;

// Pause between ball:reveal and the start of the next ball — gives players
// time to read the resolution trail before timer pressure resumes.
export const POST_BALL_PAUSE_SECONDS = 10 as const;

// Draft round structure: 2 Elite + 3 Gold + 5 Silver + 10 Bronze = 20 picks
export const DRAFT_ROUNDS_BY_TIER = {
  Elite: 2,
  Gold: 3,
  Silver: 5,
  Bronze: 10,
} as const;

export const DRAFT_OPTIONS_PER_ROUND = 4 as const;
export const DRAFT_SITUATION_INJECTION_COUNT = 5 as const;

export const REVIEW_APPEAL_WICKET_CHANCE = 0.4 as const;

/**
 * Wide-outside-off mechanic: if the bowler delivers Wide outside off and the
 * outcome is a dot ball, there's a tier-based chance the umpire calls it
 * wide — better bowlers are more accurate and less likely to be called.
 * Triggers an extra run + a re-bowled delivery (ball doesn't count).
 */
export const WIDE_CHANCE_BY_TIER = {
  Elite: 0.05,
  Gold: 0.15,
  Silver: 0.25,
  Bronze: 0.4,
} as const;

/** Free runs awarded for a No Ball or Wide call. */
export const EXTRAS_RUNS = 1 as const;
