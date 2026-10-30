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
console.log(`Bowlers used: ${JSON.stringify(s.sim.bowlersUsed)} (mean ${s.sim.bowlersUsedMean}; measured norm 5: 17%, 6: 62%, 7: 20%)`);
console.log(`Results: ${s.results.decided} decided, favourite right ${(100 * s.results.accuracy).toFixed(0)}%, Brier ${s.results.brier} (coin 0.25), log loss ${s.results.logLoss} (coin ${s.results.baselineLogLoss})`);
writeJson(resolve(paths.out, "engine", `replay-${editionId}.json`), s);
