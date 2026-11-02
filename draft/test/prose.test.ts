import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult } from "../../wcdraft/src/engine/tournament.ts";
import { BANK } from "../src/game/bank.ts";
import type { Fact } from "../src/game/facts.ts";
import { Picker, count, factSentence, matchSlots, numbersIn, render, resultLine, stopPress, tidy } from "../src/game/prose.ts";

const fact = (key: string, n: Record<string, number>, s: Record<string, string> = {}, player: string | null = null, team = "India"): Fact => ({ key, tier: 1, team, player: player ? { id: player, name: player } : null, n, s });

/** Every slot name the bank's frames reference, per fact key. */
function slotsUsed(frames: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const f of frames) for (const m of f.matchAll(/\{([a-zA-Z_0-9]+)(?::[a-z]+)?\}/g)) out.add(m[1]!);
  return out;
}

/** Slots every sentence may use from the match itself (prose.ts `matchSlots`), with distinctive numbers. */
const MATCH_SLOTS = { total: 151, target: 152, tempo: "low-scoring", finish: "thriller", matchShape: "low-scoring thriller", chaser: "Chasers", setter: "Setters", chasing: "chasing 152", defending: "defending 151" };
const STRING_SLOTS = new Set(["loser", "opp", "a", "b", "holder", "prevHolder", "prevTeam", "scopeText", "prevWhen", "since", "stood", "scope"]);

/** A fact whose numbers and names cover every slot a frame could ask for, with distinctive numbers. */
function fullFact(key: string): Fact {
  const n: Record<string, number> = {}, s: Record<string, string> = {};
  let i = 11;
  for (const slot of slotsUsed([...(BANK.facts[key] ?? []), ...(BANK.stopPress[key] ?? [])])) {
    if (["team", "player", "surname"].includes(slot) || slot in MATCH_SLOTS) continue;
    if (STRING_SLOTS.has(slot)) s[slot] = `${slot}Name`;
    else n[slot] = (i += 7);
  }
  return fact(key, n, s, "Virat Kohli");
}

describe("prose", () => {
  it("carries no digits in the bank: every number must come from the match", () => {
    const all = [...Object.values(BANK.lists).flat(), ...Object.values(BANK.facts).flat(), ...Object.values(BANK.stopPress).flat(), ...Object.values(BANK.results).flat()];
    for (const frame of all) assert.ok(!/\d/.test(frame.replace(/\{[^}]*\}/g, "")), `digit in frame: ${frame}`);
    assert.ok(all.length >= 200, `bank size ${all.length}`);
  });

  it("renders every frame for every fact key without a missing slot or list, and quotes only the fact's numbers", () => {
    for (const key of Object.keys(BANK.facts)) {
      const f = fullFact(key);
      const picker = new Picker(`t:${key}`);
      const frames = BANK.facts[key]!;
      const allowed = new Set([...Object.values(f.n), MATCH_SLOTS.total, MATCH_SLOTS.target]);
      for (let i = 0; i < frames.length * 2; i += 1) {
        const text = factSentence(f, picker, MATCH_SLOTS);
        assert.ok(text && text.length > 10, `${key}: ${text}`);
        for (const num of numbersIn(text!)) assert.ok(allowed.has(num), `${key}: number ${num} not in fact (${text})`);
        assert.ok(!/\{|\[|\]|\}/.test(text!), `${key}: unfilled token in ${text}`);
        assert.ok(!text!.includes("!"), "no exclamation marks");
        assert.ok(!/per cent/.test(text!), "no percentages in prose");
      }
      const stop = stopPress(f, picker, MATCH_SLOTS);
      assert.ok(stop && stop.length > 4, `${key} stop press`);
    }
  });

  it("does not repeat a frame until the list is used up, and the same seed prints the same paper", () => {
    const f = fullFact("hundred");
    const frames = BANK.facts.hundred!.length;
    const a = new Picker("seed-one"), b = new Picker("seed-one"), c = new Picker("seed-two");
    const seen = new Set<string>();
    const outA: string[] = [], outB: string[] = [], outC: string[] = [];
    for (let i = 0; i < frames; i += 1) {
      const sa = factSentence(f, a)!;
      outA.push(sa); outB.push(factSentence(f, b)!); outC.push(factSentence(f, c)!);
      assert.ok(!seen.has(sa), `repeat within a cycle: ${sa}`);
      seen.add(sa);
    }
    assert.deepEqual(outA, outB, "same seed, same sentences");
    assert.notDeepEqual(outA, outC, "a different seed shuffles differently");
    // Fifty seeds, a seven-issue run each: the stop press for a hundred never repeats inside a run.
    for (let s = 0; s < 50; s += 1) {
      const p = new Picker(`run-${s}`);
      const lines = Array.from({ length: Math.min(7, BANK.stopPress.hundred!.length) }, () => stopPress(f, p));
      assert.equal(new Set(lines).size, lines.length, `run ${s} repeated a stop press`);
    }
  });

  it("writes result lines for every kind of finish", () => {
    const picker = new Picker("results");
    const base = { stageId: "g", teams: ["India", "Pakistan"] as [string, string], date: null, venueId: "v", group: "A", scores: ["", ""] as [string, string], tieBreak: null, rain: null } as unknown as FixtureResult;
    const runs = resultLine({ ...base, winner: "India", margin: { runs: 1 } } as FixtureResult, picker);
    assert.match(runs, /India/);
    assert.match(runs, /1 run\b/);
    const wk = resultLine({ ...base, winner: "Pakistan", margin: { wickets: 1, ballsLeft: 1 } } as FixtureResult, picker);
    assert.match(wk, /1[- ]wicket\b/);
    assert.match(wk, /1 ball\b/);
    const last = resultLine({ ...base, winner: "Pakistan", margin: { wickets: 3, ballsLeft: 0 } } as FixtureResult, picker);
    assert.match(last, /last ball|final delivery/);
    const nr = resultLine({ ...base, winner: null, margin: null } as FixtureResult, picker);
    assert.match(nr, /rain|abandoned/i);
    const so = resultLine({ ...base, winner: "India", margin: null, tieBreak: { method: "super-over" } } as unknown as FixtureResult, picker);
    assert.match(so, /super over/);
    const dls = resultLine({ ...base, winner: "India", margin: { runs: 12, dls: true } } as unknown as FixtureResult, picker);
    assert.match(dls, /Duckworth|par/);
  });

  it("reads the shape of a match into words", () => {
    const base = { stageId: "g", teams: ["A", "B"] as [string, string], date: null, venueId: "v", group: "A", scores: ["", ""] as [string, string], tieBreak: null, rain: null } as unknown as FixtureResult;
    const inn = (team: string, index: 1 | 2, runs: number, target: number | null = null) => ({ team, index, runs, target }) as unknown as FixtureResult["innings"] extends (infer T)[] | undefined ? T : never;
    const marks = { lowTotal: 125, highTotal: 200 };
    const tight = matchSlots({ ...base, winner: "B", margin: { wickets: 5, ballsLeft: 4 }, innings: [inn("A", 1, 126), inn("B", 2, 127, 127)] } as FixtureResult, marks);
    assert.equal(tight.matchShape, "thriller");
    assert.equal(tight.target, 127);
    assert.equal(tight.chasing, "chasing 127");
    const low = matchSlots({ ...base, winner: "A", margin: { runs: 3 }, innings: [inn("A", 1, 118), inn("B", 2, 115, 119)] } as FixtureResult, marks);
    assert.equal(low.matchShape, "low-scoring thriller");
    const rout = matchSlots({ ...base, winner: "A", margin: { runs: 80 }, innings: [inn("A", 1, 210), inn("B", 2, 130, 211)] } as FixtureResult, marks);
    assert.equal(rout.matchShape, "high-scoring rout");
    const plain = matchSlots({ ...base, winner: "A", margin: { runs: 20 }, innings: [inn("A", 1, 160), inn("B", 2, 140, 161)] } as FixtureResult, marks);
    assert.equal(plain.matchShape, "contest");
  });

  it("counts, ordinals and tidying", () => {
    assert.equal(count(1, "run"), "1 run");
    assert.equal(count(12, "wicket"), "12 wickets");
    assert.equal(count(2, "nth"), "2nd");
    assert.equal(count(11, "nth"), "11th");
    assert.equal(count(23, "nth"), "23rd");
    assert.equal(count(6, "six"), "6 sixes");
    assert.equal(tidy("a  innings , here ."), "An innings, here.");
    assert.equal(tidy("steering them in a one-sided affair and a useful stand"), "Steering them in a one-sided affair and a useful stand");
    assert.equal(tidy("a opening stand"), "An opening stand");
    const picker = new Picker("x");
    assert.equal(render("{team} beat {loser} by {runs:run}.", { team: "A", loser: "B", runs: 1 }, picker), "A beat B by 1 run.");
    assert.throws(() => render("{missing}", {}, picker));
    assert.equal(render("{a:pos} total beat {b:pos} mark.", { a: "West Indies", b: "India" }, picker), "West Indies' total beat India's mark.");
    // Fragments keep their case inside a sentence; only the first letter of the sentence is raised.
    assert.equal(render("{team} won [calmly].", { team: "India" }, picker, { calmly: ["without fuss"] }), "India won without fuss.");
  });
});
