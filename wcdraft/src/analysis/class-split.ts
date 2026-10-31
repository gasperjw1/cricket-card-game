/**
 * Batting against pace and against spin, by source (added 2026-10-30): every ball a World Cup
 * player faced in T20Is, the leagues and ODIs, filed by the bowler's class before each edition.
 *
 * Each ball carries what an average batter of the same hand scored against that class in the same
 * source, year and phase. Conditioning on class stops spin's lower scoring rate reading as "every
 * batter is worse against spin" when the bowler's own vector already carries it, and conditioning
 * on hand leaves the hand × class effect to the engine's matchup term. So `outcomes ÷ expected`
 * compares a batter with his peers against that class; the ratings then contrast the two classes
 * within one source, never across sources, because a batter's level differs by format.
 *
 * Balls are kept per source and edition with no overlap (`form` sits inside `careerToDate`, so
 * adding those two counted every recent ball twice). Two passes,
 * like the domestic and context populations: populations first, then the players.
 */

import { mainInnings, OUTCOME_KEYS, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import type { BowlGroup } from "./matchups.js";

export type ClassSource = "t20i" | "league" | "odi";

export interface ClassCounts {
  balls: number;
  outcomes: Record<OutcomeKey, number>;
  expected: Record<OutcomeKey, number>;
}

export type ClassPair = Record<BowlGroup, ClassCounts>;

export interface ClassSplitOut {
  hand: "R" | "L" | null;
  /** Career-to-date by source at the edition's start, plus `tournament`: the edition's own balls, for debutants. */
  sources: Partial<Record<ClassSource | "tournament", ClassPair>>;
}

export interface ClassLookup {
  group: (bowlerId: string) => BowlGroup | null;
  hand: (batterId: string) => "R" | "L" | null;
}

type Counts = Record<OutcomeKey, number>;
const zero = (): Counts => ({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 });
const emptyPair = (): ClassPair => ({ pace: { balls: 0, outcomes: zero(), expected: zero() }, spin: { balls: 0, outcomes: zero(), expected: zero() } });

function outcomeKey(runs: number, wicket: boolean): OutcomeKey {
  if (wicket) return "W";
  if (runs >= 6) return "6";
  if (runs === 5) return "4";
  return String(runs) as OutcomeKey;
}

const MIN_CELL_BALLS = 600;

/** ODI overs fall into the same three bands as T20 phases: powerplay 1–10, middle 11–40, death 41–50. */
function bandOf(source: ClassSource, over: number): Phase {
  if (source !== "odi") return phaseOf(over);
  return over < 10 ? "pp" : over < 40 ? "mid" : "death";
}

interface EachBall {
  batter: string;
  group: BowlGroup;
  band: Phase;
  outcome: OutcomeKey;
}

export class ClassSplitAnalysis {
  private readonly population = new Map<string, { counts: Counts; balls: number }>();
  private readonly probs = new Map<string, Counts>();
  /** person → one entry per edition (balls before that edition's start and after the previous one) → source → pair. */
  private readonly players = new Map<string, Map<ClassSource, ClassPair>[]>();
  private readonly tournament = new Map<string, Map<string, ClassPair>>();
  private frozen = false;

  /** `editions` in date order; `members` are the people worth keeping (every World Cup squad). */
  constructor(private readonly lookup: ClassLookup, private readonly editions: { id: string; start: string }[], private readonly members: Set<string>) {}

  private each(m: Match, source: ClassSource, visit: (ball: EachBall) => void): void {
    for (const inn of mainInnings(m)) {
      if (inn.reduced) continue;
      for (const b of inn.balls) {
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (b.wide && !strikerOut) continue;
        const group = this.lookup.group(b.bowler);
        if (group) visit({ batter: b.batter, group, band: bandOf(source, b.over), outcome: outcomeKey(b.runsBatter, strikerOut) });
      }
    }
  }

  private keys(source: ClassSource, year: string, band: Phase, group: BowlGroup, hand: string | null): string[] {
    const shared = `${source}|all|${band}|${group}|any`;
    return hand ? [`${source}|${year}|${band}|${group}|${hand}`, `${source}|all|${band}|${group}|${hand}`, shared] : [shared];
  }

  addPopulation(m: Match, source: ClassSource): void {
    const year = m.date.slice(0, 4);
    this.each(m, source, ({ batter, group, band, outcome }) => {
      for (const key of this.keys(source, year, band, group, this.lookup.hand(batter))) {
        const cell = this.population.get(key) ?? this.population.set(key, { counts: zero(), balls: 0 }).get(key)!;
        cell.balls += 1;
        cell.counts[outcome] += 1;
      }
    });
  }

  freeze(): void {
    for (const [key, c] of this.population) this.probs.set(key, Object.fromEntries(OUTCOME_KEYS.map((k) => [k, c.counts[k] / c.balls])) as Counts);
    this.frozen = true;
  }

  private expected(source: ClassSource, year: string, band: Phase, group: BowlGroup, hand: string | null): Counts | null {
    for (const key of this.keys(source, year, band, group, hand)) {
      if ((this.population.get(key)?.balls ?? 0) >= MIN_CELL_BALLS) return this.probs.get(key) ?? null;
    }
    return null;
  }

  /** Second pass. `wcEdition` files a World Cup match's balls under that edition's `tournament` source as well. */
  add(m: Match, source: ClassSource, wcEdition: string | null = null): void {
    if (!this.frozen) throw new Error("ClassSplitAnalysis: call freeze() after the first pass");
    const year = m.date.slice(0, 4);
    // Balls count toward every edition that starts after them; those after the last edition count toward none.
    const bucket = this.editions.findIndex((e) => e.start > m.date);
    if (bucket < 0 && !wcEdition) return;
    this.each(m, source, ({ batter, group, band, outcome }) => {
      if (!this.members.has(batter)) return;
      const e = this.expected(source, year, band, group, this.lookup.hand(batter));
      if (!e) return;
      const file = (pair: ClassPair) => {
        const c = pair[group];
        c.balls += 1;
        c.outcomes[outcome] += 1;
        for (const k of OUTCOME_KEYS) c.expected[k] += e[k];
      };
      if (bucket >= 0) {
        const buckets = this.players.get(batter) ?? this.players.set(batter, this.editions.map(() => new Map())).get(batter)!;
        const slot = buckets[bucket]!;
        file(slot.get(source) ?? slot.set(source, emptyPair()).get(source)!);
      }
      if (wcEdition) {
        const edition = this.tournament.get(wcEdition) ?? this.tournament.set(wcEdition, new Map()).get(wcEdition)!;
        file(edition.get(batter) ?? edition.set(batter, emptyPair()).get(batter)!);
      }
    });
  }

  /** A person's split at an edition's start. */
  blockFor(editionId: string, personId: string): ClassSplitOut {
    const round = (pair: ClassPair): ClassPair => {
      const part = (c: ClassCounts): ClassCounts => ({ balls: c.balls, outcomes: c.outcomes, expected: Object.fromEntries(OUTCOME_KEYS.map((k) => [k, Math.round(c.expected[k] * 100) / 100])) as Counts });
      return { pace: part(pair.pace), spin: part(pair.spin) };
    };
    const summed = new Map<ClassSource, ClassPair>();
    const upTo = this.editions.findIndex((e) => e.id === editionId);
    for (const slot of (this.players.get(personId) ?? []).slice(0, upTo + 1)) {
      for (const [source, pair] of slot) {
        const into = summed.get(source) ?? summed.set(source, emptyPair()).get(source)!;
        for (const group of ["pace", "spin"] as const) {
          into[group].balls += pair[group].balls;
          for (const k of OUTCOME_KEYS) { into[group].outcomes[k] += pair[group].outcomes[k]; into[group].expected[k] += pair[group].expected[k]; }
        }
      }
    }
    const sources: ClassSplitOut["sources"] = {};
    for (const [source, pair] of summed) sources[source] = round(pair);
    const own = this.tournament.get(editionId)?.get(personId);
    if (own) sources.tournament = round(own);
    return { hand: this.lookup.hand(personId), sources };
  }
}
