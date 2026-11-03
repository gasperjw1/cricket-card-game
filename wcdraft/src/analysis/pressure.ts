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
 *   streak, ballInOver, chaseDots (2026-11-02) — the sequence terms of `situation.ts`, measured the
 *              same way and with setness removed too. Streak and chase dots are read against a null
 *              that shuffles each innings' balls within phase, striker and bowler, so the people in
 *              the ball and their day stay where they were and only the order goes: the raw tables'
 *              null shuffled across batters, so a good batter's run of balls read as momentum.
 *
 * Every number is observed ÷ expected, and expected removes the year, over, innings and wickets
 * band, then the batter, then the bowler, per outcome. Players are read in each phase, as the engine
 * plays them: against a career level, a Rotator's ordinary death hitting swamps what pressure adds.
 * Full 20-over T20Is and leagues since 2014.
 */

import { mainInnings, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { OUTCOMES, type BattingStyle, type Vector } from "../ratings/model.js";
import { dotsBand, outcomeKey, pressureBand, rngFor, setnessBand, streakBand, wicketsBand } from "./situation.js";
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
  /** `${innings}|${phase}|${wicketsBand}|${streakBand}` → runs off the last six balls, real over the null. */
  streak?: Record<string, Vector>;
  /** `${innings}|${phase}|${position}` → legal-ball position in the over. */
  ballInOver?: Record<string, Vector>;
  /** `${phase}|${wicketsBand}|${dotsBand}` → consecutive dots before this ball in a chase, real over the null. */
  chaseDots?: Record<string, Vector>;
}

/** The chases the tables cover: a side with wickets in hand, and the required rates where a batter must swing but the game is still on. */
export const PRESSURE = { maxWickets: 7, gear: [11, 18] as [number, number] };

const FROM_YEAR = 2014;
/** Expected events a player's ratio is shrunk with, outcome by outcome: career toward 1, phase toward career. */
const PLAYER_PRIOR = 30;
/** Expected events a table cell is shrunk toward 1 with. */
const CELL_PRIOR = 60;

type Counts = number[];
/** `runs` off the bat and `total` off the ball feed the sequence terms; `position` is the legal ball's place in its over. */
/** `team`, `month` and `slot` (the striker's place in the order) feed `coachResiduals`. */
type Ball = { peer: Counts; batter: string; bowler: string; year: number; innings: 1 | 2; phase: Phase; outcome: number; wickets: number; rpo: number | null; faced: number; found: boolean; runs: number; total: number; position: number; half: 0 | 1; team: string; month: string; slot: number };

/** A match's half of the archive (by id), for traits set on one half and measured on the other. */
const halfOf = (id: string): 0 | 1 => ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 2) as 0 | 1;

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
  balls(key: string): number {
    return this.cells.get(key)?.seen.reduce((a, x) => a + x, 0) ?? 0;
  }
}

const vector = (r: Counts): Vector => Object.fromEntries(OUTCOMES.map((k, i) => [k, +r[i]!.toFixed(4)])) as Vector;

/**
 * The sequence null for one innings: slot i is filled by ball perm[i], each striker's balls against
 * each bowler in a phase shuffled among themselves (deterministic by the innings' place in the list).
 * Three things stay put, each found on the sim with every sequence term off, where a sound null
 * reads 1 (`scripts/research/sequence-null-check.mts`): a dismissal stays where it fell, since it
 * is always the batter's last ball; balls move only within the batter's setness band, since his
 * first balls are the dot-heavy, low-risk ones; and an odd total only swaps with an odd one, an even
 * with an even, since that decides who faces the next ball (a single moved into a dot's place
 * would hand the partner a ball he never faced). Shuffling across any of them made the null itself
 * read fewer wickets after dots and after a quiet run.
 */
function nullOrder(start: number, slots: Ball[]): number[] {
  const W = tallyKey("W");
  const groups = new Map<string, number[]>();
  slots.forEach((b, i) => { if (b.outcome === W) return; const g = `${b.phase}|${b.batter}|${b.bowler}|${setnessBand(b.faced)}|${b.total % 2}`; (groups.get(g) ?? groups.set(g, []).get(g)!).push(i); });
  const next = rngFor(`seq:${start}`);
  const perm = slots.map((_, i) => i);
  for (const idx of groups.values()) {
    const shuffled = idx.slice();
    for (let a = shuffled.length - 1; a > 0; a -= 1) { const c = Math.floor(next() * (a + 1)); [shuffled[a], shuffled[c]] = [shuffled[c]!, shuffled[a]!]; }
    idx.forEach((slot, n) => { perm[slot] = shuffled[n]!; });
  }
  return perm;
}

/** One row of `dotResponse`: a type's next ball after a run of dots, real over the null, against the same type's other balls. */
export interface DotResponseRow {
  key: string;
  balls: number;
  multiplier: Vector;
}

export class PressureAnalysis {
  private readonly balls: Ball[] = [];
  /** Each innings' balls as a [start, end) range of `balls`, in order. */
  private readonly inningsRanges: [number, number][] = [];
  private readonly peers = new Map<string, Counts>();
  /**
   * Kept by `tables()` for `dotResponse`: a ball's expected outcome shares with players and setness
   * removed (`full`), and with only the batter removed (`batter`, for reading a bowler's own rates).
   */
  private expect: { full: (b: Ball) => Counts; batter: (b: Ball) => Counts } | null = null;

  add(m: Match): void {
    const year = +m.date.slice(0, 4);
    if (year < FROM_YEAR || (m.scheduledOvers || 20) !== 20) return;
    const month = m.date.slice(0, 7);
    const innings = mainInnings(m);
    for (const inn of innings) {
      if (inn.reduced || inn.superOver) continue;
      const target = inn.index === 1 ? inn.target ?? innings[0]!.total + 1 : null;
      const faced = new Map<string, number>(), hit = new Set<string>();
      let wickets = 0, runs = 0, legal = 0, inOver = 0, lastOver = -1;
      const start = this.balls.length;
      for (const b of inn.balls) {
        if (b.over !== lastOver) { inOver = 0; lastOver = b.over; }
        if (b.legal && b.over < 20) {
          const left = 120 - legal;
          const out = b.wickets.some((w) => w.playerOut === b.batter);
          const key = `${inn.index}|${year}|${b.over}|${wicketsBand(wickets)}`;
          const peer = this.peers.get(key) ?? this.peers.set(key, zeros()).get(key)!;
          const outcome = tallyKey(outcomeKey(b.runsBatter, out));
          peer[outcome]! += 1;
          this.balls.push({ peer, batter: b.batter, bowler: b.bowler, year, innings: (inn.index + 1) as 1 | 2, phase: phaseOf(b.over), outcome, wickets, rpo: target !== null && left > 0 && target > runs ? ((target - runs) * 6) / left : null, faced: faced.get(b.batter) ?? 0, found: hit.has(b.batter), runs: b.runsBatter, total: b.runsTotal, position: Math.min(6, inOver + 1), half: halfOf(m.id), team: inn.team, month, slot: inn.battingOrder.indexOf(b.batter) + 1 });
          faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
          legal += 1;
          inOver += 1;
          if (b.isFour || b.isSix) hit.add(b.batter);
        }
        runs += b.runsTotal;
        wickets += b.wickets.length;
      }
      if (this.balls.length > start) this.inningsRanges.push([start, this.balls.length]);
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

    // Sequence terms. Expected also carries the striker's setness, so a slow start is not read as a cold run.
    const setCache = new Map<string, Counts>();
    const withSetness = (b: Ball) => {
      const ctx = `${b.innings}|${b.phase}|${wicketsBand(b.wickets)}`, key = `${ctx}|${setnessBand(b.faced)}`;
      if (!setCache.has(key)) setCache.set(key, relative(setness.ratio(key, CELL_PRIOR)!, setnessCtx.ratio(ctx, CELL_PRIOR)));
      return times(expectedOf(b), setCache.get(key));
    };
    type Seq = { cell: Ratios; base: Ratios };
    const seq = () => ({ real: { cell: new Ratios(), base: new Ratios() }, nil: { cell: new Ratios(), base: new Ratios() } });
    const streak = seq(), dots = seq();
    const bio = new Ratios(), bioBase = new Ratios();
    const W = tallyKey("W");
    // Walks an innings in slot order; `at(i)` is the ball that fills slot i (itself, or a shuffled one).
    const walk = (slots: Ball[], at: (i: number) => { b: Ball; e: Counts }, s: Seq, d: Seq) => {
      const recent: number[] = [];
      let run = 0;
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i]!, { b, e } = at(i);
        const ctx = `${slot.innings}|${slot.phase}|${wicketsBand(slot.wickets)}`;
        const band = streakBand(recent.length, recent.slice(-6).reduce((a, x) => a + x, 0));
        if (band !== "n/a") { s.cell.add(`${ctx}|${band}`, b.outcome, e); s.base.add(ctx, b.outcome, e); }
        if (slot.innings === 2) {
          const dctx = `${slot.phase}|${wicketsBand(slot.wickets)}`;
          d.cell.add(`${dctx}|${dotsBand(run)}`, b.outcome, e);
          d.base.add(dctx, b.outcome, e);
        }
        recent.push(b.runs);
        run = b.total === 0 && b.outcome !== W ? run + 1 : 0;
      }
    };
    for (const [start, end] of this.inningsRanges) {
      const slots = this.balls.slice(start, end);
      const expected = slots.map(withSetness);
      for (let i = 0; i < slots.length; i += 1) {
        const b = slots[i]!;
        bio.add(`${b.innings}|${b.phase}|${b.position}`, b.outcome, expected[i]!);
        bioBase.add(`${b.innings}|${b.phase}`, b.outcome, expected[i]!);
      }
      walk(slots, (i) => ({ b: slots[i]!, e: expected[i]! }), streak.real, dots.real);
      const perm = nullOrder(start, slots);
      walk(slots, (i) => ({ b: slots[perm[i]!]!, e: expected[perm[i]!]! }), streak.nil, dots.nil);
    }
    this.expect = { full: withSetness, batter: (b) => times(peerShare.get(b.peer)!, ratio(batters, b.batter, b.phase)) };
    const stateRatio = (s: Seq, key: string, ctx: string) => {
      const cell = s.cell.ratio(key, CELL_PRIOR);
      return cell ? relative(cell, s.base.ratio(ctx, CELL_PRIOR)) : undefined;
    };
    const overNull = (t: ReturnType<typeof seq>, ctxOf: (key: string) => string) =>
      Object.fromEntries(t.real.cell.keys().map((k) => [k, vector(relative(stateRatio(t.real, k, ctxOf(k))!, stateRatio(t.nil, k, ctxOf(k))))]));
    const upTo = (n: number) => (k: string) => k.split("|").slice(0, n).join("|");

    return {
      streak: overNull(streak, upTo(3)),
      ballInOver: Object.fromEntries(bio.keys().map((k) => [k, vector(relative(bio.ratio(k, CELL_PRIOR)!, bioBase.ratio(upTo(2)(k), CELL_PRIOR)))])),
      chaseDots: overNull(dots, upTo(2)),
      pressure: Object.fromEntries(pressure.keys().map((k) => [k, vector(pressure.ratio(k, CELL_PRIOR)!)])),
      gears: Object.fromEntries(gears.keys().map((k) => [k, vector(relative(gears.ratio(k, CELL_PRIOR)!, gearAll.ratio(k.split("|")[1]!, CELL_PRIOR)))])),
      found: Object.fromEntries(found.keys().map((k) => [k, vector(relative(found.ratio(k, CELL_PRIOR)!, foundBand.ratio(k.split("|")[0]!, CELL_PRIOR)))])),
      setness: Object.fromEntries(setness.keys().map((k) => [k, vector(relative(setness.ratio(k, CELL_PRIOR)!, setnessCtx.ratio(k.split("|").slice(0, 3).join("|"), CELL_PRIOR)))])),
    };
  }

  /**
   * Research, 2026-11-02 (`scripts/research/dot-response.mts`); call after `tables()`. The next ball
   * after a run of dots, by who is in it: the striker's batting style, the bowler's pace or spin,
   * and the bowler's own dot and wicket rates (thirds set on the other half of the archive, so a
   * type is never read off the balls it is measured on). Two runs: the side's dots in a row (what
   * the engine's chase-dot term counts) and the striker's own. Each cell is real over the null, as
   * the engine tables are, relative to the same type's balls in the same innings.
   */
  dotResponse(styleOf: (id: string, year: number) => BattingStyle | null, groupOf: (id: string) => string | null, minBalls = 300): DotResponseRow[] {
    const expect = this.expect;
    if (!expect) throw new Error("dotResponse needs tables() first");
    const DOT = tallyKey("0"), W = tallyKey("W");
    // Each half's bowlers in thirds by their dot and wicket rates against the batters they bowled to.
    const thirds = [0, 1].map((h) => {
      const own = new Map<string, { seen: Counts; exp: Counts }>();
      for (const b of this.balls) {
        if (b.half !== h) continue;
        const c = own.get(b.bowler) ?? own.set(b.bowler, { seen: zeros(), exp: zeros() }).get(b.bowler)!;
        c.seen[b.outcome]! += 1;
        expect.batter(b).forEach((x, k) => { c.exp[k]! += x; });
      }
      const rated = [...own].filter(([, c]) => c.seen.reduce((a, x) => a + x, 0) >= minBalls);
      const third = (k: number) => {
        const r = rated.map(([id, c]) => [id, c.seen[k]! / c.exp[k]!] as const).sort((a, b) => a[1] - b[1]);
        return new Map(r.map(([id], i) => [id, ["low", "mid", "high"][Math.min(2, Math.floor((3 * i) / r.length))]!]));
      };
      return { dot: third(DOT), w: third(W) };
    });
    const styles = new Map<string, string>();
    const style = (b: Ball) => {
      const id = `${b.batter}|${b.year}`;
      if (!styles.has(id)) styles.set(id, styleOf(b.batter, b.year) ?? "none");
      return styles.get(id)!;
    };
    const dims = (b: Ball) => {
      const other = thirds[1 - b.half]!;
      return ["all", `style=${style(b)}`, `class=${groupOf(b.bowler) ?? "none"}`, `bowlDot=${other.dot.get(b.bowler) ?? "none"}`, `bowlW=${other.w.get(b.bowler) ?? "none"}`];
    };
    const t = { real: { cell: new Ratios(), base: new Ratios() }, nil: { cell: new Ratios(), base: new Ratios() } };
    const walk = (slots: Ball[], at: (i: number) => { b: Ball; e: Counts }, s: { cell: Ratios; base: Ratios }) => {
      let side = 0;
      const own = new Map<string, number>();
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i]!, { b, e } = at(i);
        const runs: [string, number][] = [["team", side], ["own", own.get(slot.batter) ?? 0]];
        for (const d of dims(slot)) for (const [kind, n] of runs) {
          s.cell.add(`${d}|${slot.innings}|${kind}|${dotsBand(n)}`, b.outcome, e);
          s.base.add(`${d}|${slot.innings}|${kind}`, b.outcome, e);
        }
        const dot = b.total === 0 && b.outcome !== W;
        side = dot ? side + 1 : 0;
        own.set(slot.batter, dot ? (own.get(slot.batter) ?? 0) + 1 : 0);
      }
    };
    for (const [start, end] of this.inningsRanges) {
      const slots = this.balls.slice(start, end);
      const expected = slots.map(expect.full);
      walk(slots, (i) => ({ b: slots[i]!, e: expected[i]! }), t.real);
      const perm = nullOrder(start, slots);
      walk(slots, (i) => ({ b: slots[perm[i]!]!, e: expected[perm[i]!]! }), t.nil);
    }
    const ctxOf = (k: string) => k.split("|").slice(0, 3).join("|");
    const state = (s: typeof t.real, k: string) => {
      const cell = s.cell.ratio(k, CELL_PRIOR);
      return cell ? cell.map((x, i) => x / (s.base.ratio(ctxOf(k), CELL_PRIOR)?.[i] ?? 1)) : undefined;
    };
    return t.real.cell.keys().map((k) => {
      const real = state(t.real, k)!, nil = state(t.nil, k);
      return { key: k, balls: t.real.cell.balls(k), multiplier: vector(real.map((x, i) => x / (nil?.[i] ?? 1))) };
    });
  }

  /**
   * Research, 2026-11-03 (`scripts/research/coach-residuals.mts`); call after `tables()`. What a
   * batting side did under each coach beyond what its batters and the bowlers they faced normally
   * do (the same expected shares as the sequence terms): runs and wickets observed against expected
   * by phase and for the lower order (No. 6 down), kept apart for the two halves of the archive so
   * a residual can be checked against itself. `tenureOf` names the coach in charge of a side in a
   * month, or null.
   */
  coachResiduals(tenureOf: (team: string, month: string) => string | null): Map<string, CoachResidual[]> {
    const expect = this.expect;
    if (!expect) throw new Error("coachResiduals needs tables() first");
    const RUNS = OUTCOMES.map((k) => (k === "W" ? 0 : Number(k)));
    const W = tallyKey("W");
    const out = new Map<string, CoachResidual[]>();
    const blank = (): CoachResidual => ({ balls: 0, ...Object.fromEntries(COACH_CELLS.map((c) => [c, { runs: [0, 0], wickets: [0, 0] }])) }) as CoachResidual;
    const cache = new Map<string, string | null>();
    for (const b of this.balls) {
      const key = `${b.team}|${b.month}`;
      if (!cache.has(key)) cache.set(key, tenureOf(b.team, b.month));
      const tenure = cache.get(key);
      if (!tenure) continue;
      const halves = out.get(tenure) ?? out.set(tenure, [blank(), blank()]).get(tenure)!;
      const h = halves[b.half]!;
      const e = expect.full(b);
      const expRuns = e.reduce((a, x, i) => a + x * RUNS[i]!, 0);
      h.balls += 1;
      for (const cell of [b.phase, ...(b.slot >= 6 ? ["lower" as const] : [])]) {
        h[cell].runs[0] += RUNS[b.outcome]!; h[cell].runs[1] += expRuns;
        h[cell].wickets[0] += b.outcome === W ? 1 : 0; h[cell].wickets[1] += e[W]!;
      }
    }
    return out;
  }
}

const COACH_CELLS = ["pp", "mid", "death", "lower"] as const;
/** One half of a coach's tenure: observed and expected runs and wickets (players removed), by phase and for No. 6 down. */
export type CoachResidual = { balls: number } & Record<(typeof COACH_CELLS)[number], { runs: [number, number]; wickets: [number, number] }>;
