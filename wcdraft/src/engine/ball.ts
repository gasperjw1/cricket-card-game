/**
 * One delivery's outcome distribution (design spec §7.1):
 *   p ∝ base[phase] × batRel^a × bowlRel^b × τ[innings][over][wickets] × chase^c
 *       × streak (residual over the shuffled null) × setness (striker's balls faced)
 *       × ballInOver × chaseDots × scoring effects (match, innings, player days, venue)
 * Every multiplier is a measured ratio to its own conditioning base, shrunk toward 1.
 */

import { phaseOf, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { OUTCOMES } from "../ratings/model.js";
import { chaseBand, dotsBand, setnessBand, type SituationCell, type SituationTables, type StateTable, type StreakBand, wicketsBand } from "../analysis/situation.js";
import type { BowlClass, MatchupTables } from "../analysis/matchups.js";
import { ENGINE } from "./model.js";
import type { EnginePlayer, MatchEnvironment, Vector } from "./types.js";

const SCORING: OutcomeKey[] = ["1", "2", "3", "4", "6"];
const UNIT: Vector = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };

/** Shrunk multiplier tables: cell distribution ÷ reference distribution, toward 1 with `prior` balls. */
export class SituationModel {
  private readonly cache = new Map<string, Vector>();
  constructor(private readonly tables: SituationTables, private readonly matchups: MatchupTables | null = null, private readonly prior = ENGINE.situationPrior) {}

  /**
   * Matchup: observed ÷ expected for the striker's hand against the bowler's class, beyond what
   * both players' own averages explain (Phase 2b). Phase cell shrunk toward the pooled cell, which
   * is shrunk toward 1; unit when either player is unlabelled.
   */
  matchup(hand: "R" | "L" | null, cls: BowlClass | null, phase: Phase): Vector {
    if (!hand || !cls || !this.matchups) return UNIT;
    return this.cached(`mu:${hand}|${cls}|${phase}`, () => {
      const ratio = (cell: { balls: number; observed: Record<OutcomeKey, number>; expected: Record<OutcomeKey, number> } | undefined, centre: Vector, prior: number): Vector => {
        const out = {} as Vector;
        for (const k of OUTCOMES) {
          if (!cell) { out[k] = centre[k]; continue; }
          const e = cell.expected[k];
          out[k] = e > 0 ? (cell.observed[k] + prior * centre[k] * (e / cell.balls)) / (e + prior * (e / cell.balls)) : centre[k];
        }
        return out;
      };
      const pooled = ratio(this.matchups!.cells[`${hand}|${cls}|all`], UNIT, ENGINE.matchupPrior);
      return ratio(this.matchups!.cells[`${hand}|${cls}|${phase}`], pooled, ENGINE.matchupPrior);
    });
  }

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

  private cached(key: string, make: () => Vector): Vector {
    let v = this.cache.get(key);
    if (!v) this.cache.set(key, (v = make()));
    return v;
  }

  private state(table: StateTable, context: string, state: string): Vector {
    return this.multiplier(table.cells[`${context}|${state}`], table.base[context]);
  }

  /** τ for (innings, over, wickets down) relative to the innings-and-phase distribution. */
  tau(innings: 1 | 2, over: number, wickets: number): Vector {
    const key = `${innings}|${over}|${Math.min(9, wickets)}`;
    return this.cached(`tau:${key}`, () => this.multiplier(this.tables.cells[key], this.tables.phases[`${innings}|${phaseOf(over)}`]));
  }

  /** Chase pressure for a required rate, relative to the second-innings phase distribution. */
  chase(requiredRpo: number, phase: Phase): Vector {
    const key = `${chaseBand(requiredRpo)}|${phase}`;
    return this.cached(`chase:${key}`, () => this.multiplier(this.tables.chase[key], this.tables.phases[`2|${phase}`]));
  }

  /**
   * Streak: runs off the previous six legal balls, as the ratio of the real multiplier to the
   * shuffled-innings null, so only serial dependence beyond the context counts. The first six
   * balls of an innings return 1: that caution is the openers' setness, counted once.
   */
  streak(innings: 1 | 2, phase: Phase, wickets: number, band: StreakBand): Vector {
    if (band === "n/a") return UNIT;
    const ctx = `${innings}|${phase}|${wicketsBand(wickets)}`;
    return this.cached(`streak:${ctx}|${band}`, () => {
      const real = this.state(this.tables.streak, ctx, band);
      const nil = this.state(this.tables.streakNull, ctx, band);
      return Object.fromEntries(OUTCOMES.map((k) => [k, real[k] / Math.max(1e-6, nil[k])])) as Vector;
    });
  }

  /** Setness: the striker's own balls faced this innings (new batters score less and are out less). */
  setness(innings: 1 | 2, phase: Phase, wickets: number, ballsFaced: number): Vector {
    const ctx = `${innings}|${phase}|${wicketsBand(wickets)}`;
    const band = setnessBand(ballsFaced);
    return this.cached(`set:${ctx}|${band}`, () => this.state(this.tables.setness, ctx, band));
  }

  ballInOver(innings: 1 | 2, phase: Phase, position: number): Vector {
    const ctx = `${innings}|${phase}`;
    const state = String(Math.min(6, Math.max(1, position)));
    return this.cached(`bio:${ctx}|${state}`, () => this.state(this.tables.ballInOver, ctx, state));
  }

  /** Consecutive dot balls before this one, chases only. */
  chaseDots(phase: Phase, wickets: number, consecutiveDots: number): Vector {
    const ctx = `${phase}|${wicketsBand(wickets)}`;
    const state = dotsBand(consecutiveDots);
    return this.cached(`dots:${ctx}|${state}`, () => this.state(this.tables.chaseDots, ctx, state));
  }

  get dayEffects(): SituationTables["dayEffects"] {
    return this.tables.dayEffects;
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
  /** Striker's and bowler's day factors multiplied (1 = average day). */
  playerFactor: number;
  /** Runs off the previous six legal balls (band), position of this legal ball in the over, consecutive dots before it. */
  streak: StreakBand;
  ballInOver: number;
  consecutiveDots: number;
  /** True on the delivery after a no-ball: the striker cannot be out other than run out. */
  freeHit: boolean;
}

const pow = (v: Vector, e: number): Vector => (e === 1 ? v : (Object.fromEntries(OUTCOMES.map((k) => [k, Math.pow(v[k], e)])) as Vector));

/** Normalised outcome probabilities for one delivery. */
export function outcomeDistribution(striker: EnginePlayer, bowler: EnginePlayer, env: MatchEnvironment, situation: SituationModel, ctx: BallContext): Vector {
  const phase = phaseOf(ctx.over);
  const base = env.base[phase];
  const bat = striker.battingRel[phase];
  const bowl = bowler.bowlingRel[phase];
  const tau = situation.tau(ctx.innings, ctx.over, ctx.wickets);
  const chase = ctx.requiredRpo !== null ? pow(situation.chase(ctx.requiredRpo, phase), ENGINE.chaseExponent) : UNIT;
  const streak = pow(situation.streak(ctx.innings, phase, ctx.wickets, ctx.streak), ENGINE.streakExponent);
  const setness = pow(situation.setness(ctx.innings, phase, ctx.wickets, ctx.strikerBalls), ENGINE.setnessExponent);
  const bio = pow(situation.ballInOver(ctx.innings, phase, ctx.ballInOver), ENGINE.ballInOverExponent);
  const dots = ctx.requiredRpo !== null ? pow(situation.chaseDots(phase, ctx.wickets, ctx.consecutiveDots), ENGINE.chaseDotsExponent) : UNIT;
  const matchup = pow(situation.matchup(striker.hand, bowler.bowlClass, phase), ENGINE.matchupExponent);
  const scoring = ctx.scoringFactor * ctx.playerFactor * Math.pow(env.venueFactor, ENGINE.venueExponent) * ENGINE.scoringCalibration;
  const out = {} as Vector;
  let total = 0;
  for (const k of OUTCOMES) {
    let p = base[k] * Math.pow(bat[k], ENGINE.batExponent) * Math.pow(bowl[k], ENGINE.bowlExponent) * tau[k] * chase[k] * streak[k] * setness[k] * bio[k] * dots[k] * matchup[k];
    if (k === "W") p *= (ctx.freeHit ? 0.08 : 1) * ENGINE.hazardCalibration; // a run out is still possible off a free hit
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
