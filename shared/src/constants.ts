/**
 * v1 game constants. Keep these in shared/ so client and server agree on numbers.
 */

export const HAND_SIZE = 4 as const;
export const DECK_SIZE = 20 as const;
export const MAX_BALLS_PER_INNINGS = 6 as const;
export const MAX_WICKETS_PER_INNINGS = 2 as const;

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
export const POST_BALL_PAUSE_SECONDS = 15 as const;

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
