/**
 * Batting partnerships between squad-mates, per edition, over the tournament plus the form
 * window. Feeds the Dynamic Duo tag. Only pairs with a meaningful sample are emitted.
 */

import type { Innings } from "../cricsheet/match.js";
import { getOrCreate, ratio } from "../util/stats.js";

interface Pair {
  balls: number;
  runs: number;
  innings: number;
  lastInningsKey: string;
}

export class PartnershipsAnalysis {
  private readonly pairs = new Map<string, Pair>();

  constructor(private readonly minBalls = 60) {}

  /**
   * @param isMember  whether a person id belongs to this edition's squad for `inn.team`
   * @param inningsKey unique key for the innings (match id + innings index)
   */
  add(editionId: string, inn: Innings, isMember: (id: string) => boolean, inningsKey: string): void {
    for (const b of inn.balls) {
      if (!isMember(b.batter) || !isMember(b.nonStriker)) continue;
      const [a, c] = b.batter < b.nonStriker ? [b.batter, b.nonStriker] : [b.nonStriker, b.batter];
      const p = getOrCreate(this.pairs, `${editionId}|${inn.team}|${a}|${c}`, () => ({ balls: 0, runs: 0, innings: 0, lastInningsKey: "" }));
      if (b.legal) p.balls += 1;
      p.runs += b.runsTotal;
      if (p.lastInningsKey !== inningsKey) {
        p.innings += 1;
        p.lastInningsKey = inningsKey;
      }
    }
  }

  summary(names: Map<string, string>) {
    const rows = [];
    for (const [key, p] of this.pairs) {
      if (p.balls < this.minBalls) continue;
      const [editionId, team, a, b] = key.split("|") as [string, string, string, string];
      rows.push({
        editionId,
        team,
        pair: [{ id: a, name: names.get(a) ?? a }, { id: b, name: names.get(b) ?? b }],
        innings: p.innings,
        balls: p.balls,
        runs: p.runs,
        runsPerOver: ratio(6 * p.runs, p.balls, 2),
      });
    }
    return rows.sort((x, y) => x.editionId.localeCompare(y.editionId) || y.runs - x.runs);
  }
}
