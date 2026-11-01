/**
 * What a ball's state does to the people in it (measured 2026-11-01), for the engine:
 *
 *   pressure — chases by required rate and phase: batters forced to swing hit more sixes and are
 *              caught more. Compared with second innings at the same over and wickets, so it sits on
 *              top of τ without counting the typical chase twice.
 *   gears    — how each batting style answers that pressure, beyond the population.
 *   found    — whether the striker has hit a boundary yet, within his balls-faced band. Against his
 *              own level, because better batters find boundaries sooner; each band averages to 1, so
 *              the setness curve keeps its size.
 *
 * Every number is observed ÷ expected, and expected removes the year, over, innings and wickets
 * band, then the batter, then the bowler, per outcome. Players are read in each phase, as the engine
 * plays them: against a career level, a Rotator's ordinary death hitting swamps what pressure adds.
 * Full 20-over T20Is and leagues since 2014.
 */

import { mainInnings, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { OUTCOMES, type BattingStyle, type Vector } from "../ratings/model.js";
import { outcomeKey, pressureBand, setnessBand, wicketsBand } from "./situation.js";
import { ENGINE } from "../engine/model.js";

export interface PressureTables {
  /** `${phase}|${band}` → multiplier, up to `PRESSURE.maxWickets` down. */
  pressure: Record<string, Vector>;
  /** `${style}|${phase}` → multiplier beyond `pressure`, required rate in `PRESSURE.gear`. */
  gears: Record<string, Vector>;
  /** `${setnessBand}|${0 or 1}` → multiplier for having found a boundary yet. */
  found: Record<string, Vector>;
  /**
   * `${innings}|${phase}|${wicketsBand}|${setnessBand}` → multiplier for the striker's balls faced,
   * with the batter's and bowler's own levels removed (2026-11-01): the raw table in
   * `situation.setness` also carries that better batters are the ones who reach 25 balls.
   */
  setness: Record<string, Vector>;
}

/** The chases the tables cover: a side with wickets in hand, and the required rates where a batter must swing but the game is still on. */
export const PRESSURE = { maxWickets: 7, gear: [11, 18] as [number, number] };

const FROM_YEAR = 2014;
/** Expected events a player's ratio is shrunk with, outcome by outcome: career toward 1, phase toward career. */
const PLAYER_PRIOR = 30;
/** Expected events a table cell is shrunk toward 1 with. */
const CELL_PRIOR = 60;

type Counts = number[];
type Ball = { peer: Counts; batter: string; bowler: string; year: number; innings: 1 | 2; phase: Phase; outcome: number; wickets: number; rpo: number | null; faced: number; found: boolean };

const zeros = (): Counts => OUTCOMES.map(() => 0);
const tallyKey = (o: OutcomeKey) => OUTCOMES.indexOf(o);

/** Observed and expected per outcome, keyed however a table needs. */
class Ratios {
  private readonly cells = new Map<string, { seen: Counts; expected: Counts }>();
  add(key: string, outcome: number, expected: Counts): void {
    const c = this.cells.get(key) ?? this.cells.set(key, { seen: zeros(), expected: zeros() }).get(key)!;
    c.seen[outcome]! += 1;
    for (let k = 0; k < OUTCOMES.length; k += 1) c.expected[k]! += expected[k]!;
  }
  ratio(key: string, prior: number, centre?: Counts): Counts | undefined {
    const c = this.cells.get(key);
    return c?.seen.map((s, k) => (s + prior * (centre?.[k] ?? 1)) / (c.expected[k]! + prior));
  }
  keys(): string[] {
    return [...this.cells.keys()].sort();
  }
}

const vector = (r: Counts): Vector => Object.fromEntries(OUTCOMES.map((k, i) => [k, +r[i]!.toFixed(4)])) as Vector;

export class PressureAnalysis {
  private readonly balls: Ball[] = [];
  private readonly peers = new Map<string, Counts>();

  add(m: Match): void {
    const year = +m.date.slice(0, 4);
    if (year < FROM_YEAR || (m.scheduledOvers || 20) !== 20) return;
    const innings = mainInnings(m);
    for (const inn of innings) {
      if (inn.reduced || inn.superOver) continue;
      const target = inn.index === 1 ? inn.target ?? innings[0]!.total + 1 : null;
      const faced = new Map<string, number>(), hit = new Set<string>();
      let wickets = 0, runs = 0, legal = 0;
      for (const b of inn.balls) {
        if (b.legal && b.over < 20) {
          const left = 120 - legal;
          const out = b.wickets.some((w) => w.playerOut === b.batter);
          const key = `${inn.index}|${year}|${b.over}|${wicketsBand(wickets)}`;
          const peer = this.peers.get(key) ?? this.peers.set(key, zeros()).get(key)!;
          const outcome = tallyKey(outcomeKey(b.runsBatter, out));
          peer[outcome]! += 1;
          this.balls.push({ peer, batter: b.batter, bowler: b.bowler, year, innings: (inn.index + 1) as 1 | 2, phase: phaseOf(b.over), outcome, wickets, rpo: target !== null && left > 0 && target > runs ? ((target - runs) * 6) / left : null, faced: faced.get(b.batter) ?? 0, found: hit.has(b.batter) });
          faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
          legal += 1;
          if (b.isFour || b.isSix) hit.add(b.batter);
        }
        runs += b.runsTotal;
        wickets += b.wickets.length;
      }
    }
  }

  /** The tables, once every ball is in. `styleOf` gives a batter's style going into a year. */
  tables(styleOf: (id: string, year: number) => BattingStyle | null): PressureTables {
    const peerShare = new Map<Counts, Counts>();
    for (const c of this.peers.values()) {
      const n = c.reduce((a, x) => a + x, 0);
      peerShare.set(c, c.map((x) => x / n));
    }
    const times = (a: Counts, r: Counts | undefined) => (r ? a.map((x, k) => x * r[k]!) : a);
    // The ratios are cached per player and phase, so one ball's expected vector is two small multiplications.
    const cache = new Map<string, Counts | undefined>();
    // Players are removed at the strength the engine plays them (bat^a, bowl^b; 2026-11-01 audit):
    // at full strength the tables were measured against batters the engine never fields.
    const ratio = (t: Ratios, id: string, phase: Phase) => {
      const key = `${t === batters ? "b" : "o"}|${id}|${phase}`;
      if (!cache.has(key)) {
        const full = t.ratio(`${id}|${phase}`, PLAYER_PRIOR, t.ratio(id, PLAYER_PRIOR));
        const exp = t === batters ? ENGINE.batExponent : ENGINE.bowlExponent;
        cache.set(key, full?.map((x) => Math.pow(x, exp)));
      }
      return cache.get(key);
    };
    const tally = (t: Ratios, id: string, b: Ball, expected: Counts) => {
      t.add(id, b.outcome, expected);
      t.add(`${id}|${b.phase}`, b.outcome, expected);
    };
    const batters = new Ratios(), bowlers = new Ratios();
    for (const b of this.balls) tally(batters, b.batter, b, peerShare.get(b.peer)!);
    for (const b of this.balls) tally(bowlers, b.bowler, b, times(peerShare.get(b.peer)!, ratio(batters, b.batter, b.phase)));
    const expectedOf = (b: Ball) => times(times(peerShare.get(b.peer)!, ratio(batters, b.batter, b.phase)), ratio(bowlers, b.bowler, b.phase));

    const pressure = new Ratios(), found = new Ratios(), foundBand = new Ratios(), setness = new Ratios(), setnessCtx = new Ratios();
    const inPressure = (b: Ball) => b.rpo !== null && b.wickets <= PRESSURE.maxWickets;
    for (const b of this.balls) {
      const e = expectedOf(b);
      if (inPressure(b)) pressure.add(`${b.phase}|${pressureBand(b.rpo!)}`, b.outcome, e);
      const band = setnessBand(b.faced);
      found.add(`${band}|${b.found ? 1 : 0}`, b.outcome, e);
      foundBand.add(band, b.outcome, e);
      const ctx = `${b.innings}|${b.phase}|${wicketsBand(b.wickets)}`;
      setness.add(`${ctx}|${band}`, b.outcome, e);
      setnessCtx.add(ctx, b.outcome, e);
    }
    const gears = new Ratios(), gearAll = new Ratios();
    const styles = new Map<string, BattingStyle | null>();
    for (const b of this.balls) {
      if (!inPressure(b) || b.rpo! < PRESSURE.gear[0] || b.rpo! >= PRESSURE.gear[1]) continue;
      const id = `${b.batter}|${b.year}`;
      if (!styles.has(id)) styles.set(id, styleOf(b.batter, b.year));
      const style = styles.get(id);
      const e = times(expectedOf(b), pressure.ratio(`${b.phase}|${pressureBand(b.rpo!)}`, CELL_PRIOR));
      gearAll.add(b.phase, b.outcome, e);
      if (style) gears.add(`${style}|${b.phase}`, b.outcome, e);
    }
    const relative = (r: Counts, to: Counts | undefined) => r.map((x, k) => x / (to?.[k] ?? 1));
    return {
      pressure: Object.fromEntries(pressure.keys().map((k) => [k, vector(pressure.ratio(k, CELL_PRIOR)!)])),
      gears: Object.fromEntries(gears.keys().map((k) => [k, vector(relative(gears.ratio(k, CELL_PRIOR)!, gearAll.ratio(k.split("|")[1]!, CELL_PRIOR)))])),
      found: Object.fromEntries(found.keys().map((k) => [k, vector(relative(found.ratio(k, CELL_PRIOR)!, foundBand.ratio(k.split("|")[0]!, CELL_PRIOR)))])),
      setness: Object.fromEntries(setness.keys().map((k) => [k, vector(relative(setness.ratio(k, CELL_PRIOR)!, setnessCtx.ratio(k.split("|").slice(0, 3).join("|"), CELL_PRIOR)))])),
    };
  }
}
