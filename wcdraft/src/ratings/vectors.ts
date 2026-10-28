/**
 * Vector arithmetic for the ratings model: Dirichlet shrinkage, relative vectors, transport
 * into an edition's environment, and the scalar value of a vector against a population.
 */

import type { OutcomeKey } from "../cricsheet/match.js";
import { MODEL, OUTCOMES, RUNS, type Vector } from "./model.js";

export function normalise(v: Vector): Vector {
  const s = OUTCOMES.reduce((a, k) => a + Math.max(0, v[k]), 0);
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = s > 0 ? Math.max(0, v[k]) / s : 1 / OUTCOMES.length;
  return out;
}

/** Posterior mean of a Dirichlet–multinomial: (counts + c·prior) / (n + c). */
export function shrink(counts: Record<OutcomeKey, number>, n: number, prior: Vector, c: number): Vector {
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = (counts[k] + c * prior[k]) / (n + c);
  return normalise(out);
}

/**
 * Shrink scoring outcomes with strength `c` and the dismissal cell with its own, stronger `cHazard`,
 * then renormalise the scoring cells to fill 1 − W.
 */
export function shrinkWithHazard(counts: Record<OutcomeKey, number>, n: number, prior: Vector, c: number, cHazard: number): Vector {
  const post = shrink(counts, n, prior, c);
  const w = (counts.W + cHazard * prior.W) / (n + cHazard);
  const scoring = OUTCOMES.filter((k) => k !== "W");
  const s = scoring.reduce((a, k) => a + post[k], 0);
  const out = {} as Vector;
  for (const k of scoring) out[k] = s > 0 ? (post[k] / s) * (1 - w) : (1 - w) / scoring.length;
  out.W = w;
  return out;
}

/** Element-wise ratio player ÷ population, floored so a zero population cell cannot explode. */
export function relative(p: Vector, pop: Vector): Vector {
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = p[k] / Math.max(pop[k], 1e-4);
  return out;
}

/** Apply a relative vector to a destination population and renormalise. */
export function transport(rel: Vector, destination: Vector): Vector {
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = rel[k] * destination[k];
  return normalise(out);
}

/** Weighted blend of relative vectors (weights need not sum to 1). */
export function blend(parts: { rel: Vector; weight: number }[]): Vector {
  const total = parts.reduce((a, p) => a + p.weight, 0);
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = total > 0 ? parts.reduce((a, p) => a + (p.weight * p.rel[k]) / total, 0) : 1;
  return out;
}

export function expectedRuns(v: Vector): number {
  return OUTCOMES.reduce((a, k) => a + v[k] * RUNS[k], 0);
}

/**
 * Batting value per 100 balls against a population: runs above population minus the wicket
 * cost of extra dismissals. Positive is better.
 */
/**
 * Batting value as a percentage of the population's expected runs per ball: runs above population
 * minus the wicket cost of extra dismissals, divided by population runs per ball. Scale-free, so a
 * 10 means "10% more effective than an average batter here" in any era. Positive is better.
 */
export function battingValue(v: Vector, pop: Vector, wicketCost = MODEL.wicketCost): number {
  const base = Math.max(0.2, expectedRuns(pop));
  return (100 * (expectedRuns(v) - expectedRuns(pop) - wicketCost * (v.W - pop.W))) / base;
}

/** Bowling value as a percentage of population runs per ball saved, plus the wicket value of extra dismissals. */
export function bowlingValue(v: Vector, pop: Vector, wicketCost = MODEL.wicketCost): number {
  const base = Math.max(0.2, expectedRuns(pop));
  return (100 * (expectedRuns(pop) - expectedRuns(v) + wicketCost * (v.W - pop.W))) / base;
}

export const UNIFORM: Vector = { "0": 1 / 7, "1": 1 / 7, "2": 1 / 7, "3": 1 / 7, "4": 1 / 7, "6": 1 / 7, W: 1 / 7 };

export function toVector(p: Record<string, number> | null | undefined, fallback: Vector): Vector {
  if (!p) return fallback;
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = p[k] ?? 0;
  return normalise(out);
}
