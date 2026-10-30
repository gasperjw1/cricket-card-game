/**
 * Situation tables for the engine (design spec §7.1, the τ[over][wickets] term): how the per-ball
 * outcome distribution moves with the over and the wickets already down, measured over every
 * complete 20-over T20I innings in the archive, separately for first and second innings, plus a
 * chase-pressure table by required run rate. The engine divides each cell by its innings-and-phase
 * distribution to get a multiplier it applies on top of the batter × bowler × environment vector,
 * so era level and player quality are not double counted.
 */

import { mainInnings, phaseOf, type Match, type OutcomeKey } from "../cricsheet/match.js";

export interface SituationCell {
  balls: number;
  outcomes: Record<OutcomeKey, number>;
}

export interface SituationTables {
  /** `${innings}|${over}|${wicketsDown}` (innings 1 or 2, over 0–19, wickets 0–9). */
  cells: Record<string, SituationCell>;
  /** `${innings}|${phase}`. */
  phases: Record<string, SituationCell>;
  /** Second innings only: `${requiredRateBand}|${phase}`, bands from CHASE_BANDS. */
  chase: Record<string, SituationCell>;
}

/** Required run-rate bands for the chase table (runs per over still needed). */
export const CHASE_BANDS = ["<6", "6-8", "8-10", "10-12", "12+"] as const;
export type ChaseBand = (typeof CHASE_BANDS)[number];

export function chaseBand(requiredRpo: number): ChaseBand {
  return requiredRpo < 6 ? "<6" : requiredRpo < 8 ? "6-8" : requiredRpo < 10 ? "8-10" : requiredRpo < 12 ? "10-12" : "12+";
}

const emptyCell = (): SituationCell => ({ balls: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } });

function outcomeKey(runs: number, wicket: boolean): OutcomeKey {
  if (wicket) return "W";
  if (runs >= 6) return "6";
  if (runs === 5) return "4";
  return String(runs) as OutcomeKey;
}

export class SituationAnalysis {
  private readonly cells = new Map<string, SituationCell>();
  private readonly phases = new Map<string, SituationCell>();
  private readonly chase = new Map<string, SituationCell>();

  add(m: Match): void {
    for (const inn of mainInnings(m)) {
      // `Innings.index` is zero-based; the tables use 1 and 2 like the engine.
      const number = inn.index + 1;
      if (inn.reduced || inn.superOver || number > 2 || inn.oversStarted === 0) continue;
      const target = number === 2 ? inn.target : null;
      let wickets = 0, runs = 0, legal = 0;
      for (const b of inn.balls) {
        if (b.over >= 20) continue;
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (b.legal || strikerOut) {
          const key = outcomeKey(b.runsBatter, strikerOut);
          this.bump(this.cells, `${number}|${b.over}|${Math.min(9, wickets)}`, key);
          this.bump(this.phases, `${number}|${phaseOf(b.over)}`, key);
          if (target !== null) {
            const ballsLeft = Math.max(1, 120 - legal);
            const required = ((target - runs) * 6) / ballsLeft;
            this.bump(this.chase, `${chaseBand(required)}|${phaseOf(b.over)}`, key);
          }
        }
        runs += b.runsTotal;
        if (b.legal) legal += 1;
        wickets += b.wickets.length;
      }
    }
  }

  private bump(map: Map<string, SituationCell>, key: string, outcome: OutcomeKey): void {
    let c = map.get(key);
    if (!c) map.set(key, (c = emptyCell()));
    c.balls += 1;
    c.outcomes[outcome] += 1;
  }

  summary(): SituationTables {
    const obj = (m: Map<string, SituationCell>) => Object.fromEntries([...m.entries()].sort());
    return { cells: obj(this.cells), phases: obj(this.phases), chase: obj(this.chase) };
  }
}
