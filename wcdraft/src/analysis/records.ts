/**
 * Record books as they stood before each World Cup (asked 2026-11-02): the all-time men's T20
 * World Cup records and the all-time men's T20I records between full members, dated, so a run's
 * gazette can tell a record of that World Cup (a note) from a record of all World Cups or of all
 * T20Is (news). Both books are "as of the edition's first day": a record set in a later edition
 * is unknown to an earlier one, and the sim's own matches then move the marks as they go.
 *
 * Kinds match the client's `facts.ts`: highest and lowest completed total, highest successful
 * chase, best figures, highest score, biggest wins by runs and by balls, fastest fifty.
 */

import { mainInnings, type Innings, type Match } from "../cricsheet/match.js";

export type RecordKind = "highestTotal" | "lowestTotal" | "highestChase" | "bestFigures" | "highestScore" | "biggestRunsWin" | "biggestBallsWin" | "fastestFifty";
export const RECORD_KINDS: RecordKind[] = ["highestTotal", "lowestTotal", "highestChase", "bestFigures", "highestScore", "biggestRunsWin", "biggestBallsWin", "fastestFifty"];

export interface RecordMark {
  value: number;
  /** Wickets down for a total or chase; runs conceded for figures; balls faced for a score. */
  value2: number;
  holder: string;
  holderId: string | null;
  team: string;
  opp: string;
  date: string;
  /** The World Cup edition for a World Cup record, else "". */
  editionId: string;
}

/** The best mark and the one it displaced, per kind. */
export type RecordBookOut = Partial<Record<RecordKind, { current: RecordMark; previous: RecordMark | null }>>;

export interface RecordsOut {
  /** Records before this edition's first day, by edition id. */
  [editionId: string]: { worldCup: RecordBookOut; t20i: RecordBookOut };
}

export function better(kind: RecordKind, a: { value: number; value2: number }, b: { value: number; value2: number }): boolean {
  switch (kind) {
    case "lowestTotal":
    case "fastestFifty": return a.value < b.value;
    case "bestFigures": return a.value > b.value || (a.value === b.value && a.value2 < b.value2);
    default: return a.value > b.value;
  }
}

interface Candidate { kind: RecordKind; mark: RecordMark; worldCup: boolean; fullMembers: boolean }

/** Balls each batter took to reach fifty in an innings; only those who got there. */
function fiftyBalls(inn: Innings): Map<string, number> {
  const runs = new Map<string, number>(), faced = new Map<string, number>(), out = new Map<string, number>();
  for (const b of inn.balls) {
    if (b.wide) continue;
    const r = (runs.get(b.batter) ?? 0) + b.runsBatter;
    const n = (faced.get(b.batter) ?? 0) + 1;
    runs.set(b.batter, r);
    faced.set(b.batter, n);
    if (r >= 50 && !out.has(b.batter)) out.set(b.batter, n);
  }
  return out;
}

export class RecordsAnalysis {
  private readonly candidates: Candidate[] = [];

  constructor(private readonly isFullMember: (team: string, year: number) => boolean) {}

  add(m: Match, wcEdition: string | null): void {
    const inns = mainInnings(m);
    const [i1, i2] = inns;
    if (!i1 || !i2) return;
    const year = Number(m.date.slice(0, 4));
    const fullMembers = m.teams.every((t) => this.isFullMember(t, year));
    const rain = /D\/?L/i.test(m.method ?? "") || i1.reduced || i2.reduced;
    const name = (id: string) => m.names.get(id) ?? id;
    const push = (kind: RecordKind, mark: Omit<RecordMark, "date" | "editionId">) =>
      this.candidates.push({ kind, mark: { ...mark, date: m.date, editionId: wcEdition ?? "" }, worldCup: !!wcEdition, fullMembers });
    for (const inn of inns) {
      const opp = inn.bowlingTeam;
      if (inn.legalBalls === 0) continue;
      push("highestTotal", { value: inn.total, value2: inn.wickets, holder: inn.team, holderId: null, team: inn.team, opp });
      // Completed for the lowest total: all out, or the full allotment faced (the shared helper wants twenty overs started, which drops a side skittled in ten).
      if (!rain && (inn.wickets >= 10 || inn.legalBalls >= inn.scheduledOvers * 6)) push("lowestTotal", { value: inn.total, value2: inn.wickets, holder: inn.team, holderId: null, team: inn.team, opp });
      for (const [id, b] of inn.batters) if (b.runs >= 50) push("highestScore", { value: b.runs, value2: b.balls, holder: name(id), holderId: id, team: inn.team, opp });
      for (const [id, w] of inn.bowlers) if (w.wickets >= 3) push("bestFigures", { value: w.wickets, value2: w.runs, holder: name(id), holderId: id, team: opp, opp: inn.team });
      for (const [id, n] of fiftyBalls(inn)) push("fastestFifty", { value: n, value2: inn.batters.get(id)?.runs ?? 50, holder: name(id), holderId: id, team: inn.team, opp });
    }
    if (!rain && m.winner === i2.team && i2.total >= (i2.target ?? i1.total + 1)) {
      push("highestChase", { value: i2.total, value2: i2.wickets, holder: i2.team, holderId: null, team: i2.team, opp: i1.team });
      push("biggestBallsWin", { value: Math.max(0, i2.scheduledOvers * 6 - i2.legalBalls), value2: 10 - i2.wickets, holder: i2.team, holderId: null, team: i2.team, opp: i1.team });
    }
    if (!rain && m.winner === i1.team && !m.tieWinner) {
      push("biggestRunsWin", { value: i1.total - i2.total, value2: 0, holder: i1.team, holderId: null, team: i1.team, opp: i2.team });
    }
  }

  /** The two books before a date: World Cup matches only, and T20Is between full members. */
  bookBefore(date: string, scope: "worldCup" | "t20i"): RecordBookOut {
    const out: RecordBookOut = {};
    for (const kind of RECORD_KINDS) {
      let current: RecordMark | null = null, previous: RecordMark | null = null;
      for (const c of this.candidates) {
        if (c.kind !== kind || c.mark.date >= date) continue;
        if (scope === "worldCup" ? !c.worldCup : !c.fullMembers) continue;
        if (!current || better(kind, c.mark, current)) { previous = current; current = c.mark; }
      }
      if (current) out[kind] = { current, previous };
    }
    return out;
  }

  summary(windows: { id: string; start: string }[]): RecordsOut {
    const out: RecordsOut = {};
    for (const w of windows) out[w.id] = { worldCup: this.bookBefore(w.start, "worldCup"), t20i: this.bookBefore(w.start, "t20i") };
    return out;
  }
}
