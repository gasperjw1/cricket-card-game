/**
 * `npm run engine:calibrate -- [sims]` — sweep the engine's combination exponents over several
 * editions and print the bias of simulated run rate, dot share and balls per wicket against the
 * real editions, plus result calibration. The replay harness is the acceptance test; this picks
 * the constants in `src/engine/model.ts`.
 */
import { setEngineOverrides } from "../engine/model.js";
import { replayEdition } from "../engine/replay.js";

const sims = Number(process.argv[2] ?? 20);
const editions = ["2012", "2016", "2022", "2024", "2026"];
const grid = [
  { batExponent: 0.5, bowlExponent: 0.5 },
  { batExponent: 0.7, bowlExponent: 0.7 },
  { batExponent: 0.9, bowlExponent: 0.9 },
  { batExponent: 1.0, bowlExponent: 1.0 },
  { batExponent: 0.8, bowlExponent: 0.6 },
  { batExponent: 0.6, bowlExponent: 0.8 },
];
console.log("| bat^ | bowl^ | RPO bias % | dot bias pts | balls/wkt bias | 1st-inn SD ratio | chase win bias pts | Brier | favourite right |", "\n|---|---|---|---|---|---|---|---|---|");
for (const g of grid) {
  setEngineOverrides(g);
  let rpo = 0, dot = 0, bpw = 0, sd = 0, chase = 0, brier = 0, acc = 0, n = 0, decided = 0;
  for (const ed of editions) {
    const s = replayEdition(ed, sims);
    rpo += (100 * (s.sim.runsPerOver - s.real.runsPerOver)) / s.real.runsPerOver;
    dot += s.sim.dotPct - s.real.dotPct;
    bpw += s.sim.ballsPerWicket - s.real.ballsPerWicket;
    sd += s.sim.firstInningsSd / s.real.firstInningsSd;
    chase += s.sim.chaseWinPct - s.real.chaseWinPct;
    brier += s.results.brier * s.results.decided;
    acc += s.results.accuracy * s.results.decided;
    decided += s.results.decided;
    n += 1;
  }
  const f = (x: number, d = 2) => (x / n).toFixed(d);
  console.log(`| ${g.batExponent} | ${g.bowlExponent} | ${f(rpo, 1)} | ${f(dot, 1)} | ${f(bpw, 1)} | ${f(sd)} | ${f(chase, 1)} | ${(brier / decided).toFixed(3)} | ${(acc / decided).toFixed(2)} |`);
}
