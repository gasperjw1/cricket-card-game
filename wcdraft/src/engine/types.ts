/**
 * Engine inputs and outputs (design spec §7). Everything here is plain data so the same engine
 * can run in the game server, a worker or a browser once the draft client exists.
 */

import type { OutcomeKey, Phase } from "../cricsheet/match.js";
import type { BowlClass } from "../analysis/matchups.js";
import type { BattingArchetype, BowlingArchetype, PhaseVectors, Vector } from "../ratings/model.js";

export type { OutcomeKey, Phase, PhaseVectors, Vector };

export interface EnginePlayer {
  id: string;
  name: string;
  /** Absolute per-phase outcome vectors in the edition's value-population space (from the ratings). */
  batting: PhaseVectors;
  bowling: PhaseVectors;
  /** Relative vectors (player ÷ value population), what the engine multiplies into the base. */
  battingRel: PhaseVectors;
  bowlingRel: PhaseVectors;
  batLowSample: boolean;
  bowlLowSample: boolean;
  role: "batter" | "bowler" | "all-rounder" | "unknown";
  archetype: { batting: BattingArchetype | null; bowling: BowlingArchetype | null };
  positionMedian: number | null;
  /** Share of this bowler's overs by phase in the form window (null when he barely bowls). */
  bowlingShares: Record<Phase, number> | null;
  /** Whether the allocation policy may call on him at all. */
  canBowl: boolean;
  /** Batting hand and bowler class from the hand labels (null when unlabelled); drive the matchup term. */
  hand: "R" | "L" | null;
  bowlClass: BowlClass | null;
  /** Display-only. */
  tier: string;
  battingDisplay: number;
  bowlingDisplay: number;
}

export interface EngineTeam {
  name: string;
  players: EnginePlayer[];
  /** Player ids in batting order (all eleven). */
  battingOrder: string[];
}

/** Scoring environment for one match. */
export interface MatchEnvironment {
  editionId: string;
  /** Base per-phase outcome distribution the player effects are applied to. */
  base: PhaseVectors;
  /** Multiplier on scoring outcomes for the ground (1 = edition average). */
  venueFactor: number;
  /** Second-innings scoring uplift as a fraction of runs per over (dew and target knowledge). */
  chaseUplift: number;
  /** Probability the toss winner fields. */
  tossFieldPct: number;
  widesPerBall: number;
  noBallsPerBall: number;
  byesPerBall: number;
  overs: number;
  maxOversPerBowler: number;
  tieBreak: "super-over" | "bowl-out" | "none";
  /** Rain: probability the match is affected at this ground in this edition, and how affected matches split. */
  rain: { pAffected: number; noResultShare: number };
}

export interface RainEvent {
  kind: "no-result" | "reduced" | "chase-cut";
  /** Overs per side after a reduction before the start (both innings). */
  oversPerSide: number;
  /** For a chase cut short: the legal balls bowled when play stopped and the par score at that point. */
  cutAtBalls: number | null;
  parScore: number | null;
}

export interface BallRecord {
  innings: 1 | 2;
  over: number;
  ballInOver: number;
  striker: string;
  nonStriker: string;
  bowler: string;
  outcome: OutcomeKey;
  runsBatter: number;
  extras: number;
  extraKind: "wide" | "no-ball" | "bye" | null;
  wicket: boolean;
  legal: boolean;
}

export interface BatterLine {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  position: number;
}

export interface BowlerLine {
  id: string;
  name: string;
  balls: number;
  runs: number;
  wickets: number;
  overs: number[];
}

export interface InningsResult {
  index: 1 | 2;
  team: string;
  /** Overs the side was scheduled to face (20 unless rain reduced the match). */
  scheduledOvers: number;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  batting: BatterLine[];
  bowling: BowlerLine[];
  fallOfWickets: { runs: number; over: number; ball: number; batter: string }[];
  phaseRuns: Record<Phase, { runs: number; balls: number; wickets: number }>;
  /** Legal-ball outcome counts (batter's runs; W = striker dismissed). */
  outcomes: Record<OutcomeKey, number>;
  /** Legal balls on which the only runs were byes or leg-byes (a "0" outcome that is not a dot on the scorecard). */
  byeBalls: number;
  target: number | null;
}

export interface MatchResult {
  teams: [string, string];
  tossWinner: string;
  tossDecision: "bat" | "field";
  innings: [InningsResult, InningsResult];
  /** Super-over or bowl-out innings when the match was tied. */
  tieBreak: { winner: string; method: "super-over" | "bowl-out" | "coin"; innings?: InningsResult[] } | null;
  winner: string | null;
  margin: { runs: number } | { wickets: number; ballsLeft: number } | { dls: true; runs: number } | null;
  rain: RainEvent | null;
  balls: BallRecord[];
}
