/**
 * Situation tables for the engine (design spec §7.1), measured over every complete 20-over T20I
 * innings in the archive:
 *
 *   - τ[innings][over][wickets]: outcome distribution by over and wickets down (per innings number)
 *   - streak: by runs off the previous six legal balls, conditioned on innings × phase × wickets band,
 *     with a shuffled-innings null (same balls, outcome labels permuted) so only serial dependence
 *     beyond the context counts (the Miller–Sanjurjo correction for streak measurements)
 *   - setness: by the striker's own balls faced (new batter → set batter), same conditioning
 *   - ballInOver: by legal-ball position in the over
 *   - chaseDots: by consecutive dot balls before this one, second innings only
 *   - dayEffects: variance decomposition of bowler-innings and batter-innings scoring against the
 *     player's own mean, giving the size of the "good day / bad day" random effect
 *
 * The engine divides each cell by its base (the conditioning context without the state) to get a
 * multiplier, so era level and player quality are not double counted.
 */

import { mainInnings, OUTCOME_KEYS, PHASES, phaseOf, type Match, type OutcomeKey } from "../cricsheet/match.js";
import type { PressureTables } from "./pressure.js";

export interface SituationCell {
  balls: number;
  outcomes: Record<OutcomeKey, number>;
}

/** A family of cells keyed `${context}|${state}` with a base per `${context}`. */
export interface StateTable {
  cells: Record<string, SituationCell>;
  base: Record<string, SituationCell>;
}

export interface DayEffect {
  /** Player-innings used and mean balls per player-innings. */
  innings: number;
  meanBalls: number;
  /** E[z²] − 1 where z is the standardised innings total against the player's own per-ball mean (0 = pure sampling noise). */
  excessVariance: number;
  /** Fitted SD of the multiplicative per-innings effect on the player's scoring rate. */
  sd: number;
}

export interface SituationTables {
  cells: Record<string, SituationCell>;
  phases: Record<string, SituationCell>;
  streak: StateTable;
  streakNull: StateTable;
  setness: StateTable;
  ballInOver: StateTable;
  chaseDots: StateTable;
  dayEffects: { bowler: DayEffect; batter: DayEffect };
  /**
   * Resource table for rain rules (Phase 2b): mean first-innings runs still to come from a state
   * (balls left b, wickets down w) as a share of the mean full-innings total, from every natural
   * 20-over first innings. `resources[w][b]`, b = 0..120, w = 0..9; monotone in both directions.
   */
  resources: number[][];
  /** Scheduled overs of first innings reduced before the start (rain): overs → count. */
  reducedOvers: Record<string, number>;
  /** Required-rate pressure, style gears and found-a-boundary (`analysis/pressure.ts`). */
  states: PressureTables;
}

export const PRESSURE_BANDS = ["<6", "6-8", "8-10", "10-12", "12-14", "14-16", "16-18", "18+"] as const;
export type PressureBand = (typeof PRESSURE_BANDS)[number];
export function pressureBand(requiredRpo: number): PressureBand {
  const i = requiredRpo < 6 ? 0 : Math.min(7, 1 + Math.floor((requiredRpo - 6) / 2));
  return PRESSURE_BANDS[i]!;
}

export const STREAK_BANDS = ["n/a", "0-3", "4-7", "8-12", "13+"] as const;
export type StreakBand = (typeof STREAK_BANDS)[number];
export function streakBand(ballsSeen: number, runsLastSix: number): StreakBand {
  if (ballsSeen < 6) return "n/a";
  return runsLastSix <= 3 ? "0-3" : runsLastSix <= 7 ? "4-7" : runsLastSix <= 12 ? "8-12" : "13+";
}

export const SETNESS_BANDS = ["0-2", "3-5", "6-11", "12-24", "25+"] as const;
export type SetnessBand = (typeof SETNESS_BANDS)[number];
export function setnessBand(ballsFaced: number): SetnessBand {
  return ballsFaced <= 2 ? "0-2" : ballsFaced <= 5 ? "3-5" : ballsFaced <= 11 ? "6-11" : ballsFaced <= 24 ? "12-24" : "25+";
}

export function wicketsBand(wickets: number): string {
  return wickets <= 2 ? "w0-2" : wickets <= 5 ? "w3-5" : "w6+";
}

export function dotsBand(consecutiveDots: number): string {
  return consecutiveDots >= 3 ? "3+" : String(consecutiveDots);
}

const emptyCell = (): SituationCell => ({ balls: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } });

export function outcomeKey(runs: number, wicket: boolean): OutcomeKey {
  if (wicket) return "W";
  if (runs >= 6) return "6";
  if (runs === 5) return "4";
  return String(runs) as OutcomeKey;
}

/** mulberry32: a deterministic shuffle per innings. */
function rngFor(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Table {
  readonly cells = new Map<string, SituationCell>();
  readonly base = new Map<string, SituationCell>();
  /** `inBase: false` files the ball under its state but leaves it out of the context base (a state the engine plays as 1). */
  add(context: string, state: string, outcome: OutcomeKey, inBase = true): void {
    bump(this.cells, `${context}|${state}`, outcome);
    if (inBase) bump(this.base, context, outcome);
  }
  out(): StateTable {
    return { cells: obj(this.cells), base: obj(this.base) };
  }
}

function bump(map: Map<string, SituationCell>, key: string, outcome: OutcomeKey): void {
  let c = map.get(key);
  if (!c) map.set(key, (c = emptyCell()));
  c.balls += 1;
  c.outcomes[outcome] += 1;
}

const obj = (m: Map<string, SituationCell>) => Object.fromEntries([...m.entries()].sort());

interface PlayerTotals {
  balls: number;
  runs: number;
  sumsq: number;
}

export class SituationAnalysis {
  private readonly cells = new Map<string, SituationCell>();
  private readonly phases = new Map<string, SituationCell>();
  private readonly streak = new Table();
  private readonly streakNull = new Table();
  private readonly setness = new Table();
  private readonly ballInOver = new Table();
  private readonly chaseDots = new Table();
  private readonly bowlerTotals = new Map<string, PlayerTotals>();
  private readonly batterTotals = new Map<string, PlayerTotals>();
  private readonly bowlerInnings: { id: string; balls: number; runs: number }[] = [];
  private readonly batterInnings: { id: string; balls: number; runs: number }[] = [];
  /** [wickets][ballsLeft] → { n, remainingRuns } over natural first innings. */
  private readonly remaining: { n: number; runs: number }[][] = Array.from({ length: 10 }, () => Array.from({ length: 121 }, () => ({ n: 0, runs: 0 })));
  private fullTotals = { n: 0, runs: 0 };
  private readonly reducedOvers = new Map<number, number>();

  add(m: Match): void {
    for (const inn of mainInnings(m)) {
      const number = inn.index + 1;
      // Overs a rain-shortened first innings actually ran to (the archive does not say whether the
      // cut came before or during the innings; both feed the engine's reduced-overs draw).
      if (number === 1 && inn.reduced && inn.wickets < 10 && inn.legalBalls >= 30) {
        const overs = Math.ceil(inn.legalBalls / 6);
        if (overs < 20) this.reducedOvers.set(overs, (this.reducedOvers.get(overs) ?? 0) + 1);
      }
      if (number === 1 && !inn.reduced && !inn.superOver && inn.scheduledOvers === 20) this.addResources(inn);
      if (inn.reduced || inn.superOver || number > 2 || inn.oversStarted === 0) continue;
      const target = number === 2 ? inn.target : null;
      type Rec = { over: number; wickets: number; outcome: OutcomeKey; runsBatter: number; runsTotal: number; legal: boolean; batter: string; bowler: string; legalInOver: number };
      const recs: Rec[] = [];
      let wickets = 0, runs = 0, legal = 0, legalInOver = 0, lastOver = -1;
      const faced = new Map<string, number>();
      const bowlRuns = new Map<string, { balls: number; runs: number }>();
      const batRuns = new Map<string, { balls: number; runs: number }>();
      for (const b of inn.balls) {
        if (b.over >= 20) continue;
        if (b.over !== lastOver) { legalInOver = 0; lastOver = b.over; }
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (b.legal || strikerOut) {
          const key = outcomeKey(b.runsBatter, strikerOut);
          const ctxPhase = `${number}|${phaseOf(b.over)}`;
          bump(this.cells, `${number}|${b.over}|${Math.min(9, wickets)}`, key);
          bump(this.phases, ctxPhase, key);
          const ctx = `${ctxPhase}|${wicketsBand(wickets)}`;
          this.setness.add(ctx, setnessBand(faced.get(b.batter) ?? 0), key);
          if (b.legal) this.ballInOver.add(ctxPhase, String(Math.min(6, legalInOver + 1)), key);
          recs.push({ over: b.over, wickets, outcome: key, runsBatter: b.runsBatter, runsTotal: b.runsTotal, legal: b.legal, batter: b.batter, bowler: b.bowler, legalInOver });
          if (b.legal) {
            faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
            const br = bowlRuns.get(b.bowler) ?? bowlRuns.set(b.bowler, { balls: 0, runs: 0 }).get(b.bowler)!;
            br.balls += 1; br.runs += b.runsConceded;
            const bt = batRuns.get(b.batter) ?? batRuns.set(b.batter, { balls: 0, runs: 0 }).get(b.batter)!;
            bt.balls += 1; bt.runs += b.runsBatter;
            const tb = this.bowlerTotals.get(b.bowler) ?? this.bowlerTotals.set(b.bowler, { balls: 0, runs: 0, sumsq: 0 }).get(b.bowler)!;
            tb.balls += 1; tb.runs += b.runsConceded; tb.sumsq += b.runsConceded * b.runsConceded;
            const tt = this.batterTotals.get(b.batter) ?? this.batterTotals.set(b.batter, { balls: 0, runs: 0, sumsq: 0 }).get(b.batter)!;
            tt.balls += 1; tt.runs += b.runsBatter; tt.sumsq += b.runsBatter * b.runsBatter;
          }
        }
        runs += b.runsTotal;
        if (b.legal) { legal += 1; legalInOver += 1; }
        wickets += b.wickets.length;
      }
      for (const [id, v] of bowlRuns) this.bowlerInnings.push({ id, balls: v.balls, runs: v.runs });
      for (const [id, v] of batRuns) this.batterInnings.push({ id, balls: v.balls, runs: v.runs });

      // Streak (real sequence) and consecutive dots in chases.
      this.tabulateSequence(recs, number, recs.map((r) => r.runsBatter), this.streak, target !== null);
      // Shuffled null: same positions and contexts, outcome labels permuted within the innings AND
      // within the phase (2026-11-01 audit: a whole-innings shuffle let the phase difference ride
      // inside the streak residual, +4–6% on every powerplay band).
      const next = rngFor(`${m.id}:${inn.index}`);
      const perm = recs.map((_, i) => i);
      for (const ph of PHASES) {
        const idx = perm.filter((i) => phaseOf(recs[i]!.over) === ph);
        for (let a = idx.length - 1; a > 0; a -= 1) {
          const b2 = Math.floor(next() * (a + 1));
          [idx[a], idx[b2]] = [idx[b2]!, idx[a]!];
        }
        let n = 0;
        for (let i = 0; i < perm.length; i += 1) if (phaseOf(recs[i]!.over) === ph) perm[i] = idx[n++]!;
      }
      const shuffled = recs.map((r, i) => ({ ...r, outcome: recs[perm[i]!]!.outcome, runsBatter: recs[perm[i]!]!.runsBatter }));
      this.tabulateSequence(shuffled, number, shuffled.map((r) => r.runsBatter), this.streakNull, false);
    }
  }

  private tabulateSequence(recs: { over: number; wickets: number; outcome: OutcomeKey; runsTotal: number; legal: boolean }[], number: number, runsSeq: number[], table: Table, chase: boolean): void {
    const recent: number[] = [];
    let consecutiveDots = 0;
    for (let i = 0; i < recs.length; i += 1) {
      const r = recs[i]!;
      const ctx = `${number}|${phaseOf(r.over)}|${wicketsBand(r.wickets)}`;
      const lastSix = recent.slice(-6).reduce((a, x) => a + x, 0);
      // The first six balls ("n/a") are filed but kept out of the base: the engine plays them as 1
      // (their caution is the openers' setness and τ), so the other bands are measured against the
      // balls that actually carry a band. With them in, every band read above 1 in the powerplay.
      const band = streakBand(recent.length, lastSix);
      table.add(ctx, band, r.outcome, band !== "n/a");
      if (chase) this.chaseDots.add(`${phaseOf(r.over)}|${wicketsBand(r.wickets)}`, dotsBand(consecutiveDots), r.outcome);
      recent.push(runsSeq[i]!);
      if (r.legal) consecutiveDots = r.runsTotal === 0 && r.outcome !== "W" ? consecutiveDots + 1 : 0;
    }
  }

  /** Runs still to come from every (balls left, wickets down) state of a natural first innings. */
  private addResources(inn: { balls: { legal: boolean; runsTotal: number; wickets: unknown[] }[]; total: number }): void {
    this.fullTotals.n += 1;
    this.fullTotals.runs += inn.total;
    let legal = 0, runs = 0, wickets = 0;
    // State before each legal ball, plus the terminal state.
    for (const b of inn.balls) {
      if (b.legal) {
        const cell = this.remaining[Math.min(9, wickets)]![120 - legal]!;
        cell.n += 1;
        cell.runs += inn.total - runs;
        legal += 1;
      }
      runs += b.runsTotal;
      wickets += b.wickets.length;
      if (legal >= 120 || wickets >= 10) break;
    }
  }

  private resourceTable(): number[][] {
    const full = this.fullTotals.n ? this.fullTotals.runs / this.fullTotals.n : 1;
    const raw = this.remaining.map((row) => row.map((c) => (c.n >= 30 ? c.runs / c.n / full : NaN)));
    // Fill thin cells from neighbours, then enforce monotonicity: more balls left or fewer wickets down never means fewer resources.
    const table: number[][] = raw.map((row) => row.slice());
    for (let w = 0; w < 10; w += 1) {
      table[w]![0] = 0;
      for (let b = 1; b <= 120; b += 1) if (Number.isNaN(table[w]![b]!)) table[w]![b] = table[w]![b - 1]!;
    }
    for (let w = 9; w >= 0; w -= 1) for (let b = 1; b <= 120; b += 1) {
      let v = table[w]![b]!;
      v = Math.max(v, table[w]![b - 1]!);
      if (w < 9) v = Math.max(v, table[w + 1]![b]!);
      table[w]![b] = v;
    }
    // A full innings with no wicket down is 100% of the resources by definition.
    const top = table[0]![120]! || 1;
    return table.map((row) => row.map((v) => Math.min(1, +(v / top).toFixed(4))));
  }

  private dayEffect(totals: Map<string, PlayerTotals>, innings: { id: string; balls: number; runs: number }[], minTotalBalls: number, minInningsBalls: number): DayEffect {
    let n = 0, sumZ2 = 0, sumBalls = 0, sumRatio = 0;
    for (const x of innings) {
      const t = totals.get(x.id);
      if (!t || t.balls < minTotalBalls || x.balls < minInningsBalls) continue;
      const mu = t.runs / t.balls;
      const sigma2 = t.sumsq / t.balls - mu * mu;
      if (sigma2 <= 0 || mu <= 0) continue;
      const z = (x.runs - x.balls * mu) / Math.sqrt(x.balls * sigma2);
      n += 1; sumZ2 += z * z; sumBalls += x.balls; sumRatio += (x.balls * mu * mu) / sigma2;
    }
    if (n === 0) return { innings: 0, meanBalls: 0, excessVariance: 0, sd: 0 };
    const excess = sumZ2 / n - 1;
    // Var(r) = nσ² + n²μ²s²  ⇒  E[z²] − 1 = n μ² s² / σ²  ⇒  s² = excess / mean(n μ² / σ²)
    const s2 = Math.max(0, excess / (sumRatio / n));
    return { innings: n, meanBalls: +(sumBalls / n).toFixed(1), excessVariance: +excess.toFixed(3), sd: +Math.sqrt(s2).toFixed(3) };
  }

  summary(): Omit<SituationTables, "states"> {
    return {
      cells: obj(this.cells),
      phases: obj(this.phases),
      streak: this.streak.out(),
      streakNull: this.streakNull.out(),
      setness: this.setness.out(),
      ballInOver: this.ballInOver.out(),
      chaseDots: this.chaseDots.out(),
      dayEffects: {
        bowler: this.dayEffect(this.bowlerTotals, this.bowlerInnings, 600, 18),
        batter: this.dayEffect(this.batterTotals, this.batterInnings, 300, 10),
      },
      resources: this.resourceTable(),
      reducedOvers: Object.fromEntries([...this.reducedOvers.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), v])),
    };
  }
}

export { OUTCOME_KEYS };
