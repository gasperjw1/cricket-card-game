import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../../wcdraft/src/engine/rng.ts";
import { drawCoachPanel, drawSquad, eligible, fits, lineupProblems, needs, oversCovered, slotsFor, spinPlayers, squadUniverse } from "../src/game/rules.ts";
import { batInSlot, slotWeights } from "../src/game/slots.ts";
import type { PoolPlayer } from "../src/game/types.ts";

const player = (over: Partial<PoolPlayer>): PoolPlayer => ({
  id: over.id ?? Math.random().toString(36).slice(2), name: "X", team: "T", editionId: "2024", standIn: false, tier: "Silver", tierScore: 0.5, role: "batter",
  archetype: { batting: "top order", bowling: null }, bat: 70, bowl: 50, batPhases: { pp: 70, mid: 70, death: 70 }, bowlPhases: { pp: 50, mid: 50, death: 50 },
  batLow: false, bowlLow: true, batShown: true, bowlShown: false, domesticBalls: { bat: 0, bowl: 0 }, batWeights: { pp: 0.3, mid: 0.45, death: 0.25 }, squadPlayer: false, position: 3, positionless: false, hand: "R", bowlingType: null, keeper: false, ...over,
});

describe("draft rules", () => {
  it("locks the draft to bowlers and keepers once the open slots are down to what the side still needs", () => {
    const bat = player({ role: "batter", bowlShown: false, keeper: false });
    const bowler = player({ role: "bowler", bowlShown: true, keeper: false });
    const keeper = player({ role: "batter", bowlShown: false, keeper: true });
    const picks = (...ps: typeof bat[]) => [...ps, ...Array(11 - ps.length).fill(null)] as (typeof bat | null)[];
    // Five batters taken: six slots left, five bowlers and a keeper needed, so batters are out.
    const five = picks(bat, bat, bat, bat, bat);
    assert.deepEqual(needs(five), { bowlers: 5, keeper: 1, open: 6 });
    assert.equal(eligible(bat, five), false);
    assert.equal(eligible(bowler, five), true);
    assert.equal(eligible(keeper, five), true);
    // Four batters taken: still one slot of slack, anyone goes.
    assert.equal(eligible(bat, picks(bat, bat, bat, bat)), true);
    // Keeper and four bowlers already in: with six open and one bowler needed, batters are fine until the last slot.
    assert.equal(eligible(bat, picks(keeper, bowler, bowler, bowler, bowler)), true);
    assert.equal(eligible(bat, picks(keeper, bowler, bowler, bowler, bowler, bat, bat, bat, bat, bat)), false);
    assert.equal(eligible(bowler, picks(keeper, bowler, bowler, bowler, bowler, bat, bat, bat, bat, bat)), true);
    // The keeper does not bowl: a lone keeper-bowler keeps, so he covers no overs and fills only the gloves.
    const keeperBowler = player({ role: "all-rounder", bowlShown: true, keeper: true });
    assert.equal(oversCovered(picks(keeperBowler, bowler, bowler, bowler, bowler)), 16);
    assert.deepEqual(needs(picks(keeperBowler, bowler, bowler, bowler, bowler)), { bowlers: 1, keeper: 0, open: 6 });
    // With one slot left and a bowler needed: a bowler fills it, a pure keeper takes the gloves and frees
    // the keeper-bowler to bowl (so he counts too), a pure batter does nothing.
    const tight = picks(keeperBowler, bowler, bowler, bowler, bowler, bat, bat, bat, bat, bat);
    assert.equal(eligible(bowler, tight), true);
    assert.equal(eligible(keeper, tight), true, "a second keeper frees the keeper-bowler to bowl");
    assert.equal(eligible(bat, tight), false);
    // A second keeper who does not bowl takes the gloves and frees the keeper-bowler to bowl.
    assert.equal(oversCovered(picks(keeperBowler, keeper, bowler, bowler, bowler, bowler)), 20);
  });

  it("re-weights a batter's number to the overs a slot faces", () => {
    const editions = [{ id: "2024", environment: { positionPhaseBalls: { "1": { pp: 900, mid: 400, death: 50 }, "7": { pp: 10, mid: 300, death: 400 } } } }] as never;
    const opener = slotWeights(editions, "2024", 1);
    const seven = slotWeights(editions, "2024", 7);
    assert.ok(opener.pp > 0.6 && seven.death > 0.5);
    // A powerplay specialist (pp 85, death 60) loses value at No. 7 and gains none as an opener he already is.
    const p = player({ bat: 78, batPhases: { pp: 85, mid: 76, death: 60 }, batWeights: opener });
    assert.equal(batInSlot(p, opener), 78);
    assert.ok(batInSlot(p, seven) < 72, `at seven ${batInSlot(p, seven)}`);
    assert.equal(batInSlot(player({ batShown: false, bat: 70 }), seven), 70, "an unshown batting number is left alone");
  });

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
    assert.deepEqual(lineupProblems(picks), ["No wicketkeeper: at least one player must have kept in a T20I", "Only 0 overs covered: you need five players who bowl besides the keeper"]);
    picks[6] = player({ id: "wk", keeper: true });
    for (let i = 7; i < 11; i += 1) picks[i] = player({ id: `b${i}`, role: "bowler", bowlLow: false, bowlShown: true });
    picks[5] = player({ id: "ar", role: "all-rounder" });
    assert.equal(oversCovered(picks), 20);
    assert.deepEqual(lineupProblems(picks), []);
    picks[0] = player({ id: "wk" });
    assert.deepEqual(lineupProblems(picks), ["The same person appears twice"]);
  });

  it("spins deterministically over the squad universe and drops drafted people", () => {
    const universe = squadUniverse(new Map([["2024", [{ team: "India", editionId: "2024", standIn: false }, { team: "Uganda", editionId: "2024", standIn: false }] as never], ["2016", [{ team: "Oman", editionId: "2016", standIn: false }] as never]]));
    assert.equal(universe.length, 3);
    const squads = new Map([["2012", [{ team: "Namibia", editionId: "2012", standIn: true }, { team: "India", editionId: "2012", standIn: false }] as never]]);
    assert.deepEqual(squadUniverse(squads, [{ editionId: "2012", team: "Namibia" }]).map((s) => s.team), ["India"], "mostly blank squads are not spun");
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
