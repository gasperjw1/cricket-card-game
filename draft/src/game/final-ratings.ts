/**
 * Final ratings (asked 2026-10-30): what each drafted player is worth in the World Cup actually
 * being played, for the result screen's Player ratings tab. A card number belongs to the player's
 * own edition; the engine carries his era-free relative vectors into the identity edition, so this
 * runs those same vectors through the engine's own combination (base × rel^0.7, against average
 * opposition and before the match situation) on both editions' base rates, and reads each value
 * off that edition's field on the card scale (median 70, 99th percentile 99, 5th percentile 45).
 *
 * Steps are differences on that scale and anchor on the card, so a low-sample number the card has
 * already held back stays held back: card + era + slot + pace/spin + coach = final.
 */

import type { Phase } from "../../../wcdraft/src/cricsheet/match.ts";
import { applyIntent } from "../../../wcdraft/src/engine/ball.ts";
import { ENGINE } from "../../../wcdraft/src/engine/model.ts";
import type { EditionData } from "../../../wcdraft/src/engine/data.ts";
import type { EnginePlayer } from "../../../wcdraft/src/engine/types.ts";
import { MODEL, OUTCOMES, PHASE_LIST, type ClassSplitPart, type PhaseVectors, type PlayerRating, type SkillRating, type Vector } from "../../../wcdraft/src/ratings/model.ts";
import { battingValue, bowlingValue, expectedRuns, normalise } from "../../../wcdraft/src/ratings/vectors.ts";
import type { PhaseWeights } from "./slots.ts";
import type { PoolPlayer } from "./types.ts";

export type Skill = "bat" | "bowl";

/** What a value is worked out under: the pace/spin mix to meet (batting only) and the coach's intent per phase. */
export interface ValueOptions {
  classMix?: { pace: number; spin: number };
  intent?: Record<Phase, number>;
}

export interface EditionEnv {
  editionId: string;
  base: PhaseVectors;
  scale: Record<Skill, (value: number) => number>;
}

export interface FinalStep {
  key: "era" | "slot" | "class" | "coach";
  label: string;
  delta: number;
}

/** Per-ball rates: runs per 100 balls and balls per dismissal (batting), runs per over and balls per wicket (bowling). */
export interface Rates {
  rate: number;
  ballsPerOut: number;
}

export interface FinalPhase {
  phase: Phase;
  then: Rates;
  here: Rates;
}

export interface FinalSkill {
  /** False for a skill the card hides ("rarely bats"): the rates are then prior-shaped and no number is printed. */
  shown: boolean;
  card: number;
  final: number;
  steps: FinalStep[];
  then: Rates;
  here: Rates;
  phases: FinalPhase[];
  evidence: SkillRating["evidence"];
  lowSample: boolean;
}

export interface PlayerFinal {
  player: PoolPlayer;
  position: number;
  batting: FinalSkill;
  /** Null for the designated keeper, who does not bowl. */
  bowling: FinalSkill | null;
  vsClass: { pace: ClassSplitPart; spin: ClassSplitPart } | null;
  transferBat: number;
}

const UNIT: Vector = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };

/** The engine's combination against an average opponent: base × rel^exponent, normalised. */
export function project(base: Vector, rel: Vector, exponent: number, residual: Vector = UNIT): Vector {
  return normalise(Object.fromEntries(OUTCOMES.map((k) => [k, base[k] * Math.pow(rel[k] * residual[k], exponent)])) as Vector);
}

function phaseDistribution(player: EnginePlayer, skill: Skill, base: Vector, phase: Phase, opts: ValueOptions): Vector {
  if (skill === "bowl") return project(base, player.bowlingRel[phase], ENGINE.bowlExponent);
  const rel = player.battingRel[phase];
  let dist = project(base, rel, ENGINE.batExponent);
  if (opts.classMix) {
    const pace = project(base, rel, ENGINE.batExponent, player.batVsClass.pace);
    const spin = project(base, rel, ENGINE.batExponent, player.batVsClass.spin);
    dist = Object.fromEntries(OUTCOMES.map((k) => [k, opts.classMix!.pace * pace[k] + opts.classMix!.spin * spin[k]])) as Vector;
  }
  return applyIntent(dist, opts.intent?.[phase] ?? 0);
}

/** A player's value in an edition: the rating model's value of his projected distribution, weighted by phase. */
export function valueIn(player: EnginePlayer, skill: Skill, base: PhaseVectors, weights: PhaseWeights, opts: ValueOptions = {}): number {
  const score = skill === "bat" ? battingValue : bowlingValue;
  return PHASE_LIST.reduce((a, p) => a + weights[p] * score(phaseDistribution(player, skill, base[p], p, opts), base[p]), 0);
}

function ratesOf(dist: Vector, skill: Skill): Rates {
  return { rate: expectedRuns(dist) * (skill === "bat" ? 100 : 6), ballsPerOut: dist.W > 0 ? 1 / dist.W : Infinity };
}

function blendedRates(player: EnginePlayer, skill: Skill, base: PhaseVectors, weights: PhaseWeights, opts: ValueOptions): Rates {
  const pooled = Object.fromEntries(OUTCOMES.map((k) => [k, PHASE_LIST.reduce((a, p) => a + weights[p] * phaseDistribution(player, skill, base[p], p, opts)[k], 0)])) as Vector;
  return ratesOf(pooled, skill);
}

/** The card's display map (rate.ts) over one edition's field: median → 70, 99th percentile → 99, 5th → 45. */
export function fieldScale(values: number[]): (value: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * (sorted.length - 1))))] ?? 0;
  const median = q(0.5), top = q(0.99), low = q(0.05);
  return (value) => {
    const raw = value >= median ? 70 + (29 * (value - median)) / Math.max(1e-6, top - median) : 70 - (25 * (median - value)) / Math.max(1e-6, median - low);
    return Math.min(MODEL.display.max, Math.max(MODEL.display.min, raw));
  };
}

/** An edition's base rates and scales; the field is its rated players with a shown skill and a real sample. */
export function editionEnv(data: EditionData, ratings: PlayerRating[]): EditionEnv {
  const base = data.populations.editionPop;
  const values = (skill: Skill): number[] => ratings.flatMap((r) => {
    const s = skill === "bat" ? r.batting : r.bowling;
    const player = data.players.get(`${r.team}|${r.personId}`);
    return player && s.shown && !s.lowSample ? [valueIn(player, skill, base, s.evidence.phaseWeights)] : [];
  });
  return { editionId: data.edition.id, base, scale: { bat: fieldScale(values("bat")), bowl: fieldScale(values("bowl")) } };
}

/** Rounds a running total so the printed steps add up exactly to the printed final. */
function stepsFrom(points: { key: FinalStep["key"]; label: string; at: number }[], start: number): FinalStep[] {
  let prev = start;
  return points.map((p) => {
    const delta = Math.round(p.at) - Math.round(prev);
    prev = p.at;
    return { key: p.key, label: p.label, delta };
  });
}

function clampDisplay(n: number): number {
  return Math.max(MODEL.display.min, Math.min(MODEL.display.max, n));
}

function finishSkill(skill: Skill, s: SkillRating, card: number, shown: boolean, steps: FinalStep[], player: EnginePlayer, home: EditionEnv, here: EditionEnv, weights: PhaseWeights, opts: ValueOptions): FinalSkill {
  return {
    shown,
    card,
    final: clampDisplay(card + steps.reduce((a, x) => a + x.delta, 0)),
    steps,
    then: blendedRates(player, skill, home.base, s.evidence.phaseWeights, {}),
    here: blendedRates(player, skill, here.base, weights, opts),
    phases: PHASE_LIST.map((phase) => ({
      phase,
      then: ratesOf(phaseDistribution(player, skill, home.base[phase], phase, {}), skill),
      here: ratesOf(phaseDistribution(player, skill, here.base[phase], phase, opts), skill),
    })),
    evidence: s.evidence,
    lowSample: s.lowSample,
  };
}

export interface FinalInput {
  player: PoolPlayer;
  rating: PlayerRating;
  engine: EnginePlayer;
  home: EditionEnv;
  here: EditionEnv;
  position: number;
  slot: PhaseWeights;
  /** Share of the overs bowled by pace and by spin in the edition being played. */
  classMix: { pace: number; spin: number };
  intent?: Record<Phase, number>;
  coachName?: string;
  /** The designated keeper keeps and does not bowl. */
  keeps: boolean;
}

export function computeFinal(input: FinalInput): PlayerFinal {
  const { player, rating, engine, home, here, position, slot, classMix, intent, coachName, keeps } = input;
  const sameEdition = home.editionId === here.editionId;
  const eraLabel = sameEdition ? `Same World Cup (${here.editionId})` : `Era: ${home.editionId} to ${here.editionId}`;

  const ownBat = rating.batting.evidence.phaseWeights;
  const batStart = home.scale.bat(valueIn(engine, "bat", home.base, ownBat));
  const batEra = here.scale.bat(valueIn(engine, "bat", here.base, ownBat));
  const batSlot = here.scale.bat(valueIn(engine, "bat", here.base, slot));
  const batClass = here.scale.bat(valueIn(engine, "bat", here.base, slot, { classMix }));
  const batCoach = here.scale.bat(valueIn(engine, "bat", here.base, slot, { classMix, intent }));
  const batting = finishSkill("bat", rating.batting, player.bat, player.batShown, stepsFrom([
    { key: "era", label: eraLabel, at: batEra },
    { key: "slot", label: `Batting at No. ${position}`, at: batSlot },
    { key: "class", label: `Pace and spin mix (${Math.round(100 * classMix.spin)}% spin)`, at: batClass },
    { key: "coach", label: coachName ? `Coach intent (${coachName})` : "Coach intent", at: batCoach },
  ], batStart), engine, home, here, slot, { classMix, intent });

  const ownBowl = rating.bowling.evidence.phaseWeights;
  const bowling = keeps ? null : finishSkill("bowl", rating.bowling, player.bowl, player.bowlShown, stepsFrom([
    { key: "era", label: eraLabel, at: here.scale.bowl(valueIn(engine, "bowl", here.base, ownBowl)) },
  ], home.scale.bowl(valueIn(engine, "bowl", home.base, ownBowl))), engine, home, here, ownBowl, {});

  const split = rating.batting.byBowlClass;
  return {
    player,
    position,
    batting,
    bowling,
    vsClass: split,
    transferBat: rating.batting.evidence.transfer,
  };
}
