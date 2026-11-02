/**
 * Facts about a match (asked 2026-11-01): things the gazette may say because the scorecard or the
 * ball log shows them. Pure functions over a fixture and the record book as it stood before that
 * match, for your matches and CPU matches alike. A fact carries a key, a tier and its numbers; the
 * prose module turns facts into sentences, so nothing here is wording.
 *
 * Tiers: 1 is stop-press (rare, under about 5% of matches), 2 is report (worth a sentence), 3 is
 * a note (late news may use it, the report only if it has nothing better). The tiers were set from
 * the corpus harness (`draft/scripts/facts-corpus.mts`), not by hand.
 */

import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { BallRecord, BatterLine, BowlerLine, InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { fullName } from "../lib/names.ts";

/** A player as the paper names him: the full name when the names file knows it, the scorecard's short form otherwise. */
const who = (p: { id: string; name: string }) => ({ id: p.id, name: fullName(p.id, p.name) });

export type FactTier = 1 | 2 | 3;

export interface Fact {
  key: string;
  tier: FactTier;
  /** The side the fact is about (the batting side for a batting fact, the bowling side for a bowling one). */
  team: string | null;
  player: { id: string; name: string } | null;
  /** Numbers the sentence may quote; every number in the prose must come from here or the scorecard. */
  n: Record<string, number>;
  /** Names and labels the sentence may quote. */
  s: Record<string, string>;
}

/* ---------- the record book ---------- */

export type RecordKind = "highestTotal" | "lowestTotal" | "highestChase" | "bestFigures" | "highestScore" | "biggestRunsWin" | "biggestBallsWin" | "fastestFifty";
export const RECORD_KINDS: RecordKind[] = ["highestTotal", "lowestTotal", "highestChase", "bestFigures", "highestScore", "biggestRunsWin", "biggestBallsWin", "fastestFifty"];

export interface RecordEntry {
  value: number;
  /** Runs conceded for best figures; balls for the highest score; wickets down for a total. */
  value2: number;
  holder: string;
  holderId: string | null;
  team: string;
  opp: string;
  date: string | null;
  fixtureKey: string;
}

export interface RecordLine {
  current: RecordEntry;
  /** Earlier holders, oldest first. */
  history: RecordEntry[];
}

export type RecordBook = Partial<Record<RecordKind, RecordLine>>;

export interface Broken {
  kind: RecordKind;
  entry: RecordEntry;
  previous: RecordEntry | null;
}

export const fixtureKey = (f: { stageId: string; teams: [string, string] | string[] }) => `${f.stageId}|${f.teams.join("|")}`;

/** True when `a` beats `b` for this kind of record; ties never break a record. */
export function better(kind: RecordKind, a: { value: number; value2: number }, b: { value: number; value2: number }): boolean {
  switch (kind) {
    case "lowestTotal":
    case "fastestFifty": return a.value < b.value;
    case "bestFigures": return a.value > b.value || (a.value === b.value && a.value2 < b.value2);
    default: return a.value > b.value;
  }
}

/** A completed innings for the lowest-total record: all out, or the full allotment bowled, and no rain. */
const completed = (inn: InningsResult, f: FixtureResult) => !f.rain && (inn.wickets >= 10 || inn.legalBalls >= inn.scheduledOvers * 6);

/** Balls each batter took to reach fifty in an innings, from the ball log; only batters who got there. */
export function fiftyBalls(balls: BallRecord[], innings: 1 | 2): Map<string, number> {
  const runs = new Map<string, number>(), faced = new Map<string, number>(), out = new Map<string, number>();
  for (const b of balls) {
    if (b.innings !== innings) continue;
    if (b.extraKind === "wide") continue;
    const r = (runs.get(b.striker) ?? 0) + b.runsBatter;
    const n = (faced.get(b.striker) ?? 0) + 1;
    runs.set(b.striker, r);
    faced.set(b.striker, n);
    if (r >= 50 && !out.has(b.striker)) out.set(b.striker, n);
  }
  return out;
}

/** The candidate entries a fixture offers for each record kind. */
function candidates(f: FixtureResult): { kind: RecordKind; entry: RecordEntry }[] {
  const out: { kind: RecordKind; entry: RecordEntry }[] = [];
  const [i1, i2] = f.innings ?? [];
  if (!i1 || !i2) return out;
  const key = fixtureKey(f);
  const base = (team: string, opp: string) => ({ date: f.date, fixtureKey: key, team, opp });
  for (const inn of [i1, i2]) {
    const opp = inn === i1 ? i2.team : i1.team;
    if (inn.legalBalls === 0) continue;
    out.push({ kind: "highestTotal", entry: { value: inn.runs, value2: inn.wickets, holder: inn.team, holderId: null, ...base(inn.team, opp) } });
    if (completed(inn, f)) out.push({ kind: "lowestTotal", entry: { value: inn.runs, value2: inn.wickets, holder: inn.team, holderId: null, ...base(inn.team, opp) } });
    for (const b of inn.batting) if (b.balls > 0) out.push({ kind: "highestScore", entry: { value: b.runs, value2: b.balls, holder: who(b).name, holderId: b.id, ...base(inn.team, opp) } });
    for (const w of inn.bowling) if (w.wickets > 0) out.push({ kind: "bestFigures", entry: { value: w.wickets, value2: w.runs, holder: who(w).name, holderId: w.id, ...base(opp, inn.team) } });
  }
  if (f.winner === i2.team && f.margin && "wickets" in f.margin && !f.rain) {
    out.push({ kind: "highestChase", entry: { value: i2.runs, value2: i2.wickets, holder: i2.team, holderId: null, ...base(i2.team, i1.team) } });
    out.push({ kind: "biggestBallsWin", entry: { value: f.margin.ballsLeft, value2: f.margin.wickets, holder: i2.team, holderId: null, ...base(i2.team, i1.team) } });
  }
  if (f.winner === i1.team && f.margin && "runs" in f.margin && !("dls" in f.margin)) {
    out.push({ kind: "biggestRunsWin", entry: { value: f.margin.runs, value2: 0, holder: i1.team, holderId: null, ...base(i1.team, i2.team) } });
  }
  if (f.balls?.length) {
    for (const inn of [i1, i2]) {
      const opp = inn === i1 ? i2.team : i1.team;
      for (const [id, n] of fiftyBalls(f.balls, inn.index as 1 | 2)) {
        const line = inn.batting.find((b) => b.id === id);
        out.push({ kind: "fastestFifty", entry: { value: n, value2: line?.runs ?? 50, holder: fullName(id, line?.name ?? id), holderId: id, ...base(inn.team, opp) } });
      }
    }
  }
  return out;
}

/** The book after this fixture, and which records it broke. A record is only "broken" when a previous holder existed. */
export function updateRecords(book: RecordBook, f: FixtureResult): { book: RecordBook; broken: Broken[] } {
  const next: RecordBook = { ...book };
  const broken: Broken[] = [];
  // The best candidate per kind from this match, so a match never "breaks" its own record twice.
  const best = new Map<RecordKind, RecordEntry>();
  for (const { kind, entry } of candidates(f)) {
    const cur = best.get(kind);
    if (!cur || better(kind, entry, cur)) best.set(kind, entry);
  }
  for (const [kind, entry] of best) {
    const line = next[kind];
    if (!line) { next[kind] = { current: entry, history: [] }; continue; }
    if (better(kind, entry, line.current)) {
      next[kind] = { current: entry, history: [...line.history, line.current] };
      broken.push({ kind, entry, previous: line.current });
    }
  }
  return { book: next, broken };
}

export interface RecordsAt {
  before: RecordBook;
  after: RecordBook;
  broken: Broken[];
}

/** Fold the record book over fixtures in play order; each fixture sees only what came before it. */
export function foldRecords(fixtures: FixtureResult[]): Map<string, RecordsAt> {
  const out = new Map<string, RecordsAt>();
  let book: RecordBook = {};
  for (const f of fixtures) {
    const { book: after, broken } = updateRecords(book, f);
    out.set(fixtureKey(f), { before: book, after, broken });
    book = after;
  }
  return out;
}

/* ---------- full members, for upsets ---------- */

const FULL_MEMBERS = ["Australia", "England", "India", "New Zealand", "Pakistan", "South Africa", "Sri Lanka", "West Indies", "Bangladesh", "Zimbabwe"];

/** Full members at a World Cup: the ten, plus Afghanistan and Ireland from 2017. */
export function fullMembersAt(editionId: string): Set<string> {
  const year = Number(editionId.slice(0, 4));
  return new Set(year >= 2017 ? [...FULL_MEMBERS, "Afghanistan", "Ireland"] : FULL_MEMBERS);
}

/* ---------- ball-log readings ---------- */

export interface ChaseReading {
  /** Required rate at the start of the chase. */
  startRate: number;
  /** Highest required rate inside the last five overs while the chase was alive. */
  peakLateRate: number;
  /** Runs off the final over bowled, and whether the chase was completed in it. */
  finalOverRuns: number;
  wonInFinalOver: boolean;
}

export function readChase(balls: BallRecord[], i2: InningsResult): ChaseReading | null {
  const target = i2.target;
  if (!target || !balls.length) return null;
  const total = i2.scheduledOvers * 6;
  const mine = balls.filter((b) => b.innings === 2);
  if (!mine.length) return null;
  let legal = 0, peak = 0, legalAtWin = 0;
  for (const b of mine) {
    if (b.legal) legal += 1;
    const left = total - legal;
    const need = target - b.runsAfter;
    if (need <= 0) { legalAtWin = legal; break; }
    if (left <= 0) break;
    if (left <= 30) peak = Math.max(peak, (need * 6) / left);
  }
  const lastOver = Math.max(...mine.map((b) => b.over));
  const finalOver = mine.filter((b) => b.over === lastOver);
  const finalOverRuns = finalOver.reduce((a, b) => a + b.runsBatter + b.extras, 0);
  // Won in the final over: the winning run came after the first nineteen (or the shortened allotment less one) were complete.
  const wonInFinalOver = legalAtWin > total - 6;
  return { startRate: (target * 6) / total, peakLateRate: peak, finalOverRuns, wonInFinalOver };
}

/** Bowlers who took three wickets in three consecutive legal deliveries of their own, in an innings. */
export function hatTricks(balls: BallRecord[], innings: 1 | 2): string[] {
  const runs = new Map<string, number>();
  const out = new Set<string>();
  for (const b of balls) {
    if (b.innings !== innings || !b.legal) continue;
    const credited = b.wicket && b.dismissal && b.dismissal.kind !== "run out" && b.dismissal.bowler?.id === b.bowler;
    const n = credited ? (runs.get(b.bowler) ?? 0) + 1 : 0;
    runs.set(b.bowler, n);
    if (n >= 3) out.add(b.bowler);
  }
  return [...out];
}

/* ---------- the detectors ---------- */

export interface FactContext {
  editionId: string;
  /** Records before this match and what it broke. */
  records: RecordsAt;
  /** This stage is a knockout. */
  knockout: boolean;
  /** Each side's record in the tournament before this match. */
  before: Map<string, { won: number; lost: number; played: number }>;
  /** Edition-relative marks: a total or chase at or above these is big here. */
  marks: { highTotal: number; highChase: number };
}

const topBat = (inn: InningsResult): BatterLine | null => [...inn.batting].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0] ?? null;
const topBowl = (inn: InningsResult): BowlerLine | null => [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0] ?? null;

/** A sharp fall: at least four wickets for 25 runs or fewer, the longest such run. */
export function collapseIn(inn: InningsResult): { wickets: number; runs: number; from: number } | null {
  const fow = inn.fallOfWickets;
  let best: { wickets: number; runs: number; from: number } | null = null;
  for (let i = 0; i < fow.length; i += 1) {
    for (let j = i + 4; j < fow.length; j += 1) {
      const runs = fow[j]!.runs - fow[i]!.runs;
      if (runs <= 25 && (!best || j - i > best.wickets)) best = { wickets: j - i, runs, from: fow[i]!.runs };
    }
  }
  return best;
}

/** Marks for an edition from its scoring rate: a big total and a big chase here, not in the abstract. */
export function marksFor(runsPerOver: number): { highTotal: number; highChase: number } {
  return { highTotal: Math.round(runsPerOver * 20 + 45), highChase: Math.round(runsPerOver * 20 + 25) };
}

export function factsFor(f: FixtureResult, ctx: FactContext): Fact[] {
  const facts: Fact[] = [];
  const [i1, i2] = f.innings ?? [];
  const add = (key: string, tier: FactTier, team: string | null, player: { id: string; name: string } | null, n: Record<string, number> = {}, s: Record<string, string> = {}) =>
    facts.push({ key, tier, team, player, n, s });
  const full = fullMembersAt(ctx.editionId);
  const loser = f.winner ? f.teams.find((t) => t !== f.winner) ?? null : null;

  // Results that are facts in themselves.
  if (!f.winner) add("noResult", 3, null, null);
  if (f.tieBreak) add(f.tieBreak.method === "super-over" ? "superOver" : f.tieBreak.method === "bowl-out" ? "bowlOut" : "coinToss", 1, f.winner, null);
  if (f.margin && "dls" in f.margin) add("dls", 2, f.winner, null, { runs: f.margin.runs });
  if (f.winner && loser && !full.has(f.winner) && full.has(loser)) add("upset", 1, f.winner, null, {}, { loser });
  if (ctx.knockout && f.winner && loser) add("knockout", 2, f.winner, null, {}, { loser });
  if (f.winner && f.margin && !f.tieBreak) {
    const m = f.margin;
    if ("wickets" in m) {
      if (m.ballsLeft === 0) add("lastBall", 1, f.winner, null, { wickets: m.wickets });
      else if (m.ballsLeft <= 3 || m.wickets === 1) add("nailBiter", 2, f.winner, null, { wickets: m.wickets, ballsLeft: m.ballsLeft });
      // Routs: a fifth of matches met the old bar (corpus), so it sits higher now.
      if (m.ballsLeft >= 48 && m.wickets >= 8) add("rout", 2, f.winner, null, { wickets: m.wickets, ballsLeft: m.ballsLeft }, { loser: loser ?? "" });
    } else if (!("dls" in m)) {
      if (m.runs <= 4) add("nailBiter", 2, f.winner, null, { runs: m.runs });
      if (m.runs >= 75) add("rout", 2, f.winner, null, { runs: m.runs }, { loser: loser ?? "" });
    }
  }

  // The sides' runs.
  if (f.winner) {
    const b = ctx.before.get(f.winner);
    if (b && b.played >= 2 && b.won === 0) add("firstWin", 2, f.winner, null, { after: b.played, attempt: b.played + 1 });
    if (b && b.lost === 0 && b.won + 1 >= 5) add("unbeatenRun", 2, f.winner, null, { wins: b.won + 1 });
  }

  if (!i1 || !i2) return facts;

  for (const inn of [i1, i2]) {
    const opp = inn === i1 ? i2.team : i1.team;
    const won = f.winner === inn.team;
    const top = topBat(inn);
    const best = topBowl(inn);
    for (const b of inn.batting) if (b.runs >= 100) add("hundred", 1, inn.team, who(b), { runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, notOut: b.out ? 0 : 1 });
    for (const w of inn.bowling) if (w.wickets >= 5) add("fiveFor", 1, opp, who(w), { wickets: w.wickets, runs: w.runs, balls: w.balls });
    if (inn.captainId) {
      const c = inn.batting.find((b) => b.id === inn.captainId);
      if (c && c.out && c.runs === 0) add("captainDuck", 3, inn.team, who(c), { balls: c.balls });
    }
    if (completed(inn, f) && inn.runs < 100) add("subHundred", inn.runs < 90 ? 2 : 3, inn.team, null, { runs: inn.runs, wickets: inn.wickets, balls: inn.legalBalls }, { opp });
    if (inn.runs >= ctx.marks.highTotal) add("bigTotal", 2, inn.team, null, { runs: inn.runs, wickets: inn.wickets }, { opp });
    if (inn.index === 2 && won && inn.runs >= ctx.marks.highChase && !f.rain) add("bigChase", 1, inn.team, null, { runs: inn.runs, wickets: inn.wickets, target: inn.target ?? inn.runs }, { opp });
    // A lone hand: fifty or more in a win with no team-mate past 30.
    if (won && top && top.runs >= 50 && inn.batting.every((b) => b === top || b.runs <= 30)) {
      const share = Math.round((100 * top.runs) / Math.max(1, inn.runs));
      add("loneHand", share >= 45 ? 2 : 3, inn.team, who(top), { runs: top.runs, balls: top.balls, share, total: inn.runs, notOut: top.out ? 0 : 1 });
    }
    // A standout bowler in a win: four wickets, or three at under six while the rest went for eight or more.
    if (f.winner === opp && best && best.balls >= 12) {
      const others = inn.bowling.filter((w) => w !== best);
      const oBalls = others.reduce((a, w) => a + w.balls, 0), oRuns = others.reduce((a, w) => a + w.runs, 0);
      const econ = (6 * best.runs) / best.balls, oEcon = oBalls ? (6 * oRuns) / oBalls : 0;
      // A four-for in a win is a report line; three cheap wickets while the rest leaked is a note with its own frames.
      const n = { wickets: best.wickets, runs: best.runs, balls: best.balls, econ: Math.round(econ * 10) / 10, othersEcon: Math.round(oEcon * 10) / 10 };
      if (best.wickets >= 4) add("standoutBowler", 2, opp, who(best), n);
      else if (best.wickets >= 3 && econ < 6 && oEcon >= 8.5) add("cheapWickets", 3, opp, who(best), n);
    }
    // Four for 25 happens in a third of matches (corpus), so only five or more is report-worthy.
    const fall = collapseIn(inn);
    if (fall) add("collapse", fall.wickets >= 5 ? 2 : 3, inn.team, null, { wickets: fall.wickets, runs: fall.runs, from: fall.from }, { opp });
    const stand = [...inn.partnerships].sort((a, b) => b.runs - a.runs)[0];
    if (stand && stand.runs >= 100) {
      const names = stand.batters.map((id) => fullName(id, inn.batting.find((b) => b.id === id)?.name ?? id));
      add("bigStand", stand.runs >= 130 ? 2 : 3, inn.team, null, { runs: stand.runs, balls: stand.balls, wicket: stand.wicket ?? 0 }, { a: names[0]!, b: names[1]!, opp });
    }
    if (f.balls?.length) for (const id of hatTricks(f.balls, inn.index as 1 | 2)) {
      const w = inn.bowling.find((x) => x.id === id);
      if (w) add("hatTrick", 1, opp, who(w), { wickets: w.wickets, runs: w.runs });
    }
  }

  // The chase from the ball log.
  if (f.balls?.length && f.winner === i2.team) {
    const chase = readChase(f.balls, i2);
    if (chase) {
      if (chase.peakLateRate >= 15 && chase.startRate < 10) add("lateSurge", 1, i2.team, null, { peakRate: Math.round(chase.peakLateRate * 10) / 10, startRate: Math.round(chase.startRate * 10) / 10, target: i2.target ?? i2.runs });
      if (chase.wonInFinalOver && chase.finalOverRuns >= 20) add("finalOverTwenty", 1, i2.team, null, { runs: chase.finalOverRuns, target: i2.target ?? i2.runs });
    }
  }

  // Records, with their chains.
  // A mark that fell inside its first two days was never much of a record (the corpus shows the
  // first week breaking most of them), so the tier follows how long the previous mark stood.
  for (const b of ctx.records.broken) {
    const prev = b.previous;
    const days = prev && prev.date && b.entry.date ? Math.round((Date.parse(b.entry.date) - Date.parse(prev.date)) / 86400000) : -1;
    const since = days <= 0 ? "earlier the same day" : days === 1 ? "the day before" : `${days} days earlier`;
    const stood = days <= 0 ? "for less than a day" : days === 1 ? "for a day" : `for ${days} days`;
    const minor = b.kind === "fastestFifty" || b.kind === "biggestBallsWin";
    const tier: FactTier = days >= 3 && !minor ? 1 : days >= 1 ? 2 : 3;
    add(`record:${b.kind}`, tier, b.entry.team, b.entry.holderId ? { id: b.entry.holderId, name: b.entry.holder } : null,
      { value: b.entry.value, value2: b.entry.value2, prevValue: prev?.value ?? 0, prevValue2: prev?.value2 ?? 0, daysSince: Math.max(0, days), timesBroken: (ctx.records.after[b.kind]?.history.length ?? 0) },
      { holder: b.entry.holder, prevHolder: prev?.holder ?? "", prevTeam: prev?.team ?? "", opp: b.entry.opp, since, stood });
  }

  return facts;
}

/** The best fact a match has, for late news: lowest tier, then the order detected. */
export function bestFact(facts: Fact[]): Fact | null {
  return [...facts].sort((a, b) => a.tier - b.tier)[0] ?? null;
}

/** Sides' records before each fixture in play order, keyed by fixture. */
export function recordsBefore(fixtures: FixtureResult[]): Map<string, Map<string, { won: number; lost: number; played: number }>> {
  const out = new Map<string, Map<string, { won: number; lost: number; played: number }>>();
  const tally = new Map<string, { won: number; lost: number; played: number }>();
  for (const f of fixtures) {
    out.set(fixtureKey(f), new Map([...tally].map(([k, v]) => [k, { ...v }])));
    for (const t of f.teams) {
      const r = tally.get(t) ?? { won: 0, lost: 0, played: 0 };
      r.played += 1;
      if (f.winner === t) r.won += 1;
      else if (f.winner) r.lost += 1;
      tally.set(t, r);
    }
  }
  return out;
}
