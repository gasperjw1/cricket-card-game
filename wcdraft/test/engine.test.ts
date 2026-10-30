/**
 * Phase 2 engine: determinism, bookkeeping invariants and the replay acceptance test (design
 * spec Phase 2). Replay tolerances are deliberately loose; the calibration sweep is the tool for
 * tightening them. Skipped until data:build and ratings:build have run.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { engineReady, loadEdition, matchEnvironment, teamFromDefault } from "../src/engine/load.js";
import { simulateMatch } from "../src/engine/match.js";
import { replayEdition } from "../src/engine/replay.js";
import { Rng } from "../src/engine/rng.js";
import { outcomeDistribution } from "../src/engine/ball.js";

describe("rng", () => {
  it("is deterministic per seed and picks by weight", () => {
    const a = new Rng("seed-1"), b = new Rng("seed-1"), c = new Rng("seed-2");
    const xs = Array.from({ length: 5 }, () => a.next());
    assert.deepEqual(xs, Array.from({ length: 5 }, () => b.next()));
    assert.notDeepEqual(xs, Array.from({ length: 5 }, () => c.next()));
    const r = new Rng(7);
    let ones = 0;
    for (let i = 0; i < 2000; i += 1) if (r.pick([1, 3]) === 1) ones += 1;
    assert.ok(ones > 1350 && ones < 1650, `weight-3 option drawn ${ones} of 2000`);
  });
});

describe("engine", { skip: !engineReady() && "engine data not built" }, () => {
  const data = loadEdition("2024");
  const india = teamFromDefault(data, "India");
  const southAfrica = teamFromDefault(data, "South Africa");
  const env = matchEnvironment(data, "bridgetown");

  it("produces normalised ball distributions with sane hazards", () => {
    const striker = india.players.find((p) => p.name === "V Kohli")!;
    const bowler = southAfrica.players.find((p) => p.name === "K Rabada")!;
    const d = outcomeDistribution(striker, bowler, env, data.situation, { innings: 1, over: 0, wickets: 0, strikerBalls: 0, requiredRpo: null, scoringFactor: 1, freeHit: false });
    const sum = Object.values(d).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(d.W > 0.02 && d.W < 0.12, `first-ball hazard ${d.W}`);
    const set = outcomeDistribution(striker, bowler, env, data.situation, { innings: 1, over: 10, wickets: 2, strikerBalls: 30, requiredRpo: null, scoringFactor: 1, freeHit: false });
    assert.ok(set.W < d.W, "a set batter is harder to dismiss than a new one");
    const chase = outcomeDistribution(striker, bowler, env, data.situation, { innings: 2, over: 17, wickets: 4, strikerBalls: 20, requiredRpo: 13, scoringFactor: 1, freeHit: false });
    assert.ok(chase["4"] + chase["6"] > set["4"] + set["6"], "a steep chase raises the boundary rate");
  });

  it("is deterministic given a seed and keeps the books straight", () => {
    const a = simulateMatch(india, southAfrica, env, data.situation, { seed: "final-2024", keepBallLog: true });
    const b = simulateMatch(india, southAfrica, env, data.situation, { seed: "final-2024", keepBallLog: true });
    assert.deepEqual(a, b);
    const c = simulateMatch(india, southAfrica, env, data.situation, { seed: "another" });
    assert.notDeepEqual(a.innings[0].runs + a.innings[1].runs, c.innings[0].runs + c.innings[1].runs);
    for (const inn of a.innings) {
      assert.ok(inn.wickets <= 10 && inn.legalBalls <= 120);
      const batterRuns = inn.batting.reduce((s, x) => s + x.runs, 0);
      assert.equal(inn.runs, batterRuns + inn.extras, "innings total = batter runs + extras");
      assert.equal(inn.fallOfWickets.length, inn.wickets);
      for (const bw of inn.bowling) assert.ok(bw.overs.length <= env.maxOversPerBowler, `${bw.name} bowled ${bw.overs.length} overs`);
      assert.ok(inn.bowling.length >= 5, `bowlers used ${inn.bowling.length}`);
    }
    const [i1, i2] = a.innings;
    if (a.winner === i2.team) assert.ok(i2.runs > i1.runs);
    else if (a.winner === i1.team) assert.ok(i1.runs > i2.runs);
    else assert.ok(a.tieBreak);
    assert.ok(a.balls.length > 200);
  });

  it("reproduces the 2024 edition's environment, results and bowler usage within tolerance (acceptance)", () => {
    const s = replayEdition("2024", 12, 42);
    assert.ok(s.matchCount >= 40, `matches replayed ${s.matchCount}`);
    const rpoBias = (s.sim.runsPerOver - s.real.runsPerOver) / s.real.runsPerOver;
    assert.ok(Math.abs(rpoBias) < 0.06, `run rate bias ${(100 * rpoBias).toFixed(1)}%`);
    assert.ok(Math.abs(s.sim.ballsPerWicket - s.real.ballsPerWicket) < 3, `balls per wicket ${s.sim.ballsPerWicket} vs ${s.real.ballsPerWicket}`);
    assert.ok(Math.abs(s.sim.dotPct - s.real.dotPct) < 4, `dot % ${s.sim.dotPct} vs ${s.real.dotPct}`);
    assert.ok(s.sim.chaseWinPct > 40 && s.sim.chaseWinPct < 75, `chase win % ${s.sim.chaseWinPct}`);
    assert.ok(s.sim.bowlersUsedMean > 5.4 && s.sim.bowlersUsedMean < 6.6, `bowlers used ${s.sim.bowlersUsedMean}`);
    assert.ok(s.results.brier < 0.24, `Brier ${s.results.brier}`);
    assert.ok(s.results.accuracy > 0.55, `favourite right ${s.results.accuracy}`);
  });
});
