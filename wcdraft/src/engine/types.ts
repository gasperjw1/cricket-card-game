/**
 * Engine inputs and outputs (design spec §7). Everything here is plain data so the same engine
 * can run in the game server, a worker or a browser once the draft client exists.
 */

import type { OutcomeKey, Phase } from "../cricsheet/match.js";
import type { BowlClass } from "../analysis/matchups.js";
import type { BattingArchetype, BattingStyle, BowlingArchetype, PhaseVectors, StartShape, Vector } from "../ratings/model.js";

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
  /** Has kept wicket (labels). In a team sheet: he keeps in this eleven, takes the stumpings and most catches behind, and never bowls. */
  keeper: boolean;
  /** Stumpings credited in the men's T20I archive, how a side's first-choice keeper is told from a part-timer. */
  stumpings: number;
  /** Within-player batting residual against pace and against spin (1 = his overall level); multiplies his relative vector by the bowler's class. */
  batVsClass: Record<"pace" | "spin", Vector>;
  /** How he starts an innings and how he answers a chase; null with too few balls anywhere. */
  style: BattingStyle | null;
  shape: StartShape | null;
  /** Pacers only: he is in the edition's top third for death dots (true) or not (false). Null for everyone else. */
  squeezer: boolean | null;
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
  /** Coach intent profile per phase in SD units (0 = era average); from the coach at that World Cup or the drafted coach. */
  intent?: Record<Phase, number>;
  /** Captaincy rating in SD units (0 = average); scales the bowling-allocation noise. */
  captainZ?: number;
  /** Who leads the side on the scorecard. */
  captainId?: string;
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
  /** Chance per delivery by phase. `byes` also carries the wide and no-ball runs beyond the first. */
  /** Per legal ball by phase; `byes` are byes and leg-byes, `runsPerWide` the mean runs a wide costs (≥ 1). */
  extras: Record<Phase, { wides: number; noBalls: number; byes: number; runsPerWide?: number }>;
  overs: number;
  maxOversPerBowler: number;
  tieBreak: "super-over" | "bowl-out" | "none";
  /** Rain: probability the match is affected at this ground in this edition, and how affected matches split. */
  rain: { pAffected: number; noResultShare: number };
  /** Shares of dismissal kinds at this ground (sum 1), from the venue or edition dismissal fingerprint. */
  dismissalMix: Record<DismissalKind, number>;
}

export interface RainEvent {
  kind: "no-result" | "reduced" | "chase-cut";
  /** Overs per side after a reduction before the start (both innings). */
  oversPerSide: number;
  /** For a chase cut short: the legal balls bowled when play stopped and the par score at that point. */
  cutAtBalls: number | null;
  parScore: number | null;
}

export type DismissalKind = "caught" | "bowled" | "lbw" | "run out" | "stumped" | "caught and bowled" | "hit wicket";
export const DISMISSAL_KINDS: DismissalKind[] = ["caught", "bowled", "lbw", "run out", "stumped", "caught and bowled", "hit wicket"];

/** How a batter went: the kind drawn from the ground's dismissal fingerprint, the bowler (credited unless run out) and the fielder. */
export interface Dismissal {
  kind: DismissalKind;
  bowler: { id: string; name: string } | null;
  fielder: { id: string; name: string } | null;
  /** The fielder is the side's keeper (the scorecard's dagger). */
  byKeeper: boolean;
  /** A run out at the non-striker's end: the ball's `nonStriker` went, not the striker. */
  nonStriker?: boolean;
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
  dismissal: Dismissal | null;
  legal: boolean;
  /** Score after this delivery, for the live feed. */
  runsAfter: number;
  wicketsAfter: number;
}

export interface BatterLine {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal: Dismissal | null;
  position: number;
}

export interface BowlerLine {
  id: string;
  name: string;
  balls: number;
  runs: number;
  wickets: number;
  overs: number[];
  maidens: number;
  dots: number;
  wides: number;
  noBalls: number;
}

export interface Partnership {
  batters: [string, string];
  runs: number;
  balls: number;
  /** Which wicket ended it (1-based), or null for the unbroken stand. */
  wicket: number | null;
}

export interface InningsResult {
  index: 1 | 2;
  team: string;
  /** The batting side's captain and keeper, for the (c) and (wk) on the batting card. */
  captainId: string | null;
  keeperId: string | null;
  /** Overs the side was scheduled to face (20 unless rain reduced the match). */
  scheduledOvers: number;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  batting: BatterLine[];
  bowling: BowlerLine[];
  fallOfWickets: { runs: number; over: number; ball: number; batter: string }[];
  partnerships: Partnership[];
  extrasDetail: { wides: number; noBalls: number; byes: number };
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
