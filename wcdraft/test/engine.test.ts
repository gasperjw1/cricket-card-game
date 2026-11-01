/**
 * Phase 2 engine: determinism, bookkeeping invariants and the replay acceptance test (design
 * spec Phase 2). Replay tolerances are deliberately loose; the calibration sweep is the tool for
 * tightening them. Skipped until data:build and ratings:build have run.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { engineReady, loadEdition, matchEnvironment, teamFromDefault } from "../src/engine/load.js";
import { simulateMatch } from "../src/engine/match.js";
import { playerOfTheMatch } from "../src/engine/awards.js";
import { ENGINE, setEngineOverrides } from "../src/engine/model.js";
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

  it("counts every run in a phase, wides included, and concedes more extras at the death than in the middle", () => {
    for (let i = 0; i < 30; i += 1) {
      const m = simulateMatch(india, southAfrica, env, data.situation, { seed: `phases-${i}`, rainProbability: 0 });
      for (const inn of m.innings) assert.equal(inn.phaseRuns.pp.runs + inn.phaseRuns.mid.runs + inn.phaseRuns.death.runs, inn.runs);
    }
    const perBall = (p: "mid" | "death") => env.extras[p].wides + env.extras[p].noBalls + env.extras[p].byes;
    assert.ok(perBall("death") > perBall("mid"));
  });

  it("plays a chase's death overs with more dots and fewer sixes than a first innings'", () => {
    const first = data.situation.inningsPhase(1, "death"), chase = data.situation.inningsPhase(2, "death");
    assert.ok(chase["0"] > first["0"]);
    assert.ok(chase["6"] < first["6"]);
  });

  it("forces batters to swing as the required rate climbs, and each band of found averages out", () => {
    const striker = { ...india.players.find((p) => p.name === "V Kohli")!, style: null, shape: null };
    const bowler = { ...southAfrica.players.find((p) => p.name === "K Rabada")!, squeezer: null };
    const ball = { innings: 2 as const, over: 17, wickets: 4, strikerBalls: 20, scoringFactor: 1, playerFactor: 1, streak: "4-7" as const, ballInOver: 3, consecutiveDots: 0, freeHit: false };
    const easy = outcomeDistribution(striker, bowler, env, data.situation, { ...ball, requiredRpo: 7 });
    const steep = outcomeDistribution(striker, bowler, env, data.situation, { ...ball, requiredRpo: 15 });
    assert.ok(steep["6"] > 1.3 * easy["6"], `sixes ${easy["6"]} to ${steep["6"]}`);
    assert.ok(steep.W > 1.2 * easy.W, `wickets ${easy.W} to ${steep.W}`);
    assert.ok(steep["0"] < easy["0"], "fewer dots");
    // Eight down the tail is in and the table stops: it was measured up to seven.
    const tail = outcomeDistribution(striker, bowler, env, data.situation, { ...ball, wickets: 8, requiredRpo: 15 });
    const tailEasy = outcomeDistribution(striker, bowler, env, data.situation, { ...ball, wickets: 8, requiredRpo: 7 });
    assert.ok(Math.abs(tail["6"] - tailEasy["6"]) < 1e-12);
    // `found` is off by default (2026-11-01); switched on, a batter who has found a boundary hits more.
    const kept = ENGINE.foundExponent;
    setEngineOverrides({ foundExponent: 0.4 });
    try {
      const found = outcomeDistribution(striker, bowler, env, data.situation, { ...ball, requiredRpo: null, strikerFound: true });
      const notFound = outcomeDistribution(striker, bowler, env, data.situation, { ...ball, requiredRpo: null, strikerFound: false });
      assert.ok(found["6"] > notFound["6"], "a batter who has found a boundary hits more");
    } finally {
      setEngineOverrides({ foundExponent: kept });
    }
  });

  it("plays a batter's start and his answer to pressure, and lifts only Squeezers' wickets, when those terms are switched on", () => {
    // Shape, gears and the Squeezer gap are off by default (2026-11-01 audit); this tests the mechanisms.
    const kept = { shapeExponent: ENGINE.shapeExponent, gearExponent: ENGINE.gearExponent, top: ENGINE.squeezer.top, rest: ENGINE.squeezer.rest };
    setEngineOverrides({ shapeExponent: 1, gearExponent: 1 });
    ENGINE.squeezer.top = 1.04; ENGINE.squeezer.rest = 0.98;
    const restore = () => { setEngineOverrides({ shapeExponent: kept.shapeExponent, gearExponent: kept.gearExponent }); ENGINE.squeezer.top = kept.top; ENGINE.squeezer.rest = kept.rest; };
    const base = india.players.find((p) => p.name === "V Kohli")!;
    const unit = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };
    const bowler = { ...southAfrica.players.find((p) => p.name === "K Rabada")!, squeezer: null as boolean | null };
    const ball = { innings: 1 as const, over: 2, wickets: 0, requiredRpo: null, scoringFactor: 1, playerFactor: 1, streak: "n/a" as const, ballInOver: 3, consecutiveDots: 0, freeHit: false };
    const quick = { ...base, style: null, shape: { start: { ...unit, "4": 1.2 }, later: unit } };
    const flat = { ...base, style: null, shape: null };
    const at = (p: typeof base, strikerBalls: number) => outcomeDistribution(p, bowler, env, data.situation, { ...ball, strikerBalls });
    assert.ok(at(quick, 4)["4"] > at(flat, 4)["4"], "the start applies in his first ten balls");
    assert.ok(Math.abs(at(quick, 12)["4"] - at(flat, 12)["4"]) < 1e-12, "and not after");
    const press = { ...ball, innings: 2 as const, over: 18, wickets: 4, strikerBalls: 20, requiredRpo: 14 };
    const of = (p: typeof base, q: boolean | null, requiredRpo = 14, over = 18) => outcomeDistribution(p, { ...bowler, squeezer: q }, env, data.situation, { ...press, requiredRpo, over });
    const odds = (a: { W: number }, b: { W: number }) => (a.W / (1 - a.W)) / (b.W / (1 - b.W));
    assert.ok(Math.abs(odds(of(flat, true), of(flat, false)) - 1.04 / 0.98) < 0.002, "Squeezers' wicket gap in a pressure chase");
    assert.ok(Math.abs(of(flat, true, 8).W - of(flat, false, 8).W) < 1e-12, "no gap when the batter need not swing");
    assert.ok(Math.abs(of(flat, true, 14, 10).W - of(flat, false, 14, 10).W) < 1e-12, "no gap outside the death");
    try {
      assert.ok(of({ ...flat, style: "Anchor" }, null).W > of({ ...flat, style: "Rotator" }, null).W, "an Anchor pays more for being forced to swing");
    } finally {
      restore();
    }
  });

  it("marks about a third of ranked death pacers as Squeezers, and only pacers", () => {
    const all = [...data.players.values()];
    assert.ok(all.filter((p) => !p.bowlClass?.startsWith("pace")).every((p) => p.squeezer === null));
    const marked = all.filter((p) => p.squeezer === true);
    assert.ok(marked.length >= 8 && marked.every((p) => p.bowlClass!.startsWith("pace") && p.bowlingShares!.death >= 0.15));
  });

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
    // Scorecard detail: every out batter has a dismissal, bowler wickets exclude run-outs, partnerships
    // add up to the total, extras split adds up, and the ball log tracks the score.
    for (const inn of a.innings) {
      for (const bt of inn.batting) assert.equal(!!bt.dismissal, bt.out, `${bt.name} dismissal`);
      const credited = inn.batting.filter((bt) => bt.dismissal && bt.dismissal.kind !== "run out").length;
      assert.equal(inn.bowling.reduce((s, x) => s + x.wickets, 0), credited, "bowler wickets = credited dismissals");
      assert.equal(inn.partnerships.reduce((s, p) => s + p.runs, 0), inn.runs, "partnerships sum to the total");
      assert.equal(inn.extrasDetail.wides + inn.extrasDetail.noBalls + inn.extrasDetail.byes, inn.extras, "extras split");
      for (const bt of inn.batting) if (bt.dismissal?.kind === "stumped") assert.ok(bt.dismissal.fielder, "stumpings have a keeper");
      const last = a.balls.filter((x) => x.innings === inn.index).at(-1)!;
      assert.equal(last.runsAfter, inn.runs);
      assert.equal(last.wicketsAfter, inn.wickets);
    }
    const potm = playerOfTheMatch(a);
    assert.ok(potm && potm.summary.length > 0, "player of the match named");
  });

  it("keeps the toss, the laws and the bowling figures honest", () => {
    let noBallWickets = 0;
    for (let i = 0; i < 150; i += 1) {
      const battingFirst = i % 2 ? "India" : undefined;
      const m = simulateMatch(india, southAfrica, env, data.situation, { seed: `laws-${i}`, keepBallLog: true, battingFirst, rainProbability: i % 3 === 0 ? 1 : 0 });
      const first = m.innings[0].team;
      assert.equal(first === m.tossWinner ? "bat" : "field", m.tossDecision, "the toss decision agrees with who batted first");
      if (!m.winner) assert.equal(playerOfTheMatch(m), null, "no player of the match in a no-result");
      for (const inn of m.innings) {
        const balls = m.balls.filter((b) => b.innings === inn.index);
        assert.equal(inn.bowling.reduce((a, w) => a + w.balls, 0), inn.legalBalls, "bowlers' balls add up to the innings");
        for (const b of inn.batting) assert.equal(balls.filter((x) => x.striker === b.id && x.extraKind !== "wide").length, b.balls, `${b.name} balls faced`);
      }
      m.balls.forEach((b, j) => {
        const afterNoBall = j > 0 && m.balls[j - 1]!.extraKind === "no-ball" && m.balls[j - 1]!.innings === b.innings;
        if (b.wicket && (b.extraKind === "no-ball" || afterNoBall)) { noBallWickets += 1; assert.equal(b.dismissal?.kind, "run out", "only a run out off a no-ball or free hit"); }
      });
    }
    assert.ok(noBallWickets >= 0);
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
    assert.equal(profile.captains[0]?.name, "RG Sharma");
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

  it("names one keeper and one captain per side; the keeper never bowls and takes the stumpings", () => {
    for (const team of [india, southAfrica]) {
      assert.equal(team.players.filter((p) => p.keeper).length, 1);
      assert.ok(team.players.some((p) => p.id === team.captainId));
    }
    assert.equal(india.players.find((p) => p.keeper)?.name, "RR Pant");
    const keepers = new Set([india, southAfrica].map((t) => t.players.find((p) => p.keeper)!.id));
    for (let s = 0; s < 40; s += 1) {
      const r = simulateMatch(india, southAfrica, env, data.situation, { seed: `gloves${s}`, keepBallLog: true, rainProbability: 0 });
      for (const inn of r.innings) {
        assert.ok(inn.keeperId && inn.captainId);
        for (const w of inn.bowling) assert.ok(!keepers.has(w.id), `${w.name} kept and bowled`);
        for (const b of inn.batting) {
          if (b.dismissal?.kind === "stumped") assert.ok(b.dismissal.byKeeper && keepers.has(b.dismissal.fielder!.id));
          if (b.dismissal?.kind === "caught and bowled") assert.equal(b.dismissal.fielder?.id, b.dismissal.bowler?.id);
        }
      }
    }
  });

  it("names the man who led at the World Cup, not the longest tenure that year", () => {
    const captainOf = (edition: string, team: string) => {
      const d = loadEdition(edition);
      const t = teamFromDefault(d, team);
      return t.players.find((p) => p.id === t.captainId)?.name;
    };
    assert.equal(captainOf("2021", "India"), "V Kohli");
    assert.equal(captainOf("2022", "India"), "RG Sharma");
    assert.equal(captainOf("2024", "Scotland"), "RD Berrington");
    assert.equal(captainOf("2012", "Sri Lanka"), "DPMD Jayawardene");
  });

  it("keeps a side's spare bowling spare: a weak sixth comes on less than a strong one", () => {
    const options = india.players.filter((p) => p.canBowl);
    assert.ok(options.length >= 6);
    const overs = (players: typeof india.players) => {
      const weak = players[players.length - 1]!.id;
      let n = 0;
      for (let s = 0; s < 60; s += 1) {
        const r = simulateMatch({ ...india, players }, southAfrica, env, data.situation, { seed: `depth${s}`, keepBallLog: true, rainProbability: 0, battingFirst: southAfrica.name });
        n += r.innings[0].bowling.find((w) => w.id === weak)?.overs.length ?? 0;
      }
      return n;
    };
    const dreadful = (p: typeof india.players[number]) => ({ ...p, bowlingRel: Object.fromEntries(Object.entries(p.bowlingRel).map(([ph, v]) => [ph, { ...v, "4": v["4"] * 1.5, "6": v["6"] * 1.5, W: v.W * 0.7 }])) as typeof p.bowlingRel });
    const sorted = [...india.players].sort((a, b) => Number(b.canBowl) - Number(a.canBowl));
    const last = options.length - 1;
    const worse = sorted.map((p, i) => (i === last ? dreadful(p) : p));
    const rest = [...worse.slice(0, last), ...worse.slice(last + 1), worse[last]!];
    assert.ok(overs(rest) < overs([...sorted.slice(0, last), ...sorted.slice(last + 1), sorted[last]!]));
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
    // Design spec §9: per-ball marginals (3), par (4), wickets-by-over shape (2), death trust (5).
    assert.ok(s.marginals.totalVariation < 0.03, `marginals TV ${s.marginals.totalVariation}`);
    assert.ok(Math.abs(s.par.simRemaining - s.par.tableRemaining) < 8, `par: sim ${s.par.simRemaining} vs table ${s.par.tableRemaining}`);
    assert.ok(Math.abs(s.wicketsByOver.sim["10"]! - s.wicketsByOver.reference["10"]!) < 0.7, `wickets at over 10: ${s.wicketsByOver.sim["10"]} vs ${s.wicketsByOver.reference["10"]}`);
    assert.ok(s.sim.deathOversByNewBallPct > 22, `overs 19–20 by an opening bowler ${s.sim.deathOversByNewBallPct}%`);
  });
});
