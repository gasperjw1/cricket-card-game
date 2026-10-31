/**
 * Matchups (design spec §7.1, the λ_match term; Phase 2b): how the per-ball outcome moves with the
 * striker's batting hand against the bowler's type, beyond what the two players' own averages
 * explain. Two passes over the archive: the first collects each player's own per-phase outcome
 * distribution, the second compares every labelled ball with the expectation from the engine's
 * combination rule (base × batter^0.7 × bowler^0.7) and files observed and expected counts by
 * hand × bowler class × phase. The engine applies observed ÷ expected, shrunk toward 1.
 *
 * Labels come from `data/labels/players.csv` (handedness R/L, bowling type codes); unlabelled
 * balls are counted but carry no cell.
 */

import { mainInnings, OUTCOME_KEYS, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";

export type BowlClass = "pace-right" | "pace-left" | "off-spin" | "leg-spin" | "left-arm-spin";
export const BOWL_CLASSES: BowlClass[] = ["pace-right", "pace-left", "off-spin", "leg-spin", "left-arm-spin"];

/** Cricinfo-derived bowling code → matchup class. */
export function bowlClassOf(code: string | undefined | null): BowlClass | null {
  switch ((code ?? "").trim()) {
    case "RF": case "RFM": case "RM": return "pace-right";
    case "LF": case "LFM": case "LM": return "pace-left";
    case "OB": return "off-spin";
    case "LB": case "LBG": return "leg-spin";
    case "SLA": case "SLW": case "SLC": return "left-arm-spin";
    default: return null;
  }
}

/** Pace or spin, from the Cricinfo-derived bowling code; null when unknown, mixed or a non-bowler. */
export type BowlGroup = "pace" | "spin";
export function bowlGroupOf(code: string | undefined | null): BowlGroup | null {
  const cls = bowlClassOf(code);
  return cls === null ? null : cls.startsWith("pace") ? "pace" : "spin";
}

export function handOf(code: string | undefined | null): "R" | "L" | null {
  const c = (code ?? "").trim().toUpperCase();
  return c === "R" || c === "L" ? c : null;
}

export interface MatchupCell {
  balls: number;
  observed: Record<OutcomeKey, number>;
  expected: Record<OutcomeKey, number>;
}

export interface MatchupTables {
  /** `${hand}|${class}|${phase}` and `${hand}|${class}|all`. */
  cells: Record<string, MatchupCell>;
  coverage: { balls: number; labelled: number; batters: number; bowlers: number };
  combination: { batExponent: number; bowlExponent: number; playerPrior: number };
}

type Counts = Record<OutcomeKey, number>;
const zero = (): Counts => ({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 });

function outcomeKey(runs: number, wicket: boolean): OutcomeKey {
  if (wicket) return "W";
  if (runs >= 6) return "6";
  if (runs === 5) return "4";
  return String(runs) as OutcomeKey;
}

const COMBINATION = { batExponent: 0.7, bowlExponent: 0.7, playerPrior: 100 } as const;

export class MatchupAnalysis {
  private readonly batters = new Map<string, Record<Phase, Counts>>();
  private readonly bowlers = new Map<string, Record<Phase, Counts>>();
  private readonly base: Record<Phase, Counts> = { pp: zero(), mid: zero(), death: zero() };
  private readonly cells = new Map<string, MatchupCell>();
  private balls = 0;
  private labelled = 0;
  private frozen = false;
  private readonly batP = new Map<string, Record<Phase, Counts>>();
  private readonly bowlP = new Map<string, Record<Phase, Counts>>();
  private readonly baseP: Record<Phase, Counts> = { pp: zero(), mid: zero(), death: zero() };

  constructor(private readonly labels: Map<string, { handedness: string; bowlingType: string }>) {}

  private static eligible(m: Match) {
    return mainInnings(m).filter((inn) => !inn.reduced && !inn.superOver);
  }

  /** First pass: each player's own per-phase outcome counts and the global base. */
  addFirstPass(m: Match): void {
    for (const inn of MatchupAnalysis.eligible(m)) {
      for (const b of inn.balls) {
        if (b.over >= 20) continue;
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (!(b.legal || strikerOut)) continue;
        const ph = phaseOf(b.over);
        const key = outcomeKey(b.runsBatter, strikerOut);
        this.base[ph][key] += 1;
        const bat = this.batters.get(b.batter) ?? this.batters.set(b.batter, { pp: zero(), mid: zero(), death: zero() }).get(b.batter)!;
        bat[ph][key] += 1;
        const bowl = this.bowlers.get(b.bowler) ?? this.bowlers.set(b.bowler, { pp: zero(), mid: zero(), death: zero() }).get(b.bowler)!;
        bowl[ph][key] += 1;
      }
    }
  }

  /** Turn counts into shrunk probabilities once the first pass is complete. */
  freeze(): void {
    const toP = (c: Counts, prior: Counts | null, strength: number): Counts => {
      const n = OUTCOME_KEYS.reduce((a, k) => a + c[k], 0);
      const out = zero();
      for (const k of OUTCOME_KEYS) out[k] = prior ? (c[k] + strength * prior[k]) / (n + strength) : n > 0 ? c[k] / n : 1 / 7;
      return out;
    };
    for (const ph of ["pp", "mid", "death"] as Phase[]) this.baseP[ph] = toP(this.base[ph], null, 0);
    for (const [id, c] of this.batters) this.batP.set(id, { pp: toP(c.pp, this.baseP.pp, COMBINATION.playerPrior), mid: toP(c.mid, this.baseP.mid, COMBINATION.playerPrior), death: toP(c.death, this.baseP.death, COMBINATION.playerPrior) });
    for (const [id, c] of this.bowlers) this.bowlP.set(id, { pp: toP(c.pp, this.baseP.pp, COMBINATION.playerPrior), mid: toP(c.mid, this.baseP.mid, COMBINATION.playerPrior), death: toP(c.death, this.baseP.death, COMBINATION.playerPrior) });
    this.frozen = true;
  }

  /** Second pass: observed and expected counts per hand × bowler class × phase. */
  add(m: Match): void {
    if (!this.frozen) throw new Error("MatchupAnalysis: call freeze() after the first pass");
    for (const inn of MatchupAnalysis.eligible(m)) {
      for (const b of inn.balls) {
        if (b.over >= 20) continue;
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (!(b.legal || strikerOut)) continue;
        this.balls += 1;
        const hand = handOf(this.labels.get(b.batter)?.handedness);
        const cls = bowlClassOf(this.labels.get(b.bowler)?.bowlingType);
        if (!hand || !cls) continue;
        this.labelled += 1;
        const ph = phaseOf(b.over);
        const key = outcomeKey(b.runsBatter, strikerOut);
        const base = this.baseP[ph];
        const bat = this.batP.get(b.batter)?.[ph] ?? base;
        const bowl = this.bowlP.get(b.bowler)?.[ph] ?? base;
        const e = zero();
        let total = 0;
        for (const k of OUTCOME_KEYS) {
          e[k] = base[k] * Math.pow(bat[k] / base[k], COMBINATION.batExponent) * Math.pow(bowl[k] / base[k], COMBINATION.bowlExponent);
          total += e[k];
        }
        for (const cellKey of [`${hand}|${cls}|${ph}`, `${hand}|${cls}|all`]) {
          const cell = this.cells.get(cellKey) ?? this.cells.set(cellKey, { balls: 0, observed: zero(), expected: zero() }).get(cellKey)!;
          cell.balls += 1;
          cell.observed[key] += 1;
          for (const k of OUTCOME_KEYS) cell.expected[k] += e[k] / total;
        }
      }
    }
  }

  summary(): MatchupTables {
    const cells: Record<string, MatchupCell> = {};
    for (const [k, c] of [...this.cells.entries()].sort()) cells[k] = { balls: c.balls, observed: c.observed, expected: Object.fromEntries(OUTCOME_KEYS.map((o) => [o, Math.round(c.expected[o] * 100) / 100])) as Counts };
    return { cells, coverage: { balls: this.balls, labelled: this.labelled, batters: this.batters.size, bowlers: this.bowlers.size }, combination: { ...COMBINATION } };
  }
}
