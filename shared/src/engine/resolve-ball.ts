/**
 * Pure ball resolution engine.
 *
 * Given the post-swap, post-cancellation cards both players played, plus a
 * deterministic-or-random hook for Review Appeal, computes the final outcome
 * and a step-by-step breakdown the UI can use to animate the result.
 *
 * The 11-step canonical order from docs/situation-cards.md is implemented
 * inline below. Old School cancellation and Mankad/Retired Out/Cramps swaps
 * happen BEFORE this function is called — by the time we run, both situation
 * cards are either in effect or null, and both mandatory cards are final.
 */

import {
  EXTRAS_RUNS,
  REVIEW_APPEAL_WICKET_CHANCE,
  WIDE_CHANCE_BY_TIER,
} from "../constants.js";
import type {
  Adjective,
  BatsmanCard,
  BatsmanOutcome,
  BowlerCard,
  FieldingRegion,
  Length,
  Line,
  RunValue,
  SituationCard,
  SituationEffectId,
  Zone,
} from "../types/cards.js";
import type {
  BallOutcome,
  ResolutionStep,
} from "../types/game.js";

export interface ResolveBallInput {
  batsman: BatsmanCard;
  bowler: BowlerCard;
  /** Situation card the batting side played, or null. Old School cancellation must be applied UPSTREAM — pass null if it was cancelled. */
  battingSituation: SituationCard | null;
  bowlingSituation: SituationCard | null;
  /** Random source in [0, 1). Defaults to Math.random; tests pass a deterministic value. */
  random?: () => number;
}

export interface ResolutionResult {
  steps: ResolutionStep[];
  finalOutcome: BallOutcome;
  /** Free runs awarded on top of finalOutcome (No Ball / Wide). */
  extraRuns: number;
  /** Why extras were awarded, if any. */
  extrasNote: string | null;
  /** True if the delivery doesn't count against the over (No Ball / Wide). */
  rebowled: boolean;
}

export function resolveBall(input: ResolveBallInput): ResolutionResult {
  const random = input.random ?? Math.random;
  const steps: ResolutionStep[] = [];

  const battingSit = input.battingSituation?.id ?? null;
  const bowlingSit = input.bowlingSituation?.id ?? null;

  // ───── Step 3: zone modifiers ─────
  // (Steps 1 & 2 — Old School cancel + Mankad/Retired Out/Cramps swaps —
  //  happen upstream of this function; the inputs we receive are already final.)
  let lookupZone: Zone = input.bowler.delivery;
  if (bowlingSit === "day-5-pitch") {
    const before = lookupZone;
    lookupZone = { line: shiftLineAway(lookupZone.line), length: lookupZone.length };
    const changed = lookupZone.line !== before.line;
    steps.push({
      kind: "day-5-pitch",
      label: "Day 5 Pitch",
      detail: changed
        ? `Pitch deteriorating — bowler's line shifted from ${before.line} to ${lookupZone.line}.`
        : `Day 5 Pitch had no effect — line was already ${before.line} (clamped to off side).`,
      applied: changed,
    });
  }
  if (battingSit === "trot-down") {
    const before = lookupZone;
    lookupZone = { line: lookupZone.line, length: shiftLengthDown(lookupZone.length) };
    const changed = lookupZone.length !== before.length;
    steps.push({
      kind: "trot-down",
      label: "Trot Down",
      detail: changed
        ? `Batter charged down — ${before.length} length is met as ${lookupZone.length}.`
        : `Trot Down had no effect — delivery was already Full.`,
      applied: changed,
    });
  }

  // Switch Hit mirrors the BATTER'S card lookup, not the delivery.
  let lookupOnBatter: Zone = lookupZone;
  if (battingSit === "switch-hit") {
    lookupOnBatter = { line: mirrorLine(lookupZone.line), length: lookupZone.length };
    const changed = lookupOnBatter.line !== lookupZone.line;
    steps.push({
      kind: "switch-hit",
      label: "Switch Hit",
      detail: changed
        ? `Batter switched stance — ${lookupZone.line} is treated as ${lookupOnBatter.line} on the card.`
        : `Switch Hit had no effect — line was Middle stump (mirrors to itself).`,
      applied: changed,
    });
  }
  // Shuffle Across moves the batter toward the off side, so the bowler's
  // line is met one stump further leg-side on the batter's card. Inverse of
  // Day 5 Pitch. Clamps at Leg stump.
  if (battingSit === "shuffle-across") {
    const before = lookupOnBatter;
    lookupOnBatter = { line: shiftLineToward(lookupOnBatter.line, "leg"), length: lookupOnBatter.length };
    const changed = lookupOnBatter.line !== before.line;
    steps.push({
      kind: "shuffle-across",
      label: "Shuffle Across",
      detail: changed
        ? `Batter shuffled across — ${before.line} is met as ${lookupOnBatter.line} on the card.`
        : `Shuffle Across had no effect — line was already Leg stump (clamped).`,
      applied: changed,
    });
  }

  // ───── Step 4: base lookup ─────
  let outcome: BallOutcome = lookupOutcome(input.batsman, lookupOnBatter);
  steps.push({
    kind: "base-lookup",
    label: "Base lookup",
    detail: describeBaseLookup(input.bowler, lookupZone, input.batsman, outcome),
    after: outcome,
    applied: true,
  });

  // ───── Step 5: Invariable Bounce ─────
  if (bowlingSit === "invariable-bounce") {
    const before = outcome;
    outcome = downgrade(outcome);
    const changed = !sameOutcome(before, outcome);
    steps.push({
      kind: "invariable-bounce",
      label: "Invariable Bounce",
      detail: changed
        ? `Ball isn't coming on — ${describeChange(before, outcome)}.`
        : `Invariable Bounce had no effect — ${describeOutcome(before)} can't be downgraded.`,
      before,
      after: outcome,
      applied: changed,
    });
  }

  // ───── Step 6: bowler adjective ─────
  if (input.bowler.adjective) {
    const adj = input.bowler.adjective;
    const resistant = input.batsman.resistances.includes(adj);
    if (resistant) {
      steps.push({
        kind: "adjective",
        label: `${adjectiveLabel(adj)} adjective`,
        detail: `${input.batsman.name} is resistant to ${adj} — ${input.bowler.name}'s adjective has no effect.`,
        before: outcome,
        after: outcome,
        applied: false,
      });
    } else {
      const before = outcome;
      outcome = downgrade(outcome);
      const changed = !sameOutcome(before, outcome);
      steps.push({
        kind: "adjective",
        label: `${adjectiveLabel(adj)} adjective`,
        detail: changed
          ? `${input.bowler.name}'s ${adj} beats the bat — ${describeChange(before, outcome)}.`
          : `${input.bowler.name}'s ${adj} can't downgrade ${describeOutcome(before)}.`,
        before,
        after: outcome,
        applied: changed,
      });
    }
  }

  // ───── Step 7: fielding coverage ─────
  if (outcome.type === "runs" && input.bowler.fielding.length > 0) {
    const region = inferFieldingRegion(outcome.shot);
    if (region && input.bowler.fielding.includes(region)) {
      const before = outcome;
      outcome = downgrade(outcome);
      const changed = !sameOutcome(before, outcome);
      steps.push({
        kind: "fielding",
        label: `Fielding: ${region}`,
        detail: changed
          ? `${region} cuts off the ${before.type === "runs" ? before.shot : "shot"} — ${describeChange(before, outcome)}.`
          : `${region} is in position but couldn't bring the value down further.`,
        before,
        after: outcome,
        applied: changed,
      });
    }
  }

  // ───── Step 8: Power Surge ─────
  if (battingSit === "power-surge") {
    const before = outcome;
    if (outcome.type === "wicket") {
      steps.push({
        kind: "power-surge",
        label: "Power Surge",
        detail: "Power Surge upgrades runs but does not protect against weaknesses — wicket stands.",
        before,
        after: outcome,
        applied: false,
      });
    } else {
      outcome = upgrade(outcome);
      const changed = !sameOutcome(before, outcome);
      steps.push({
        kind: "power-surge",
        label: "Power Surge",
        detail: changed
          ? `Field is up — ${describeChange(before, outcome)}.`
          : `Power Surge played but the outcome was already at the cap.`,
        before,
        after: outcome,
        applied: changed,
      });
    }
  }

  // ───── Step 9: DRS Review ─────
  if (battingSit === "drs-review") {
    if (outcome.type === "wicket") {
      const before = outcome;
      outcome = { type: "dot" };
      steps.push({
        kind: "drs-review",
        label: "DRS Review",
        detail: `Not out on review — '${before.mode}' overturned to a dot ball.`,
        before,
        after: outcome,
        applied: true,
      });
    } else {
      steps.push({
        kind: "drs-review",
        label: "DRS Review",
        detail: `DRS Review only triggers on a wicket — outcome was ${describeOutcome(outcome)}, no effect.`,
        before: outcome,
        after: outcome,
        applied: false,
      });
    }
  }

  // ───── Step 10: Review Appeal ─────
  if (bowlingSit === "review-appeal") {
    if (outcome.type === "dot") {
      const roll = random();
      if (roll < REVIEW_APPEAL_WICKET_CHANCE) {
        const before = outcome;
        outcome = { type: "wicket", mode: "LBW on review" };
        steps.push({
          kind: "review-appeal",
          label: "Review Appeal",
          detail: `Howzat! Dot ball upgraded to LBW on the appeal (${Math.round(REVIEW_APPEAL_WICKET_CHANCE * 100)}% chance roll succeeded).`,
          before,
          after: outcome,
          applied: true,
        });
      } else {
        steps.push({
          kind: "review-appeal",
          label: "Review Appeal",
          detail: `Appeal turned down — ${Math.round(REVIEW_APPEAL_WICKET_CHANCE * 100)}% chance roll missed.`,
          before: outcome,
          after: outcome,
          applied: false,
        });
      }
    } else {
      steps.push({
        kind: "review-appeal",
        label: "Review Appeal",
        detail: `Review Appeal only triggers on dots — outcome was ${describeOutcome(outcome)}, no effect.`,
        before: outcome,
        after: outcome,
        applied: false,
      });
    }
  }

  // ───── Step 11: No Ball ─────
  // No-ball cancels any wicket on this delivery, awards 1 free run, and the
  // ball is re-bowled (doesn't count against the over).
  let extraRuns = 0;
  let extrasNote: string | null = null;
  let rebowled = false;
  if (battingSit === "no-ball") {
    if (outcome.type === "wicket") {
      const before = outcome;
      outcome = { type: "dot" };
      steps.push({
        kind: "no-ball",
        label: "No Ball",
        detail: `Foot fault! '${before.mode}' overturned to a dot ball, +1 run, ball is re-bowled.`,
        before,
        after: outcome,
        applied: true,
      });
    } else {
      steps.push({
        kind: "no-ball",
        label: "No Ball",
        detail: `Foot fault! +1 run, ball is re-bowled — ${describeOutcome(outcome)} stands.`,
        before: outcome,
        after: outcome,
        applied: true,
      });
    }
    extraRuns += EXTRAS_RUNS;
    extrasNote = "no-ball";
    rebowled = true;
  }

  // ───── Step 12: Wide outside off mechanic ─────
  // Tier-based chance the umpire calls a wide when the bowler bowls
  // Wide-outside-off and the outcome is a dot ball. Better bowlers are more
  // accurate. Wide adds 1 extra run and re-bowls.
  if (
    !rebowled &&
    input.bowler.delivery.line === "Wide outside off" &&
    outcome.type === "dot"
  ) {
    const chance = WIDE_CHANCE_BY_TIER[input.bowler.tier];
    const roll = random();
    if (roll < chance) {
      steps.push({
        kind: "wide",
        label: "Wide called",
        detail: `Wide outside off — umpire signals wide (${Math.round(chance * 100)}% chance for ${input.bowler.tier} tier). +1 run, ball re-bowled.`,
        before: outcome,
        after: outcome,
        applied: true,
      });
      extraRuns += EXTRAS_RUNS;
      extrasNote = "wide";
      rebowled = true;
    }
  }

  return { steps, finalOutcome: outcome, extraRuns, extrasNote, rebowled };
}

// ─────────────────────────── Helpers ───────────────────────────

function lookupOutcome(batsman: BatsmanCard, zone: Zone): BallOutcome {
  const all: Array<{ bucket: BatsmanOutcome[]; isWicket: boolean }> = [
    { bucket: batsman.strengths, isWicket: false },
    { bucket: batsman.neutrals, isWicket: false },
    { bucket: batsman.weaknesses, isWicket: true },
  ];
  for (const { bucket, isWicket } of all) {
    for (const o of bucket) {
      if (o.zone.line === zone.line && o.zone.length === zone.length) {
        if (isWicket) {
          if (o.outcome.type !== "wicket") {
            // Defensive — shouldn't happen given how the parser builds cards.
            return { type: "wicket", mode: "out" };
          }
          return { type: "wicket", mode: o.outcome.mode };
        }
        if (o.outcome.type !== "runs") {
          return { type: "dot" };
        }
        return { type: "runs", value: o.outcome.value, shot: o.outcome.shot };
      }
    }
  }
  return { type: "dot" };
}

const TIER_DOWN: Record<RunValue, RunValue> = {
  6: 4,
  4: 2,
  2: 1,
  1: 0,
  0: 0,
};

const TIER_UP: Record<RunValue, RunValue> = {
  0: 1,
  1: 2,
  2: 4,
  4: 6,
  6: 6,
};

function downgrade(o: BallOutcome): BallOutcome {
  if (o.type === "wicket") return o;
  if (o.type === "dot") return o;
  const next = TIER_DOWN[o.value as RunValue];
  if (next === 0) return { type: "dot" };
  return { type: "runs", value: next, shot: o.shot };
}

function upgrade(o: BallOutcome): BallOutcome {
  if (o.type === "wicket") return o;
  if (o.type === "dot") {
    return { type: "runs", value: 1, shot: "scrambled single" };
  }
  const next = TIER_UP[o.value as RunValue];
  return { type: "runs", value: next, shot: o.shot };
}

function sameOutcome(a: BallOutcome, b: BallOutcome): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "runs" && b.type === "runs") return a.value === b.value;
  if (a.type === "wicket" && b.type === "wicket") return a.mode === b.mode;
  return true;
}

function adjectiveLabel(a: Adjective): string {
  return a;
}

/** Human-readable form of an outcome for use in step.detail strings. */
function describeOutcome(o: BallOutcome): string {
  if (o.type === "runs") return `${o.shot} (${o.value})`;
  if (o.type === "wicket") return `wicket — ${o.mode}`;
  return "a dot ball";
}

/** "X (4) → X (2)" style narrative, with the shot text preserved. */
function describeChange(before: BallOutcome, after: BallOutcome): string {
  return `${describeOutcome(before)} becomes ${describeOutcome(after)}`;
}

const LINE_ORDER: Line[] = [
  "Leg stump",
  "Middle stump",
  "Off stump",
  "5th stump",
  "Wide outside off",
];

/** Day 5 Pitch shifts the line one step away from the batter's body (right-hander frame). */
function shiftLineAway(line: Line): Line {
  const idx = LINE_ORDER.indexOf(line);
  if (idx < 0) return line;
  return LINE_ORDER[Math.min(idx + 1, LINE_ORDER.length - 1)]!;
}

/** Trot Down compresses the length: Good length → Full, Short → Good length, Full → Full. */
function shiftLengthDown(length: Length): Length {
  if (length === "Short") return "Good length";
  if (length === "Good length") return "Full";
  return "Full";
}

/** Switch Hit mirrors the line on the batter's card. */
function mirrorLine(line: Line): Line {
  switch (line) {
    case "Off stump": return "Leg stump";
    case "Leg stump": return "Off stump";
    case "5th stump": return "Leg stump";
    case "Wide outside off": return "Leg stump";
    case "Middle stump": return "Middle stump";
  }
}

/**
 * Shifts a line one step toward leg side (or off side). Clamps at the end:
 * shifting Leg stump toward leg stays at Leg stump; shifting Wide outside
 * off toward off stays at Wide outside off. Used by Shuffle Across (toward
 * leg) and parallels Day 5 Pitch's shiftLineAway (toward off).
 */
function shiftLineToward(line: Line, direction: "leg" | "off"): Line {
  const idx = LINE_ORDER.indexOf(line);
  if (idx < 0) return line;
  const next = direction === "leg" ? Math.max(idx - 1, 0) : Math.min(idx + 1, LINE_ORDER.length - 1);
  return LINE_ORDER[next]!;
}

/**
 * Heuristic mapping of shot description → fielding region. Cards don't
 * currently carry an explicit region tag; we infer from the shot phrase.
 * Imprecise — many shots have no clean region match (lofts, slogs, scoops
 * that go over the field).
 */
function inferFieldingRegion(shotText: string): FieldingRegion | null {
  const s = shotText.toLowerCase();
  if (s.includes("cover drive") || /\bcover\b/.test(s)) return "Cover";
  if (s.includes("late cut")) return "Slip cordon";
  if (s.includes("edge") || s.includes("snick")) return "Slip cordon";
  if (s.includes("cut") || s.includes("square drive") || s.includes("slash"))
    return "Gully/Point";
  if (s.includes("on drive") || s.includes("on-drive") || s.includes("pull"))
    return "Mid-wicket";
  if (
    s.includes("flick behind") ||
    s.includes("leg glance") ||
    s.includes("scoop") ||
    s.includes("ramp") ||
    s.includes("hook")
  )
    return "Fine leg/Leg slip";
  if (s.includes("flick") || s.includes("sweep") || s.includes("slog") || s.includes("work"))
    return "Mid-wicket";
  return null;
}

function describeBaseLookup(
  bowler: BowlerCard,
  zone: Zone,
  batsman: BatsmanCard,
  outcome: BallOutcome,
): string {
  const where = `${zone.length} ${zone.line.toLowerCase()}`;
  if (outcome.type === "runs") {
    return `${bowler.name} bowls ${where} → ${batsman.name} ${outcome.shot} for ${outcome.value}.`;
  }
  if (outcome.type === "wicket") {
    return `${bowler.name} bowls ${where} → ${batsman.name} ${outcome.mode}.`;
  }
  return `${bowler.name} bowls ${where} → no scoring shot for ${batsman.name} (dot).`;
}

// Re-export the resistance check for the engine's siblings (e.g. tests).
export function _internal_isResistant(batsman: BatsmanCard, adj: Adjective): boolean {
  return batsman.resistances.includes(adj);
}

// Type-check enums vs effect IDs so refactors are caught.
type _AssertEffectIdsCovered = SituationEffectId;
const _: _AssertEffectIdsCovered[] = [
  "drs-review",
  "power-surge",
  "retired-out",
  "switch-hit",
  "trot-down",
  "mankad",
  "review-appeal",
  "cramps",
  "invariable-bounce",
  "day-5-pitch",
  "old-school-batting",
  "old-school-bowling",
];
void _;
