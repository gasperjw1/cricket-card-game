/**
 * One delivery's outcome distribution (design spec §7.1):
 *   p ∝ base[phase] × batRel^a × bowlRel^b × τ[innings][over][wickets] × chase^c × eye-in × effects
 */

import { phaseOf, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { OUTCOMES } from "../ratings/model.js";
import { chaseBand, type SituationCell, type SituationTables } from "../analysis/situation.js";
import { ENGINE } from "./model.js";
import type { EnginePlayer, MatchEnvironment, Vector } from "./types.js";

const SCORING: OutcomeKey[] = ["1", "2", "3", "4", "6"];

/**
 * Mean of the eye-in multiplier over a batter's balls faced, taking balls faced as geometric with
 * mean `ENGINE.eyeInMeanBalls` (E[exp(−n/L)] = p / (1 − (1 − p) e^{−1/L})).
 */
const EYE_IN_MEAN = (() => {
  const p = 1 / ENGINE.eyeInMeanBalls;
  const e = Math.exp(-1 / ENGINE.eyeInLength);
  return 1 + (ENGINE.eyeInHazard * p) / (1 - (1 - p) * e);
})();

/** Shrunk multiplier table: cell distribution ÷ reference distribution, toward 1 with `prior` balls. */
export class SituationModel {
  private readonly cache = new Map<string, Vector>();
  constructor(private readonly tables: SituationTables, private readonly prior = ENGINE.situationPrior) {}

  private multiplier(cell: SituationCell | undefined, ref: SituationCell | undefined): Vector {
    const out = {} as Vector;
    for (const k of OUTCOMES) {
      if (!cell || !ref || ref.balls === 0) {
        out[k] = 1;
        continue;
      }
      const pRef = ref.outcomes[k] / ref.balls;
      const p = (cell.outcomes[k] + this.prior * pRef) / (cell.balls + this.prior);
      out[k] = pRef > 0 ? p / pRef : 1;
    }
    return out;
  }

  /** τ for (innings, over, wickets down) relative to the innings-and-phase distribution. */
  tau(innings: 1 | 2, over: number, wickets: number): Vector {
    const key = `${innings}|${over}|${Math.min(9, wickets)}`;
    let v = this.cache.get(key);
    if (!v) {
      v = this.multiplier(this.tables.cells[key], this.tables.phases[`${innings}|${phaseOf(over)}`]);
      this.cache.set(key, v);
    }
    return v;
  }

  /** Chase pressure for a required rate, relative to the second-innings phase distribution. */
  chase(requiredRpo: number, phase: Phase): Vector {
    const key = `${chaseBand(requiredRpo)}|${phase}`;
    let v = this.cache.get(`chase:${key}`);
    if (!v) {
      v = this.multiplier(this.tables.chase[key], this.tables.phases[`2|${phase}`]);
      this.cache.set(`chase:${key}`, v);
    }
    return v;
  }
}

export interface BallContext {
  innings: 1 | 2;
  over: number;
  wickets: number;
  /** Striker's balls faced so far this innings. */
  strikerBalls: number;
  /** Required runs per over when chasing, else null. */
  requiredRpo: number | null;
  /** Combined log-normal scoring factor for this innings (match × innings effects). */
  scoringFactor: number;
  /** True on the delivery after a no-ball: the striker cannot be out other than run out. */
  freeHit: boolean;
}

/** Normalised outcome probabilities for one delivery. */
export function outcomeDistribution(striker: EnginePlayer, bowler: EnginePlayer, env: MatchEnvironment, situation: SituationModel, ctx: BallContext): Vector {
  const phase = phaseOf(ctx.over);
  const base = env.base[phase];
  const bat = striker.battingRel[phase];
  const bowl = bowler.bowlingRel[phase];
  const tau = situation.tau(ctx.innings, ctx.over, ctx.wickets);
  const chase = ctx.requiredRpo !== null ? situation.chase(ctx.requiredRpo, phase) : null;
  // Centred so the innings-average multiplier is 1: the base distribution already contains the
  // population's share of new batters, so the eye-in term only redistributes hazard toward them.
  const eyeIn = (1 + ENGINE.eyeInHazard * Math.exp(-ctx.strikerBalls / ENGINE.eyeInLength)) / EYE_IN_MEAN;
  const scoring = ctx.scoringFactor * Math.pow(env.venueFactor, ENGINE.venueExponent);
  const out = {} as Vector;
  let total = 0;
  for (const k of OUTCOMES) {
    let p = base[k] * Math.pow(bat[k], ENGINE.batExponent) * Math.pow(bowl[k], ENGINE.bowlExponent) * tau[k];
    if (chase) p *= Math.pow(chase[k], ENGINE.chaseExponent);
    if (k === "W") p *= ctx.freeHit ? 0.08 : eyeIn; // a run out is still possible off a free hit
    else if (SCORING.includes(k)) p *= scoring;
    out[k] = Math.max(0, p);
    total += out[k];
  }
  for (const k of OUTCOMES) out[k] = total > 0 ? out[k] / total : 1 / OUTCOMES.length;
  return out;
}

/** Expected runs per ball of a distribution (for the allocation policy). */
export function expectedRunsOf(v: Vector): number {
  return v["1"] + 2 * v["2"] + 3 * v["3"] + 4 * v["4"] + 6 * v["6"];
}
