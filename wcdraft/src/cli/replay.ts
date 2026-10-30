/** `npm run engine:replay -- [edition] [sims]` — replay an edition's real matches and compare with reality. */
import { resolve } from "node:path";
import { replayEdition } from "../engine/replay.js";
import { paths, writeJson } from "../util/io.js";

const editionId = process.argv[2] ?? "2024";
const sims = Number(process.argv[3] ?? 100);
const t0 = Date.now();
const s = replayEdition(editionId, sims);
const row = (k: keyof typeof s.real) => `| ${k} | ${s.real[k]} | ${s.sim[k as keyof typeof s.sim]} |`;
console.log(`Replayed ${s.matchCount} matches of ${editionId} × ${sims} sims in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("| Measure | Real | Simulated |", "\n|---|---|---|");
for (const k of ["runsPerOver", "ballsPerWicket", "dotPct", "fourPct", "sixPct", "powerplayRpo", "middleRpo", "deathRpo", "firstInningsAvg", "firstInningsSd", "chaseWinPct"] as const) console.log(row(k));
console.log(`Test 1 first-innings totals p10/p50/p90: real ${s.firstInnings.real.p10}/${s.firstInnings.real.p50}/${s.firstInnings.real.p90} (n ${s.firstInnings.real.n}), sim ${s.firstInnings.sim.p10}/${s.firstInnings.sim.p50}/${s.firstInnings.sim.p90}`);
console.log(`Test 2 wickets down at overs 6/10/15/close: reference ${Object.values(s.wicketsByOver.reference).join("/")}, sim ${Object.values(s.wicketsByOver.sim).join("/")}`);
console.log(`Test 3 per-ball marginals TV distance ${s.marginals.totalVariation} (target ≤ 0.02): real ${JSON.stringify(s.marginals.real)} sim ${JSON.stringify(s.marginals.sim)}`);
console.log(`Test 4 runs after the 10-over mark: sim ${s.par.simRemaining}, resource-table par ${s.par.tableRemaining} (n ${s.par.n})`);
console.log(`Test 5 bowlers used: ${JSON.stringify(s.sim.bowlersUsed)} (mean ${s.sim.bowlersUsedMean}; norm 5: 17%, 6: 62%, 7: 20%); death overs by a new-ball bowler ${s.sim.deathOversByNewBallPct}% (norm 43% for overs 19–20)`);
console.log(`Test 6 chase win % by ground (≥ 4 matches): ${s.venues.map((v) => `${v.venueId} real ${v.realChaseWinPct} sim ${v.simChaseWinPct} (${v.matches}m, uplift ${(100 * v.chaseUplift).toFixed(1)}%)`).join("; ")}`);
console.log(`Test 8 results: ${s.results.decided} decided, favourite right ${(100 * s.results.accuracy).toFixed(0)}%, Brier ${s.results.brier} (coin 0.25), log loss ${s.results.logLoss} (coin ${s.results.baselineLogLoss})`);
writeJson(resolve(paths.out, "engine", `replay-${editionId}.json`), s);
