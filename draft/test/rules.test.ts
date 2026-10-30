import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../../wcdraft/src/engine/rng.ts";
import { drawCoachPanel, drawSquad, fits, lineupProblems, oversCovered, slotsFor, spinPlayers, squadUniverse } from "../src/game/rules.ts";
import type { PoolPlayer } from "../src/game/types.ts";

const player = (over: Partial<PoolPlayer>): PoolPlayer => ({
  id: over.id ?? Math.random().toString(36).slice(2), name: "X", team: "T", editionId: "2024", standIn: false, tier: "Silver", tierScore: 0.5, role: "batter",
  archetype: { batting: "top order", bowling: null }, bat: 70, bowl: 50, batPhases: { pp: 70, mid: 70, death: 70 }, bowlPhases: { pp: 50, mid: 50, death: 50 },
  batLow: false, bowlLow: true, squadPlayer: false, position: 3, positionless: false, hand: "R", bowlingType: null, keeper: false, ...over,
});

describe("draft rules", () => {
  it("fits archetypes to slots and widens when nothing natural is open", () => {
    const finisher = player({ archetype: { batting: "finisher", bowling: null } });
    assert.ok(fits(finisher, "lower") && fits(finisher, "middle") && !fits(finisher, "opener"));
    const picks: (PoolPlayer | null)[] = Array.from({ length: 11 }, () => null);
    assert.deepEqual(slotsFor(finisher, picks).slots.map((s) => s.kind), ["middle", "middle", "lower", "lower", "lower", "tail", "tail"]);
    for (let i = 4; i < 11; i += 1) picks[i] = player({});
    const widened = slotsFor(finisher, picks);
    assert.equal(widened.natural, false);
    assert.equal(widened.slots.length, 4);
  });

  it("enforces the keeper, five bowlers and one instance per person", () => {
    const picks: (PoolPlayer | null)[] = Array.from({ length: 11 }, (_, i) => player({ id: `p${i}` }));
    assert.deepEqual(lineupProblems(picks), ["No wicketkeeper: at least one player must have kept in a T20I", "Only 0 overs covered: you need five players who bowl"]);
    picks[6] = player({ id: "wk", keeper: true });
    for (let i = 7; i < 11; i += 1) picks[i] = player({ id: `b${i}`, role: "bowler", bowlLow: false });
    picks[5] = player({ id: "ar", role: "all-rounder" });
    assert.equal(oversCovered(picks), 20);
    assert.deepEqual(lineupProblems(picks), []);
    picks[0] = player({ id: "wk" });
    assert.deepEqual(lineupProblems(picks), ["The same person appears twice"]);
  });

  it("spins deterministically over the squad universe and drops drafted people", () => {
    const universe = squadUniverse(new Map([["2024", [{ team: "India", editionId: "2024", standIn: false }, { team: "Uganda", editionId: "2024", standIn: false }] as never], ["2016", [{ team: "Oman", editionId: "2016", standIn: false }] as never]]));
    assert.equal(universe.length, 3);
    assert.deepEqual(drawSquad(universe, new Rng("s")), drawSquad(universe, new Rng("s")));
    const pool = [player({ id: "a", team: "India", tierScore: 0.9 }), player({ id: "b", team: "India", tierScore: 0.95 }), player({ id: "c", team: "Uganda" })];
    assert.deepEqual(spinPlayers(pool, "India", new Set(["b"])).map((p) => p.id), ["a"]);
    assert.deepEqual(spinPlayers(pool, "India", new Set()).map((p) => p.id), ["b", "a"]);
  });

  it("draws a coach panel without repeats", () => {
    const coaches = Array.from({ length: 8 }, (_, i) => ({ team: "T", coachName: `C${i}`, role: "", from: "2010", to: "2012", worldCups: ["2012"], months: 10, innings: 30, tags: [], intent: { pp: 0, mid: 0, death: 0 } }));
    const panel = drawCoachPanel(coaches, new Rng("panel"));
    assert.equal(panel.length, 3);
    assert.equal(new Set(panel.map((c) => c.coachName)).size, 3);
  });
});
