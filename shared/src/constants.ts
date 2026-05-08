/**
 * v1 game constants. Keep these in shared/ so client and server agree on numbers.
 */

export const HAND_SIZE = 4 as const;
export const DECK_SIZE = 20 as const;
export const MAX_BALLS_PER_INNINGS = 6 as const;
export const MAX_WICKETS_PER_INNINGS = 2 as const;

export const TURN_TIMER_SECONDS = 30 as const;
export const DRAFT_ROUND_TIMER_SECONDS = 15 as const;

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
