import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult, TournamentResult } from "../../wcdraft/src/engine/tournament.ts";
import { dailyLabel, dailySeed, decodeRun, encodeRun, netRunRate, performance, type SharedRun } from "../src/game/score.ts";
import { planAt } from "../src/game/plan.ts";

const inn = (team: string, runs: number, wickets: number, legalBalls = 120) => ({ team, runs, wickets, legalBalls, scheduledOvers: 20 });
const fixture = (me: string, opp: number, mine: number, won: boolean, stageId = "group"): FixtureResult =>
  ({ stageId, teams: [me, "X"], winner: won ? me : "X", innings: [inn(me, mine, 5), inn("X", opp, 7)], rain: null }) as unknown as FixtureResult;
const result = (stages: number, exit: string, won: number, lost: number, champion = false, unbeaten = lost === 0): TournamentResult =>
  ({ stages: Array.from({ length: stages }, (_, i) => ({ id: `s${i}`, label: i === stages - 1 ? "Final" : `Stage ${i}`, fixtures: [] })), identity: { team: "Me", played: won + lost, won, lost, exit, unbeaten, champion } }) as unknown as TournamentResult;

describe("performance and the share link", () => {
  it("scores the stage reached, wins, net run rate and an unbeaten run", () => {
    const mine = [fixture("Me", 150, 180, true, "s0"), fixture("Me", 140, 170, true, "s0"), fixture("Me", 160, 190, true, "s2")];
    const r = result(3, "Final", 3, 0, true);
    const p = performance(r, mine, "Me");
    assert.equal(p.stagePoints, 60);
    assert.equal(p.winPoints, 12);
    assert.ok(p.nrr > 1.4 && p.nrr < 1.6, `nrr ${p.nrr}`);
    assert.equal(p.nrrPoints, 8);
    assert.equal(p.unbeatenPoints, 10);
    assert.equal(p.score, 90);
    // A group exit with one win and a poor rate scores low but not below zero.
    const bad = performance(result(3, "Stage 0", 1, 3, false, false), [fixture("Me", 200, 100, false, "s0")], "Me");
    assert.equal(bad.stagePoints, 0);
    assert.equal(bad.nrrPoints, -10);
    assert.equal(bad.score, 0);
  });

  it("charges a side bowled out its full allotment in the net run rate", () => {
    const f = { stageId: "g", teams: ["Me", "X"], winner: "X", rain: null, innings: [{ team: "X", runs: 160, wickets: 4, legalBalls: 120, scheduledOvers: 20 }, { team: "Me", runs: 100, wickets: 10, legalBalls: 90, scheduledOvers: 20 }] } as unknown as FixtureResult;
    assert.ok(Math.abs(netRunRate([f], "Me") - (5 - 8)) < 1e-9);
  });

  it("round-trips a run through the link, plans included", () => {
    const run: SharedRun = {
      seed: "daily-2026-11-02", identity: { team: "United States of America", editionId: "2024", standIn: false }, coach: { team: "India", coachName: "Rahul Dravid", from: "2021-11" },
      picks: Array.from({ length: 11 }, (_, i) => ["India", "2024", `p${i}`] as [string, string, string]), captainId: "p3",
      plans: [undefined, { order: ["p1", "p0", ...Array.from({ length: 9 }, (_, i) => `p${i + 2}`)] }, { intent: "attack" }, undefined, { captainId: "p5" }], movesUsed: 2,
    };
    const text = encodeRun(run);
    assert.match(text, /^[A-Za-z0-9_-]+$/, "URL-safe");
    assert.deepEqual(decodeRun(text), run);
    assert.equal(decodeRun("not-a-run"), null);
    assert.equal(decodeRun(encodeRun({ ...run, picks: run.picks.slice(0, 10) })), null, "eleven picks or nothing");
  });

  it("reads a link made before line-up moves as none spent", () => {
    const old = btoa(JSON.stringify({ s: "x", i: ["India", "2024", 0], c: null, p: Array.from({ length: 11 }, (_, i) => ["India", "2024", `p${i}`]), k: null, l: [] })).replace(/=+$/, "");
    assert.equal(decodeRun(old)?.movesUsed, 0);
  });

  it("holds every plan from its match on, a later one changing only what it sets", () => {
    const order = ["b", "a", "c"];
    const plans = [{ captainId: "a" }, { order }, undefined, { intent: "attack" as const }];
    assert.deepEqual(planAt(plans, 0), { captainId: "a" });
    assert.deepEqual(planAt(plans, 2), { captainId: "a", order });
    assert.deepEqual(planAt(plans, 3), { captainId: "a", order, intent: "attack" }, "the order and captain set earlier stay when a tempo is set");
    assert.deepEqual(planAt([], 4), {});
  });

  it("names the day's seed by the player's local date", () => {
    // Late evening local time is still that day, whatever the UTC date has become.
    const evening = new Date(2026, 10, 2, 23, 30);
    assert.equal(dailySeed(evening), "daily-2026-11-02");
    assert.equal(dailyLabel(evening), "11/2/2026");
    assert.equal(dailySeed(new Date(2026, 0, 5, 0, 5)), "daily-2026-01-05");
  });
});
