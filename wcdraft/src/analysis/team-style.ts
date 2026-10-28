/**
 * Team playing style per calendar month, over every men's T20I in the archive.
 *
 * Coach and captain tenures are date ranges, so this table lets any tenure be summarised by
 * joining on (team, month) without re-parsing the archive. Global per-month aggregates are
 * emitted too, so a tenure can be expressed relative to its era (team value / era value).
 *
 * Metrics follow the coach-philosophy spec (§5.10): powerplay intent, wicket preservation,
 * batting depth, finisher reliance, bowl-first preference, bowlers used.
 */

import { isCompleteInnings, mainInnings, phaseOf, type Match } from "../cricsheet/match.js";
import { getOrCreate, ratio } from "../util/stats.js";

interface StyleTotals {
  matches: number;
  innings: number;
  ppRuns: number;
  ppBalls: number;
  ppWickets: number;
  deathRuns: number;
  deathBalls: number;
  runs: number;
  lowerOrderRuns: number;
  wicketsAt15Sum: number;
  wicketsAt15N: number;
  firstInningsTotals: number;
  firstInningsN: number;
  bowlersUsedSum: number;
  bowlersUsedN: number;
  tosses: number;
  bowlFirst: number;
}

const empty = (): StyleTotals => ({
  matches: 0, innings: 0, ppRuns: 0, ppBalls: 0, ppWickets: 0, deathRuns: 0, deathBalls: 0, runs: 0, lowerOrderRuns: 0,
  wicketsAt15Sum: 0, wicketsAt15N: 0, firstInningsTotals: 0, firstInningsN: 0, bowlersUsedSum: 0, bowlersUsedN: 0, tosses: 0, bowlFirst: 0,
});

export class TeamStyleAnalysis {
  private readonly byTeamMonth = new Map<string, Map<string, StyleTotals>>();
  private readonly byMonth = new Map<string, StyleTotals>();

  add(m: Match): void {
    const month = m.date.slice(0, 7);
    const global = getOrCreate(this.byMonth, month, empty);
    const forTeam = (team: string) => getOrCreate(getOrCreate(this.byTeamMonth, team, () => new Map()), month, empty);

    for (const team of m.teams) {
      const t = forTeam(team);
      t.matches += 1;
      if (m.tossWinner === team) {
        t.tosses += 1;
        global.tosses += 1;
        if (m.tossDecision === "field") {
          t.bowlFirst += 1;
          global.bowlFirst += 1;
        }
      }
    }
    global.matches += 1;

    for (const inn of mainInnings(m)) {
      if (inn.reduced) continue;
      const targets = [forTeam(inn.team), global];
      const lowerOrderRuns = [...inn.batters.values()].filter((b) => b.position >= 7).reduce((s, b) => s + b.runs, 0);
      let ppRuns = 0, ppBalls = 0, ppWickets = 0, deathRuns = 0, deathBalls = 0;
      for (const b of inn.balls) {
        const ph = phaseOf(b.over);
        if (ph === "pp") {
          ppRuns += b.runsTotal;
          if (b.legal) ppBalls += 1;
          ppWickets += b.wickets.filter((w) => w.kind !== "retired hurt").length;
        } else if (ph === "death") {
          deathRuns += b.runsTotal;
          if (b.legal) deathBalls += 1;
        }
      }
      for (const t of targets) {
        t.innings += 1;
        t.ppRuns += ppRuns;
        t.ppBalls += ppBalls;
        t.ppWickets += ppWickets;
        t.deathRuns += deathRuns;
        t.deathBalls += deathBalls;
        t.runs += inn.total;
        t.lowerOrderRuns += lowerOrderRuns;
        if (inn.wicketsAt15 !== null) {
          t.wicketsAt15Sum += inn.wicketsAt15;
          t.wicketsAt15N += 1;
        }
        if (inn.index === 0 && (inn.oversStarted >= 20 || inn.wickets >= 10)) {
          t.firstInningsTotals += inn.total;
          t.firstInningsN += 1;
        }
      }
      if (isCompleteInnings(inn)) {
        const used = new Set(inn.bowlerByOver.filter(Boolean)).size;
        for (const t of [forTeam(inn.bowlingTeam), global]) {
          t.bowlersUsedSum += used;
          t.bowlersUsedN += 1;
        }
      }
    }
  }

  summary() {
    const fmt = (t: StyleTotals) => ({
      matches: t.matches,
      innings: t.innings,
      ppRpo: ratio(6 * t.ppRuns, t.ppBalls, 2),
      ppWicketsPerOver: ratio(6 * t.ppWickets, t.ppBalls, 3),
      deathRpo: ratio(6 * t.deathRuns, t.deathBalls, 2),
      lowerOrderRunShare: ratio(t.lowerOrderRuns, t.runs, 3),
      wicketsAt15: ratio(t.wicketsAt15Sum, t.wicketsAt15N, 2),
      firstInningsAvg: ratio(t.firstInningsTotals, t.firstInningsN, 1),
      bowlersUsed: ratio(t.bowlersUsedSum, t.bowlersUsedN, 2),
      bowlFirstPct: t.tosses ? ratio(100 * t.bowlFirst, t.tosses, 0) : null,
    });
    return {
      months: Object.fromEntries([...this.byMonth.entries()].sort().map(([m, t]) => [m, fmt(t)])),
      teams: Object.fromEntries(
        [...this.byTeamMonth.entries()].sort().map(([team, months]) => [team, Object.fromEntries([...months.entries()].sort().map(([m, t]) => [m, fmt(t)]))]),
      ),
    };
  }
}
