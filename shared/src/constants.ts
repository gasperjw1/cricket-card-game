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
    // 2+3+10+9 = 24 player cards + 6 situations = 30.
    //
    // DECK-SIZE MARGIN: an innings is 18 balls, and every ball consumes
    // ≥1 mandatory card. Mankad / Retired Out / Cramps burn TWO mandatory
    // cards in one ball (original + replacement). With bots playing sits
    // ~30% of the time, expected ~1-2 swap events per innings → up to
    // 20 mandatories needed in the worst case. 24 player cards = 4-card
    // safety margin so the deck never runs dry late, even with bad luck.
    //
    // Tier supply per Test nation: E2/G3/S3/B5 per role. Silver bumped
    // to 10 (own 3 + associate pool of 8 = 11 candidates). Bronze bumped
    // to 9 (own 5 + 4 cross-nation via the existing fallback in
    // server/src/innings.ts buildDeck).
    deckSize: 30,
    tierDistribution: { Elite: 2, Gold: 3, Silver: 10, Bronze: 9 },
    situationCount: 6,
  },
};

/** Default format when not specified (back-compat for older clients). */
export const DEFAULT_MATCH_FORMAT: MatchFormat = "T1";

/**
 * Map a ball number (1..ballsPerInnings) to its match phase.
 *
 * T1 (6 balls):    balls 1-2 Powerplay · 3-4 Middle · 5-6 Death
 * T3 (18 balls):   over 1 (1-6) Powerplay · over 2 (7-12) Middle · over 3 (13-18) Death
 * T5 (30 balls):   overs 1-2 (1-12) Powerplay · overs 3-4 (13-24) Middle · over 5 (25-30) Death
 *
 * Drives the in-phase / out-of-phase engine rolls — a batter's role
 * (top-order / middle-order / finisher) maps to a phase (powerplay /
 * middle / death) and gets a bonus when this function returns that phase.
 */
export function phaseForBall(
  format: MatchFormat,
  ballNumber: number,
): "powerplay" | "middle" | "death" {
  // Clamp defensively — out-of-range numbers just bucket into the last phase.
  const safeBall = Math.max(1, ballNumber);
  switch (format) {
    case "T1": {
      if (safeBall <= 2) return "powerplay";
      if (safeBall <= 4) return "middle";
      return "death";
    }
    case "T3": {
      if (safeBall <= 6) return "powerplay";
      if (safeBall <= 12) return "middle";
      return "death";
    }
  }
}

/** Map a card role to the match phase it prefers (and vice versa via reverse
 *  lookup at the call site). Centralized so the role naming + phase naming
 *  stay in lockstep. */
export const BATTER_ROLE_TO_PHASE: Record<
  "top-order" | "middle-order" | "finisher",
  "powerplay" | "middle" | "death"
> = {
  "top-order": "powerplay",
  "middle-order": "middle",
  finisher: "death",
};

export const BOWLER_ROLE_TO_PHASE: Record<
  "powerplay" | "middle-overs" | "death-overs",
  "powerplay" | "middle" | "death"
> = {
  powerplay: "powerplay",
  "middle-overs": "middle",
  "death-overs": "death",
};

/** Human labels for UI display. */
export const PHASE_LABEL: Record<"powerplay" | "middle" | "death", string> = {
  powerplay: "Powerplay",
  middle: "Middle Overs",
  death: "Death Overs",
};

// ─────────────────────────── Engine perk probabilities ───────────────────────────
// These knobs tune the new role-system perks. Keep them grouped so balance
// tweaks are easy. All in [0,1].

/** Per-roll chance a non-run-out wicket triggers a lucky escape (bails staying
 *  on, umpire turning down LBW, catch dropped, inside edge on stumping).
 *  What actually happens depends on the dismissal category — see resolve-ball.ts
 *  buildLuckyEscape(). Equivalent to the old WICKET_SAVE_2_BYE + WICKET_SAVE_4_BYE
 *  combined (0.30 total). */
export const LUCKY_ESCAPE_CHANCE = 0.30 as const;

/** When the batter is OUT of their preferred phase, this is the chance
 *  a scoring shot becomes a dot. */
export const BATTER_OUT_OF_PHASE_DOT_CHANCE = 0.25 as const;

/** Chance a neutral run (1 or 2) becomes a run-out wicket. Bowler perk. */
export const BOWLER_NEUTRAL_RUNOUT_CHANCE = 0.10 as const;

/** Extra wide-call chance ADDED to the existing tier-based wide chance when
 *  the bowler is bowling on leg stump or outside off and out of phase. */
export const BOWLER_OUT_OF_PHASE_WIDE_BUMP = 0.20 as const;

/** When the batter IS in their preferred phase, chance a scoring shot
 *  ticks up one tier (1→2, 2→4, 4→6). Symmetric to the OOP penalty. */
export const BATTER_IN_PHASE_UPGRADE_CHANCE = 0.10 as const;

/** When the bowler IS in their preferred phase, chance a dot becomes a
 *  wicket (yorker / new-ball nip / death-overs slower-ball deception). */
export const BOWLER_IN_PHASE_WICKET_CHANCE = 0.10 as const;


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
