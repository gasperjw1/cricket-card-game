/**
 * Draft-time fit (asked 2026-11-01): what a card is worth in the World Cup being played, with the
 * coach the user has chosen, shown while the pick is being made rather than after the tournament.
 * The sum is the one `final-ratings.ts` prints on the result screen, run at the player's usual
 * batting position: card + era + position + pace/spin mix = here, then the coach on top.
 *
 * The coach step is the engine's own `applyIntent` on the player's vectors, so it is exactly what
 * the simulation will play. Measured over the 2016 field it is mostly level, not fit: an attacking
 * coach lifts every batter about +3 and a holding one costs every batter about −3, with a spread
 * of about ±1 around that. So the step is split in two: the field-wide part (what the coach does
 * to everyone) and the fit (how this batter fares against that), and the card shows the fit.
 *
 * `atSlot` is the same sum at each of the eleven batting positions, so the slot chooser and the
 * team sheet quote the number the simulation will play there, not the card's linear shift.
 *
 * Pure maths only; the loaders and React hooks live in `fit-load.ts` so this file tests in Node.
 */

import type { Phase } from "../../../wcdraft/src/cricsheet/match.ts";
import type { CoachOut, EditionData, EditionOut } from "../../../wcdraft/src/engine/data.ts";
import type { EnginePlayer } from "../../../wcdraft/src/engine/types.ts";
import type { PlayerRating } from "../../../wcdraft/src/ratings/model.ts";
import { valueIn, type EditionEnv } from "./final-ratings.ts";
import type { PhaseWeights } from "./slots.ts";
import type { PoolPlayer } from "./types.ts";

export interface FitStep {
  key: "era" | "slot" | "class" | "coachField" | "coachFit";
  label: string;
  delta: number;
}

export interface SkillFit {
  card: number;
  /** The card in this World Cup before the coach: card + era + usual position + pace/spin mix. */
  here: number;
  /** What the coach does to every batter in this field (0 for bowling, which intent does not touch). */
  coachField: number;
  /** How this batter fares against that: the coach step less the field-wide part. */
  coachFit: number;
  /** `here` plus both coach parts: the number the simulation plays at his usual position. */
  final: number;
  steps: FitStep[];
}

export interface PlayerFit {
  position: number;
  batting: SkillFit | null;
  bowling: SkillFit | null;
  /** Batting number at each of the eleven positions, coach included; null when the card hides his batting. */
  atSlot: (number | null)[];
}

export interface FitContext {
  editionId: string;
  here: EditionEnv;
  classMix: { pace: number; spin: number };
  /** The eleven positions' phase mixes in this World Cup. */
  slots: PhaseWeights[];
  /** Field-wide coach step on the batting card scale; 0 with no coach. */
  coachField: number;
  coach: CoachOut | null;
}

/** The share of overs bowled by spin in an edition, as `simulate.ts` works it out for the result screen. */
export function classMixOf(editions: EditionOut[], editionId: string): { pace: number; spin: number } {
  const paceSpin = editions.find((e) => e.id === editionId)?.environment.paceSpin;
  const spin = paceSpin ? paceSpin.spin.sharePct / Math.max(1, paceSpin.spin.sharePct + paceSpin.pace.sharePct) : 0.35;
  return { pace: 1 - spin, spin };
}

const round = (n: number) => Math.round(n);
const clamp = (n: number) => Math.max(40, Math.min(99, n));

/**
 * What the coach's intent does to the whole field: the mean rounded step over every batter with a
 * real sample, each at his own phase mix. The part of a player's coach step that is not this is his fit.
 */
export function coachFieldStep(bundle: { data: EditionData; ratings: PlayerRating[]; env: EditionEnv }, classMix: { pace: number; spin: number }, coach: CoachOut | null): number {
  if (!coach) return 0;
  const deltas: number[] = [];
  for (const r of bundle.ratings) {
    if (!r.batting.shown || r.batting.lowSample) continue;
    const engine = bundle.data.players.get(`${r.team}|${r.personId}`);
    if (!engine) continue;
    const w = r.batting.evidence.phaseWeights;
    const scale = bundle.env.scale.bat;
    deltas.push(round(scale(valueIn(engine, "bat", bundle.env.base, w, { classMix, intent: coach.intent }))) - round(scale(valueIn(engine, "bat", bundle.env.base, w, { classMix }))));
  }
  return deltas.length ? round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;
}

/** Where a card usually bats, for the position step: his own band, else the middle order (No. 6) or No. 9 for a bowler. */
export function usualPosition(p: PoolPlayer): number {
  return p.position ?? (p.role === "bowler" ? 9 : 6);
}

/** The card number at one batting position, every step included: era, that slot's overs, pace/spin mix, coach. */
export function numberAt(skill: "bat" | "bowl", card: number, engine: EnginePlayer, rating: PlayerRating, home: EditionEnv, ctx: FitContext, slot: PhaseWeights): number {
  const own = (skill === "bat" ? rating.batting : rating.bowling).evidence.phaseWeights;
  const start = home.scale[skill](valueIn(engine, skill, home.base, own));
  const end = skill === "bat"
    ? ctx.here.scale.bat(valueIn(engine, "bat", ctx.here.base, slot, { classMix: ctx.classMix, intent: ctx.coach?.intent }))
    : ctx.here.scale.bowl(valueIn(engine, "bowl", ctx.here.base, own));
  return clamp(card + round(end) - round(start));
}

/** One skill's fit at the player's usual position, as steps that add up to the number the simulation plays. */
export function skillFit(skill: "bat" | "bowl", card: number, engine: EnginePlayer, rating: PlayerRating, home: EditionEnv, ctx: FitContext, position: number): SkillFit {
  const own = (skill === "bat" ? rating.batting : rating.bowling).evidence.phaseWeights;
  const slot = ctx.slots[position - 1] ?? own;
  const scaleHome = home.scale[skill], scaleHere = ctx.here.scale[skill];
  const start = scaleHome(valueIn(engine, skill, home.base, own));
  const points: { key: FitStep["key"]; label: string; at: number }[] = [
    { key: "era", label: home.editionId === ctx.editionId ? `Same World Cup (${ctx.editionId})` : `Era: ${home.editionId} to ${ctx.editionId}`, at: scaleHere(valueIn(engine, skill, ctx.here.base, own)) },
  ];
  if (skill === "bat") {
    points.push({ key: "slot", label: `Batting at No. ${position}`, at: scaleHere(valueIn(engine, "bat", ctx.here.base, slot)) });
    points.push({ key: "class", label: `Pace and spin mix (${Math.round(100 * ctx.classMix.spin)}% spin)`, at: scaleHere(valueIn(engine, "bat", ctx.here.base, slot, { classMix: ctx.classMix })) });
  }
  let prev = start;
  const steps: FitStep[] = points.map((p) => {
    const delta = round(p.at) - round(prev);
    prev = p.at;
    return { key: p.key, label: p.label, delta };
  });
  const here = clamp(card + steps.reduce((a, s) => a + s.delta, 0));
  let coachField = 0, coachFit = 0;
  if (skill === "bat" && ctx.coach) {
    const withCoach = round(scaleHere(valueIn(engine, "bat", ctx.here.base, slot, { classMix: ctx.classMix, intent: ctx.coach.intent })));
    const whole = withCoach - round(prev);
    coachField = ctx.coachField;
    coachFit = whole - coachField;
    steps.push({ key: "coachField", label: `${ctx.coach.coachName}'s tempo, field-wide`, delta: coachField });
    steps.push({ key: "coachFit", label: `Fit with ${ctx.coach.coachName}`, delta: coachFit });
  }
  return { card, here, coachField, coachFit, final: clamp(here + coachField + coachFit), steps };
}

/** A card's fit in the World Cup being played: both skills at his usual position, and the batting number at every slot. */
export function fitPlayer(p: PoolPlayer, engine: EnginePlayer, rating: PlayerRating, home: EditionEnv, ctx: FitContext): PlayerFit {
  const position = usualPosition(p);
  return {
    position,
    batting: p.batShown ? skillFit("bat", p.bat, engine, rating, home, ctx, position) : null,
    bowling: p.bowlShown ? skillFit("bowl", p.bowl, engine, rating, home, ctx, position) : null,
    atSlot: ctx.slots.map((slot) => (p.batShown ? numberAt("bat", p.bat, engine, rating, home, ctx, slot) : null)),
  };
}

/** "attacks", "balanced", "holds back": the coach's intent in a phase, in the words the coach panel uses. */
export const intentWord = (z: number) => (z >= 0.6 ? "attacks" : z <= -0.6 ? "holds back" : "balanced");

const PHASE_NAMES: Record<Phase, string> = { pp: "in the powerplay", mid: "in the middle overs", death: "at the death" };

/** One sentence on the coach and this card: his tempo, what it does to the field, and how this batter fares against that. */
export function coachNote(p: PoolPlayer, fit: PlayerFit | undefined, coach: CoachOut | null): string | null {
  if (!coach || !fit?.batting) return null;
  const strong = (Object.keys(PHASE_NAMES) as Phase[]).filter((ph) => Math.abs(coach.intent[ph]) >= 0.6);
  const where = strong.length ? strong.map((ph) => `${intentWord(coach.intent[ph])} ${PHASE_NAMES[ph]}`).join(", ") : "keeps an even tempo";
  const field = fit.batting.coachField;
  const fieldText = field > 0 ? `lifts every batter about ${field}` : field < 0 ? `costs every batter about ${-field}` : "leaves the field where it is";
  const d = fit.batting.coachFit;
  const effect = d > 0 ? `does ${d} better than that` : d < 0 ? `does ${-d} worse than that` : "fares as the field does";
  const style = p.style ? ` as ${/^[AEIOU]/.test(p.style.tag) ? "an" : "a"} ${p.style.tag}` : "";
  return `${coach.coachName} ${where}, which ${fieldText}; ${p.name}${style} ${effect}.`;
}
