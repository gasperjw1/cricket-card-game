import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult } from "../../wcdraft/src/engine/tournament.ts";
import type { RecordBook } from "../src/game/facts.ts";
import { fieldLevel, journeyFor, journeyLine, recordChains, residuals, souvenirLists, type Expectation } from "../src/game/souvenir.ts";
import type { PlayerTotals } from "../src/game/stats.ts";

const totals = (over: Partial<PlayerTotals>): PlayerTotals => ({ id: "x", name: "X", team: "T", innings: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, high: 0, highNotOut: false, bowlInnings: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, best: null, potm: 0, points: 0, catches: 0, stumpings: 0, runOuts: 0, ...over });
const exp = (over: Partial<Expectation>): Expectation => ({ name: "X", team: "T", cardBat: 70, cardBowl: null, bat: { rate: 120, ballsPerOut: 20 }, bowl: null, ...over });

describe("souvenir", () => {
  // A field that scored exactly as its cards said, so the subject is measured against his own expectation.
  const steady = (n: number) => Array.from({ length: n }, (_, i) => [`T|s${i}`, totals({ id: `s${i}`, runs: 120, balls: 100, outs: 5, bowlBalls: 60, bowlRuns: 80, wickets: 3 })] as const);
  const steadyExp = (n: number) => Array.from({ length: n }, (_, i) => [`T|s${i}`, exp({ name: `S${i}`, cardBowl: 70, bowl: { rate: 8, ballsPerOut: 20 } })] as const);

  it("measures a batter against his card's strike rate and dismissal rate, in runs, at the field's level", () => {
    // 150 balls at 120 would be 180 runs with 7.5 dismissals; he made 220 for 5: ahead on both counts.
    const t = new Map([...steady(20), ["T|a", totals({ id: "a", runs: 220, balls: 150, outs: 5 })]]);
    const e = new Map([...steadyExp(20), ["T|a", exp({ name: "A" })]]);
    const r = residuals(t, e, new Set()).find((x) => x.key === "T|a");
    assert.ok(r && r.bat);
    assert.ok(r.bat!.above > 35 && r.bat!.above < 120, `above ${r.bat!.above}`);
    assert.equal(Math.round(r.bat!.sr), 147);
    // Under the sample floor he is left out.
    assert.equal(residuals(new Map([["T|b", totals({ id: "b", runs: 50, balls: 30 })]]), new Map([["T|b", exp({})]]), new Set()).length, 0);
  });

  it("allows for the whole field scoring above its cards", () => {
    // Everyone scored 50% faster than his card: at the field's level nobody is unexpected.
    const t = new Map(Array.from({ length: 10 }, (_, i) => [`T|f${i}`, totals({ id: `f${i}`, runs: 180, balls: 100, outs: 5 })] as const));
    const e = new Map(Array.from({ length: 10 }, (_, i) => [`T|f${i}`, exp({ name: `F${i}` })] as const));
    assert.ok(Math.abs(fieldLevel(t, e).sr - 1.5) < 1e-9);
    for (const r of residuals(t, e, new Set())) assert.ok(Math.abs(r.bat!.above) < 1e-6, `${r.name} ${r.bat!.above}`);
  });

  it("measures a bowler against economy and balls per wicket", () => {
    // 72 balls at 8 an over expected (96 runs) with a wicket every 18 balls (4): he went for 60 and took 7.
    const t = new Map([...steady(20), ["T|c", totals({ id: "c", bowlBalls: 72, bowlRuns: 60, wickets: 7 })]]);
    const e = new Map([...steadyExp(20), ["T|c", exp({ cardBat: null, bat: null, cardBowl: 80, bowl: { rate: 8, ballsPerOut: 18 } })]]);
    const r = residuals(t, e, new Set()).find((x) => x.key === "T|c");
    assert.ok(r && r.bowl && !r.bat);
    assert.ok(r.bowl!.above > 30, `above ${r.bowl!.above}`);
    assert.equal(r.bowl!.econ, 5);
  });

  it("sorts standouts, the unexpected (cards of 75 and under) and the disappointing (85 and over)", () => {
    const t = new Map([
      ["T|big", totals({ id: "big", runs: 100, balls: 100, outs: 6 })],
      ["T|small", totals({ id: "small", runs: 200, balls: 120, outs: 3 })],
      ["T|mid", totals({ id: "mid", runs: 150, balls: 110, outs: 5 })],
    ]);
    const e = new Map([
      ["T|big", exp({ name: "Big", cardBat: 95, bat: { rate: 150, ballsPerOut: 25 } })],
      ["T|small", exp({ name: "Small", cardBat: 62, bat: { rate: 105, ballsPerOut: 16 } })],
      ["T|mid", exp({ name: "Mid", cardBat: 80 })],
    ]);
    const lists = souvenirLists(residuals(t, e, new Set(["T|small"])));
    assert.equal(lists.standouts[0]!.name, "Small");
    assert.ok(lists.standouts[0]!.mine);
    // Small leads the tournament on a modest card: named once, among the players of the tournament.
    assert.deepEqual(lists.unexpected.map((r) => r.name), []);
    assert.deepEqual(lists.disappointing.map((r) => r.name), ["Big"]);
    const one = souvenirLists(residuals(t, e, new Set(["T|small"])), 1);
    assert.deepEqual(one.standouts.map((r) => r.name), ["Small"]);
    assert.ok(one.unexpected.every((r) => !one.standouts.includes(r)), "no man in both lists");
  });

  it("writes the journey match by match, with a dash for a match he sat out", () => {
    const inn = (team: string, batting: { id: string; runs: number; balls: number; out: boolean }[], bowling: { id: string; wickets: number; runs: number; balls: number }[]) => ({ team, batting, bowling }) as unknown as NonNullable<FixtureResult["innings"]>[number];
    const f = (opp: string, winner: string | null, mine: Parameters<typeof inn>[1], theirs: Parameters<typeof inn>[2]) => ({ teams: ["Me", opp], winner, stageLabel: "Group", innings: [inn("Me", mine, []), inn(opp, [], theirs)] }) as unknown as FixtureResult & { stageLabel: string };
    const mine = [
      f("A", "Me", [{ id: "p", runs: 45, balls: 30, out: false }], [{ id: "p", wickets: 2, runs: 18, balls: 24 }]),
      f("B", "B", [], []),
      f("C", "Me", [{ id: "p", runs: 0, balls: 1, out: true }], []),
    ];
    const [j] = journeyFor(mine, "Me", [{ id: "p", name: "P" }]);
    assert.equal(journeyLine(j!, "bat"), "45*, –, 0");
    assert.equal(journeyLine(j!, "bowl"), "2-18, –, –");
    assert.deepEqual(j!.matches.map((m) => m.won), [true, false, true]);
  });

  it("lays out a record's chain with how long each mark stood", () => {
    const entry = (holder: string, value: number, date: string) => ({ value, value2: 0, holder, holderId: null, team: holder, opp: "X", date, fixtureKey: `g|${holder}|X` });
    const book: RecordBook = { highestTotal: { current: entry("C", 210, "2024-06-12"), history: [entry("A", 180, "2024-06-02"), entry("B", 195, "2024-06-05")] } };
    const [c] = recordChains(book);
    assert.equal(c!.holder, "C");
    assert.deepEqual(c!.chain.map((h) => [h.holder, h.stoodDays]), [["A", 3], ["B", 7]]);
  });
});
