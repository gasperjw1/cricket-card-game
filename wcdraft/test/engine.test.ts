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
import { expectedRunsOf, outcomeDistribution } from "../src/engine/ball.js";

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
    const base = { innings: 1 as const, over: 10, wickets: 2, requiredRpo: null, scoringFactor: 1, playerFactor: 1, streak: "4-7" as const, ballInOver: 3, consecutiveDots: 0, freeHit: false };
    const fresh = outcomeDistribution(striker, bowler, env, data.situation, { ...base, strikerBalls: 0 });
    const sum = Object.values(fresh).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(fresh.W > 0.02 && fresh.W < 0.12, `first-ball hazard ${fresh.W}`);
    const set = outcomeDistribution(striker, bowler, env, data.situation, { ...base, strikerBalls: 30 });
    // T20 setness (measured): a new batter scores less and is dismissed less; both rise as he gets set.
    assert.ok(expectedRunsOf(set) > expectedRunsOf(fresh), "a set batter scores faster");
    assert.ok(set.W > fresh.W, "a set batter takes more risk");
    const hot = outcomeDistribution(striker, bowler, env, data.situation, { ...base, strikerBalls: 30, streak: "13+" });
    const cold = outcomeDistribution(striker, bowler, env, data.situation, { ...base, strikerBalls: 30, streak: "0-3" });
    assert.ok(hot["4"] + hot["6"] > cold["4"] + cold["6"], "a hot streak raises the boundary rate");
    const chase = outcomeDistribution(striker, bowler, env, data.situation, { ...base, innings: 2, over: 17, wickets: 4, strikerBalls: 20, requiredRpo: 13 });
    assert.ok(chase["4"] + chase["6"] > set["4"] + set["6"], "a steep chase raises the boundary rate");
    const stuck = outcomeDistribution(striker, bowler, env, data.situation, { ...base, innings: 2, over: 17, wickets: 4, strikerBalls: 20, requiredRpo: 13, consecutiveDots: 3 });
    assert.ok(expectedRunsOf(stuck) < expectedRunsOf(chase), "three dots in a chase lower expected runs");
    // Matchups: a left-hander scores less against off-spin than a right-hander does, beyond the players' own averages.
    const maharaj = southAfrica.players.find((p) => p.name === "KA Maharaj")!;
    const markram = southAfrica.players.find((p) => p.name === "AK Markram")!;
    assert.equal(striker.hand, "R");
    assert.equal(maharaj.bowlClass, "left-arm-spin");
    assert.equal(markram.bowlClass, "off-spin");
    const left = { ...striker, hand: "L" as const };
    const rOff = outcomeDistribution(striker, markram, env, data.situation, { ...base, strikerBalls: 20 });
    const lOff = outcomeDistribution(left, markram, env, data.situation, { ...base, strikerBalls: 20 });
    assert.ok(expectedRunsOf(lOff) < expectedRunsOf(rOff), "left-hander vs off-spin scores less");
    const rSla = outcomeDistribution(striker, maharaj, env, data.situation, { ...base, strikerBalls: 20 });
    const lSla = outcomeDistribution(left, maharaj, env, data.situation, { ...base, strikerBalls: 20 });
    assert.ok(expectedRunsOf(lSla) > expectedRunsOf(rSla), "left-hander vs left-arm orthodox scores more");
  });

  it("is deterministic given a seed and keeps the books straight", () => {
    const a = simulateMatch(india, southAfrica, env, data.situation, { seed: "final-2024", keepBallLog: true });
    const b = simulateMatch(india, southAfrica, env, data.situation, { seed: "final-2024", keepBallLog: true });
    assert.deepEqual(a, b);
    const c = simulateMatch(india, southAfrica, env, data.situation, { seed: "another" });
    assert.notDeepEqual(a.innings, c.innings, "a different seed plays a different match");
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

  it("plays rain-affected matches by the rules: no-results, equal reductions and resource-table chase cuts", () => {
    const resources = data.situation;
    assert.equal(resources.resource(120, 0), 1);
    assert.equal(resources.resource(0, 3), 0);
    assert.ok(resources.resource(60, 0) > resources.resource(60, 5) && resources.resource(60, 5) > resources.resource(30, 5), "resources fall with fewer balls and more wickets");
    assert.ok(resources.resource(60, 0) > 0.45 && resources.resource(60, 0) < 0.7, `half the balls with wickets in hand ≈ ${resources.resource(60, 0)} of the runs`);
    const kinds = new Map<string, number>();
    for (let i = 0; i < 120; i += 1) {
      const r = simulateMatch(india, southAfrica, env, data.situation, { seed: `rain-${i}`, rainProbability: 1 });
      assert.ok(r.rain, "every match is rain-affected at probability 1");
      kinds.set(r.rain!.kind, (kinds.get(r.rain!.kind) ?? 0) + 1);
      if (r.rain!.kind === "no-result") {
        assert.equal(r.winner, null);
        assert.equal(r.innings[1].legalBalls, 0);
      } else if (r.rain!.kind === "reduced") {
        const n = r.rain!.oversPerSide;
        assert.ok(n >= 5 && n < 20, `reduced to ${n} overs`);
        for (const inn of r.innings) {
          assert.equal(inn.scheduledOvers, n);
          assert.ok(inn.legalBalls <= n * 6);
          for (const bw of inn.bowling) assert.ok(bw.overs.length <= Math.ceil(n / 5), `${bw.name} bowled ${bw.overs.length} of ${n} overs`);
        }
        assert.ok(r.winner);
      } else {
        assert.ok(r.winner);
        if (r.rain!.parScore !== null) {
          assert.ok(r.innings[1].legalBalls <= r.rain!.cutAtBalls!);
          // Decided on the par score, or level with par and settled by the tie-break.
          assert.ok((r.margin && "dls" in r.margin) || r.tieBreak, `chase cut at par ${r.rain!.parScore}: margin ${JSON.stringify(r.margin)}`);
        }
      }
    }
    assert.ok((kinds.get("no-result") ?? 0) > 0 && (kinds.get("reduced") ?? 0) > 0 && (kinds.get("chase-cut") ?? 0) > 0, JSON.stringify([...kinds]));
    const dry = simulateMatch(india, southAfrica, env, data.situation, { seed: "dry", rainProbability: 0 });
    assert.equal(dry.rain, null);
  });

  it("carries coach intent and captaincy into the match (Phase 2b)", () => {
    const profile = data.profiles.get("India")!;
    assert.ok(profile.coach && profile.coach.name === "Rahul Dravid", `India 2024 coach ${profile.coach?.name}`);
    assert.ok(profile.coach!.tags.includes("Powerplay aggressor"));
    assert.ok(profile.captain && profile.captain.name === "RG Sharma", `India 2024 captain ${profile.captain?.name}`);
    assert.ok(india.intent && india.intent.pp > 0.5, `India powerplay intent ${india.intent?.pp}`);
    assert.ok(typeof india.captainZ === "number");
    const striker = india.players.find((p) => p.name === "V Kohli")!;
    const bowler = southAfrica.players.find((p) => p.name === "K Rabada")!;
    const base = { innings: 1 as const, over: 3, wickets: 0, strikerBalls: 12, requiredRpo: null, scoringFactor: 1, playerFactor: 1, streak: "4-7" as const, ballInOver: 3, consecutiveDots: 0, freeHit: false };
    const hot = outcomeDistribution(striker, bowler, env, data.situation, { ...base, intent: 1.5 });
    const cold = outcomeDistribution(striker, bowler, env, data.situation, { ...base, intent: -1.5 });
    assert.ok(hot["4"] + hot["6"] > cold["4"] + cold["6"] && hot.W > cold.W, "aggressive intent buys boundaries with risk");
    assert.ok(expectedRunsOf(hot) > expectedRunsOf(cold));
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
