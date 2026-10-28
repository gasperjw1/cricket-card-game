/**
 * How captains actually used their bowlers: bowlers per innings, quota completion after
 * expensive starts, return rate after an expensive over, death-overs trust, phase share by
 * bowler rank, and when the sixth option is introduced. Measured on complete 20-over innings
 * only. These are the norms the engine's allocation policy must reproduce.
 */

import type { Innings } from "../cricsheet/match.js";
import { bump, getOrCreate, histogram, mean, pct } from "../util/stats.js";

const FIRST_TWO_BANDS = ["<=10", "11-16", "17-24", "25+"] as const;
const OVER_COST_BANDS = ["0-6", "7-11", "12-17", "18+"] as const;

function firstTwoBand(runs: number): (typeof FIRST_TWO_BANDS)[number] {
  return runs <= 10 ? "<=10" : runs <= 16 ? "11-16" : runs <= 24 ? "17-24" : "25+";
}
function overCostBand(runs: number): (typeof OVER_COST_BANDS)[number] {
  return runs <= 6 ? "0-6" : runs <= 11 ? "7-11" : runs <= 17 ? "12-17" : "18+";
}

/** Increment a [n, hits] pair for `band`. */
function tally(map: Map<string, [number, number]>, band: string, hit: boolean): void {
  const cell = getOrCreate(map, band, () => [0, 0] as [number, number]);
  cell[0] += 1;
  if (hit) cell[1] += 1;
}

class UsageAccumulator {
  innings = 0;
  bowlersUsed: number[] = [];
  quota = new Map<string, [number, number]>(); // band → [n, completed 4]
  newBallAtDeath = new Map<string, [number, number]>(); // band → [n, bowled at death]
  returnAfter = new Map<string, [number, number]>(); // band → [n, returned]
  deathOvers = 0;
  deathOversByOpener = 0;
  rankPhase = new Map<number, { pp: number; mid: number; death: number }>();
  sixthIntroOver: number[] = [];
  sixthOvers: number[] = [];

  add(inn: Innings): void {
    const seq = inn.bowlerByOver.slice(0, 20);
    if (seq.length < 20 || seq.some((b) => !b)) return;
    this.innings += 1;
    const runsByOver = new Array<number>(20).fill(0);
    for (const b of inn.balls) if (b.over < 20) runsByOver[b.over] = (runsByOver[b.over] ?? 0) + b.runsTotal;

    const count = new Map<string, number>();
    for (const b of seq) bump(count, b);
    this.bowlersUsed.push(count.size);

    const order = [...count.keys()].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || seq.indexOf(a) - seq.indexOf(b));
    const rank = new Map(order.map((b, i) => [b, i + 1]));

    seq.forEach((b, idx) => {
      const r = Math.min(rank.get(b) ?? 9, 6);
      const rp = getOrCreate(this.rankPhase, r, () => ({ pp: 0, mid: 0, death: 0 }));
      rp[idx < 6 ? "pp" : idx < 16 ? "mid" : "death"] += 1;
    });

    // Quota completion and death trust for new-ball bowlers (bowled in overs 1–3).
    for (const b of new Set(seq.slice(0, 3))) {
      const overs = seq.map((x, i) => (x === b ? i : -1)).filter((i) => i >= 0);
      if (overs.length < 2) continue;
      const band = firstTwoBand((runsByOver[overs[0]!] ?? 0) + (runsByOver[overs[1]!] ?? 0));
      tally(this.quota, band, (count.get(b) ?? 0) >= 4);
      tally(this.newBallAtDeath, band, overs.some((i) => i >= 16));
    }

    // Return rate after an over of a given cost, while quota remains.
    seq.forEach((b, k) => {
      const bowledSoFar = seq.slice(0, k + 1).filter((x) => x === b).length;
      if (bowledSoFar >= 4) return;
      tally(this.returnAfter, overCostBand(runsByOver[k] ?? 0), seq.slice(k + 1).includes(b));
    });

    const openers = new Set(seq.slice(0, 2));
    for (const k of [18, 19]) {
      this.deathOvers += 1;
      if (openers.has(seq[k]!)) this.deathOversByOpener += 1;
    }

    const sixth = order[5];
    if (sixth) {
      this.sixthIntroOver.push(seq.indexOf(sixth) + 1);
      this.sixthOvers.push(count.get(sixth) ?? 0);
    } else {
      this.sixthOvers.push(0);
    }
  }

  summary() {
    const bandTable = (m: Map<string, [number, number]>, bands: readonly string[]) =>
      Object.fromEntries(bands.map((b) => [b, { n: m.get(b)?.[0] ?? 0, pct: pct(m.get(b)?.[1] ?? 0, m.get(b)?.[0] ?? 0, 0) }]));
    const used = histogram(this.bowlersUsed);
    const rankPhaseShare: Record<string, { oversPerInnings: number; ppPct: number; midPct: number; deathPct: number }> = {};
    for (const [r, v] of [...this.rankPhase.entries()].sort((a, b) => a[0] - b[0])) {
      const tot = v.pp + v.mid + v.death;
      rankPhaseShare[String(r)] = { oversPerInnings: +(tot / Math.max(1, this.innings)).toFixed(2), ppPct: pct(v.pp, tot, 0), midPct: pct(v.mid, tot, 0), deathPct: pct(v.death, tot, 0) };
    }
    return {
      completeInnings: this.innings,
      bowlersUsed: { histogramPct: Object.fromEntries(Object.entries(used).map(([k, v]) => [k, pct(v, this.innings, 0)])), mean: mean(this.bowlersUsed) },
      newBallQuotaCompletionByFirstTwoOvers: bandTable(this.quota, FIRST_TWO_BANDS),
      newBallBowlsAtDeathByFirstTwoOvers: bandTable(this.newBallAtDeath, FIRST_TWO_BANDS),
      returnsLaterByOverCost: bandTable(this.returnAfter, OVER_COST_BANDS),
      overs19And20ByOpeningBowlerPct: pct(this.deathOversByOpener, this.deathOvers, 0),
      rankPhaseShare,
      sixthBowler: { introducedOverHistogram: histogram(this.sixthIntroOver), oversPerInnings: mean(this.sixthOvers) },
    };
  }
}

export class BowlingUsageAnalysis {
  private readonly byEdition = new Map<string, UsageAccumulator>();
  private readonly byTeamEdition = new Map<string, UsageAccumulator>();

  add(editionId: string, inn: Innings): void {
    getOrCreate(this.byEdition, editionId, () => new UsageAccumulator()).add(inn);
    getOrCreate(this.byTeamEdition, `${editionId}|${inn.bowlingTeam}`, () => new UsageAccumulator()).add(inn);
  }

  summary() {
    return {
      byEdition: Object.fromEntries([...this.byEdition.entries()].sort().map(([e, a]) => [e, a.summary()])),
      byTeamEdition: [...this.byTeamEdition.entries()].sort().map(([key, a]) => {
        const [editionId, team] = key.split("|") as [string, string];
        const s = a.summary();
        return { editionId, team, completeInnings: s.completeInnings, bowlersUsed: s.bowlersUsed, overs19And20ByOpeningBowlerPct: s.overs19And20ByOpeningBowlerPct, sixthBowlerOversPerInnings: s.sixthBowler.oversPerInnings };
      }),
    };
  }
}
