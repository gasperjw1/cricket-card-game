import type { Phase } from "../../../wcdraft/src/cricsheet/match.ts";
import type { BattingArchetype, BowlingArchetype, Tier } from "../../../wcdraft/src/ratings/model.ts";
import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import type { TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";

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
  bat: number;
  bowl: number;
  batPhases: Record<Phase, number>;
  bowlPhases: Record<Phase, number>;
  batLow: boolean;
  bowlLow: boolean;
  /** Whether the card shows the skill at all (false for a batter who rarely bowls, and vice versa). */
  batShown: boolean;
  bowlShown: boolean;
  domesticBalls: { bat: number; bowl: number };
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
  picks: (PoolPlayer | null)[];
  captainId: string | null;
  result: TournamentResult | null;
  error: string | null;
}

export const BUDGET = { identityRerolls: 1, coachRerolls: 1, spinRerolls: 2, coachPanel: 3 } as const;
