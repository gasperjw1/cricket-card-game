/**
 * Byes and leg-byes per ball and per event (2026-11-03, the dots research): the edition profile
 * stores bye runs per over, and the engine read that as the chance of a one-run bye ball, so it made
 * about a third too many bye balls and that many fewer dots. This measures, by phase, how often a
 * legal ball yields byes or leg-byes and how many runs such a ball brings, over men's T20Is since
 * 2014 and over the World Cups alone.
 *
 *   node --import tsx scripts/research/byes.mts
 */

import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch, phaseOf } from "../../src/cricsheet/match.ts";

const config = loadConfig();
const wc = (e: { eventName: string | null }) => !!e.eventName && config.worldCupEventNames.has(e.eventName);
type T = { balls: number; events: number; runs: number; byRuns: Record<number, number> };
const t = (): T => ({ balls: 0, events: 0, runs: 0, byRuns: {} });
const all: Record<string, T> = { pp: t(), mid: t(), death: t() }, cups: Record<string, T> = { pp: t(), mid: t(), death: t() };
for (const e of loadIndex()) {
  if (e.gender !== "male" || e.date < "2014-01-01") continue;
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  for (const inn of mainInnings(m)) {
    if (inn.reduced) continue;
    for (const b of inn.balls) {
      if (!b.legal) continue;
      for (const tab of wc(e) ? [all, cups] : [all]) {
        const x = tab[phaseOf(b.over)]!;
        x.balls += 1;
        if (b.runsByes > 0) { x.events += 1; x.runs += b.runsByes; x.byRuns[b.runsByes] = (x.byRuns[b.runsByes] ?? 0) + 1; }
      }
    }
  }
}
for (const [label, tab] of [["All men's T20Is since 2014", all], ["World Cups since 2014", cups]] as const) {
  console.log(label);
  for (const p of ["pp", "mid", "death"]) {
    const x = tab[p]!;
    const dist = Object.entries(x.byRuns).map(([r, n]) => `${r}: ${((100 * n) / x.events).toFixed(1)}%`).join(", ");
    console.log(`  ${p.padEnd(5)} balls ${x.balls}  bye balls ${((100 * x.events) / x.balls).toFixed(2)}%  bye runs a ball ${(x.runs / x.balls).toFixed(4)}  runs per bye ball ${(x.runs / x.events).toFixed(3)}  (${dist})`);
  }
}
