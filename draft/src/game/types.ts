import type { Phase } from "../../../wcdraft/src/cricsheet/match.ts";
import type { BattingArchetype, BowlingArchetype, StyleOut, Tier } from "../../../wcdraft/src/ratings/model.ts";
import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import type { TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { MatchPlan } from "./simulate.ts";

/** A batter's number against one bowling class. */
export interface VsClass {
  n: number;
  balls: number;
  /** Under 60 balls even with ODIs: the batter's level and hand, not his own record against the class. */
  estimated: boolean;
  /** T20 balls fell short, so ODIs were used. */
  odi: boolean;
}

/** One line of a slim per-edition pool file (written by scripts/sync-data.mjs). */
export interface PoolPlayer {
  id: string;
  name: string;
  team: string;
  editionId: string;
  standIn: boolean;
  tier: Tier;
  tierScore: number;
  role: "batter" | "bowler" | "all-rounder" | "unknown";
  archetype: { batting: BattingArchetype | null; bowling: BowlingArchetype | null };
  /** How the player bats: tempo against peers, null with too few balls anywhere. */
  style: StyleOut | null;
  /** Balls from after this World Cup behind a projected number; 0 when the number is not projected. */
  batProjected: number;
  bowlProjected: number;
  bat: number;
  bowl: number;
  batPhases: Record<Phase, number>;
  bowlPhases: Record<Phase, number>;
  /** Share of his overs in each phase (form window and tournament), as the engine's allocation reads it; null when he has bowled none. */
  bowlShares?: Record<Phase, number> | null;
  batLow: boolean;
  bowlLow: boolean;
  /** Whether the card shows the skill at all (false for a batter who rarely bowls, and vice versa). */
  batShown: boolean;
  bowlShown: boolean;
  domesticBalls: { bat: number; bowl: number };
  /** Phase weights behind the headline batting number (the overs he actually batted in); see game/slots.ts. */
  batWeights: Record<Phase, number>;
  /** Batting number against pace and against spin; null only when the card hides his batting. */
  vsPace: VsClass | null;
  vsSpin: VsClass | null;
  squadPlayer: boolean;
  position: number | null;
  positionless: boolean;
  hand: string | null;
  bowlingType: string | null;
  keeper: boolean;
}

export type SlotKind = "opener" | "top" | "middle" | "lower" | "tail";

export interface Slot {
  index: number;
  kind: SlotKind;
  label: string;
}

/** The lineup is eleven batting positions (decided 2026-10-27): 2 openers, 2 top, 2 middle, 3 lower, 2 tail. */
export const SLOTS: Slot[] = [
  { index: 0, kind: "opener", label: "Opener" },
  { index: 1, kind: "opener", label: "Opener" },
  { index: 2, kind: "top", label: "No. 3" },
  { index: 3, kind: "top", label: "No. 4" },
  { index: 4, kind: "middle", label: "No. 5" },
  { index: 5, kind: "middle", label: "No. 6" },
  { index: 6, kind: "lower", label: "No. 7" },
  { index: 7, kind: "lower", label: "No. 8" },
  { index: 8, kind: "lower", label: "No. 9" },
  { index: 9, kind: "tail", label: "No. 10" },
  { index: 10, kind: "tail", label: "No. 11" },
];

export interface Identity {
  team: string;
  editionId: string;
  standIn: boolean;
}

export interface Spin {
  team: string;
  editionId: string;
  players: PoolPlayer[];
}

export type Step = "home" | "identity" | "coach" | "draft" | "lineup" | "simulating" | "result";

export interface RunState {
  seed: string;
  step: Step;
  identity: Identity | null;
  identityRerolls: number;
  coachPanel: CoachOut[];
  coach: CoachOut | null;
  coachRerolls: number;
  spin: Spin | null;
  spinNumber: number;
  spinRerolls: number;
  /** Squads already spun in this draft (`${editionId}|${team}`), rerolled-away ones too, so none comes round twice. */
  spun: string[];
  picks: (PoolPlayer | null)[];
  captainId: string | null;
  /** The between-match lever: a plan for the side's nth match holds from that match onward. */
  plans: (MatchPlan | undefined)[];
  /** Line-up moves left (2026-11-03): each swap of two batting positions costs one, on the lineup screen or before a match. */
  movesLeft: number;
  result: TournamentResult | null;
  error: string | null;
  /** For a run opened from a shared link: the engine version that played it (0 before links carried one); null for the user's own run. */
  linkEngine: number | null;
}

/**
 * What a run allows. Kept in one place so the difficulty settings Yash plans can set them (with
 * limits on Elite and Gold picks to come): rerolls of the side, the coach panel and the squad
 * spins, and line-up moves, one swap of two batting positions each, spent on the lineup screen or
 * before any match (2026-11-03).
 */
export const BUDGET = { identityRerolls: 1, coachRerolls: 1, spinRerolls: 2, coachPanel: 3, lineupMoves: 3 } as const;
