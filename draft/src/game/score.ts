/**
 * The run as a number and as a link (2026-11-02, step 5b).
 *
 * Performance score: how the season went, not how good the squad looked. Stage reached (the
 * exit stage as a share of the bracket, champions 60), four a win, net run rate over the side's
 * matches clamped to ±10, and ten for an unbeaten run. 0 to 100 in practice.
 *
 * Share link: everything a run needs to be replayed exactly: seed, identity, coach, the eleven
 * with their slots, the captain and the between-match plans. The seed fixes the spins; the rest
 * are the user's choices, which the seed alone cannot recover.
 */

import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import type { FixtureResult, TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { MatchPlan } from "./simulate.ts";
import { exitStageOf } from "./stats.ts";
import type { Identity, PoolPlayer } from "./types.ts";

export interface Performance {
  score: number;
  stagePoints: number;
  winPoints: number;
  nrr: number;
  nrrPoints: number;
  unbeatenPoints: number;
}

/** Net run rate over the side's completed matches, a side bowled out charged its full allotment. */
export function netRunRate(mine: FixtureResult[], me: string): number {
  let forRuns = 0, forBalls = 0, againstRuns = 0, againstBalls = 0;
  for (const f of mine) {
    if (!f.winner || !f.innings || f.rain) continue;
    for (const inn of f.innings) {
      const balls = inn.wickets >= 10 ? inn.scheduledOvers * 6 : inn.legalBalls;
      if (inn.team === me) { forRuns += inn.runs; forBalls += balls; } else { againstRuns += inn.runs; againstBalls += balls; }
    }
  }
  return (forBalls ? (6 * forRuns) / forBalls : 0) - (againstBalls ? (6 * againstRuns) / againstBalls : 0);
}

export function performance(result: TournamentResult, mine: FixtureResult[], me: string): Performance {
  const id = result.identity;
  if (!id) return { score: 0, stagePoints: 0, winPoints: 0, nrr: 0, nrrPoints: 0, unbeatenPoints: 0 };
  const stages = result.stages.length;
  const exit = exitStageOf(result.stages, mine);
  const stagePoints = id.champion ? 60 : Math.round((50 * exit) / Math.max(1, stages - 1));
  const winPoints = 4 * id.won;
  const nrr = netRunRate(mine, me);
  const nrrPoints = Math.max(-10, Math.min(10, Math.round(nrr * 5)));
  const unbeatenPoints = id.unbeaten && id.played > 0 ? 10 : 0;
  return { score: Math.max(0, stagePoints + winPoints + nrrPoints + unbeatenPoints), stagePoints, winPoints, nrr, nrrPoints, unbeatenPoints };
}

/* ---------- the share link ---------- */

export interface SharedRun {
  seed: string;
  identity: Identity;
  coach: { team: string; coachName: string; from: string } | null;
  /** [team, editionId, playerId] in batting order. */
  picks: [string, string, string][];
  captainId: string | null;
  plans: (MatchPlan | undefined)[];
  /** Line-up moves spent, so a replayed run has only what was left. */
  movesUsed: number;
}

const b64 = {
  encode: (text: string) => btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  decode: (text: string) => decodeURIComponent(escape(atob(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4)))),
};

export function encodeRun(run: SharedRun): string {
  const compact = { s: run.seed, i: [run.identity.team, run.identity.editionId, run.identity.standIn ? 1 : 0], c: run.coach ? [run.coach.team, run.coach.coachName, run.coach.from] : null, p: run.picks, k: run.captainId, l: run.plans.map((p) => p ?? 0), m: run.movesUsed };
  return b64.encode(JSON.stringify(compact));
}

export function decodeRun(text: string): SharedRun | null {
  try {
    const c = JSON.parse(b64.decode(text)) as { s: string; i: [string, string, number]; c: [string, string, string] | null; p: [string, string, string][]; k: string | null; l: (MatchPlan | 0)[]; m?: number };
    if (typeof c.s !== "string" || !Array.isArray(c.i) || !Array.isArray(c.p) || c.p.length !== 11) return null;
    return {
      seed: c.s, identity: { team: c.i[0], editionId: c.i[1], standIn: !!c.i[2] }, coach: c.c ? { team: c.c[0], coachName: c.c[1], from: c.c[2] } : null,
      // Links made before line-up moves have no count: none were possible then.
      picks: c.p, captainId: c.k ?? null, plans: (c.l ?? []).map((p) => (p === 0 ? undefined : p)), movesUsed: typeof c.m === "number" ? c.m : 0,
    };
  } catch {
    return null;
  }
}

export function runFrom(seed: string, identity: Identity, coach: CoachOut | null, picks: PoolPlayer[], captainId: string | null, plans: (MatchPlan | undefined)[], movesUsed = 0): SharedRun {
  return { seed, identity, coach: coach ? { team: coach.team, coachName: coach.coachName, from: coach.from } : null, picks: picks.map((p) => [p.team, p.editionId, p.id]), captainId, plans, movesUsed };
}

/**
 * The daily seed: one World Cup a day for everyone on the same calendar date, by the player's own
 * clock (2026-11-03; it was the UTC date, so the button read tomorrow's date in a US evening).
 */
export function dailySeed(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `daily-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The daily seed's date as the button prints it (M/D/YYYY), the same local day the seed uses. */
export function dailyLabel(date = new Date()): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}
