import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EnginePlayer } from "../../wcdraft/src/engine/types.ts";
import type { PhaseVectors, PlayerRating, SkillRating, Vector } from "../../wcdraft/src/ratings/model.ts";
import { computeFinal, fieldScale, project, valueIn, type EditionEnv } from "../src/game/final-ratings.ts";
import type { PoolPlayer } from "../src/game/types.ts";

const UNIT: Vector = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };
const LOW: Vector = { "0": 0.46, "1": 0.36, "2": 0.06, "3": 0.01, "4": 0.06, "6": 0.01, W: 0.04 };
const HIGH: Vector = { "0": 0.34, "1": 0.36, "2": 0.06, "3": 0.01, "4": 0.13, "6": 0.06, W: 0.04 };
const phases = (v: Vector): PhaseVectors => ({ pp: v, mid: v, death: v });
const WEIGHTS = { pp: 0.3, mid: 0.45, death: 0.25 };
const BIG_HITTER: Vector = { ...UNIT, "0": 0.9, "4": 1.2, "6": 1.5 };

const engine = (rel: Vector, residual: Partial<Record<"pace" | "spin", Vector>> = {}): EnginePlayer => ({
  battingRel: phases(rel), bowlingRel: phases(UNIT), batVsClass: { pace: residual.pace ?? UNIT, spin: residual.spin ?? UNIT },
}) as unknown as EnginePlayer;

const skill = (): SkillRating => ({ evidence: { phaseWeights: WEIGHTS, source: "form", transfer: 1, formBalls: 100, careerBalls: 400, domesticBalls: 0, odiBalls: 0 }, lowSample: false, byBowlClass: null } as unknown as SkillRating);
const rating = { batting: skill(), bowling: skill() } as unknown as PlayerRating;
const pool = (over: Partial<PoolPlayer> = {}) => ({ bat: 80, bowl: 60, batShown: true, bowlShown: true, ...over }) as PoolPlayer;
const scale = fieldScale([-20, -10, -5, 0, 5, 10, 20, 30]);
const env = (id: string, base: Vector): EditionEnv => ({ editionId: id, base: phases(base), scale: { bat: scale, bowl: scale } });

describe("final ratings", () => {
  it("uses the engine's own combination, so a neutral player is the base rate", () => {
    const dist = project(LOW, UNIT, 0.7);
    for (const k of Object.keys(LOW) as (keyof Vector)[]) assert.ok(Math.abs(dist[k] - LOW[k]) < 1e-9);
    assert.ok(Math.abs(valueIn(engine(UNIT), "bat", phases(LOW), WEIGHTS)) < 1e-9);
  });

  it("maps the field onto the card scale, flat outside it", () => {
    const s = fieldScale([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    assert.equal(s(50), 70);
    assert.ok(s(100) >= 99 && s(1000) === 99);
    assert.equal(s(-1000), 40);
    assert.ok(s(75) > s(25));
  });

  it("has nothing to add for a player in his own World Cup at his own phase mix", () => {
    const home = env("2012", LOW);
    const f = computeFinal({ player: pool(), rating, engine: engine(BIG_HITTER), home, here: home, position: 3, slot: WEIGHTS, classMix: { pace: 0.65, spin: 0.35 }, keeps: false });
    assert.equal(f.batting.final, 80);
    assert.ok(f.batting.steps.every((s) => s.delta === 0));
    assert.equal(f.bowling!.final, 60);
  });

  it("anchors on the card and the printed steps add up to the final", () => {
    const f = computeFinal({
      player: pool(), rating, engine: engine(BIG_HITTER, { spin: { ...UNIT, "6": 0.7, "4": 0.8 } }), home: env("2012", LOW), here: env("2024", HIGH), position: 7,
      slot: { pp: 0.02, mid: 0.38, death: 0.6 }, classMix: { pace: 0.6, spin: 0.4 }, intent: { pp: 1, mid: 1, death: 1 }, keeps: false,
    });
    assert.equal(f.batting.final, 80 + f.batting.steps.reduce((a, s) => a + s.delta, 0));
    assert.deepEqual(f.batting.steps.map((s) => s.key), ["era", "slot", "class", "coach"]);
    assert.ok(f.batting.steps.find((s) => s.key === "class")!.delta < 0, "a weak spin record costs him against a spin-heavy attack");
    assert.ok(f.batting.steps.find((s) => s.key === "coach")!.delta > 0, "attacking intent lifts a batter's value here");
  });

  it("moves the rates with the era but not the player's relative edge", () => {
    const f = computeFinal({ player: pool(), rating, engine: engine(BIG_HITTER), home: env("2012", LOW), here: env("2024", HIGH), position: 3, slot: WEIGHTS, classMix: { pace: 0.65, spin: 0.35 }, keeps: false });
    assert.ok(f.batting.here.rate > f.batting.then.rate, "the same edge scores faster in a higher-scoring era");
  });

  it("gives the designated keeper no bowling and keeps a hidden skill unprinted", () => {
    const base = env("2024", HIGH);
    const args = { rating, engine: engine(UNIT), home: base, here: base, position: 6, slot: WEIGHTS, classMix: { pace: 0.65, spin: 0.35 } };
    assert.equal(computeFinal({ ...args, player: pool(), keeps: true }).bowling, null);
    assert.equal(computeFinal({ ...args, player: pool({ bowlShown: false }), keeps: false }).bowling!.shown, false);
  });
});
