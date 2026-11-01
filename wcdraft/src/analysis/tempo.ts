/**
 * Batting tempo: how an innings starts and grows (decided 2026-10-31).
 *
 * Every legal ball across T20Is and leagues is compared with peers at the same year, over and
 * stage of the batter's innings (first 10 balls, 11–25, 26+), so an opener's powerplay is not held
 * against a finisher's death overs. Three numbers then place a batter:
 *   start boundary — boundary % in the first 10 balls faced (fours and sixes)
 *   start dot      — dot % in the first 10 balls faced
 *   later scoring  — runs per ball from ball 11 on
 * Fast from ball one also needs first-10 strike rate, so boundaries among many dots do not count.
 * Six styles:
 *                         scores big later    does not
 *   fast from ball one    Aggressor           Starter
 *   few dots              Complete            Rotator
 *   neither               Builder             Anchor
 *
 * A style at an edition is the three years before it, pulled toward the career with
 * `CAREER_PULL` balls. Three-year windows alone kept the same tag to the next World Cup 52% of the
 * time, pulled 72%; split-half r is 0.66–0.69 on these measures (over 1,000+ balls since 2016).
 * The career includes balls after the edition, so a style carries some hindsight.
 *
 * The engine plays the same idea outcome by outcome: a `StartShape` is what a batter does in his
 * first 10 balls and after, each against peers, over his level across both.
 *
 * Runs added at a World Cup value each ball from the resource table: runs plus the change in
 * expected runs still to come, so a wicket costs what it costs at that point of that innings.
 */

import { mainInnings, type Match } from "../cricsheet/match.js";
import { BATTING_STYLES, OUTCOMES, type BattingStyle, type StartShape, type StyleEdition, type StyleOut, type StyleResults, type StyleRow, type Vector } from "../ratings/model.js";
import { outcomeKey } from "./situation.js";

/** Balls of career pulled into every three-year window. */
const CAREER_PULL = 300;
/** The years before an edition that make its window. */
const WINDOW_YEARS = 3;
/** A window counts from these balls; a career needs the later-balls bar as well. */
const MIN_BALLS = 200, MIN_START_BALLS = 60, MIN_LATER_BALLS = 80;
/** The batters the cuts come from: long records with real innings after the start. */
const CUT_POPULATION = { balls: 1000, laterBalls: 300 };
/**
 * Share of that population below each cut. Fast takes both boundaries and first-10 strike rate: on
 * boundaries alone 30% of long records were Aggressors, Gayle among them for all his early dots.
 */
export const STYLE_CUTS = { fastBoundary: 0.65, fastRuns: 0.6, lowDot: 0.5, big: 0.55 };
/** Balls a style's best player needs at a World Cup to be named. */
const BEST_MIN_BALLS = 30;
/** Innings length the expected-runs table is scaled to: a year's runs per ball × this. */
const INNINGS_BALLS = 118;
/**
 * Expected events a shape's ratio is shrunk toward the batter's own level with. Set out of sample:
 * shapes built on balls before 2023 against the first-10-v-later gap of 464 batters from 2023 on,
 * so each prior is where that outcome's slope reaches 1 (no hindsight, unlike the split-half r
 * above). r stays low there, 0.06–0.24, so a batter's start is real but much smaller than it looks.
 */
export const SHAPE_PRIOR: Vector = { "0": 700, "1": 1250, "2": 680, "3": 680, "4": 310, "6": 200, W: 440 };

export type StyleCuts = { fastBoundary: number; fastRuns: number; lowDot: number; big: number };
type Totals = { n: number; runs: number; boundaries: number; dots: number; outcomes: number[] };
/** Outcome counts seen and expected from peers, first 10 balls and after. */
type ShapeAcc = { startSeen: number[]; startExpected: number[]; laterSeen: number[]; laterExpected: number[] };
type Acc = { startN: number; startBoundary: number; startDot: number; startRuns: number; laterN: number; laterRuns: number; balls: number };
type Profile = { startBoundary: number; startDot: number; startRuns: number; laterRuns: number; balls: number };
type WorldCupBall = { batter: string; runs: number; wickets: number; next: { left: number; wickets: number } | null; left: number; out: boolean };
type WorldCupMatch = { editionId: string; date: string; year: number; winner: string | null; orders: Record<string, string[]>; names: Map<string, string>; balls: WorldCupBall[] };

const emptyAcc = (): Acc => ({ startN: 0, startBoundary: 0, startDot: 0, startRuns: 0, laterN: 0, laterRuns: 0, balls: 0 });
const zeros = () => OUTCOMES.map(() => 0);
const emptyShape = (): ShapeAcc => ({ startSeen: zeros(), startExpected: zeros(), laterSeen: zeros(), laterExpected: zeros() });
const shapeTotal = (rows: ShapeAcc[], scale = 1): ShapeAcc => {
  const t = emptyShape();
  for (const r of rows) for (const k of Object.keys(t) as (keyof ShapeAcc)[]) r[k].forEach((x, i) => { t[k][i]! += scale * x; });
  return t;
};
const stage = (faced: number) => (faced <= 10 ? 0 : faced <= 25 ? 1 : 2);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(q * (s.length - 1))] ?? 0;
};

/** Each legal ball of a match with the batter's balls faced so far in the innings. */
function* legalBalls(m: Match) {
  for (const inn of mainInnings(m)) {
    const faced = new Map<string, number>();
    for (const b of inn.balls) {
      if (!b.legal) continue;
      const n = (faced.get(b.batter) ?? 0) + 1;
      faced.set(b.batter, n);
      yield { inn, b, n, out: b.wickets.some((w) => w.playerOut === b.batter) };
    }
  }
}

export class TempoAnalysis {
  private readonly peers = new Map<string, Totals>();
  private readonly firstInnings = new Map<number, { runs: number; balls: number }>();
  private readonly players = new Map<string, Map<number, Acc>>();
  private readonly shapes = new Map<string, Map<number, ShapeAcc>>();
  private readonly worldCups: WorldCupMatch[] = [];
  private cuts: StyleCuts | null = null;
  private careers = new Map<string, Profile>();

  private static key(year: string, over: number, n: number): string {
    return `${year}|${Math.min(19, over)}|${stage(n)}`;
  }

  /** First pass: what peers did at each year, over and stage. */
  addPopulation(m: Match): void {
    const year = m.date.slice(0, 4);
    const first = mainInnings(m)[0];
    for (const { inn, b, n, out } of legalBalls(m)) {
      const key = TempoAnalysis.key(year, b.over, n);
      const t = this.peers.get(key) ?? this.peers.set(key, { n: 0, runs: 0, boundaries: 0, dots: 0, outcomes: zeros() }).get(key)!;
      t.n += 1; t.runs += b.runsBatter;
      t.outcomes[OUTCOMES.indexOf(outcomeKey(b.runsBatter, out))]! += 1;
      if (b.runsBatter === 4 || b.runsBatter === 6) t.boundaries += 1;
      if (b.runsBatter === 0 && !out) t.dots += 1;
      if (inn === first) {
        const f = this.firstInnings.get(+year) ?? this.firstInnings.set(+year, { runs: 0, balls: 0 }).get(+year)!;
        f.runs += b.runsBatter; f.balls += 1;
      }
    }
  }

  /** Second pass: each ball against those peers, under its batter and year. */
  add(m: Match, worldCup: string | null = null): void {
    const year = m.date.slice(0, 4);
    for (const { b, n, out } of legalBalls(m)) {
      const t = this.peers.get(TempoAnalysis.key(year, b.over, n))!;
      const years = this.players.get(b.batter) ?? this.players.set(b.batter, new Map()).get(b.batter)!;
      const a = years.get(+year) ?? years.set(+year, emptyAcc()).get(+year)!;
      a.balls += 1;
      const shapes = this.shapes.get(b.batter) ?? this.shapes.set(b.batter, new Map()).get(b.batter)!;
      const shape = shapes.get(+year) ?? shapes.set(+year, emptyShape()).get(+year)!;
      const [seen, expected] = n <= 10 ? [shape.startSeen, shape.startExpected] : [shape.laterSeen, shape.laterExpected];
      seen[OUTCOMES.indexOf(outcomeKey(b.runsBatter, out))]! += 1;
      t.outcomes.forEach((x, i) => { expected[i]! += x / t.n; });
      const runs = b.runsBatter - t.runs / t.n;
      if (n <= 10) {
        a.startN += 1;
        a.startRuns += runs;
        a.startBoundary += (b.runsBatter === 4 || b.runsBatter === 6 ? 1 : 0) - t.boundaries / t.n;
        a.startDot += (b.runsBatter === 0 && !out ? 1 : 0) - t.dots / t.n;
      } else {
        a.laterN += 1;
        a.laterRuns += runs;
      }
    }
    if (worldCup) this.addWorldCup(m, worldCup);
  }

  private addWorldCup(m: Match, editionId: string): void {
    const balls: WorldCupBall[] = [];
    const orders: Record<string, string[]> = {};
    for (const inn of mainInnings(m)) {
      orders[inn.team] = inn.battingOrder;
      const total = (m.scheduledOvers || 20) * 6;
      let legal = 0, wickets = 0;
      const start = balls.length;
      for (const b of inn.balls) {
        if (!b.legal) { wickets += b.wickets.length; continue; }
        const left = Math.max(0, total - legal);
        balls.push({ batter: b.batter, runs: b.runsBatter, wickets, left, out: b.wickets.some((w) => w.playerOut === b.batter), next: null });
        legal += 1;
        wickets += b.wickets.length;
        if (balls.length > start + 1) balls[balls.length - 2]!.next = { left, wickets: balls[balls.length - 1]!.wickets };
      }
    }
    this.worldCups.push({ editionId, date: m.date, year: +m.date.slice(0, 4), winner: m.winner ?? m.tieWinner, orders, names: m.names, balls });
  }

  /** Call once after every ball is in: careers and the population cuts. */
  freeze(): void {
    for (const [id, years] of this.players) {
      const p = this.profile([...years.values()]);
      if (p) this.careers.set(id, p);
    }
    const pop = [...this.careers.entries()].filter(([id, p]) => p.balls >= CUT_POPULATION.balls && this.laterBalls(id) >= CUT_POPULATION.laterBalls).map(([, p]) => p);
    this.cuts = {
      fastBoundary: quantile(pop.map((p) => p.startBoundary), STYLE_CUTS.fastBoundary),
      fastRuns: quantile(pop.map((p) => p.startRuns), STYLE_CUTS.fastRuns),
      lowDot: quantile(pop.map((p) => p.startDot), STYLE_CUTS.lowDot),
      big: quantile(pop.map((p) => p.laterRuns), STYLE_CUTS.big),
    };
  }

  private laterBalls(id: string): number {
    return [...(this.players.get(id)?.values() ?? [])].reduce((a, x) => a + x.laterN, 0);
  }

  private profile(rows: Acc[]): Profile | null {
    const a = emptyAcc();
    for (const r of rows) for (const k of Object.keys(a) as (keyof Acc)[]) a[k] += r[k];
    if (a.balls < MIN_BALLS || a.startN < MIN_START_BALLS || a.laterN < MIN_LATER_BALLS) return null;
    return { startBoundary: a.startBoundary / a.startN, startDot: a.startDot / a.startN, startRuns: a.startRuns / a.startN, laterRuns: a.laterRuns / a.laterN, balls: a.balls };
  }

  /** The style a batter carries into a year's World Cup; null with too few balls anywhere. */
  styleAt(id: string, year: number): StyleOut | null {
    const career = this.careers.get(id);
    if (!career || !this.cuts) return null;
    const window = [...(this.players.get(id) ?? [])].filter(([y]) => y >= year - WINDOW_YEARS && y < year).map(([, a]) => a);
    const sum = window.reduce((t, a) => ({ startN: t.startN + a.startN, startBoundary: t.startBoundary + a.startBoundary, startDot: t.startDot + a.startDot, startRuns: t.startRuns + a.startRuns, laterN: t.laterN + a.laterN, laterRuns: t.laterRuns + a.laterRuns }), { startN: 0, startBoundary: 0, startDot: 0, startRuns: 0, laterN: 0, laterRuns: 0 });
    const pull = (total: number, n: number, c: number) => (total + c * CAREER_PULL) / (n + CAREER_PULL);
    const f = {
      startBoundary: pull(sum.startBoundary, sum.startN, career.startBoundary),
      startDot: pull(sum.startDot, sum.startN, career.startDot),
      startRuns: pull(sum.startRuns, sum.startN, career.startRuns),
      laterRuns: pull(sum.laterRuns, sum.laterN, career.laterRuns),
    };
    return {
      tag: styleOf(f, this.cuts),
      startBoundary: +(100 * f.startBoundary).toFixed(1),
      startDot: +(100 * f.startDot).toFixed(1),
      startSR: +(100 * f.startRuns).toFixed(1),
      laterSR: +(100 * f.laterRuns).toFixed(1),
      balls: career.balls,
    };
  }

  /** The batter's shape going into a year: the same three years pulled toward the career as his style. */
  shapeAt(id: string, year: number): StartShape | null {
    const rows = this.shapes.get(id);
    if (!rows || !this.careers.has(id)) return null;
    const window = shapeTotal([...rows].filter(([y]) => y >= year - WINDOW_YEARS && y < year).map(([, s]) => s));
    const career = shapeTotal([...rows.values()]);
    const balls = (x: number[]) => x.reduce((a, v) => a + v, 0);
    const pull = (seen: number[], expected: number[], total: number[], totalExpected: number[]) => {
      const scale = CAREER_PULL / Math.max(CAREER_PULL, balls(total));
      return { seen: seen.map((x, i) => x + scale * total[i]!), expected: expected.map((x, i) => x + scale * totalExpected[i]!) };
    };
    const start = pull(window.startSeen, window.startExpected, career.startSeen, career.startExpected);
    const later = pull(window.laterSeen, window.laterExpected, career.laterSeen, career.laterExpected);
    const level = start.seen.map((x, i) => (x + later.seen[i]! + 1) / (start.expected[i]! + later.expected[i]! + 1));
    // Shrunk toward his level, so a thin stage reads 1 and his level survives both stages together.
    const ratio = (s: { seen: number[]; expected: number[] }) => Object.fromEntries(OUTCOMES.map((k, i) => [k, +((s.seen[i]! + SHAPE_PRIOR[k] * level[i]!) / (s.expected[i]! + SHAPE_PRIOR[k]) / level[i]!).toFixed(4)])) as Vector;
    return { start: ratio(start), later: ratio(later) };
  }

  /** Runs added by style at each World Cup. */
  results(resources: number[][]): StyleResults {
    type Cell = { balls: number; added: number; people: Map<string, { added: number; balls: number; name: string }> };
    const blank = (): Cell => ({ balls: 0, added: 0, people: new Map() });
    const editions = new Map<string, Map<BattingStyle | null, Cell>>();
    const overall = new Map<BattingStyle | null, { balls: number; added: number }>();
    for (const m of this.worldCups) {
      if (!m.winner) continue;
      const f = this.firstInnings.get(m.year);
      const scale = f ? (f.runs / f.balls) * INNINGS_BALLS : 150;
      const still = (wickets: number, left: number) => (wickets >= 10 ? 0 : (resources[Math.min(9, wickets)]?.[Math.max(0, Math.min(120, left))] ?? 0) * scale);
      const cells = editions.get(m.editionId) ?? editions.set(m.editionId, new Map()).get(m.editionId)!;
      for (const b of m.balls) {
        const style = this.styleAt(b.batter, +m.editionId)?.tag ?? null;
        // The last ball of an innings: a finished chase has nothing left to lose; an all-out loses all that was left.
        const value = b.next ? b.runs + still(b.next.wickets, b.next.left) - still(b.wickets, b.left) : b.out ? b.runs - still(b.wickets, b.left) : b.runs;
        const c = cells.get(style) ?? cells.set(style, blank()).get(style)!;
        c.balls += 1; c.added += value;
        const person = c.people.get(b.batter) ?? c.people.set(b.batter, { added: 0, balls: 0, name: m.names.get(b.batter) ?? b.batter }).get(b.batter)!;
        person.added += value; person.balls += 1;
        const o = overall.get(style) ?? overall.set(style, { balls: 0, added: 0 }).get(style)!;
        o.balls += 1; o.added += value;
      }
    }
    const rows = (map: Map<BattingStyle | null, { balls: number; added: number; people?: Cell["people"] }>): StyleRow[] => {
      const list = [...map.entries()];
      const balls = list.reduce((a, [, c]) => a + c.balls, 0);
      const mean = list.reduce((a, [, c]) => a + c.added, 0) / Math.max(1, balls);
      return list.map(([style, c]) => {
        const top = [...(c.people ?? [])].filter(([, p]) => p.balls >= BEST_MIN_BALLS).sort((a, b) => b[1].added - a[1].added)[0];
        return { style, ballsPct: +((100 * c.balls) / balls).toFixed(1), addedPer100: +(100 * (c.added / c.balls - mean)).toFixed(1), best: top ? { id: top[0], name: top[1].name, added: +top[1].added.toFixed(1), balls: top[1].balls } : null };
      }).sort((a, b) => (a.style === null ? 1 : b.style === null ? -1 : b.addedPer100 - a.addedPer100));
    };
    const out: StyleEdition[] = [...editions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([editionId, cells]) => {
      const last = this.worldCups.filter((m) => m.editionId === editionId && m.winner).sort((a, b) => b.date.localeCompare(a.date))[0];
      const order = last?.winner ? last.orders[last.winner] ?? [] : [];
      return {
        editionId,
        rows: rows(cells),
        champion: last?.winner ? { team: last.winner, topSix: order.slice(0, 6).map((id) => ({ id, name: last.names.get(id) ?? id, style: this.styleAt(id, +editionId)?.tag ?? null })) } : null,
      };
    });
    return { overall: rows(overall), editions: out };
  }

  /** Career style counts over the cut population, for the build log. */
  mix(): Record<BattingStyle, number> {
    const out = Object.fromEntries(BATTING_STYLES.map((s) => [s, 0])) as Record<BattingStyle, number>;
    for (const [id, p] of this.careers) if (this.cuts && p.balls >= CUT_POPULATION.balls && this.laterBalls(id) >= CUT_POPULATION.laterBalls) out[styleOf(p, this.cuts)] += 1;
    return out;
  }
}

/** The six styles from the three measures. */
export function styleOf(f: { startBoundary: number; startDot: number; startRuns: number; laterRuns: number }, cuts: StyleCuts): BattingStyle {
  const fast = f.startBoundary >= cuts.fastBoundary && f.startRuns >= cuts.fastRuns, low = f.startDot <= cuts.lowDot, big = f.laterRuns >= cuts.big;
  if (big) return fast ? "Aggressor" : low ? "Complete" : "Builder";
  return fast ? "Starter" : low ? "Rotator" : "Anchor";
}
