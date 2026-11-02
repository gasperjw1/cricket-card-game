import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult } from "../../wcdraft/src/engine/tournament.ts";
import { BANK } from "../src/game/bank.ts";
import type { Fact } from "../src/game/facts.ts";
import { Picker, count, factSentence, numbersIn, render, resultLine, stopPress, tidy } from "../src/game/prose.ts";

const fact = (key: string, n: Record<string, number>, s: Record<string, string> = {}, player: string | null = null, team = "India"): Fact => ({ key, tier: 1, team, player: player ? { id: player, name: player } : null, n, s });

/** Every slot name the bank's frames reference, per fact key. */
function slotsUsed(frames: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const f of frames) for (const m of f.matchAll(/\{([a-zA-Z_0-9]+)(?::[a-z]+)?\}/g)) out.add(m[1]!);
  return out;
}

/** A fact whose numbers and names cover every slot a frame could ask for, with distinctive numbers. */
function fullFact(key: string): Fact {
  const n: Record<string, number> = {}, s: Record<string, string> = {};
  let i = 11;
  for (const slot of slotsUsed([...(BANK.facts[key] ?? []), ...(BANK.stopPress[key] ?? [])])) {
    if (["team", "player", "surname"].includes(slot)) continue;
    if (["loser", "opp", "a", "b", "holder", "prevHolder", "prevTeam"].includes(slot)) s[slot] = `${slot}Name`;
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
      const allowed = new Set(Object.values(f.n));
      for (let i = 0; i < frames.length * 2; i += 1) {
        const text = factSentence(f, picker);
        assert.ok(text && text.length > 10, `${key}: ${text}`);
        for (const num of numbersIn(text!)) assert.ok(allowed.has(num), `${key}: number ${num} not in fact (${text})`);
        assert.ok(!/\{|\[|\]|\}/.test(text!), `${key}: unfilled token in ${text}`);
        assert.ok(!text!.includes("!"), "no exclamation marks");
      }
      const stop = stopPress(f, picker);
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

  it("counts, ordinals and tidying", () => {
    assert.equal(count(1, "run"), "1 run");
    assert.equal(count(12, "wicket"), "12 wickets");
    assert.equal(count(2, "nth"), "2nd");
    assert.equal(count(11, "nth"), "11th");
    assert.equal(count(23, "nth"), "23rd");
    assert.equal(count(6, "six"), "6 sixes");
    assert.equal(tidy("a  innings , here ."), "An innings, here.");
    const picker = new Picker("x");
    assert.equal(render("{team} beat {loser} by {runs:run}.", { team: "A", loser: "B", runs: 1 }, picker), "A beat B by 1 run.");
    assert.throws(() => render("{missing}", {}, picker));
    assert.equal(render("{a:pos} total beat {b:pos} mark.", { a: "West Indies", b: "India" }, picker), "West Indies' total beat India's mark.");
    // Fragments keep their case inside a sentence; only the first letter of the sentence is raised.
    assert.equal(render("{team} won [calmly].", { team: "India" }, picker, { calmly: ["without fuss"] }), "India won without fuss.");
  });
});
