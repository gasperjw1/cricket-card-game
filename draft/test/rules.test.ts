import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../../wcdraft/src/engine/rng.ts";
import { bowlerCount, bowlersRequired, canSwap, drawCoachPanel, drawSquad, eligible, heldForKeeper, heldText, lineupProblems, needs, noSlotText, placeable, slotRange, slotsFor, spinPlayers, squadUniverse, tempoProfile } from "../src/game/rules.ts";
import { paceSpinLean } from "../src/components/PlayerCard.tsx";
import { batInSlot, slotWeights } from "../src/game/slots.ts";
import { roleLine } from "../src/components/PlayerCard.tsx";
import type { PoolPlayer } from "../src/game/types.ts";

const player = (over: Partial<PoolPlayer>): PoolPlayer => ({
  id: over.id ?? Math.random().toString(36).slice(2), name: "X", team: "T", editionId: "2024", standIn: false, tier: "Silver", tierScore: 0.5, role: "batter",
  archetype: { batting: null, bowling: null }, style: null, batProjected: 0, bowlProjected: 0, bat: 70, bowl: 50, batPhases: { pp: 70, mid: 70, death: 70 }, bowlPhases: { pp: 50, mid: 50, death: 50 },
  batLow: false, bowlLow: true, batShown: true, bowlShown: false, domesticBalls: { bat: 0, bowl: 0 }, batWeights: { pp: 0.3, mid: 0.45, death: 0.25 }, vsPace: null, vsSpin: null, squadPlayer: false, position: null, positionless: false, hand: "R", bowlingType: null, keeper: false, ...over,
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
    // The keeper does not bowl: a lone keeper-bowler keeps, so he fills only the gloves.
    const keeperBowler = player({ role: "all-rounder", bowlShown: true, keeper: true });
    assert.equal(bowlerCount(picks(keeperBowler, bowler, bowler, bowler, bowler)), 4);
    assert.deepEqual(needs(picks(keeperBowler, bowler, bowler, bowler, bowler)), { bowlers: 1, keeper: 0, open: 6 });
    // With one slot left and a bowler needed: a bowler fills it, a pure keeper takes the gloves and frees
    // the keeper-bowler to bowl (so he counts too), a pure batter does nothing.
    const tight = picks(keeperBowler, bowler, bowler, bowler, bowler, bat, bat, bat, bat, bat);
    assert.equal(eligible(bowler, tight), true);
    assert.equal(eligible(keeper, tight), true, "a second keeper frees the keeper-bowler to bowl");
    assert.equal(eligible(bat, tight), false);
    // A second keeper who does not bowl takes the gloves and frees the keeper-bowler to bowl.
    assert.equal(bowlerCount(picks(keeperBowler, keeper, bowler, bowler, bowler, bowler)), 5);
  });

  it("asks a six-bowler coach's eleven for six who bowl", () => {
    const coach = (tags: string[]) => ({ tags }) as never;
    assert.equal(bowlersRequired(coach(["Six-bowler rotation", "Bowl first"])), 6);
    assert.equal(bowlersRequired(coach(["Frontline trust"])), 5);
    assert.equal(bowlersRequired(null), 5);
    // Fresh people each time, so the full eleven has no one twice.
    const bat = () => player({ role: "batter", bowlShown: false });
    const bowler = () => player({ role: "bowler", bowlShown: true });
    const keeper = player({ role: "batter", keeper: true });
    const picks = (...ps: PoolPlayer[]) => [...ps, ...Array(11 - ps.length).fill(null)] as (PoolPlayer | null)[];
    // Keeper, five bowlers and four batters: done for five, one short for six, so the last slot is a bowler's.
    const ten = picks(keeper, bowler(), bowler(), bowler(), bowler(), bowler(), bat(), bat(), bat(), bat());
    assert.equal(eligible(bat(), ten, 5), true);
    assert.equal(eligible(bat(), ten, 6), false);
    assert.equal(eligible(bowler(), ten, 6), true);
    assert.deepEqual(lineupProblems([...ten.slice(0, 10), bat()], 6), ["Only 5 who bowl besides the keeper: you need six under a six-bowler coach"]);
    assert.deepEqual(lineupProblems([...ten.slice(0, 10), bowler()], 6), []);
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

  it("keeps each batting type to its range, down to No. 8 when he bowls (2026-11-05)", () => {
    const bat = (batting: PoolPlayer["archetype"]["batting"], bowler = false) =>
      slotRange(player({ archetype: { batting, bowling: null }, ...(bowler ? { role: "all-rounder" as const, bowlShown: true } : {}) }));
    assert.deepEqual(bat("opener"), [1, 4]);
    assert.deepEqual(bat("top order"), [1, 5]);
    assert.deepEqual(bat("middle order"), [4, 6]);
    assert.deepEqual(bat("opener", true), [1, 8]);
    assert.deepEqual(bat("top order", true), [1, 8]);
    assert.deepEqual(bat("middle order", true), [4, 8]);
    assert.deepEqual(bat("finisher"), [6, 9]);
    assert.deepEqual(bat("finisher", true), [6, 9], "the lower order's range does not move with bowling");
    assert.deepEqual(bat("tail", true), [9, 11]);
  });

  it("offers only the open slots in his range, and none when they are full", () => {
    const opener = player({ archetype: { batting: "opener", bowling: null } });
    const picks: (PoolPlayer | null)[] = Array.from({ length: 11 }, () => null);
    assert.deepEqual(slotsFor(opener, picks).map((s) => s.label), ["Opener", "Opener", "No. 3", "No. 4"]);
    for (let i = 0; i < 4; i += 1) picks[i] = player({});
    assert.deepEqual(slotsFor(opener, picks), [], "no spill into the open middle order");
    assert.equal(eligible(opener, picks), false, "a man with no open slot cannot be taken");
    assert.equal(noSlotText(opener), "He bats Nos. 1–4, and they are all taken.");
    assert.equal(eligible(player({ archetype: { batting: "finisher", bowling: null } }), picks), true);
  });

  it("reads a missing archetype off his usual number; a bowler without a place bats in the tail", () => {
    const none = { batting: null, bowling: null };
    assert.deepEqual(slotRange(player({ archetype: none, position: 10 })), [9, 11]);
    assert.deepEqual(slotRange(player({ archetype: none, position: 4 })), [1, 5], "a usual No. 4 is top order");
    assert.deepEqual(slotRange(player({ archetype: none, position: null })), [1, 11], "no archetype and no usual number: anywhere");
    assert.deepEqual(slotRange(player({ archetype: none, position: 3, positionless: true })), [1, 11], "a floating batter: anywhere");
    assert.deepEqual(slotRange(player({ archetype: none, position: 3, positionless: true, role: "bowler", bowlShown: true })), [9, 11], "a floating bowler: the tail");
    assert.deepEqual(slotRange(player({ archetype: none, position: null, role: "unknown", batShown: false, bowlShown: true })), [9, 11], "no role, only a bowling number: the tail");
  });

  it("holds the last slot in Nos. 1–9 for a keeper while the side has none", () => {
    const tail = () => player({ archetype: { batting: "tail", bowling: null }, role: "bowler", bowlShown: true });
    const finisher = player({ archetype: { batting: "finisher", bowling: null } });
    const keeper = player({ archetype: { batting: "finisher", bowling: null }, keeper: true });
    // Nos. 1–8 and 10 filled, no keeper: No. 9 is the last a keeper can be found for.
    const picks: (PoolPlayer | null)[] = [...Array.from({ length: 8 }, () => player({})), null, tail(), null];
    assert.equal(heldForKeeper(picks), 8);
    assert.deepEqual(placeable(tail(), picks).map((s) => s.label), ["No. 11"], "a bowler is kept out of No. 9");
    assert.deepEqual(placeable(finisher, picks), [], "a finisher has only No. 9, so he waits");
    assert.equal(eligible(finisher, picks), false);
    assert.equal(heldText(8), "No. 9 is held for a keeper: the side has none, and few keepers bat below No. 9.");
    assert.deepEqual(placeable(keeper, picks).map((s) => s.label), ["No. 9"]);
    // With a keeper in, nothing is held.
    picks[0] = player({ keeper: true });
    assert.equal(heldForKeeper(picks), null);
  });

  it("swaps two men only when each may bat at the other's number", () => {
    const opener = player({ archetype: { batting: "opener", bowling: null } });
    const top = player({ archetype: { batting: "top order", bowling: null } });
    const tail = player({ archetype: { batting: "tail", bowling: null } });
    const picks: (PoolPlayer | null)[] = [opener, top, ...Array(8).fill(null), tail];
    assert.equal(canSwap(picks, 0, 1), true);
    assert.equal(canSwap(picks, 0, 10), false);
    assert.equal(canSwap(picks, 1, 4), true, "into an empty No. 5 inside his range");
    assert.equal(canSwap(picks, 0, 4), false, "an opener does not bat No. 5");
    assert.equal(canSwap(picks, 0, 0), false);
  });

  it("enforces the keeper, five bowlers and one instance per person", () => {
    const picks: (PoolPlayer | null)[] = Array.from({ length: 11 }, (_, i) => player({ id: `p${i}` }));
    assert.deepEqual(lineupProblems(picks), ["No wicketkeeper: at least one player must have kept in a T20I", "Only 0 who bowl besides the keeper: you need five"]);
    picks[6] = player({ id: "wk", keeper: true });
    for (let i = 7; i < 11; i += 1) picks[i] = player({ id: `b${i}`, role: "bowler", bowlLow: false, bowlShown: true });
    picks[5] = player({ id: "ar", role: "all-rounder" });
    assert.equal(bowlerCount(picks), 5);
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

  it("draws a panel whose printed tempos differ when the pool allows it", () => {
    const coach = (i: number, pp: number, mid: number, death: number) => ({ team: "T", coachName: `C${i}`, role: "", from: "2010", to: "2012", worldCups: ["2012"], months: 10, innings: 30, tags: [], intent: { pp, mid, death } });
    // Six all-balanced coaches, one attacker, one who holds back at the death.
    const coaches = [...Array.from({ length: 6 }, (_, i) => coach(i, 0, 0.1, -0.2)), coach(6, 1, 0, 0), coach(7, 0, 0, -1)];
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const panel = drawCoachPanel(coaches, new Rng(seed));
      assert.equal(panel.length, 3);
      assert.equal(new Set(panel.map(tempoProfile)).size, 3, `seed ${seed}: three different tempos`);
    }
  });
});

describe("player descriptions", () => {
  it("reads WK and/or the bowling code, then hand and place in the order", () => {
    assert.equal(roleLine(player({ position: 1 })), "RHB opener");
    assert.equal(roleLine(player({ keeper: true, position: 5, hand: "L" })), "WK – LHB middle order");
    assert.equal(roleLine(player({ role: "bowler", bowlShown: true, bowlingType: "RF", position: 10 })), "RF – RHB tailender");
    assert.equal(roleLine(player({ role: "bowler", bowlShown: true, bowlingType: "LBG", position: 8 })), "LB – RHB lower order");
    // A keeper who bowls shows both (Glenn Phillips, Dilshan): he bowls whenever another man keeps.
    assert.equal(roleLine(player({ keeper: true, role: "all-rounder", bowlShown: true, bowlingType: "OB", position: 5 })), "WK/OB – RHB middle order");
    // A keeper whose bowling is not on his card stays WK alone.
    assert.equal(roleLine(player({ keeper: true, bowlingType: "OB", position: 3 })), "WK – RHB top order");
    assert.equal(roleLine(player({ position: 4 })), "RHB top order", "a No. 4 reads as the rules play him");
    assert.equal(roleLine(player({ position: 6, positionless: true })), "RHB floater", "a floater bats anywhere, whatever his most common number");
    assert.equal(roleLine(player({ position: 6, positionless: true, role: "bowler", bowlShown: true, bowlingType: "RF" })), "RF – RHB tailender", "a floating bowler bats in the tail");
  });

  it("tags a pace or spin lean only at the ends of the spread", () => {
    const vs = (n: number, estimated = false) => ({ n, balls: 500, estimated, odi: false });
    assert.equal(paceSpinLean(vs(80), vs(75)), "pace");
    assert.equal(paceSpinLean(vs(80), vs(77)), null, "the usual small lean toward pace is no tag");
    assert.equal(paceSpinLean(vs(70), vs(72)), "spin");
    assert.equal(paceSpinLean(vs(80), vs(70, true)), null, "an estimated split carries no tag");
  });
});
