/**
 * Normalised match model.
 *
 * Converts a raw Cricsheet match into flat, id-keyed innings with one `Ball` per delivery,
 * plus per-innings summaries (batting order, bowler per over, per-batter and per-bowler
 * innings figures). Every analysis module consumes this shape, never the raw JSON.
 *
 * Conventions
 * - People are referenced by Cricsheet person id (from `info.registry`).
 * - A ball is `legal` unless it is a wide or a no-ball. Batters face no-balls but not wides.
 * - Bowler-conceded runs exclude byes, leg-byes and penalties.
 * - `W` in a batting outcome means the striker was dismissed on that ball (any kind).
 *   Non-striker run-outs are counted separately so they don't pollute the striker's hazard.
 * - Phases: powerplay = overs 1–6, middle = 7–15, death = 16–20 (0-based over index 0–5, 6–14, 15–19).
 */

import type { RawInnings, RawMatch } from "./types.js";

export type Phase = "pp" | "mid" | "death";
export const PHASES: Phase[] = ["pp", "mid", "death"];

export function phaseOf(overIndex: number): Phase {
  return overIndex < 6 ? "pp" : overIndex < 15 ? "mid" : "death";
}

export type OutcomeKey = "0" | "1" | "2" | "3" | "4" | "6" | "W";
export const OUTCOME_KEYS: OutcomeKey[] = ["0", "1", "2", "3", "4", "6", "W"];

export const BOWLER_CREDITED_KINDS = new Set([
  "bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket",
]);

export interface Wicket {
  kind: string;
  playerOut: string;
  fielders: string[];
  bowlerCredited: boolean;
}

export interface Review {
  by: string;
  byBattingSide: boolean;
  decision: "struck down" | "upheld";
  umpiresCall: boolean;
}

export interface Ball {
  over: number;
  batter: string;
  nonStriker: string;
  bowler: string;
  runsBatter: number;
  runsExtras: number;
  /** Byes and leg-byes on this delivery (runs that are neither the batter's nor the bowler's fault). */
  runsByes: number;
  runsTotal: number;
  /** Runs charged to the bowler: total minus byes/leg-byes/penalty. */
  runsConceded: number;
  legal: boolean;
  wide: boolean;
  noBall: boolean;
  isFour: boolean;
  isSix: boolean;
  wickets: Wicket[];
  review: Review | null;
}

export interface BatterInnings {
  id: string;
  position: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissalKind: string | null;
  /** over index of first ball faced (or arrival as non-striker) */
  arrivedOver: number;
}

export interface BowlerInnings {
  id: string;
  balls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  overs: number[];
}

export interface Innings {
  index: number;
  team: string;
  bowlingTeam: string;
  superOver: boolean;
  balls: Ball[];
  /** Order of first appearance at the crease (striker or non-striker). */
  battingOrder: string[];
  /** Bowler id per over (index = over). */
  bowlerByOver: string[];
  total: number;
  wickets: number;
  legalBalls: number;
  oversStarted: number;
  batters: Map<string, BatterInnings>;
  bowlers: Map<string, BowlerInnings>;
  /** wickets fallen by the end of over 15 (index 14) — null if fewer overs bowled */
  wicketsAt15: number | null;
  target: number | null;
  /** Overs the side was scheduled to face (20 unless reduced before or during the innings). */
  scheduledOvers: number;
  /**
   * True when the innings did not run its natural 20-over course for reasons other than being
   * bowled out or completing a chase (rain reduction or abandonment). Phase vectors skip these,
   * because over indices no longer mean what they do in a full innings.
   */
  reduced: boolean;
}

export interface Match {
  id: string;
  date: string;
  season: string;
  eventName: string | null;
  stage: string | null;
  group: string | null;
  teams: [string, string];
  venue: string | null;
  city: string | null;
  tossWinner: string;
  tossDecision: "bat" | "field";
  /** Match winner. For ties this is null; see `tieWinner`. */
  winner: string | null;
  result: string | null;
  method: string | null;
  /** Winner of the super over (2009 onward) or bowl-out (2007) after a tie, if any. */
  tieWinner: string | null;
  tieMethod: "super-over" | "bowl-out" | null;
  /** Scheduled overs per side (20, or fewer when reduced before the start). */
  scheduledOvers: number;
  hasMissingData: boolean;
  playerOfMatch: string[];
  /** team → player ids (the named XI) */
  xis: Record<string, string[]>;
  /** person id → display name */
  names: Map<string, string>;
  innings: Innings[];
}

export function normaliseMatch(raw: RawMatch, id: string): Match {
  const { info } = raw;
  const reg = info.registry.people;
  const pid = (name: string): string => reg[name] ?? `name:${name}`;
  const names = new Map<string, string>();
  for (const [name, personId] of Object.entries(reg)) names.set(personId, name);

  const xis: Record<string, string[]> = {};
  for (const [team, list] of Object.entries(info.players)) xis[team] = list.map(pid);

  const rainAffected = /D\/?L/i.test(info.outcome.method ?? "") || info.outcome.result === "no result";
  const innings = raw.innings.map((inn, index) => normaliseInnings(inn, index, info.teams, pid, info.overs ?? 20, rainAffected));

  return {
    id,
    date: info.dates[0] ?? "",
    season: String(info.season),
    eventName: info.event?.name ?? null,
    stage: info.event?.stage ?? null,
    group: info.event?.group === undefined ? null : String(info.event.group),
    teams: [info.teams[0] ?? "", info.teams[1] ?? ""],
    venue: info.venue ?? null,
    city: info.city ?? null,
    tossWinner: info.toss.winner,
    tossDecision: info.toss.decision,
    winner: info.outcome.winner ?? null,
    result: info.outcome.result ?? null,
    method: info.outcome.method ?? null,
    tieWinner: info.outcome.eliminator ?? info.outcome.bowl_out ?? null,
    tieMethod: info.outcome.eliminator ? "super-over" : info.outcome.bowl_out ? "bowl-out" : null,
    scheduledOvers: info.overs ?? 20,
    hasMissingData: (info.missing?.length ?? 0) > 0,
    playerOfMatch: (info.player_of_match ?? []).map(pid),
    xis,
    names,
    innings,
  };
}

function normaliseInnings(
  inn: RawInnings,
  index: number,
  teams: string[],
  pid: (name: string) => string,
  matchOvers: number,
  rainAffected: boolean,
): Innings {
  const team = inn.team;
  const bowlingTeam = teams.find((t) => t !== team) ?? "";
  const balls: Ball[] = [];
  const battingOrder: string[] = [];
  const bowlerByOver: string[] = [];
  const batters = new Map<string, BatterInnings>();
  const bowlers = new Map<string, BowlerInnings>();

  const arrive = (id: string, over: number): BatterInnings => {
    let b = batters.get(id);
    if (!b) {
      battingOrder.push(id);
      b = { id, position: battingOrder.length, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissalKind: null, arrivedOver: over };
      batters.set(id, b);
    }
    return b;
  };
  const bowlerRec = (id: string): BowlerInnings => {
    let b = bowlers.get(id);
    if (!b) {
      b = { id, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, overs: [] };
      bowlers.set(id, b);
    }
    return b;
  };

  let total = 0;
  let wickets = 0;
  let legalBalls = 0;
  let wicketsAt15: number | null = null;

  for (const over of inn.overs ?? []) {
    const overIdx = over.over;
    const first = over.deliveries[0];
    if (first) {
      const bowlerId = pid(first.bowler);
      bowlerByOver[overIdx] = bowlerId;
      bowlerRec(bowlerId).overs.push(overIdx);
    }
    for (const d of over.deliveries) {
      const batterId = pid(d.batter);
      const nonStrikerId = pid(d.non_striker);
      const bowlerId = pid(d.bowler);
      const ex = d.extras ?? {};
      const wide = (ex.wides ?? 0) > 0;
      const noBall = (ex.noballs ?? 0) > 0;
      const legal = !wide && !noBall;
      const runsConceded = d.runs.total - (ex.byes ?? 0) - (ex.legbyes ?? 0) - (ex.penalty ?? 0);
      const isFour = d.runs.batter === 4 && !d.runs.non_boundary;
      const isSix = d.runs.batter === 6;

      const wk: Wicket[] = (d.wickets ?? []).map((w) => ({
        kind: w.kind,
        playerOut: pid(w.player_out),
        fielders: (w.fielders ?? []).filter((f) => !f.substitute && f.name).map((f) => pid(f.name)),
        bowlerCredited: BOWLER_CREDITED_KINDS.has(w.kind),
      }));

      const review: Review | null = d.review
        ? {
            by: d.review.by,
            byBattingSide: d.review.by === team,
            decision: d.review.decision,
            umpiresCall: Boolean(d.review.umpires_call),
          }
        : null;

      balls.push({
        over: overIdx, batter: batterId, nonStriker: nonStrikerId, bowler: bowlerId,
        runsBatter: d.runs.batter, runsExtras: d.runs.extras, runsByes: (ex.byes ?? 0) + (ex.legbyes ?? 0), runsTotal: d.runs.total, runsConceded,
        legal, wide, noBall, isFour, isSix, wickets: wk, review,
      });

      // Batting order: both batters at the crease count as "arrived".
      const striker = arrive(batterId, overIdx);
      arrive(nonStrikerId, overIdx);
      if (!wide) striker.balls += 1;
      striker.runs += d.runs.batter;
      if (isFour) striker.fours += 1;
      if (isSix) striker.sixes += 1;

      const bw = bowlerRec(bowlerId);
      if (legal) bw.balls += 1;
      bw.runs += runsConceded;
      if (wide) bw.wides += 1;
      if (noBall) bw.noBalls += 1;

      for (const w of wk) {
        if (w.kind === "retired hurt" || w.kind === "retired not out") continue;
        wickets += 1;
        const victim = arrive(w.playerOut, overIdx);
        victim.out = true;
        victim.dismissalKind = w.kind;
        if (w.bowlerCredited) bw.wickets += 1;
      }

      total += d.runs.total;
      if (legal) legalBalls += 1;
    }
    if (overIdx === 14) wicketsAt15 = wickets;
  }

  const oversStarted = (inn.overs ?? []).length;
  const scheduledOvers = inn.target?.overs ?? matchOvers;
  const target = inn.target?.runs ?? null;
  // Nine down with no rain means the side had no batter left (absent hurt / retired), i.e. all out.
  const allOut = wickets >= 10 || (wickets >= 9 && !rainAffected);
  const chaseComplete = target !== null && total >= target;
  const naturalEnd = oversStarted >= scheduledOvers || allOut || chaseComplete;
  const reduced = !inn.super_over && (scheduledOvers < 20 || (!naturalEnd && (index > 0 || rainAffected)));

  return {
    index,
    team,
    bowlingTeam,
    superOver: Boolean(inn.super_over),
    balls,
    battingOrder,
    bowlerByOver,
    total,
    wickets,
    legalBalls,
    oversStarted,
    batters,
    bowlers,
    wicketsAt15,
    target,
    scheduledOvers,
    reduced,
  };
}

/** The first two (non-super-over) innings, which is all a T20 result depends on. */
export function mainInnings(m: Match): Innings[] {
  return m.innings.filter((i) => !i.superOver).slice(0, 2);
}

/** A full 20-over innings (used for usage norms so rain and early finishes don't distort them). */
export function isCompleteInnings(i: Innings): boolean {
  return !i.superOver && i.oversStarted >= 20;
}

/**
 * A first innings that ran its natural course: 20 overs bowled or the side bowled out.
 * Rain-shortened innings are excluded so first-innings averages are not biased.
 */
export function isNaturalFirstInnings(i: Innings): boolean {
  return !i.superOver && i.index === 0 && (i.oversStarted >= 20 || i.wickets >= 10);
}
