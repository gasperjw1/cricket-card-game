/**
 * Super overs as they are really played (2026-11-03): the engine played a super over as the first
 * over of a 20-over innings and scored 4.6 runs a side. This measures men's T20I super overs, and
 * for scale an innings' first and last over, runs and wickets per over.
 *
 *   node --import tsx scripts/research/super-overs.mts
 */

import { ARCHIVES, loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch } from "../../src/cricsheet/match.ts";

type Tally = { n: number; runs: number; wkts: number; balls: number; runs2: number };
const tally = (): Tally => ({ n: 0, runs: 0, wkts: 0, balls: 0, runs2: 0 });
const add = (t: Tally, runs: number, wkts: number, balls: number) => { t.n += 1; t.runs += runs; t.wkts += wkts; t.balls += balls; t.runs2 += runs * runs; };
const show = (label: string, t: Tally) => {
  const mean = t.runs / t.n;
  console.log(`${label.padEnd(34)} n ${String(t.n).padStart(6)}  runs ${mean.toFixed(2)} (sd ${Math.sqrt(t.runs2 / t.n - mean * mean).toFixed(2)})  wkts ${(t.wkts / t.n).toFixed(2)}  legal balls ${(t.balls / t.n).toFixed(2)}`);
};

const so = { first: tally(), second: tally() };
const firstOver = tally(), lastOver = tally(), lastOverSet = tally();
const hist = new Map<number, number>();
const setAtBall: number[] = [];
const index = loadIndex(ARCHIVES.t20).filter((e) => e.gender === "male");
for (const e of index) {
  const m = normaliseMatch(readMatch(e.file), e.id);
  const supers = m.innings.filter((i) => i.superOver);
  supers.forEach((inn, k) => {
    add(k % 2 === 0 ? so.first : so.second, inn.total, inn.wickets, inn.legalBalls);
    hist.set(inn.total, (hist.get(inn.total) ?? 0) + 1);
  });
  for (const inn of m.innings.filter((i) => !i.superOver && !i.reduced && i.index === 0 && i.oversStarted >= 20)) {
    const over = (o: number) => inn.balls.filter((b) => b.over === o);
    const sum = (bs: typeof inn.balls) => [bs.reduce((s, b) => s + b.runsTotal, 0), bs.reduce((s, b) => s + b.wickets.length, 0), bs.filter((b) => b.legal).length] as const;
    add(firstOver, ...sum(over(0)));
    const last = sum(over(19));
    add(lastOver, ...last);
    // A last over with wickets in hand: at most five down when it began, the nearest a full innings gets to a super over's three batters.
    const downBefore = inn.balls.filter((b) => b.over < 19).reduce((s, b) => s + b.wickets.length, 0);
    if (downBefore <= 5) {
      add(lastOverSet, ...last);
      // How set the striker is on each ball of that over: balls he had faced before it.
      for (const [k, b] of inn.balls.entries()) if (b.over === 19) setAtBall.push(inn.balls.slice(0, k).filter((x) => x.batter === b.batter && !x.wide).length);
    }
  }
}
show("Super over, side batting first", so.first);
show("Super over, side batting second", so.second);
show("First over, first innings", firstOver);
show("Last over, first innings", lastOver);
show("Last over, five or fewer down", lastOverSet);
const sorted = [...setAtBall].sort((x, y) => x - y);
console.log(`Striker's balls faced before each ball of that last over: median ${sorted[Math.floor(sorted.length / 2)]}, quartiles ${sorted[Math.floor(sorted.length / 4)]}–${sorted[Math.floor((3 * sorted.length) / 4)]} (n ${sorted.length})`);
console.log("Super-over totals:", [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([r, n]) => `${r}:${n}`).join(" "));
