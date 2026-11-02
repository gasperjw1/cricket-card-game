import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult, TournamentResult } from "../../wcdraft/src/engine/tournament.ts";
import { dailySeed, decodeRun, encodeRun, netRunRate, performance, type SharedRun } from "../src/game/score.ts";

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
      picks: Array.from({ length: 11 }, (_, i) => ["India", "2024", `p${i}`] as [string, string, string]), captainId: "p3", plans: [undefined, undefined, { intent: "attack" }, undefined, { captainId: "p5" }],
    };
    const text = encodeRun(run);
    assert.match(text, /^[A-Za-z0-9_-]+$/, "URL-safe");
    assert.deepEqual(decodeRun(text), run);
    assert.equal(decodeRun("not-a-run"), null);
    assert.equal(decodeRun(encodeRun({ ...run, picks: run.picks.slice(0, 10) })), null, "eleven picks or nothing");
  });

  it("names the day's seed by the UTC date", () => {
    assert.equal(dailySeed(new Date("2026-11-02T23:30:00Z")), "daily-2026-11-02");
  });
});
