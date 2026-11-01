/**
 * `npm run engine:calibrate -- [sims] [exponents|dispersion|terms]` — sweep engine constants over
 * several editions and print the bias of simulated run rate, dot share and balls per wicket against
 * the real editions, the first-innings spread ratio and result calibration. The replay harness is
 * the acceptance test; this picks the constants in `src/engine/model.ts`.
 */
import { setEngineOverrides, type EngineOverrides } from "../engine/model.js";
import { replayEdition } from "../engine/replay.js";

const sims = Number(process.argv[2] ?? 20);
const mode = process.argv[3] ?? "dispersion";
const editions = ["2012", "2016", "2022", "2024", "2026"];
const grids: Record<string, EngineOverrides[]> = {
  exponents: [
    { batExponent: 0.5, bowlExponent: 0.5 },
    { batExponent: 0.7, bowlExponent: 0.7 },
    { batExponent: 0.9, bowlExponent: 0.9 },
    { batExponent: 1.0, bowlExponent: 1.0 },
  ],
  dispersion: [
    { bowlerDaySd: 0, batterDaySd: 0, matchEffectSd: 0.07, inningsEffectSd: 0.04 },
    { bowlerDaySd: 0.1, batterDaySd: 0.08, matchEffectSd: 0.05, inningsEffectSd: 0.03 },
    { bowlerDaySd: 0.14, batterDaySd: 0.12, matchEffectSd: 0.04, inningsEffectSd: 0.02 },
    { bowlerDaySd: 0.18, batterDaySd: 0.15, matchEffectSd: 0.03, inningsEffectSd: 0.02 },
    { bowlerDaySd: 0.21, batterDaySd: 0.19, matchEffectSd: 0, inningsEffectSd: 0 },
  ],
  // Wide enough to find 1 (2026-11-01 audit: the old grid searched 0.88–0.90 only).
  calibration: [
    { scoringCalibration: 1, hazardCalibration: 1, deathCalibration: 1 },
    { scoringCalibration: 0.98, hazardCalibration: 1, deathCalibration: 1 },
    { scoringCalibration: 0.96, hazardCalibration: 1, deathCalibration: 1 },
    { scoringCalibration: 0.94, hazardCalibration: 1, deathCalibration: 1 },
    { scoringCalibration: 0.96, hazardCalibration: 1, deathCalibration: 1.03 },
    { scoringCalibration: 0.96, hazardCalibration: 1.02, deathCalibration: 1 },
    { scoringCalibration: 0.89, hazardCalibration: 1.04, deathCalibration: 1.14 },
  ],
  chase: [
    { pressureExponent: 1.5, chaseDotsExponent: 1 },
    { pressureExponent: 1, chaseDotsExponent: 1 },
    { pressureExponent: 0.5, chaseDotsExponent: 1 },
    { pressureExponent: 0, chaseDotsExponent: 1 },
    { pressureExponent: 1, chaseDotsExponent: 0 },
  ],
  states: [
    { shapeExponent: 0, foundExponent: 1, gearExponent: 1 },
    { shapeExponent: 1, foundExponent: 0, gearExponent: 1 },
    { shapeExponent: 1, foundExponent: 1, gearExponent: 0 },
    { shapeExponent: 1, foundExponent: 1, gearExponent: 1 },
  ],
  matchups: [{ matchupExponent: 0 }, { matchupExponent: 1 }],
  terms: [
    { streakExponent: 0, setnessExponent: 0, ballInOverExponent: 0, chaseDotsExponent: 0 },
    { streakExponent: 1, setnessExponent: 0, ballInOverExponent: 0, chaseDotsExponent: 0 },
    { streakExponent: 0, setnessExponent: 1, ballInOverExponent: 0, chaseDotsExponent: 0 },
    { streakExponent: 1, setnessExponent: 1, ballInOverExponent: 1, chaseDotsExponent: 0 },
    { streakExponent: 1, setnessExponent: 1, ballInOverExponent: 1, chaseDotsExponent: 1 },
  ],
};
const grid = grids[mode];
if (!grid) throw new Error(`unknown mode ${mode}; use ${Object.keys(grids).join(" | ")}`);
console.log(`| ${mode} | RPO bias % | death RPO bias % | dot bias pts | balls/wkt bias | 1st-inn SD ratio | chase win bias pts | bowlers used | Brier | favourite right |`, "\n|---|---|---|---|---|---|---|---|---|---|");
for (const g of grid) {
  setEngineOverrides(g);
  let rpo = 0, death = 0, dot = 0, bpw = 0, sd = 0, chase = 0, used = 0, brier = 0, acc = 0, n = 0, decided = 0;
  for (const ed of editions) {
    const s = replayEdition(ed, sims);
    rpo += (100 * (s.sim.runsPerOver - s.real.runsPerOver)) / s.real.runsPerOver;
    death += (100 * (s.sim.deathRpo - s.real.deathRpo)) / s.real.deathRpo;
    dot += s.sim.dotPct - s.real.dotPct;
    bpw += s.sim.ballsPerWicket - s.real.ballsPerWicket;
    sd += s.sim.firstInningsSd / s.real.firstInningsSd;
    chase += s.sim.chaseWinPct - s.real.chaseWinPct;
    used += s.sim.bowlersUsedMean;
    brier += s.results.brier * s.results.decided;
    acc += s.results.accuracy * s.results.decided;
    decided += s.results.decided;
    n += 1;
  }
  const f = (x: number, d = 2) => (x / n).toFixed(d);
  console.log(`| ${JSON.stringify(g)} | ${f(rpo, 1)} | ${f(death, 1)} | ${f(dot, 1)} | ${f(bpw, 1)} | ${f(sd)} | ${f(chase, 1)} | ${f(used)} | ${(brier / decided).toFixed(3)} | ${(acc / decided).toFixed(2)} |`);
}
