// Replay over nine editions with engine overrides: biases, Brier and first-innings spread.
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
//   npx tsx eval.mts <label> <sims> <seeds> <overridesJson>
import { replayEdition } from "../../src/engine/replay.ts";
import { setEngineOverrides } from "../../src/engine/model.ts";

const [label, simsArg, seedsArg, overrides] = process.argv.slice(2);
const sims = Number(simsArg ?? 40), seeds = Number(seedsArg ?? 1);
if (overrides) setEngineOverrides(JSON.parse(overrides));
const ids = ["2007", "2010", "2012", "2014", "2016", "2021", "2022", "2024", "2026"];
let brier = 0, n = 0, rpo = 0, pp = 0, mid = 0, death = 0, bpw = 0, sd = 0, chase = 0, dot = 0, six = 0, acc = 0, k = 0;
for (let seed = 1; seed <= seeds; seed += 1) for (const id of ids) {
  const r = replayEdition(id, sims, seed);
  brier += r.results.brier * r.results.decided; acc += r.results.accuracy * r.results.decided; n += r.results.decided; k += 1;
  rpo += r.sim.runsPerOver - r.real.runsPerOver; pp += r.sim.powerplayRpo - r.real.powerplayRpo; mid += r.sim.middleRpo - r.real.middleRpo; death += r.sim.deathRpo - r.real.deathRpo;
  bpw += r.sim.ballsPerWicket - r.real.ballsPerWicket; sd += r.sim.firstInningsSd - r.real.firstInningsSd; chase += r.sim.chaseWinPct - r.real.chaseWinPct; dot += r.sim.dotPct - r.real.dotPct; six += r.sim.sixPct - r.real.sixPct;
}
const f = (x: number, d = 2) => (x / k).toFixed(d);
console.log(`== ${label} (${sims} sims × ${seeds} seeds): Brier ${(brier / n).toFixed(4)} acc ${(100 * acc / n).toFixed(1)}% | bias RPO ${f(rpo, 3)} PP ${f(pp, 3)} mid ${f(mid, 3)} death ${f(death, 3)} bpw ${f(bpw)} sd ${f(sd, 1)} chase ${f(chase, 1)} dot ${f(dot)} six ${f(six)}`);
