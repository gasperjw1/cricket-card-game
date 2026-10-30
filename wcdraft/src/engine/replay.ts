/**
 * Replay harness (design spec §9 acceptance tests): simulate every real match of an edition with
 * its real elevens many times and compare with what happened — scoring environment (tests 1–3),
 * remaining-runs par (4), bowler usage (5), venue effects (6) and win-probability calibration (8).
 */

import { PHASE_LIST } from "../ratings/model.js";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "./load.js";
import { simulateMatch } from "./match.js";
import type { MatchResult } from "./types.js";

export interface ReplayMatch {
  id: string;
  teams: [string, string];
  battedFirst: string;
  venueId: string;
  real: { winner: string | null; firstInningsTotal: number | null };
  /** Simulated win probability of the first-named team and mean first-innings total. */
  sim: { winProbA: number; firstInningsMean: number; firstInningsSd: number };
}

interface EnvironmentFigures {
  runsPerOver: number; ballsPerWicket: number; dotPct: number; fourPct: number; sixPct: number;
  powerplayRpo: number; middleRpo: number; deathRpo: number; firstInningsAvg: number; firstInningsSd: number; chaseWinPct: number;
}

export interface ReplaySummary {
  editionId: string;
  sims: number;
  matchCount: number;
  real: EnvironmentFigures;
  sim: EnvironmentFigures & { bowlersUsed: Record<string, number>; bowlersUsedMean: number; deathOversByNewBallPct: number };
  /** Test 1: first-innings total quantiles, real (natural first innings in the squads' match lists) vs simulated. */
  firstInnings: { real: { n: number; p10: number; p50: number; p90: number }; sim: { n: number; p10: number; p50: number; p90: number } };
  /** Test 2: mean wickets down entering overs 7, 11 and 16 and at the close of a first innings; reference = all T20Is in the situation tables. */
  wicketsByOver: { reference: Record<string, number>; sim: Record<string, number> };
  /** Test 3: total-variation distance between the simulated per-ball outcome shares and the edition's population vectors (phase-weighted). */
  marginals: { real: Record<string, number>; sim: Record<string, number>; totalVariation: number };
  /** Test 4: mean first-innings runs added after the 10-over mark, simulated vs the resource-table par from the state at that mark. */
  par: { n: number; simRemaining: number; tableRemaining: number };
  /** Test 6: chase win share per ground, real vs simulated, grounds with at least four real matches. */
  venues: { venueId: string; matches: number; realChaseWinPct: number; simChaseWinPct: number; chaseUplift: number }[];
  /** Test 8: result calibration over decided matches. */
  results: { decided: number; accuracy: number; brier: number; logLoss: number; baselineBrier: number; baselineLogLoss: number };
  matches: ReplayMatch[];
}

function realMatches(data: EditionData): { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) {
    if (squad.standIn) continue;
    for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m });
  }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) {
    if (sides.length !== 2) continue;
    const [x, y] = sides as [typeof sides[0], typeof sides[0]];
    if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue;
    out.push({ a: x.team, b: y.team, match: x.match, other: y.match });
  }
  return out.sort((p, q) => p.match.date.localeCompare(q.match.date) || p.match.id.localeCompare(q.match.id));
}

const quantiles = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))] ?? 0;
  return { n: s.length, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
};

const WICKET_MARKS = [6, 10, 15, 20] as const;

export function replayEdition(editionId: string, sims: number, seed = 1): ReplaySummary {
  const data = loadEdition(editionId);
  const games = realMatches(data);
  const env = data.edition.environment as unknown as EnvironmentFigures & { populationVectors: Record<string, Record<string, number>> };
  let runs = 0, balls = 0, wickets = 0, dots = 0, fours = 0, sixes = 0;
  const phase = { pp: { runs: 0, balls: 0 }, mid: { runs: 0, balls: 0 }, death: { runs: 0, balls: 0 } };
  const outcomeTotals: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 };
  const firstTotals: number[] = [];
  const realFirstTotals: number[] = [];
  let chases = 0, chaseWins = 0, deathOvers = 0, deathByNewBall = 0;
  const wicketsAt: Record<string, { sum: number; n: number }> = Object.fromEntries(WICKET_MARKS.map((m) => [String(m), { sum: 0, n: 0 }]));
  let parN = 0, parSim = 0, parTable = 0;
  const bowlersUsed = new Map<number, number>();
  const byVenue = new Map<string, { real: number; realChase: number; sim: number; simChase: number; uplift: number }>();
  const matches: ReplayMatch[] = [];
  let decided = 0, correct = 0, brier = 0, logLoss = 0;

  for (const g of games) {
    const teamA = teamFromMatch(data, g.a, g.match);
    const teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const matchEnv = matchEnvironment(data, g.match.venueId || null);
    const battingFirst = g.match.battedFirst ? g.a : g.b;
    const realFirst = g.match.battedFirst ? g.match.total : g.other.total;
    if (realFirst !== null) realFirstTotals.push(realFirst);
    const venue = byVenue.get(g.match.venueId) ?? byVenue.set(g.match.venueId, { real: 0, realChase: 0, sim: 0, simChase: 0, uplift: matchEnv.chaseUplift }).get(g.match.venueId)!;
    const chaser = g.match.battedFirst ? g.b : g.a;
    if (g.match.winner) { venue.real += 1; if (g.match.winner === chaser) venue.realChase += 1; }
    let winsA = 0;
    const totals: number[] = [];
    for (let s = 0; s < sims; s += 1) {
      const r: MatchResult = simulateMatch(teamA, teamB, matchEnv, data.situation, { seed: `${seed}:${g.match.id}:${s}`, battingFirst });
      for (const inn of r.innings) {
        runs += inn.runs; balls += inn.legalBalls; wickets += inn.wickets;
        // Real dot % counts legal balls with no runs at all (wicket balls included, bye balls excluded).
        dots += inn.outcomes["0"] + inn.outcomes.W - inn.byeBalls; fours += inn.outcomes["4"]; sixes += inn.outcomes["6"];
        for (const k of Object.keys(outcomeTotals)) outcomeTotals[k]! += inn.outcomes[k as keyof typeof inn.outcomes];
        for (const p of PHASE_LIST) { phase[p].runs += inn.phaseRuns[p].runs; phase[p].balls += inn.phaseRuns[p].balls; }
      }
      if (r.rain) {
        if (r.winner === g.a) winsA += 1;
        else if (!r.winner) winsA += 0.5;
        continue;
      }
      const first = r.innings[0];
      for (const inn of r.innings) bowlersUsed.set(inn.bowling.length, (bowlersUsed.get(inn.bowling.length) ?? 0) + 1);
      // Tests 2 and 4 on natural first innings; test 5's death-overs trust on both innings.
      for (const m of WICKET_MARKS) {
        const down = m === 20 ? first.wickets : first.fallOfWickets.filter((f) => f.over < m).length;
        wicketsAt[String(m)]!.sum += down; wicketsAt[String(m)]!.n += 1;
      }
      if (first.legalBalls >= 60) {
        const at60 = first.fallOfWickets.filter((f) => f.over < 10).length;
        const runsAt60 = first.fallOfWickets.length ? 0 : 0;
        void runsAt60;
        parN += 1;
        parSim += first.runs - runsAtOver(first, 10);
        parTable += env.firstInningsAvg * data.situation.resource(60, at60);
      }
      // Overs 19 and 20 (indices 18, 19) bowled by an opening bowler, the measured norm being 43%.
      for (const inn of r.innings) {
        const newBall = new Set(inn.bowling.filter((b) => b.overs.includes(0) || b.overs.includes(1)).map((b) => b.id));
        for (const b of inn.bowling) for (const o of b.overs) if (o >= 18) { deathOvers += 1; if (newBall.has(b.id)) deathByNewBall += 1; }
      }
      totals.push(first.runs);
      chases += 1;
      venue.sim += 1;
      if (r.winner === r.innings[1].team) { chaseWins += 1; venue.simChase += 1; }
      if (r.winner === g.a) winsA += 1;
    }
    const winProbA = winsA / sims;
    const mean = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const sd = totals.length ? Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length) : 0;
    firstTotals.push(...totals);
    const realWinner = g.match.winner;
    if (realWinner === g.a || realWinner === g.b) {
      decided += 1;
      const pReal = realWinner === g.a ? winProbA : 1 - winProbA;
      if (pReal > 0.5) correct += 1;
      brier += (1 - pReal) ** 2;
      logLoss += -Math.log(Math.max(0.01, pReal));
    }
    matches.push({ id: g.match.id, teams: [g.a, g.b], battedFirst: battingFirst, venueId: g.match.venueId, real: { winner: realWinner, firstInningsTotal: realFirst }, sim: { winProbA: +winProbA.toFixed(3), firstInningsMean: +mean.toFixed(1), firstInningsSd: +sd.toFixed(1) } });
  }
  const fiMean = firstTotals.reduce((a, b) => a + b, 0) / Math.max(1, firstTotals.length);
  const fiSd = Math.sqrt(firstTotals.reduce((a, b) => a + (b - fiMean) ** 2, 0) / Math.max(1, firstTotals.length));
  const usedTotal = [...bowlersUsed.values()].reduce((a, b) => a + b, 0);
  const r3 = (x: number) => +x.toFixed(3);

  // Test 3: phase-weighted real marginals vs simulated shares.
  const weights = { pp: 0.3, mid: 0.45, death: 0.25 } as const;
  const realMarginals: Record<string, number> = {};
  for (const k of Object.keys(outcomeTotals)) realMarginals[k] = +PHASE_LIST.reduce((a, p) => a + weights[p] * (env.populationVectors[p]?.[k] ?? 0), 0).toFixed(4);
  const simBalls = Object.values(outcomeTotals).reduce((a, b) => a + b, 0) || 1;
  const simMarginals = Object.fromEntries(Object.entries(outcomeTotals).map(([k, v]) => [k, +(v / simBalls).toFixed(4)]));
  const totalVariation = +(0.5 * Object.keys(outcomeTotals).reduce((a, k) => a + Math.abs((simMarginals[k] ?? 0) - (realMarginals[k] ?? 0)), 0)).toFixed(4);

  // Test 2 reference: all-T20I first innings, mean wickets down at each mark from the situation cells.
  const reference: Record<string, number> = {};
  for (const m of WICKET_MARKS) reference[String(m)] = +data.situation.meanWicketsDown(1, m).toFixed(2);

  return {
    editionId,
    sims,
    matchCount: matches.length,
    real: { runsPerOver: env.runsPerOver, ballsPerWicket: env.ballsPerWicket, dotPct: env.dotPct, fourPct: env.fourPct, sixPct: env.sixPct, powerplayRpo: env.powerplayRpo, middleRpo: env.middleRpo, deathRpo: env.deathRpo, firstInningsAvg: env.firstInningsAvg, firstInningsSd: env.firstInningsSd, chaseWinPct: env.chaseWinPct },
    sim: {
      runsPerOver: +((6 * runs) / Math.max(1, balls)).toFixed(2),
      ballsPerWicket: +(balls / Math.max(1, wickets)).toFixed(1),
      dotPct: +((100 * dots) / Math.max(1, balls)).toFixed(1),
      fourPct: +((100 * fours) / Math.max(1, balls)).toFixed(1),
      sixPct: +((100 * sixes) / Math.max(1, balls)).toFixed(1),
      powerplayRpo: +((6 * phase.pp.runs) / Math.max(1, phase.pp.balls)).toFixed(2),
      middleRpo: +((6 * phase.mid.runs) / Math.max(1, phase.mid.balls)).toFixed(2),
      deathRpo: +((6 * phase.death.runs) / Math.max(1, phase.death.balls)).toFixed(2),
      firstInningsAvg: +fiMean.toFixed(1),
      firstInningsSd: +fiSd.toFixed(1),
      chaseWinPct: +((100 * chaseWins) / Math.max(1, chases)).toFixed(1),
      bowlersUsed: Object.fromEntries([...bowlersUsed.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), +((100 * v) / usedTotal).toFixed(1)])),
      bowlersUsedMean: +([...bowlersUsed.entries()].reduce((a, [k, v]) => a + k * v, 0) / Math.max(1, usedTotal)).toFixed(2),
      deathOversByNewBallPct: +((100 * deathByNewBall) / Math.max(1, deathOvers)).toFixed(1),
    },
    firstInnings: { real: quantiles(realFirstTotals), sim: quantiles(firstTotals) },
    wicketsByOver: { reference, sim: Object.fromEntries(Object.entries(wicketsAt).map(([k, v]) => [k, +(v.sum / Math.max(1, v.n)).toFixed(2)])) },
    marginals: { real: realMarginals, sim: simMarginals, totalVariation },
    par: { n: parN, simRemaining: +(parSim / Math.max(1, parN)).toFixed(1), tableRemaining: +(parTable / Math.max(1, parN)).toFixed(1) },
    venues: [...byVenue.entries()].filter(([, v]) => v.real >= 4).map(([venueId, v]) => ({ venueId, matches: v.real, realChaseWinPct: +((100 * v.realChase) / v.real).toFixed(0), simChaseWinPct: +((100 * v.simChase) / Math.max(1, v.sim)).toFixed(0), chaseUplift: v.uplift })).sort((a, b) => b.matches - a.matches),
    results: { decided, accuracy: r3(correct / Math.max(1, decided)), brier: r3(brier / Math.max(1, decided)), logLoss: r3(logLoss / Math.max(1, decided)), baselineBrier: 0.25, baselineLogLoss: r3(Math.log(2)) },
    matches,
  };
}

/** Runs on the board when `over` began, from the phase and fall-of-wicket records (phase totals give exact runs at overs 6 and 15; over 10 is interpolated within the middle phase). */
function runsAtOver(inn: MatchResult["innings"][0], over: number): number {
  const pp = inn.phaseRuns.pp.runs, mid = inn.phaseRuns.mid.runs;
  if (over <= 6) return Math.round((pp * over) / 6);
  if (over <= 15) return Math.round(pp + (mid * (over - 6)) / 9);
  return Math.round(pp + mid + (inn.phaseRuns.death.runs * (over - 15)) / 5);
}
