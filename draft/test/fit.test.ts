import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CoachOut, EditionData } from "../../wcdraft/src/engine/data.ts";
import type { EnginePlayer } from "../../wcdraft/src/engine/types.ts";
import type { PhaseVectors, PlayerRating, SkillRating, Vector } from "../../wcdraft/src/ratings/model.ts";
import { fieldScale, type EditionEnv } from "../src/game/final-ratings.ts";
import { coachFieldStep, coachNote, fitPlayer, skillFit, usualPosition, type FitContext } from "../src/game/fit.ts";
import type { PoolPlayer } from "../src/game/types.ts";

const UNIT: Vector = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };
const BASE: Vector = { "0": 0.40, "1": 0.36, "2": 0.06, "3": 0.01, "4": 0.10, "6": 0.03, W: 0.04 };
const phases = (v: Vector): PhaseVectors => ({ pp: v, mid: v, death: v });
const WEIGHTS = { pp: 0.3, mid: 0.45, death: 0.25 };
const HITTER: Vector = { ...UNIT, "0": 0.9, "4": 1.3, "6": 1.6 };
const BLOCKER: Vector = { ...UNIT, "0": 1.1, "1": 1.05, "4": 0.7, "6": 0.5, W: 0.8 };

const engine = (rel: Vector): EnginePlayer => ({ battingRel: phases(rel), bowlingRel: phases(UNIT), batVsClass: { pace: UNIT, spin: UNIT } }) as unknown as EnginePlayer;
const skill = (): SkillRating => ({ evidence: { phaseWeights: WEIGHTS, source: "form", transfer: 1, formBalls: 100, careerBalls: 400, domesticBalls: 0, odiBalls: 0 }, lowSample: false, shown: true }) as unknown as SkillRating;
const rating = (): PlayerRating => ({ personId: "x", team: "T", batting: skill(), bowling: skill() }) as unknown as PlayerRating;
const scale = fieldScale([-20, -10, -5, 0, 5, 10, 20, 30]);
const env = (id: string): EditionEnv => ({ editionId: id, base: phases(BASE), scale: { bat: scale, bowl: scale } });
const pool = (over: Partial<PoolPlayer> = {}): PoolPlayer => ({ id: "x", name: "X", team: "T", editionId: "2016", bat: 80, bowl: 60, batShown: true, bowlShown: true, role: "batter", position: 4, style: null, ...over }) as PoolPlayer;
const attack: CoachOut = { team: "A", coachName: "Attacker", role: "head", from: "2016", to: "", worldCups: [], months: 24, innings: 40, tags: [], intent: { pp: 1, mid: 1, death: 1 } };
const slots = Array.from({ length: 11 }, (_, i) => (i < 2 ? { pp: 0.6, mid: 0.35, death: 0.05 } : i < 6 ? WEIGHTS : { pp: 0.05, mid: 0.4, death: 0.55 }));
const ctx = (coach: CoachOut | null, coachField = 0): FitContext => ({ editionId: "2016", here: env("2016"), classMix: { pace: 0.6, spin: 0.4 }, slots, coachField, coach });

describe("draft-time fit", () => {
  it("has nothing to add in the player's own World Cup at his own phase mix, with no coach", () => {
    const f = skillFit("bat", 80, engine(HITTER), rating(), env("2016"), ctx(null), 4);
    assert.equal(f.here, 80);
    assert.equal(f.final, 80);
    assert.ok(f.steps.every((s) => s.delta === 0), JSON.stringify(f.steps));
  });

  it("splits the coach step into the field-wide part and the fit, and they add up", () => {
    const whole = skillFit("bat", 80, engine(HITTER), rating(), env("2016"), ctx(attack, 0), 4);
    const total = whole.coachField + whole.coachFit;
    assert.ok(total > 0, "an attacking coach lifts a hitter");
    const split = skillFit("bat", 80, engine(HITTER), rating(), env("2016"), ctx(attack, 2), 4);
    assert.equal(split.coachField, 2);
    assert.equal(split.coachField + split.coachFit, total);
    assert.equal(split.final, 80 + total);
    assert.equal(split.steps.reduce((a, s) => a + s.delta, 0), total);
  });

  it("gives the blocker a worse fit than the hitter under an attacking coach", () => {
    const h = skillFit("bat", 80, engine(HITTER), rating(), env("2016"), ctx(attack, 2), 4);
    const b = skillFit("bat", 80, engine(BLOCKER), rating(), env("2016"), ctx(attack, 2), 4);
    assert.ok(h.coachFit >= b.coachFit, `${h.coachFit} v ${b.coachFit}`);
  });

  it("leaves bowling alone: no coach step, era only", () => {
    const f = skillFit("bowl", 60, engine(HITTER), rating(), env("2012"), ctx(attack, 2), 9);
    assert.equal(f.coachField, 0);
    assert.equal(f.coachFit, 0);
    assert.deepEqual(f.steps.map((s) => s.key), ["era"]);
  });

  it("quotes a number for every one of the eleven slots, and the usual slot agrees with the headline sum", () => {
    const f = fitPlayer(pool(), engine(HITTER), rating(), env("2016"), ctx(attack, 2));
    assert.equal(f.atSlot.length, 11);
    assert.ok(f.atSlot.every((n) => typeof n === "number"));
    assert.equal(f.atSlot[f.position - 1], f.batting!.final);
    const noBat = fitPlayer(pool({ batShown: false, role: "bowler", position: null }), engine(UNIT), rating(), env("2016"), ctx(attack, 2));
    assert.equal(noBat.position, 9);
    assert.ok(noBat.atSlot.every((n) => n === null));
    assert.equal(noBat.batting, null);
  });

  it("measures the field-wide step as the mean over batters with a real sample", () => {
    const players = new Map<string, EnginePlayer>([["T|a", engine(HITTER)], ["T|b", engine(BLOCKER)], ["T|c", engine(UNIT)]]);
    const ratings = [
      { ...rating(), personId: "a" }, { ...rating(), personId: "b" }, { ...rating(), personId: "c" },
      { ...rating(), personId: "thin", batting: { ...skill(), lowSample: true } },
    ] as PlayerRating[];
    const bundle = { data: { players } as unknown as EditionData, ratings, env: env("2016") };
    const step = coachFieldStep(bundle, { pace: 0.6, spin: 0.4 }, attack);
    assert.ok(step > 0, `attacking coach lifts the field: ${step}`);
    assert.equal(coachFieldStep(bundle, { pace: 0.6, spin: 0.4 }, null), 0);
  });

  it("writes the coach note in plain words", () => {
    const f = fitPlayer(pool({ name: "Y", style: { tag: "Anchor" } as PoolPlayer["style"] }), engine(BLOCKER), rating(), env("2016"), ctx(attack, 3));
    const note = coachNote(pool({ name: "Y", style: { tag: "Anchor" } as PoolPlayer["style"] }), f, attack)!;
    assert.match(note, /^Attacker attacks in the powerplay, attacks in the middle overs, attacks at the death, which lifts every batter about 3; Y as an Anchor /);
    assert.equal(coachNote(pool(), f, null), null);
    assert.equal(usualPosition(pool({ position: null, role: "bowler" })), 9);
  });
});
