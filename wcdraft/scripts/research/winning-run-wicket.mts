/**
 * A wicket on the ball that wins a chase (2026-11-05, Yash: a side won the chase yet a man was run
 * out on the last run). Counts chases won whose final ball also carries a wicket, by kind.
 * Run: npx tsx wcdraft/scripts/research/winning-run-wicket.mts [matches]
 */

import { loadEdition } from "../../src/engine/load.js";
import { matchEnvironment, teamFromDefault } from "../../src/engine/data.js";
import { simulateMatch } from "../../src/engine/match.js";

const n = Number(process.argv[2] ?? 4000);
const data = loadEdition("2024");
const sides = ["India", "South Africa", "England", "Australia", "West Indies", "Afghanistan", "Pakistan", "New Zealand"].filter((t) => data.squads.has(t));
const env = matchEnvironment(data, "bridgetown");
let won = 0, bad = 0;
const kinds = new Map<string, number>();
for (let i = 0; i < n; i += 1) {
  const a = teamFromDefault(data, sides[i % sides.length]!), b = teamFromDefault(data, sides[(i + 3) % sides.length]!);
  const m = simulateMatch(a, b, env, data.situation, { seed: `wrw-${i}`, rainProbability: 0, keepBallLog: true });
  const [i1, i2] = m.innings;
  if (i2.runs < i1.runs + 1) continue;
  won += 1;
  const last = m.balls.filter((x) => x.innings === 2).at(-1)!;
  if (last.wicket) {
    bad += 1;
    const k = `${last.dismissal?.kind}${last.dismissal?.nonStriker ? " (non-striker)" : ""}${last.extraKind ? ` off a ${last.extraKind}` : ""}`;
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
}
console.log(`${won} chases won of ${n} matches; ${bad} ended with a wicket on the winning ball`, Object.fromEntries(kinds));
