/**
 * Context populations for per-innings normalisation (Phase 1.5).
 *
 * First pass over the archive: outcome counts by (year-quarter, opponent-strength bin, phase)
 * for batting (vs the attack's bin) and bowling (vs the batting side's bin), plus runs per ball
 * per venue. Second pass asks, for every ball, "what would an average player have done here?"
 * and accumulates that expectation beside the raw outcome, so every block (career, form,
 * tournament) is era-, opposition- and venue-adjusted at the source.
 *
 * Sparse cells fall back quarter → year → all-time within the same opponent bin, then to the
 * opponent-agnostic cell; venue factors are shrunk toward 1 with a 1,200-ball prior.
 */

import { OUTCOME_KEYS, mainInnings, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { getOrCreate } from "../util/stats.js";
import { eloBin, type EloBin } from "./team-strength.js";
import type { MatchElo } from "./window-population.js";

type Counts = { balls: number; outcomes: Record<OutcomeKey, number> };
const emptyCounts = (): Counts => ({ balls: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } });

const MIN_CELL_BALLS = 600;
const VENUE_PRIOR_BALLS = 1200;

function quarterOf(date: string): string {
  const m = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}Q${Math.ceil(m / 3)}`;
}

function batKey(runs: number, out: boolean): OutcomeKey {
  return out ? "W" : runs >= 6 ? "6" : runs === 5 ? "4" : (String(runs) as OutcomeKey);
}

export type Skill = "bat" | "bowl";

export class ContextPopulation {
  /** skill → period key ("2024Q2", "2024", "all") → opp bin or "any" → phase → counts */
  private readonly cells = new Map<string, Counts>();
  private readonly venue = new Map<string, { balls: number; runs: number }>();
  private allBalls = 0;
  private allRuns = 0;
  private frozen = false;

  private key(skill: Skill, period: string, bin: string, phase: Phase): string {
    return `${skill}|${period}|${bin}|${phase}`;
  }

  add(m: Match, elo: MatchElo): void {
    if (this.frozen) throw new Error("ContextPopulation is frozen");
    const periods = [quarterOf(m.date), m.date.slice(0, 4), "all"];
    const venue = getOrCreate(this.venue, m.venue ?? "unknown", () => ({ balls: 0, runs: 0 }));
    for (const inn of mainInnings(m)) {
      if (inn.reduced) continue;
      const attackBin = eloBin(elo[inn.bowlingTeam] ?? 1500);
      const batsideBin = eloBin(elo[inn.team] ?? 1500);
      for (const b of inn.balls) {
        const phase = phaseOf(b.over);
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (!b.wide || strikerOut) {
          const k = batKey(b.runsBatter, strikerOut);
          for (const p of periods) for (const bin of [attackBin, "any"]) {
            const c = getOrCreate(this.cells, this.key("bat", p, bin, phase), emptyCounts);
            c.balls += 1;
            c.outcomes[k] += 1;
          }
        }
        if (b.legal) {
          const credited = b.wickets.some((w) => w.bowlerCredited);
          const k = batKey(b.runsConceded, credited);
          for (const p of periods) for (const bin of [batsideBin, "any"]) {
            const c = getOrCreate(this.cells, this.key("bowl", p, bin, phase), emptyCounts);
            c.balls += 1;
            c.outcomes[k] += 1;
          }
          venue.balls += 1;
          venue.runs += b.runsTotal;
          this.allBalls += 1;
          this.allRuns += b.runsTotal;
        }
      }
    }
  }

  freeze(): void {
    this.frozen = true;
  }

  /** Scoring factor of a venue (1 = archive average), shrunk toward 1. */
  venueFactor(venue: string | null): number {
    const v = this.venue.get(venue ?? "unknown");
    if (!v || this.allBalls === 0) return 1;
    const raw = v.balls ? v.runs / v.balls / (this.allRuns / this.allBalls) : 1;
    const w = v.balls / (v.balls + VENUE_PRIOR_BALLS);
    return w * raw + (1 - w);
  }

  /**
   * Expected outcome probabilities for one ball in context. Venue scales the scoring cells
   * (not dots or dismissals) before renormalising.
   */
  expected(skill: Skill, date: string, opponentElo: number, phase: Phase, venue: string | null): Record<OutcomeKey, number> {
    const bin: EloBin = eloBin(opponentElo);
    const candidates = [
      this.key(skill, quarterOf(date), bin, phase),
      this.key(skill, date.slice(0, 4), bin, phase),
      this.key(skill, "all", bin, phase),
      this.key(skill, quarterOf(date), "any", phase),
      this.key(skill, date.slice(0, 4), "any", phase),
      this.key(skill, "all", "any", phase),
    ];
    let cell: Counts | undefined;
    for (const k of candidates) {
      const c = this.cells.get(k);
      if (c && c.balls >= MIN_CELL_BALLS) {
        cell = c;
        break;
      }
    }
    const out = {} as Record<OutcomeKey, number>;
    if (!cell) {
      for (const k of OUTCOME_KEYS) out[k] = 1 / OUTCOME_KEYS.length;
      return out;
    }
    const f = this.venueFactor(venue);
    let sum = 0;
    for (const k of OUTCOME_KEYS) {
      const p = cell.outcomes[k] / cell.balls;
      out[k] = k === "0" || k === "W" ? p : p * f;
      sum += out[k];
    }
    for (const k of OUTCOME_KEYS) out[k] /= sum;
    return out;
  }

  summary() {
    const periods = new Set<string>();
    for (const k of this.cells.keys()) periods.add(k.split("|")[1]!);
    return { cells: this.cells.size, periods: periods.size, venues: this.venue.size, balls: this.allBalls };
  }
}
