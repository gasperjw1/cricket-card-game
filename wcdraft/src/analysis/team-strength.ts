/**
 * Team-strength timeline: an Elo rating over every men's T20I in date order.
 *
 * Used for (a) the opposition-quality covariate in ratings, (b) captaincy wins-above-expectation
 * (each match carries the pre-match win expectation), and (c) stand-in and associate team
 * strength. Plain Elo, no margin-of-victory term, K = 24; a decided tie-break counts as a win,
 * an undecided tie as a half.
 *
 * Connectivity regularisation: associates play mostly each other, so a team that dominates a
 * closed regional circuit drifts above its true level. The rating *read out* for a team is its raw
 * rating less `connectivity.isolation` times the share of its last `connectivity.window` matches
 * NOT played against full members. A side that only meets its own circuit reads 300 lower; a side
 * that always meets full members reads as rated. The raw rating still drives the Elo updates, so
 * the system stays a plain Elo underneath.
 *
 * Refit 2026-11-02 (`scripts/research/elo-connectivity-sweep.mts`). The first rule (2026-10-30,
 * after the sim rated Uganda 1668) capped the excess above 1500 by that share, but World Cup
 * associates then sat at the cap. On the 139 associate-v-full-member T20Is from 2010 to 2023 it
 * expected associates to win 40.9% against 28.1% real, and it predicted all 1,814 decided T20Is
 * slightly worse than no rule (log loss 0.6548 against 0.6520). Lowering the cap hurt that further.
 * The isolation penalty at 300 is calibrated across the tiers (27.7% against 28.1%, log loss
 * 0.6001 to 0.5327) and is the best of the sweep over all matches (0.6428; 250 and 350 both 0.643).
 * On 2024–26, which the fit didn't see, it expects 18.0% against 12.5% real; the old rule said 34.2%.
 */

import type { Match } from "../cricsheet/match.js";
import { getOrCreate, round } from "../util/stats.js";

export const ELO = { k: 24, initialFullMember: 1600, initialAssociate: 1400, connectivity: { window: 20, isolation: 300 } } as const;

/** Opponent-strength bins used to condition population vectors and player exposure. */
export const ELO_BIN_EDGES = [1400, 1500, 1600, 1700, 1800] as const;
export const ELO_BINS = ["<1400", "1400-1499", "1500-1599", "1600-1699", "1700-1799", "1800+"] as const;
export type EloBin = (typeof ELO_BINS)[number];

export function eloBin(rating: number): EloBin {
  let i = 0;
  while (i < ELO_BIN_EDGES.length && rating >= ELO_BIN_EDGES[i]!) i += 1;
  return ELO_BINS[i]!;
}

export interface StrengthMatch {
  id: string;
  date: string;
  team: string;
  opponent: string;
  pre: number;
  expected: number;
  /** 1 win, 0 loss, 0.5 undecided tie */
  result: number;
}

export class TeamStrengthAnalysis {
  private readonly rating = new Map<string, number>();
  private readonly history = new Map<string, StrengthMatch[]>();

  constructor(private readonly isFullMember: (team: string, year: number) => boolean) {}

  private start(team: string, date: string): number {
    return this.isFullMember(team, Number(date.slice(0, 4))) ? ELO.initialFullMember : ELO.initialAssociate;
  }

  /** Whether each of a team's recent opponents was a full member at the time (newest last). */
  private readonly recentOpposition = new Map<string, boolean[]>();

  /** Current (pre-match, if called before `add`) rating of a team, connectivity-regularised. */
  ratingOf(team: string, date: string): number {
    const raw = this.rating.get(team) ?? this.start(team, date);
    const recent = this.recentOpposition.get(team);
    const fullShare = recent && recent.length ? recent.filter(Boolean).length / recent.length : 0;
    return raw - ELO.connectivity.isolation * (1 - fullShare);
  }

  /** The unregularised rating (for the timeline output). */
  rawRatingOf(team: string, date: string): number {
    return this.rating.get(team) ?? this.start(team, date);
  }

  add(m: Match): void {
    const [a, b] = m.teams;
    if (!a || !b) return;
    const year = Number(m.date.slice(0, 4));
    for (const [team, opp] of [[a, b], [b, a]] as const) {
      const list = getOrCreate(this.recentOpposition, team, () => []);
      list.push(this.isFullMember(opp, year));
      if (list.length > ELO.connectivity.window) list.shift();
    }
    const winner = m.winner ?? m.tieWinner;
    if (!winner && m.result !== "tie") return; // no result: no information
    const ra = this.rating.get(a) ?? this.start(a, m.date);
    const rb = this.rating.get(b) ?? this.start(b, m.date);
    const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
    const sa = winner === a ? 1 : winner === b ? 0 : 0.5;
    this.rating.set(a, ra + ELO.k * (sa - ea));
    this.rating.set(b, rb + ELO.k * (1 - sa - (1 - ea)));
    getOrCreate(this.history, a, () => []).push({ id: m.id, date: m.date, team: a, opponent: b, pre: round(ra, 1), expected: round(ea, 3), result: sa });
    getOrCreate(this.history, b, () => []).push({ id: m.id, date: m.date, team: b, opponent: a, pre: round(rb, 1), expected: round(1 - ea, 3), result: 1 - sa });
  }

  /** Rating at the end of each month a team played, plus the full match list. */
  summary() {
    const teams: Record<string, { current: number; matches: number; byMonth: Record<string, number>; history: StrengthMatch[] }> = {};
    for (const [team, hist] of [...this.history.entries()].sort()) {
      // Post-match rating after match i is the pre-match rating of match i+1 (or the final rating).
      const byMonth: Record<string, number> = {};
      const current = this.rating.get(team) ?? ELO.initialAssociate;
      for (let i = 0; i < hist.length; i += 1) {
        const post = hist[i + 1]?.pre ?? current;
        byMonth[hist[i]!.date.slice(0, 7)] = round(post, 1);
      }
      teams[team] = { current: round(current, 1), matches: hist.length, byMonth, history: hist };
    }
    return { params: ELO, teams };
  }
}
