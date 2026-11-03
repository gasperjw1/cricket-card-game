/**
 * The souvenir issue's sums (asked 2026-11-01, built 2026-11-02): who stood out, who did more or
 * less than his card said he would, which records moved and how often, and each man's journey
 * through the tournament match by match. Pure; the expectations come from `souvenir-load.ts`.
 *
 * "Against expectation" is measured against the card's own numbers in this World Cup, the same
 * rates the Player ratings tab prints: strike rate and balls per dismissal with the bat, economy
 * and balls per wicket with the ball, against average opposition. A seven-match tournament gives
 * a batter about 150 balls, so much of what reads as unexpected is luck; the paper describes what
 * happened and never says the card was wrong.
 */

import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import { RECORD_KINDS, type RecordBook, type RecordKind } from "./facts.ts";
import { type PlayerTotals, totalsKey } from "./stats.ts";

export interface Rates {
  /** Runs per 100 balls for a batter; runs per over for a bowler. */
  rate: number;
  ballsPerOut: number;
}

export interface Expectation {
  name: string;
  team: string;
  cardBat: number | null;
  cardBowl: number | null;
  bat: Rates | null;
  bowl: Rates | null;
}

export interface Residual {
  key: string;
  name: string;
  team: string;
  mine: boolean;
  /** Runs above what the card's strike rate would have given over the balls he faced, plus dismissals saved valued at an expected innings. */
  bat: { runs: number; balls: number; outs: number; expOuts: number; sr: number; expSr: number; above: number; card: number } | null;
  /** Runs saved against the card's economy over the overs he bowled, plus wickets above expectation valued at an expected innings. */
  bowl: { wickets: number; balls: number; runs: number; econ: number; expEcon: number; above: number; card: number } | null;
  /** The headline number: the bigger of the two in runs, signed. */
  score: number;
}

export const MIN_BALLS_FACED = 60;
export const MIN_BALLS_BOWLED = 48;

/**
 * The tournament's own level against the cards: how much faster or slower everyone scored than
 * the cards said, and how much harder or easier they were to dismiss. Expectations are against
 * average opposition before match situation, and an edition's grounds, chases and pressure move
 * the whole field together, so each man is measured against the field's level, not the abstract.
 */
export function fieldLevel(totals: Map<string, PlayerTotals>, expectations: Map<string, Expectation>): { sr: number; outs: number; econ: number; wickets: number } {
  let runs = 0, expRuns = 0, outs = 0, expOuts = 0, bowlRuns = 0, expBowlRuns = 0, wickets = 0, expWickets = 0;
  for (const [key, t] of totals) {
    const e = expectations.get(key);
    if (!e) continue;
    if (e.bat && t.balls >= MIN_BALLS_FACED) { runs += t.runs; expRuns += (e.bat.rate * t.balls) / 100; outs += t.outs; expOuts += t.balls / Math.max(1, e.bat.ballsPerOut); }
    if (e.bowl && t.bowlBalls >= MIN_BALLS_BOWLED) { bowlRuns += t.bowlRuns; expBowlRuns += (e.bowl.rate * t.bowlBalls) / 6; wickets += t.wickets; expWickets += t.bowlBalls / Math.max(1, e.bowl.ballsPerOut); }
  }
  const ratio = (a: number, b: number) => (b > 0 && a > 0 ? a / b : 1);
  return { sr: ratio(runs, expRuns), outs: ratio(outs, expOuts), econ: ratio(bowlRuns, expBowlRuns), wickets: ratio(wickets, expWickets) };
}

/** Every player with a real sample, measured against his expectation at the field's level. */
export function residuals(totals: Map<string, PlayerTotals>, expectations: Map<string, Expectation>, mineKeys: Set<string>): Residual[] {
  const out: Residual[] = [];
  const level = fieldLevel(totals, expectations);
  for (const [key, t] of totals) {
    const e = expectations.get(key);
    if (!e) continue;
    let bat: Residual["bat"] = null, bowl: Residual["bowl"] = null;
    if (e.bat && e.cardBat !== null && t.balls >= MIN_BALLS_FACED) {
      const sr = (100 * t.runs) / t.balls;
      const expSr = e.bat.rate * level.sr;
      const expBallsPerOut = Math.max(1, e.bat.ballsPerOut / level.outs);
      const expOuts = t.balls / expBallsPerOut;
      const inningsWorth = (expSr / 100) * expBallsPerOut;
      const above = (t.runs - (expSr * t.balls) / 100) + (expOuts - t.outs) * inningsWorth;
      bat = { runs: t.runs, balls: t.balls, outs: t.outs, expOuts: Math.round(expOuts * 10) / 10, sr, expSr, above, card: e.cardBat };
    }
    if (e.bowl && e.cardBowl !== null && t.bowlBalls >= MIN_BALLS_BOWLED) {
      const econ = (6 * t.bowlRuns) / t.bowlBalls;
      const expEcon = e.bowl.rate * level.econ;
      const expBallsPerWicket = Math.max(1, e.bowl.ballsPerOut / level.wickets);
      const expWickets = t.bowlBalls / expBallsPerWicket;
      const wicketWorth = (expEcon / 6) * expBallsPerWicket;
      const above = ((expEcon - econ) * t.bowlBalls) / 6 + (t.wickets - expWickets) * wicketWorth;
      bowl = { wickets: t.wickets, balls: t.bowlBalls, runs: t.bowlRuns, econ, expEcon, above, card: e.cardBowl };
    }
    if (!bat && !bowl) continue;
    const score = Math.abs(bat?.above ?? 0) >= Math.abs(bowl?.above ?? 0) ? (bat?.above ?? 0) : (bowl?.above ?? 0);
    out.push({ key, name: e.name, team: e.team, mine: mineKeys.has(key), bat, bowl, score });
  }
  return out;
}

export interface Souvenir {
  /** Best actual performers by the sums, any card. */
  standouts: Residual[];
  /** Biggest positive gap among modest cards (75 and under). */
  unexpected: Residual[];
  /** Biggest negative gap among strong cards (85 and over). */
  disappointing: Residual[];
}

export function souvenirLists(all: Residual[], n = 3): Souvenir {
  const by = (f: (r: Residual) => number) => [...all].sort((a, b) => f(b) - f(a));
  const cardOf = (r: Residual) => Math.max(r.bat?.card ?? 0, r.bowl?.card ?? 0);
  const positive = (r: Residual) => (r.bat?.above ?? 0) + (r.bowl?.above ?? 0);
  const standouts = by(positive).slice(0, n);
  return {
    standouts,
    // A man already named among the players of the tournament is not printed again here (2026-11-03:
    // both lists rank by the same sum, so a modest card who led the tournament headed both).
    unexpected: by(positive).filter((r) => !standouts.includes(r) && cardOf(r) <= 75 && positive(r) > 0).slice(0, n),
    disappointing: by((r) => -positive(r)).filter((r) => cardOf(r) >= 85 && positive(r) < 0).slice(0, n),
  };
}

/* ---------- the journey ---------- */

export interface JourneyMatch {
  opp: string;
  stageLabel: string;
  won: boolean | null;
  /** Null when he did not bat. */
  runs: number | null;
  balls: number;
  out: boolean;
  /** Null when he did not bowl. */
  wickets: number | null;
  bowlRuns: number;
  bowlBalls: number;
}

export interface Journey {
  id: string;
  name: string;
  matches: JourneyMatch[];
}

/** Each of the side's players match by match, in play order; a match he sat out is still a row. */
export function journeyFor(mine: (FixtureResult & { stageLabel: string })[], me: string, ids: { id: string; name: string }[]): Journey[] {
  return ids.map(({ id, name }) => ({
    id, name,
    matches: mine.map((f) => {
      const opp = f.teams.find((t) => t !== me) ?? "";
      const won = f.winner ? f.winner === me : null;
      const own = f.innings?.find((i) => i.team === me);
      const theirs = f.innings?.find((i) => i.team !== me);
      const b = own?.batting.find((x) => x.id === id);
      const w = theirs?.bowling.find((x) => x.id === id);
      return {
        opp, stageLabel: f.stageLabel, won,
        runs: b && (b.balls > 0 || b.out) ? b.runs : null, balls: b?.balls ?? 0, out: !!b?.out,
        wickets: w && w.balls > 0 ? w.wickets : null, bowlRuns: w?.runs ?? 0, bowlBalls: w?.balls ?? 0,
      };
    }),
  }));
}

/** "12, 45*, –, 60" for the bat; "2-18, 0-31" for the ball. */
export function journeyLine(j: Journey, skill: "bat" | "bowl"): string {
  return j.matches.map((m) => (skill === "bat" ? (m.runs === null ? "–" : `${m.runs}${m.out ? "" : "*"}`) : (m.wickets === null ? "–" : `${m.wickets}-${m.bowlRuns}`))).join(", ");
}

/* ---------- records with their chains ---------- */

export interface RecordChain {
  kind: RecordKind;
  scope: "wc" | "allWc" | "t20i";
  holder: string;
  team: string;
  opp: string;
  value: number;
  value2: number;
  /** Earlier holders this tournament, oldest first, with how many days each mark stood. */
  chain: { holder: string; value: number; value2: number; stoodDays: number }[];
}

const days = (a: string | null, b: string | null) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000)) : 0);

/** The tournament's records with the marks they passed, from this World Cup's own book after the last match. */
export function recordChains(book: RecordBook, scope: RecordChain["scope"] = "wc"): RecordChain[] {
  const out: RecordChain[] = [];
  for (const kind of RECORD_KINDS) {
    const line = book[kind];
    if (!line) continue;
    const entries = [...line.history, line.current];
    const chain = line.history.map((h, i) => ({ holder: h.holder, value: h.value, value2: h.value2, stoodDays: days(h.date, entries[i + 1]!.date) }));
    out.push({ kind, scope, holder: line.current.holder, team: line.current.team, opp: line.current.opp, value: line.current.value, value2: line.current.value2, chain });
  }
  return out;
}

export { totalsKey };
