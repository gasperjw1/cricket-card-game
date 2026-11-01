/**
 * One delivery's outcome distribution (design spec §7.1):
 *   p ∝ base[phase] × batRel^a × bowlRel^b × τ[innings][over][wickets] × pressure × gear
 *       × streak (residual over the shuffled null) × setness (striker's balls faced) × found
 *       × shape (striker's start) × ballInOver × chaseDots
 *       × scoring effects (match, innings, player days, venue)
 * Every multiplier is a measured ratio to its own conditioning base, shrunk toward 1.
 */

import { phaseOf, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { OUTCOMES, PHASE_LIST, type BattingStyle } from "../ratings/model.js";
import { PRESSURE } from "../analysis/pressure.js";
import { dotsBand, pressureBand, setnessBand, type SituationCell, type SituationTables, type StateTable, type StreakBand, wicketsBand } from "../analysis/situation.js";
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

  /**
   * How this innings' phase differs from the same phase of the other innings. `tau` is relative to
   * the innings-and-phase and the base pools both innings, so nothing else carries it. The innings'
   * overall level is taken out, since the match's `chaseUplift` sets that.
   */
  inningsPhase(innings: 1 | 2, phase: Phase): Vector {
    return this.cached(`ip:${innings}|${phase}`, () => {
      const cells = (is: number[], ps: readonly Phase[]) => is.flatMap((i) => ps.flatMap((p) => this.tables.phases[`${i}|${p}`] ?? []));
      const rate = (cs: SituationCell[], k: OutcomeKey) => cs.reduce((a, c) => a + c.outcomes[k], 0) / Math.max(1, cs.reduce((a, c) => a + c.balls, 0));
      const out = {} as Vector;
      for (const k of OUTCOMES) out[k] = ((rate(cells([innings], [phase]), k) / rate(cells([1, 2], [phase]), k)) * rate(cells([1, 2], PHASE_LIST), k)) / rate(cells([innings], PHASE_LIST), k);
      return out;
    });
  }

  /** Chase pressure for a required rate, relative to second innings at this over and wickets. */
  pressure(requiredRpo: number, phase: Phase): Vector {
    return this.tables.states.pressure[`${phase}|${pressureBand(requiredRpo)}`] ?? UNIT;
  }

  /** How a batting style answers that pressure, beyond the population. */
  gear(style: BattingStyle | null, phase: Phase): Vector {
    return (style && this.tables.states.gears[`${style}|${phase}`]) || UNIT;
  }

  /** Whether the striker has found a boundary yet, within his balls-faced band. */
  found(ballsFaced: number, found: boolean): Vector {
    return this.tables.states.found[`${setnessBand(ballsFaced)}|${found ? 1 : 0}`] ?? UNIT;
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
    // The player-adjusted table (batter and bowler levels removed, `analysis/pressure.ts`) when the
    // build has it; the raw table otherwise.
    return this.cached(`set:${ctx}|${band}|${ENGINE.adjustedSetness}`, () => (ENGINE.adjustedSetness ? this.tables.states?.setness?.[`${ctx}|${band}`] : undefined) ?? this.state(this.tables.setness, ctx, band));
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

  /** Share of a full innings' expected runs still available with `ballsLeft` and `wickets` down (rain rules). */
  resource(ballsLeft: number, wickets: number): number {
    const b = Math.max(0, Math.min(120, Math.round(ballsLeft)));
    const w = Math.max(0, Math.min(9, wickets));
    if (wickets >= 10 || b === 0) return 0;
    const table = this.tables.resources;
    return table?.[w]?.[b] ?? b / 120;
  }

  get reducedOvers(): Record<string, number> {
    return this.tables.reducedOvers ?? {};
  }

  /** Mean wickets down when `over` (1-based count of completed overs) is reached, balls-weighted over the archive's innings of that number. */
  meanWicketsDown(innings: 1 | 2, over: number): number {
    const o = Math.min(19, over);
    let n = 0, sum = 0;
    for (let w = 0; w <= 9; w += 1) {
      const cell = this.tables.cells[`${innings}|${o}|${w}`];
      if (!cell) continue;
      n += cell.balls; sum += cell.balls * w;
    }
    return n ? sum / n : 0;
  }
}

export interface BallContext {
  innings: 1 | 2;
  over: number;
  wickets: number;
  /** Striker's balls faced so far this innings. */
  strikerBalls: number;
  /** The striker has hit a four or a six this innings. */
  strikerFound?: boolean;
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
  /** Batting side's coach intent for this phase, SD units (0 when unknown). */
  intent?: number;
}

const pow = (v: Vector, e: number): Vector => (e === 1 ? v : (Object.fromEntries(OUTCOMES.map((k) => [k, Math.pow(v[k], e)])) as Vector));

/** Normalised outcome probabilities for one delivery. */
export function outcomeDistribution(striker: EnginePlayer, bowler: EnginePlayer, env: MatchEnvironment, situation: SituationModel, ctx: BallContext): Vector {
  const phase = phaseOf(ctx.over);
  const base = env.base[phase];
  const bat = striker.battingRel[phase];
  const bowl = bowler.bowlingRel[phase];
  const tau = situation.tau(ctx.innings, ctx.over, ctx.wickets);
  const innings = pow(situation.inningsPhase(ctx.innings, phase), ENGINE.inningsPhaseExponent);
  const chasing = ctx.requiredRpo !== null && ctx.wickets <= PRESSURE.maxWickets;
  const forced = chasing && ctx.requiredRpo! >= PRESSURE.gear[0] && ctx.requiredRpo! < PRESSURE.gear[1];
  const pressure = chasing ? pow(situation.pressure(ctx.requiredRpo!, phase), ENGINE.pressureExponent) : UNIT;
  const gear = forced ? pow(situation.gear(striker.style, phase), ENGINE.gearExponent) : UNIT;
  const found = pow(situation.found(ctx.strikerBalls, !!ctx.strikerFound), ENGINE.foundExponent);
  const shape = striker.shape ? pow(ctx.strikerBalls < ENGINE.startBalls ? striker.shape.start : striker.shape.later, ENGINE.shapeExponent) : UNIT;
  const squeeze = forced && phase === "death" && bowler.squeezer !== null ? (bowler.squeezer ? ENGINE.squeezer.top : ENGINE.squeezer.rest) : 1;
  const streak = pow(situation.streak(ctx.innings, phase, ctx.wickets, ctx.streak), ENGINE.streakExponent);
  const setness = pow(situation.setness(ctx.innings, phase, ctx.wickets, ctx.strikerBalls), ENGINE.setnessExponent);
  const bio = pow(situation.ballInOver(ctx.innings, phase, ctx.ballInOver), ENGINE.ballInOverExponent);
  const dots = ctx.requiredRpo !== null ? pow(situation.chaseDots(phase, ctx.wickets, ctx.consecutiveDots), ENGINE.chaseDotsExponent) : UNIT;
  const matchup = pow(situation.matchup(striker.hand, bowler.bowlClass, phase), ENGINE.matchupExponent);
  // The striker's own pace/spin residual (within-player, on top of the population hand × class term).
  const vsClass = bowler.bowlClass ? striker.batVsClass[bowler.bowlClass.startsWith("pace") ? "pace" : "spin"] : UNIT;
  const scoring = ctx.scoringFactor * ctx.playerFactor * Math.pow(env.venueFactor, ENGINE.venueExponent) * ENGINE.scoringCalibration * (phase === "death" ? ENGINE.deathCalibration : 1);
  const out = {} as Vector;
  let total = 0;
  for (const k of OUTCOMES) {
    let p = base[k] * Math.pow(bat[k] * vsClass[k], ENGINE.batExponent) * Math.pow(bowl[k], ENGINE.bowlExponent) * tau[k] * innings[k] * pressure[k] * gear[k] * streak[k] * setness[k] * found[k] * shape[k] * bio[k] * dots[k] * matchup[k];
    if (k === "W") p *= (ctx.freeHit ? 0.08 : 1) * ENGINE.hazardCalibration * squeeze; // a run out is still possible off a free hit
    else if (SCORING.includes(k)) p *= scoring;
    out[k] = Math.max(0, p);
    total += out[k];
  }
  for (const k of OUTCOMES) out[k] = total > 0 ? out[k] / total : 1 / OUTCOMES.length;
  return applyIntent(out, ctx.intent ?? 0);
}

/**
 * Coach intent, applied in absolute terms to a normalised distribution: boundaries and hazard both
 * move by their multipliers and the mass comes out of the other cells, so the risk really is paid.
 */
export function applyIntent(dist: Vector, intent: number): Vector {
  const z = Math.max(-ENGINE.intent.clip, Math.min(ENGINE.intent.clip, intent));
  if (z === 0) return dist;
  const out = { ...dist };
  const b4 = out["4"] * (1 + ENGINE.intent.boundaryPerSd * z), b6 = out["6"] * (1 + ENGINE.intent.boundaryPerSd * z);
  const w = out.W * (1 + ENGINE.intent.hazardPerSd * z);
  const fixed = b4 + b6 + w;
  const restOld = 1 - out["4"] - out["6"] - out.W;
  const restNew = Math.max(0.05, 1 - fixed);
  const scale = restOld > 0 ? restNew / restOld : 1;
  for (const k of OUTCOMES) out[k] = k === "4" ? b4 : k === "6" ? b6 : k === "W" ? w : out[k] * scale;
  const t2 = OUTCOMES.reduce((a, k) => a + out[k], 0);
  for (const k of OUTCOMES) out[k] /= t2;
  return out;
}

/** Expected runs per ball of a distribution (for the allocation policy). */
export function expectedRunsOf(v: Vector): number {
  return v["1"] + 2 * v["2"] + 3 * v["3"] + 4 * v["4"] + 6 * v["6"];
}
