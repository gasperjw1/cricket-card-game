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

import { REVIEW_APPEAL_WICKET_CHANCE } from "../constants.js";
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
    steps.push({
      kind: "day-5-pitch",
      label: "Day 5 Pitch",
      detail: `Line shifted from ${before.line} to ${lookupZone.line}.`,
      applied: lookupZone.line !== before.line,
    });
  }
  if (battingSit === "trot-down") {
    const before = lookupZone;
    lookupZone = { line: lookupZone.line, length: shiftLengthDown(lookupZone.length) };
    steps.push({
      kind: "trot-down",
      label: "Trot Down",
      detail: `Batter charges down — length shifts from ${before.length} to ${lookupZone.length}.`,
      applied: lookupZone.length !== before.length,
    });
  }

  // Switch Hit mirrors the BATTER'S card lookup, not the delivery.
  let lookupOnBatter: Zone = lookupZone;
  if (battingSit === "switch-hit") {
    lookupOnBatter = { line: mirrorLine(lookupZone.line), length: lookupZone.length };
    steps.push({
      kind: "switch-hit",
      label: "Switch Hit",
      detail: `Batter mirrors stance: looking up ${lookupOnBatter.line} on the card instead of ${lookupZone.line}.`,
      applied: lookupOnBatter.line !== lookupZone.line,
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
    steps.push({
      kind: "invariable-bounce",
      label: "Invariable Bounce",
      detail: "Pitch is misbehaving — outcome downgraded one tier.",
      before,
      after: outcome,
      applied: !sameOutcome(before, outcome),
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
        detail: `${input.batsman.name} is resistant to ${adj} — no downgrade.`,
        before: outcome,
        after: outcome,
        applied: false,
      });
    } else {
      const before = outcome;
      outcome = downgrade(outcome);
      steps.push({
        kind: "adjective",
        label: `${adjectiveLabel(adj)} adjective`,
        detail: `${input.bowler.name}'s ${adj} downgrades the outcome one tier.`,
        before,
        after: outcome,
        applied: !sameOutcome(before, outcome),
      });
    }
  }

  // ───── Step 7: fielding coverage ─────
  if (outcome.type === "runs" && input.bowler.fielding.length > 0) {
    const region = inferFieldingRegion(outcome.shot);
    if (region && input.bowler.fielding.includes(region)) {
      const before = outcome;
      outcome = downgrade(outcome);
      steps.push({
        kind: "fielding",
        label: `Fielding: ${region}`,
        detail: `Shot is covered by ${region} — downgraded one tier.`,
        before,
        after: outcome,
        applied: !sameOutcome(before, outcome),
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
      steps.push({
        kind: "power-surge",
        label: "Power Surge",
        detail: "Field is up — outcome upgraded one tier.",
        before,
        after: outcome,
        applied: !sameOutcome(before, outcome),
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
        detail: `Not out on review — ${before.mode} overturned to dot ball.`,
        before,
        after: outcome,
        applied: true,
      });
    } else {
      steps.push({
        kind: "drs-review",
        label: "DRS Review",
        detail: "DRS only triggers on a wicket — no effect here.",
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
          detail: `Howzat! Dot ball upgraded to wicket on appeal (${Math.round(REVIEW_APPEAL_WICKET_CHANCE * 100)}% chance).`,
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
        detail: "Review Appeal only triggers on a dot ball — no effect here.",
        before: outcome,
        after: outcome,
        applied: false,
      });
    }
  }

  return { steps, finalOutcome: outcome };
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
