/**
 * Replay harness (design spec Phase 2 acceptance tests): simulate every real match of an edition
 * with its real elevens many times and compare the simulated scoring environment, result
 * distribution and bowler usage with what happened.
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

export interface ReplaySummary {
  editionId: string;
  sims: number;
  matchCount: number;
  real: { runsPerOver: number; ballsPerWicket: number; dotPct: number; fourPct: number; sixPct: number; powerplayRpo: number; middleRpo: number; deathRpo: number; firstInningsAvg: number; firstInningsSd: number; chaseWinPct: number };
  sim: { runsPerOver: number; ballsPerWicket: number; dotPct: number; fourPct: number; sixPct: number; powerplayRpo: number; middleRpo: number; deathRpo: number; firstInningsAvg: number; firstInningsSd: number; chaseWinPct: number; bowlersUsed: Record<string, number>; bowlersUsedMean: number };
  /** Result calibration over decided matches: accuracy of the favourite, Brier score, log loss, and the same for a 50/50 baseline. */
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

export function replayEdition(editionId: string, sims: number, seed = 1): ReplaySummary {
  const data = loadEdition(editionId);
  const games = realMatches(data);
  const env = data.edition.environment as unknown as ReplaySummary["real"];
  let runs = 0, balls = 0, wickets = 0, dots = 0, fours = 0, sixes = 0;
  const phase = { pp: { runs: 0, balls: 0 }, mid: { runs: 0, balls: 0 }, death: { runs: 0, balls: 0 } };
  const firstTotals: number[] = [];
  let chases = 0, chaseWins = 0;
  const bowlersUsed = new Map<number, number>();
  const matches: ReplayMatch[] = [];
  let decided = 0, correct = 0, brier = 0, logLoss = 0;

  for (const g of games) {
    const teamA = teamFromMatch(data, g.a, g.match);
    const teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const matchEnv = matchEnvironment(data, g.match.venueId || null);
    const battingFirst = g.match.battedFirst ? g.a : g.b;
    let winsA = 0;
    const totals: number[] = [];
    for (let s = 0; s < sims; s += 1) {
      const r: MatchResult = simulateMatch(teamA, teamB, matchEnv, data.situation, { seed: `${seed}:${g.match.id}:${s}`, battingFirst });
      // The real environment figures count reduced innings too, but first-innings averages and chase
      // wins are over natural, decided matches; mirror that here.
      if (r.rain) {
        for (const inn of r.innings) { runs += inn.runs; balls += inn.legalBalls; wickets += inn.wickets; dots += inn.outcomes["0"] + inn.outcomes.W - inn.byeBalls; fours += inn.outcomes["4"]; sixes += inn.outcomes["6"]; }
        if (r.winner === g.a) winsA += 1;
        else if (!r.winner) winsA += 0.5;
        continue;
      }
      if (r.winner === g.a) winsA += 1;
      for (const inn of r.innings) {
        runs += inn.runs;
        balls += inn.legalBalls;
        wickets += inn.wickets;
        for (const p of PHASE_LIST) { phase[p].runs += inn.phaseRuns[p].runs; phase[p].balls += inn.phaseRuns[p].balls; }
        const used = inn.bowling.length;
        bowlersUsed.set(used, (bowlersUsed.get(used) ?? 0) + 1);
      }
      totals.push(r.innings[0].runs);
      chases += 1;
      if (r.winner === r.innings[1].team) chaseWins += 1;
      // Real dot % counts legal balls with no runs at all (wicket balls included, bye balls excluded).
      for (const inn of r.innings) { dots += inn.outcomes["0"] + inn.outcomes.W - inn.byeBalls; fours += inn.outcomes["4"]; sixes += inn.outcomes["6"]; }
    }
    const winProbA = winsA / sims;
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length);
    firstTotals.push(...totals);
    const realWinner = g.match.winner;
    if (realWinner === g.a || realWinner === g.b) {
      decided += 1;
      const pReal = realWinner === g.a ? winProbA : 1 - winProbA;
      if (pReal > 0.5) correct += 1;
      brier += (1 - pReal) ** 2;
      logLoss += -Math.log(Math.max(0.01, pReal));
    }
    matches.push({ id: g.match.id, teams: [g.a, g.b], battedFirst: battingFirst, venueId: g.match.venueId, real: { winner: realWinner, firstInningsTotal: g.match.battedFirst ? g.match.total : g.other.total }, sim: { winProbA: +winProbA.toFixed(3), firstInningsMean: +mean.toFixed(1), firstInningsSd: +sd.toFixed(1) } });
  }
  const fiMean = firstTotals.reduce((a, b) => a + b, 0) / Math.max(1, firstTotals.length);
  const fiSd = Math.sqrt(firstTotals.reduce((a, b) => a + (b - fiMean) ** 2, 0) / Math.max(1, firstTotals.length));
  const usedTotal = [...bowlersUsed.values()].reduce((a, b) => a + b, 0);
  const r3 = (x: number) => +x.toFixed(3);
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
    },
    results: {
      decided,
      accuracy: r3(correct / Math.max(1, decided)),
      brier: r3(brier / Math.max(1, decided)),
      logLoss: r3(logLoss / Math.max(1, decided)),
      baselineBrier: 0.25,
      baselineLogLoss: r3(Math.log(2)),
    },
    matches,
  };
}

