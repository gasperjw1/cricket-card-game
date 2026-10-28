/**
 * Smoothed two-way population table: outcome vectors for batters (bowlers) from teams of
 * strength bin B against opposition of strength bin A.
 *
 * Raw cells are sparse (a 1400-rated side rarely meets an 1800-rated attack outside a World
 * Cup), so each outcome's rate is fitted log-additively, rate[B][A] ≈ exp(μ + α_B + β_A), by a
 * few rounds of iterative proportional fitting weighted by balls, and the fitted rates are
 * blended with the raw cell in proportion to its evidence. The result is a full table that
 * respects both the batting side's quality and the attack's.
 */

import { ELO_BINS } from "../analysis/team-strength.js";
import { OUTCOMES, type Vector } from "./model.js";
import { normalise } from "./vectors.js";

export type TwoWayCounts = Record<string, Record<string, { balls: number; outcomes: Record<string, number> }>>;
export type TwoWayVectors = Record<string, Record<string, Vector>>;

/** Balls at which a raw cell is trusted as much as the fitted rate. */
const CELL_PRIOR_BALLS = 2000;

export function smoothTwoWay(counts: TwoWayCounts): TwoWayVectors {
  const bins = [...ELO_BINS];
  // Fit each outcome rate independently (Poisson-style IPF on counts with balls as exposure).
  const fitted: Record<string, Record<string, Record<string, number>>> = {};
  for (const b of bins) {
    fitted[b] = {};
    for (const a of bins) fitted[b]![a] = {};
  }
  for (const k of OUTCOMES) {
    const alpha: Record<string, number> = Object.fromEntries(bins.map((b) => [b, 1]));
    const beta: Record<string, number> = Object.fromEntries(bins.map((a) => [a, 1]));
    const total = bins.reduce((s, b) => s + bins.reduce((t, a) => t + (counts[b]?.[a]?.balls ?? 0), 0), 0);
    const totalK = bins.reduce((s, b) => s + bins.reduce((t, a) => t + (counts[b]?.[a]?.outcomes[k] ?? 0), 0), 0);
    const mu = total > 0 ? totalK / total : 1 / OUTCOMES.length;
    for (let iter = 0; iter < 8; iter += 1) {
      for (const b of bins) {
        let obs = 0, exp = 0;
        for (const a of bins) {
          obs += counts[b]?.[a]?.outcomes[k] ?? 0;
          exp += (counts[b]?.[a]?.balls ?? 0) * mu * beta[a]!;
        }
        if (exp > 0 && obs > 0) alpha[b] = obs / exp;
      }
      for (const a of bins) {
        let obs = 0, exp = 0;
        for (const b of bins) {
          obs += counts[b]?.[a]?.outcomes[k] ?? 0;
          exp += (counts[b]?.[a]?.balls ?? 0) * mu * alpha[b]!;
        }
        if (exp > 0 && obs > 0) beta[a] = obs / exp;
      }
    }
    for (const b of bins) for (const a of bins) fitted[b]![a]![k] = mu * alpha[b]! * beta[a]!;
  }
  // Blend fitted rates with the raw cell in proportion to its evidence, then normalise.
  const out: TwoWayVectors = {};
  for (const b of bins) {
    out[b] = {};
    for (const a of bins) {
      const cell = counts[b]?.[a];
      const n = cell?.balls ?? 0;
      const w = n / (n + CELL_PRIOR_BALLS);
      const v = {} as Vector;
      for (const k of OUTCOMES) {
        const raw = n > 0 ? (cell!.outcomes[k] ?? 0) / n : 0;
        v[k] = w * raw + (1 - w) * (fitted[b]![a]![k] ?? 0);
      }
      out[b]![a] = normalise(v);
    }
  }
  return out;
}

/** Exposure-weighted mixture of a row of the two-way table (one team bin, many opponent bins). */
export function rowMixture(table: TwoWayVectors, teamBin: string, exposure: Record<string, number>): Vector | null {
  const row = table[teamBin];
  if (!row) return null;
  let total = 0;
  const acc = {} as Vector;
  for (const k of OUTCOMES) acc[k] = 0;
  for (const [a, balls] of Object.entries(exposure)) {
    const v = row[a];
    if (!v || balls <= 0) continue;
    total += balls;
    for (const k of OUTCOMES) acc[k] += balls * v[k];
  }
  if (total === 0) return null;
  for (const k of OUTCOMES) acc[k] /= total;
  return normalise(acc);
}

const BIN_CENTRES: [string, number][] = [["<1400", 1350], ["1400-1499", 1450], ["1500-1599", 1550], ["1600-1699", 1650], ["1700-1799", 1750], ["1800+", 1850]];

/**
 * Like `rowMixture`, but the team row is interpolated between the two bins nearest to the
 * team's Elo, so a rating does not jump when a team crosses a bin edge between editions.
 */
export function rowMixtureInterp(table: TwoWayVectors, teamElo: number, exposure: Record<string, number>): Vector | null {
  const clamped = Math.min(1850, Math.max(1350, teamElo));
  let lo = BIN_CENTRES[0]!, hi = BIN_CENTRES[BIN_CENTRES.length - 1]!;
  for (let i = 0; i + 1 < BIN_CENTRES.length; i += 1) {
    if (clamped >= BIN_CENTRES[i]![1] && clamped <= BIN_CENTRES[i + 1]![1]) {
      lo = BIN_CENTRES[i]!;
      hi = BIN_CENTRES[i + 1]!;
      break;
    }
  }
  const t = hi[1] === lo[1] ? 0 : (clamped - lo[1]) / (hi[1] - lo[1]);
  const a = rowMixture(table, lo[0], exposure);
  const b = rowMixture(table, hi[0], exposure);
  if (!a || !b) return a ?? b;
  const out = {} as Vector;
  for (const k of OUTCOMES) out[k] = (1 - t) * a[k] + t * b[k];
  return normalise(out);
}
