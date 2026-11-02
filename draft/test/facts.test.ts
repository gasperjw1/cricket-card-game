import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult } from "../../wcdraft/src/engine/tournament.ts";
import type { BallRecord, BatterLine, BowlerLine, InningsResult } from "../../wcdraft/src/engine/types.ts";
import { collapseIn, factsFor, fiftyBalls, fixtureKey, foldRecords, fullMembersAt, hatTricks, marksFor, readChase, recordsBefore, updateRecords, type FactContext } from "../src/game/facts.ts";

const bat = (id: string, runs: number, balls: number, out = true, position = 1): BatterLine => ({ id, name: id, runs, balls, fours: 0, sixes: 0, out, dismissal: null, position });
const bowl = (id: string, wickets: number, runs: number, balls = 24): BowlerLine => ({ id, name: id, balls, runs, wickets, overs: [], maidens: 0, dots: 0, wides: 0, noBalls: 0 });
const phases = () => ({ pp: 0, mid: 0, death: 0 });

function innings(team: string, index: 1 | 2, runs: number, wickets: number, over: Partial<InningsResult> = {}): InningsResult {
  return {
    index, team, captainId: null, keeperId: null, scheduledOvers: 20, runs, wickets, legalBalls: wickets >= 10 ? 110 : 120, extras: 0, batting: [], bowling: [],
    fallOfWickets: [], partnerships: [], extrasDetail: { wides: 0, noBalls: 0, byes: 0 }, phaseRuns: phases(), outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 }, byeBalls: 0, target: index === 2 ? over.target ?? null : null,
    ...over,
  } as InningsResult;
}

function fixture(a: string, b: string, i1: InningsResult, i2: InningsResult, over: Partial<FixtureResult> = {}): FixtureResult {
  const winner = over.winner === undefined ? (i2.runs >= (i2.target ?? i1.runs + 1) ? i2.team : i1.team) : over.winner;
  const margin = over.margin ?? (winner === i2.team ? { wickets: 10 - i2.wickets, ballsLeft: 120 - i2.legalBalls } : { runs: i1.runs - i2.runs });
  return { stageId: "group", teams: [a, b], date: "2024-06-05", venueId: "v", group: "A", winner, scores: ["", ""], margin, tieBreak: null, rain: null, innings: [i1, i2], ...over } as FixtureResult;
}

const ctx = (f: FixtureResult, over: Partial<FactContext> = {}): FactContext => ({
  editionId: "2024", records: foldRecords([f]).get(fixtureKey(f))!, knockout: false, before: new Map(), marks: marksFor(7.5), ...over,
});

const ball = (innings: 1 | 2, over: number, ballInOver: number, bowler: string, striker: string, runsBatter: number, runsAfter: number, wicket = false, extraKind: BallRecord["extraKind"] = null): BallRecord => ({
  innings, over, ballInOver, striker, nonStriker: "x", bowler, outcome: wicket ? "W" : (String(runsBatter) as BallRecord["outcome"]), runsBatter, extras: 0, extraKind, wicket,
  dismissal: wicket ? { kind: "bowled", bowler: { id: bowler, name: bowler }, fielder: null, byKeeper: false } : null, legal: extraKind !== "wide" && extraKind !== "no-ball", runsAfter, wicketsAfter: 0,
});

describe("facts", () => {
  it("finds a hundred, a five-for, a lone hand and a standout bowler from the scorecard", () => {
    const i1 = innings("India", 1, 180, 4, { batting: [bat("Kohli", 104, 60), bat("Rohit", 28, 20), bat("Pant", 22, 15)], bowling: [bowl("Boult", 2, 40)] });
    const i2 = innings("New Zealand", 2, 100, 10, { target: 181, batting: [bat("Williamson", 40, 30), bat("Conway", 25, 20)], bowling: [bowl("Bumrah", 5, 12, 24), bowl("Siraj", 1, 40, 24), bowl("Arshdeep", 2, 38, 24), bowl("Axar", 1, 25, 24)] });
    const f = fixture("India", "New Zealand", i1, i2);
    const keys = factsFor(f, ctx(f)).map((x) => x.key);
    assert.ok(keys.includes("hundred"));
    assert.ok(keys.includes("fiveFor"));
    assert.ok(keys.includes("loneHand"), keys.join());
    assert.ok(keys.includes("standoutBowler"), keys.join());
    assert.ok(keys.includes("rout"));
    const lone = factsFor(f, ctx(f)).find((x) => x.key === "loneHand")!;
    assert.equal(lone.player?.name, "Kohli");
    assert.equal(lone.n.share, Math.round((100 * 104) / 180));
  });

  it("does not call a fifty a lone hand when a team-mate passed thirty, and needs a win", () => {
    const i1 = innings("India", 1, 160, 4, { batting: [bat("Kohli", 70, 50), bat("Rohit", 45, 30)] });
    const i2 = innings("Australia", 2, 161, 5, { target: 161, batting: [bat("Head", 55, 30), bat("Marsh", 20, 15)], bowling: [bowl("Bumrah", 1, 30)] });
    const f = fixture("India", "Australia", i1, i2);
    const lone = factsFor(f, ctx(f)).filter((x) => x.key === "loneHand");
    assert.equal(lone.length, 1);
    assert.equal(lone[0]!.team, "Australia");
  });

  it("marks an associate beating a full member as an upset, by the edition's membership", () => {
    const i1 = innings("Pakistan", 1, 150, 6);
    const i2 = innings("United States of America", 2, 151, 5, { target: 151 });
    const f = fixture("Pakistan", "United States of America", i1, i2);
    assert.ok(factsFor(f, ctx(f)).some((x) => x.key === "upset"));
    assert.ok(!fullMembersAt("2016").has("Afghanistan") && fullMembersAt("2021").has("Afghanistan"));
    const g = fixture("Afghanistan", "England", innings("England", 1, 150, 6), innings("Afghanistan", 2, 151, 5, { target: 151 }));
    assert.ok(!factsFor(g, ctx(g, { editionId: "2022" })).some((x) => x.key === "upset"), "Afghanistan are a full member by 2022");
  });

  it("keeps a record book in play order and reports a break with its previous holder", () => {
    const f1 = fixture("A", "B", innings("A", 1, 180, 5, { batting: [bat("a1", 80, 50)] }), innings("B", 2, 150, 8, { target: 181 }), { date: "2024-06-01" });
    const f2 = fixture("C", "D", innings("C", 1, 170, 5, { batting: [bat("c1", 95, 55)] }), innings("D", 2, 171, 4, { target: 171 }), { date: "2024-06-04", stageId: "group", teams: ["C", "D"] });
    const f3 = fixture("E", "F", innings("E", 1, 200, 3, { batting: [bat("e1", 60, 30)] }), innings("F", 2, 100, 10, { target: 201 }), { date: "2024-06-09", stageId: "group", teams: ["E", "F"] });
    const book = foldRecords([f1, f2, f3]);
    const at2 = book.get(fixtureKey(f2))!;
    assert.equal(at2.before.highestTotal!.current.value, 180);
    // D's chase is the first successful one, so it sets the mark rather than breaking it; only the highest score falls.
    assert.deepEqual(at2.broken.map((b) => b.kind), ["highestScore"]);
    assert.equal(at2.after.highestChase!.current.team, "D");
    assert.equal(at2.broken.find((b) => b.kind === "highestScore")!.previous!.holder, "a1");
    const at3 = book.get(fixtureKey(f3))!;
    const tot = at3.broken.find((b) => b.kind === "highestTotal")!;
    assert.equal(tot.previous!.value, 180);
    const facts = factsFor(f3, { editionId: "2024", records: at3, knockout: false, before: new Map(), marks: marksFor(7.5) });
    const rec = facts.find((x) => x.key === "record:highestTotal")!;
    assert.equal(rec.n.daysSince, 8);
    assert.equal(rec.s.prevTeam, "A");
    // The first ever mark is not a "broken" record.
    assert.equal(book.get(fixtureKey(f1))!.broken.length, 0);
    // A tie does not break a record.
    const tie = updateRecords(at3.after, fixture("G", "H", innings("G", 1, 200, 9), innings("H", 2, 50, 10, { target: 201 }), { stageId: "group", teams: ["G", "H"] }));
    assert.ok(!tie.broken.some((b) => b.kind === "highestTotal"));
  });

  it("reads the chase from the ball log: a late surge, a twenty-run final over, a fastest fifty, a hat-trick", () => {
    const balls: BallRecord[] = [];
    // First innings: a batter reaches fifty in 20 balls.
    for (let i = 0; i < 20; i += 1) balls.push(ball(1, Math.floor(i / 6), i % 6, "bw", "fast", i < 10 ? 4 : 1, 0));
    assert.equal(fiftyBalls(balls, 1).get("fast"), 20);
    // Second innings: target 160, 20 overs. Quiet to over 15 (needs 15+ an over), then the last over goes for 22.
    let runs = 0;
    for (let i = 0; i < 90; i += 1) { runs += i % 3 === 0 ? 1 : 0; balls.push(ball(2, Math.floor(i / 6), i % 6, "b2", "s", i % 3 === 0 ? 1 : 0, runs)); }
    for (let i = 90; i < 114; i += 1) { runs += 4; balls.push(ball(2, Math.floor(i / 6), i % 6, "b2", "s", 4, runs)); }
    const before = runs;
    const lastOver = [6, 6, 4, 4, 1, 1];
    for (let i = 0; i < 6; i += 1) { runs += lastOver[i]!; balls.push(ball(2, 19, i, "b2", "s", lastOver[i]!, runs)); }
    const i2 = innings("B", 2, runs, 3, { target: before + 10 });
    const read = readChase(balls, i2)!;
    assert.ok(read.peakLateRate >= 15, `peak ${read.peakLateRate}`);
    assert.ok(read.startRate < 10);
    assert.equal(read.finalOverRuns, 22);
    assert.ok(read.wonInFinalOver);
    // A hat-trick: three wickets in three legal balls by the same bowler.
    const ht = [ball(1, 5, 0, "h", "p", 0, 0, true), ball(1, 5, 1, "h", "q", 0, 0, true), ball(1, 5, 2, "h", "r", 0, 0, true)];
    assert.deepEqual(hatTricks(ht, 1), ["h"]);
    const broken = [ht[0]!, ball(1, 5, 1, "h", "q", 0, 0, false, "wide"), ht[1]!, ball(1, 5, 2, "h", "r", 1, 1), ht[2]!];
    assert.deepEqual(hatTricks(broken, 1), [], "a scoring ball between breaks it");
  });

  it("finds a collapse, sides' records before a match, and edition marks", () => {
    const inn = innings("A", 1, 120, 9, { fallOfWickets: [{ runs: 80, batter: "a", over: 10, ball: 1 }, { runs: 82, batter: "b", over: 10, ball: 4 }, { runs: 85, batter: "c", over: 11, ball: 2 }, { runs: 90, batter: "d", over: 12, ball: 1 }, { runs: 95, batter: "e", over: 13, ball: 1 }] as InningsResult["fallOfWickets"] });
    const fall = collapseIn(inn)!;
    assert.equal(fall.wickets, 4);
    assert.equal(fall.runs, 15);
    assert.equal(fall.from, 80);
    const f1 = fixture("A", "B", innings("A", 1, 150, 5), innings("B", 2, 100, 10, { target: 151 }));
    const f2 = fixture("A", "C", innings("A", 1, 150, 5), innings("C", 2, 151, 2, { target: 151 }), { teams: ["A", "C"] });
    const before = recordsBefore([f1, f2]);
    assert.deepEqual(before.get(fixtureKey(f2))!.get("A"), { won: 1, lost: 0, played: 1 });
    assert.equal(before.get(fixtureKey(f1))!.size, 0);
    assert.deepEqual(marksFor(8), { highTotal: 205, highChase: 185 });
  });
});
