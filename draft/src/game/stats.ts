/** Running tournament numbers, read from the kept scorecards: leaders, a stage's table up to a given match, and the side's profile. */

import type { FixtureResult, StageResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { Phase } from "../../../wcdraft/src/cricsheet/match.ts";
import { fullName } from "../lib/names.ts";

export interface PlayerTotals {
  id: string;
  name: string;
  team: string;
  innings: number;
  runs: number;
  balls: number;
  outs: number;
  fours: number;
  sixes: number;
  high: number;
  highNotOut: boolean;
  bowlInnings: number;
  wickets: number;
  bowlRuns: number;
  bowlBalls: number;
  best: { w: number; r: number } | null;
  potm: number;
}

/** Fixtures in the order they were played: stages in turn, by date within a stage (fixtures are stored by group). */
export function inPlayOrder<T extends { date: string | null }>(fixtures: T[]): T[] {
  return [...fixtures].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/**
 * Knockouts and pairings that never happened have no real date. The paper needs one so each page
 * knows only what had happened by then, so an undated fixture takes a date from its stage's real
 * ones, spread evenly, moving to the nearest one on which neither side already plays; a stage with
 * none counts back from the edition's last day.
 */
export function datedStages(stages: StageResult[], lastMatch: string | null): StageResult[] {
  // Across the whole tournament: a side can finish one stage and start the next the same week.
  const busy = new Map<string, Set<string>>();
  const taken = (team: string) => busy.get(team) ?? busy.set(team, new Set()).get(team)!;
  for (const stage of stages) for (const f of stage.fixtures) if (f.date) for (const team of f.teams) taken(team).add(f.date);
  const free = (f: FixtureResult, date: string) => f.teams.every((team) => !taken(team).has(date));
  return stages.map((stage, s) => {
    const real = stage.fixtures.flatMap((f) => (f.date ? [f.date] : [])).sort();
    const undated = stage.fixtures.filter((f) => !f.date).length;
    const fallback = lastMatch ? addDays(lastMatch, -3 * (stages.length - 1 - s)) : null;
    let k = 0;
    return { ...stage, fixtures: stage.fixtures.map((f) => {
      if (f.date) return f;
      const target = Math.floor(((k + 0.5) * real.length) / undated);
      k += 1;
      if (!real.length && !fallback) return f;
      const byDistance = (real.length ? real : [fallback!]).map((date, i) => ({ date, distance: Math.abs(i - target) })).sort((a, b) => a.distance - b.distance);
      let date = byDistance.find((x) => free(f, x.date))?.date;
      for (let extra = 1; !date; extra += 1) { const later = addDays(real[real.length - 1] ?? fallback!, extra); if (free(f, later)) date = later; }
      for (const team of f.teams) taken(team).add(date);
      return { ...f, date };
    }) };
  });
}

/** A knockout replayed on its reserve day carries a stage id of its own; this is the stage it belongs to. */
export const stageIdOf = (f: { stageId: string }) => f.stageId.replace(/-reserve$/, "");

/** The index of the stage the side's run ended in. */
export function exitStageOf(stages: StageResult[], mine: { stageId: string }[]): number {
  const last = mine[mine.length - 1];
  return last ? Math.max(0, stages.findIndex((s) => s.id === stageIdOf(last))) : 0;
}

export const totalsKey = (team: string, id: string) => `${team}|${id}`;

/**
 * Every player's tournament numbers from the kept scorecards (all fixtures when `keepScorecards`
 * was on), keyed by team and person: a drafted player's own real side still fields him.
 */
export function tournamentTotals(fixtures: FixtureResult[]): Map<string, PlayerTotals> {
  const totals = new Map<string, PlayerTotals>();
  const get = (id: string, name: string, team: string) => {
    const key = totalsKey(team, id);
    return totals.get(key) ?? totals.set(key, { id, name: fullName(id, name), team, innings: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, high: 0, highNotOut: false, bowlInnings: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, best: null, potm: 0 }).get(key)!;
  };
  for (const f of fixtures) {
    const [i1, i2] = f.innings ?? [];
    if (!i1 || !i2) continue;
    for (const inn of [i1, i2]) {
      const fielding = inn === i1 ? i2.team : i1.team;
      for (const b of inn.batting) {
        if (b.balls === 0 && !b.out) continue;
        const t = get(b.id, b.name, inn.team);
        t.innings += 1; t.runs += b.runs; t.balls += b.balls; t.outs += b.out ? 1 : 0; t.fours += b.fours; t.sixes += b.sixes;
        if (b.runs > t.high || (b.runs === t.high && !b.out)) { t.high = b.runs; t.highNotOut = !b.out; }
      }
      for (const w of inn.bowling) {
        const t = get(w.id, w.name, fielding);
        t.bowlInnings += 1; t.wickets += w.wickets; t.bowlRuns += w.runs; t.bowlBalls += w.balls;
        if (!t.best || w.wickets > t.best.w || (w.wickets === t.best.w && w.runs < t.best.r)) t.best = { w: w.wickets, r: w.runs };
      }
    }
    if (f.potm) get(f.potm.id, f.potm.name, f.potm.team).potm += 1;
  }
  return totals;
}

export interface TableRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;
}

/** A group's table up to and including one fixture: what the morning paper would have printed. */
export function tableTo(stage: StageResult, fixture: FixtureResult): TableRow[] {
  const inGroup = inPlayOrder(stage.fixtures.filter((f) => f.group === fixture.group));
  const rows = new Map<string, TableRow>();
  const row = (team: string) => rows.get(team) ?? rows.set(team, { team, played: 0, won: 0, lost: 0, noResult: 0, points: 0 }).get(team)!;
  for (const f of inGroup) for (const team of f.teams) row(team);
  // By teams, not identity: the paper's fixtures are copies carrying their stage label.
  const upTo = inGroup.findIndex((f) => f.teams.join() === fixture.teams.join());
  for (const f of inGroup.slice(0, upTo + 1)) {
    for (const team of f.teams) {
      const r = row(team);
      r.played += 1;
      if (!f.winner) { r.noResult += 1; r.points += 1; }
      else if (f.winner === team) { r.won += 1; r.points += 2; }
      else r.lost += 1;
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.won - a.won || a.team.localeCompare(b.team));
}

export interface SideProfile {
  label: string;
  good: boolean;
}

const rate = (runs: number, balls: number) => (balls ? (6 * runs) / balls : 0);

/** Plain-words reading of a side's run against the whole tournament's rates, by phase. */
export function sideProfile(fixtures: FixtureResult[], me: string): SideProfile[] {
  const totals = (list: FixtureResult[], keep: (team: string) => boolean) => {
    const t: Record<Phase, { runs: number; balls: number }> = { pp: { runs: 0, balls: 0 }, mid: { runs: 0, balls: 0 }, death: { runs: 0, balls: 0 } };
    for (const f of list) for (const inn of f.innings ?? []) {
      if (!keep(inn.team)) continue;
      for (const p of ["pp", "mid", "death"] as Phase[]) { t[p].runs += inn.phaseRuns[p].runs; t[p].balls += inn.phaseRuns[p].balls; }
    }
    return t;
  };
  const mine = fixtures.filter((f) => f.teams.includes(me));
  const field = totals(fixtures, () => true);
  const batted = totals(mine, (team) => team === me);
  const bowled = totals(mine, (team) => team !== me);
  const out: SideProfile[] = [];
  const note = (mine: { runs: number; balls: number }, all: { runs: number; balls: number }, high: SideProfile, low: SideProfile) => {
    const ratio = rate(mine.runs, mine.balls) / Math.max(0.1, rate(all.runs, all.balls));
    if (ratio >= 1.06) out.push(high);
    else if (ratio <= 0.94) out.push(low);
  };
  note(batted.pp, field.pp, { label: "Fast starters", good: true }, { label: "Slow out of the blocks", good: false });
  note(batted.death, field.death, { label: "Strong finishers", good: true }, { label: "Short of a finish", good: false });
  note(bowled.mid, field.mid, { label: "Leaked runs in the middle overs", good: false }, { label: "Squeezed the middle overs", good: true });
  note(bowled.death, field.death, { label: "Thin at the death", good: false }, { label: "Tight at the death", good: true });
  return out;
}
