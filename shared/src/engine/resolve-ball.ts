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
  BATTER_IN_PHASE_UPGRADE_CHANCE,
  BATTER_OUT_OF_PHASE_DOT_CHANCE,
  BATTER_ROLE_TO_PHASE,
  BOWLER_IN_PHASE_WICKET_CHANCE,
  BOWLER_NEUTRAL_RUNOUT_CHANCE,
  BOWLER_OUT_OF_PHASE_WIDE_BUMP,
  BOWLER_ROLE_TO_PHASE,
  EXTRAS_RUNS,
  INSIDE_EDGE_CHANCE,
  MISFIELD_CHANCE,
  REVIEW_APPEAL_WICKET_CHANCE,
  WICKET_SAVE_2_BYE_CHANCE,
  WICKET_SAVE_4_BYE_CHANCE,
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
  /** Current match phase — drives in-phase / out-of-phase perks for the
   *  batter (role-vs-phase match) and bowler (role-vs-phase match).
   *  Optional for back-compat; if omitted, no phase-based perks fire. */
  phase?: "powerplay" | "middle" | "death";
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
  /** The zone actually looked up on the batsman's card (after Day 5 Pitch / Trot Down / Switch Hit / Shuffle Across). Used by the reveal UI to highlight only the row that fired. */
  lookupZone: import("../types/cards.js").Zone;
}

export function resolveBall(input: ResolveBallInput): ResolutionResult {
  const random = input.random ?? Math.random;
  const steps: ResolutionStep[] = [];

  const battingSit = input.battingSituation?.id ?? null;
  const bowlingSit = input.bowlingSituation?.id ?? null;

  // Track whether any auto-wide condition fires during zone modifiers — if so,
  // we short-circuit to a wide call instead of looking up the batsman card.
  // Cancellable by the bowling side's Biryani card.
  let pendingAutoWide:
    | { kind: "day-5-pitch" | "shuffle-across" | "deep-in-crease"; label: string; detail: string }
    | null = null;
  const biryaniInPlay = bowlingSit === "biryani";

  // ───── Step 3: zone modifiers ─────
  // (Steps 1 & 2 — Old School cancel + Mankad/Retired Out/Cramps swaps —
  //  happen upstream of this function; the inputs we receive are already final.)
  let lookupZone: Zone = input.bowler.delivery;
  if (bowlingSit === "day-5-pitch") {
    const before = lookupZone;
    if (before.line === "Outside off") {
      // Trying to shift further off — there's no line beyond Outside off.
      // Umpire calls a wide instead.
      pendingAutoWide = {
        kind: "day-5-pitch",
        label: "Day 5 Pitch wide",
        detail: `Day 5 Pitch tried to push the line further off, but ${before.line} is already the off-most line — umpire calls wide.`,
      };
      steps.push({
        kind: "day-5-pitch",
        label: "Day 5 Pitch",
        detail: `Pitch deteriorating — bowler tries to push further off but the line is already at the edge. Wide called.`,
        applied: true,
      });
    } else {
      lookupZone = { line: shiftLineAway(lookupZone.line), length: lookupZone.length };
      const changed = lookupZone.line !== before.line;
      steps.push({
        kind: "day-5-pitch",
        label: "Day 5 Pitch",
        detail: changed
          ? `Pitch deteriorating — bowler's line shifted from ${before.line} to ${lookupZone.line}.`
          : `Day 5 Pitch had no effect — line was already ${before.line}.`,
        applied: changed,
      });
    }
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
  // Deep in the Crease: inverse of Trot Down. Shifts length outward toward
  // the bowler. Short balls become auto-wides (the ball goes too high over
  // the batter who's stepped back).
  if (battingSit === "deep-in-crease") {
    const before = lookupZone;
    if (before.length === "Short") {
      // Already short — stepping back means it bounces higher than the
      // batter can reach. Auto-wide.
      pendingAutoWide = pendingAutoWide ?? {
        kind: "deep-in-crease",
        label: "Deep in the Crease wide",
        detail: `Batter stepped back on a short ball — too high to play, umpire calls wide.`,
      };
      steps.push({
        kind: "deep-in-crease",
        label: "Deep in the Crease",
        detail: `Batter steps back — short ball goes over the head, umpire calls wide.`,
        applied: true,
      });
    } else {
      lookupZone = { line: lookupZone.line, length: shiftLengthOut(lookupZone.length) };
      const changed = lookupZone.length !== before.length;
      steps.push({
        kind: "deep-in-crease",
        label: "Deep in the Crease",
        detail: changed
          ? `Batter steps back — ${before.length} length is met as ${lookupZone.length}.`
          : `Deep in the Crease had no effect — already at the limit.`,
        applied: changed,
      });
    }
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
  // Day 5 Pitch. Leg-stump deliveries become auto-wides (batter has shuffled
  // past the line).
  if (battingSit === "shuffle-across") {
    const before = lookupOnBatter;
    if (before.line === "Leg stump") {
      pendingAutoWide = pendingAutoWide ?? {
        kind: "shuffle-across",
        label: "Shuffle Across wide",
        detail: `Batter shuffled past a leg-stump delivery — umpire calls wide.`,
      };
      steps.push({
        kind: "shuffle-across",
        label: "Shuffle Across",
        detail: `Batter shuffled past leg stump — umpire calls wide.`,
        applied: true,
      });
    } else {
      lookupOnBatter = { line: shiftLineToward(lookupOnBatter.line, "leg"), length: lookupOnBatter.length };
      const changed = lookupOnBatter.line !== before.line;
      steps.push({
        kind: "shuffle-across",
        label: "Shuffle Across",
        detail: changed
          ? `Batter shuffled across — ${before.line} is met as ${lookupOnBatter.line} on the card.`
          : `Shuffle Across had no effect — line was already Leg stump.`,
        applied: changed,
      });
    }
  }

  // ───── Auto-wide short-circuit ─────
  // If any zone modifier triggered a wide, resolve to a wide call (or a
  // plain dot if Biryani cancels) and skip the rest of the chain.
  if (pendingAutoWide) {
    if (biryaniInPlay) {
      steps.push({
        kind: "biryani",
        label: "Biryani cancels wide",
        detail: `Third Umpire Distracted by Biryani — ${pendingAutoWide.label.toLowerCase()} is downgraded to a plain dot ball. No extras, ball counts.`,
        applied: true,
      });
      return {
        steps,
        finalOutcome: { type: "dot" },
        extraRuns: 0,
        extrasNote: null,
        rebowled: false,
        lookupZone: lookupOnBatter,
      };
    }
    steps.push({
      kind: "wide",
      label: pendingAutoWide.label,
      detail: pendingAutoWide.detail,
      applied: true,
    });
    return {
      steps,
      finalOutcome: { type: "dot" },
      extraRuns: EXTRAS_RUNS,
      extrasNote: "wide",
      rebowled: true,
      lookupZone: lookupOnBatter,
    };
  }

  // ───── Step 4: base lookup ─────
  let outcome: BallOutcome = lookupOutcome(input.batsman, lookupOnBatter);
  steps.push({
    kind: "base-lookup",
    label: "Base lookup",
    detail: describeBaseLookup(input.bowler, input.bowler.delivery, lookupOnBatter, input.batsman, outcome),
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

  // ───── Step 6: bowler adjective(s) ─────
  // Bowlers can carry 0, 1, or 2 adjectives. Only ONE downgrade fires per
  // ball — even when both un-resisted, only the first un-resisted adjective
  // applies its downgrade (no stacking). When the batter is resistant to
  // every adjective, we record a no-effect step per resisted adjective so
  // the breakdown shows what was blocked.
  if (input.bowler.adjectives.length > 0) {
    const resisted: Adjective[] = [];
    const unresisted: Adjective[] = [];
    for (const a of input.bowler.adjectives) {
      if (input.batsman.resistances.includes(a)) resisted.push(a);
      else unresisted.push(a);
    }
    if (unresisted.length > 0) {
      // Apply ONE downgrade — the first un-resisted adjective fires.
      const firing = unresisted[0]!;
      const before = outcome;
      outcome = downgrade(outcome);
      const changed = !sameOutcome(before, outcome);
      steps.push({
        kind: "adjective",
        label: `${adjectiveLabel(firing)} adjective`,
        detail: changed
          ? `${input.bowler.name}'s ${firing} beats the bat — ${describeChange(before, outcome)}.`
          : `${input.bowler.name}'s ${firing} can't downgrade ${describeOutcome(before)}.`,
        before,
        after: outcome,
        applied: changed,
      });
      // Record any other adjectives the bowler had — un-resisted but blocked
      // by the no-stack rule, OR resisted.
      for (let i = 1; i < unresisted.length; i++) {
        const blocked = unresisted[i]!;
        steps.push({
          kind: "adjective",
          label: `${adjectiveLabel(blocked)} adjective`,
          detail: `${blocked} would also fire, but only one adjective downgrade applies per ball — no stacking.`,
          before: outcome,
          after: outcome,
          applied: false,
        });
      }
      for (const r of resisted) {
        steps.push({
          kind: "adjective",
          label: `${adjectiveLabel(r)} adjective`,
          detail: `${input.batsman.name} is resistant to ${r} — that adjective has no effect.`,
          before: outcome,
          after: outcome,
          applied: false,
        });
      }
    } else {
      // All adjectives resisted — record each as a blocked step.
      for (const r of resisted) {
        steps.push({
          kind: "adjective",
          label: `${adjectiveLabel(r)} adjective`,
          detail: `${input.batsman.name} is resistant to ${r} — ${input.bowler.name}'s adjective has no effect.`,
          before: outcome,
          after: outcome,
          applied: false,
        });
      }
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
        outcome = { type: "wicket", mode: "LBW on review", dismissalCategory: "lbw" };
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
  // ball is re-bowled (doesn't count against the over). Cancellable by
  // Biryani, in which case the No Ball does nothing.
  let extraRuns = 0;
  let extrasNote: string | null = null;
  let rebowled = false;
  if (battingSit === "no-ball") {
    if (biryaniInPlay) {
      steps.push({
        kind: "biryani",
        label: "Biryani cancels No Ball",
        detail: `Third Umpire Distracted by Biryani — the No Ball is treated as a legal delivery. ${describeOutcome(outcome)} stands, no extras, ball counts.`,
        applied: true,
      });
    } else {
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
  }

  // ───── Step 12: Wide-call mechanic ─────
  // Two paths:
  //   (a) Outside-off — tier-based wide chance (existing behavior). When the
  //       bowler is OUT of phase (role-vs-current-phase mismatch), bump the
  //       chance by +20%.
  //   (b) Leg stump — no base wide chance, but +20% when the bowler is OOP.
  // Both paths are cancellable by Biryani.
  const bowlerPhase = input.bowler.role
    ? BOWLER_ROLE_TO_PHASE[input.bowler.role]
    : null;
  const bowlerOutOfPhase =
    !!input.phase && !!bowlerPhase && input.phase !== bowlerPhase;

  if (!rebowled && outcome.type === "dot") {
    const line = input.bowler.delivery.line;
    let chance = 0;
    if (line === "Outside off") {
      // Base tier-based wide chance always applies; OOP bump only when
      // perks are enabled (i.e. phase was provided to the engine).
      chance = WIDE_CHANCE_BY_TIER[input.bowler.tier];
      if (input.phase !== undefined && bowlerOutOfPhase) {
        chance += BOWLER_OUT_OF_PHASE_WIDE_BUMP;
      }
    } else if (
      input.phase !== undefined &&
      line === "Leg stump" &&
      bowlerOutOfPhase
    ) {
      chance = BOWLER_OUT_OF_PHASE_WIDE_BUMP;
    }
    if (chance > 0 && random() < chance) {
      if (biryaniInPlay) {
        steps.push({
          kind: "biryani",
          label: "Biryani cancels wide",
          detail: `Third Umpire Distracted by Biryani — wide call (${Math.round(chance * 100)}% chance) downgraded to a plain dot ball.`,
          applied: true,
        });
      } else {
        const reason =
          line === "Leg stump"
            ? `Down the leg side — umpire signals wide. Bowler is out of phase (+${Math.round(BOWLER_OUT_OF_PHASE_WIDE_BUMP * 100)}%).`
            : bowlerOutOfPhase
              ? `Outside off — wide called (${Math.round(chance * 100)}% inc. out-of-phase bump). +1 run, ball re-bowled.`
              : `Outside off — wide called (${Math.round(chance * 100)}% for ${input.bowler.tier} tier). +1 run, ball re-bowled.`;
        steps.push({
          kind: "wide",
          label: "Wide called",
          detail: reason,
          before: outcome,
          after: outcome,
          applied: true,
        });
        extraRuns += EXTRAS_RUNS;
        extrasNote = "wide";
        rebowled = true;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Steps 13+ : Role / phase perks. Gated entirely by `phase` being
  // provided — tests/callers that don't opt in get the legacy
  // deterministic behavior (no random byes, no random run-outs).
  // All also skipped when rebowled (no-ball or wide already
  // short-circuited the delivery).
  // ─────────────────────────────────────────────────────────────────
  const perksEnabled = input.phase !== undefined;
  const batterPhase = input.batsman.role
    ? BATTER_ROLE_TO_PHASE[input.batsman.role]
    : null;
  const batterInPhase =
    !!input.phase && !!batterPhase && input.phase === batterPhase;
  const batterOutOfPhase =
    !!input.phase && !!batterPhase && input.phase !== batterPhase;
  const bowlerInPhase =
    !!input.phase && !!bowlerPhase && input.phase === bowlerPhase;

  // ───── Step 13: Batter in-phase upgrade ─────
  // 10% chance a scoring shot ticks up one tier. Rewards playing the
  // right batter in the right phase.
  if (
    !rebowled &&
    batterInPhase &&
    outcome.type === "runs" &&
    random() < BATTER_IN_PHASE_UPGRADE_CHANCE
  ) {
    const before = outcome;
    outcome = upgrade(outcome);
    steps.push({
      kind: "in-phase-bonus",
      label: "In-phase bonus",
      detail: `${input.batsman.name} is a ${input.batsman.role} in the ${input.phase} — extra timing! ${describeChange(before, outcome)}.`,
      before,
      after: outcome,
      applied: !sameOutcome(before, outcome),
    });
  }

  // ───── Step 14: Batter out-of-phase dot ─────
  // 25% chance a scoring shot fizzles to a dot when the batter is in
  // the wrong phase. Mirrors Step 13's bonus.
  if (
    !rebowled &&
    batterOutOfPhase &&
    outcome.type === "runs" &&
    random() < BATTER_OUT_OF_PHASE_DOT_CHANCE
  ) {
    const before = outcome;
    outcome = { type: "dot" };
    steps.push({
      kind: "out-of-phase-dot",
      label: "Out of phase",
      detail: `${input.batsman.name} (${input.batsman.role}) isn't built for the ${input.phase} — shot didn't connect cleanly. Dot ball.`,
      before,
      after: outcome,
      applied: true,
    });
  }

  // ───── Step 15: Misfield (4 ↔ 6 swap) ─────
  if (
    perksEnabled &&
    !rebowled &&
    outcome.type === "runs" &&
    (outcome.value === 4 || outcome.value === 6) &&
    random() < MISFIELD_CHANCE
  ) {
    const before = outcome;
    const flipped = outcome.value === 4 ? 6 : 4;
    outcome = {
      type: "runs",
      value: flipped,
      shot: outcome.shot,
      shotCategory: outcome.shotCategory,
    };
    steps.push({
      kind: "misfield",
      label: "Misfield",
      detail:
        flipped === 6
          ? `Fielder fumbles on the rope — boundary becomes a six!`
          : `Acrobatic save on the rope — six is pulled back to a four.`,
      before,
      after: outcome,
      applied: true,
    });
  }

  // ───── Step 16: Run-out on a neutral ─────
  // 10% chance a 1 or 2 runs becomes a wicket. Bowler perk.
  if (
    perksEnabled &&
    !rebowled &&
    outcome.type === "runs" &&
    (outcome.value === 1 || outcome.value === 2) &&
    random() < BOWLER_NEUTRAL_RUNOUT_CHANCE
  ) {
    const before = outcome;
    outcome = {
      type: "wicket",
      mode: "run out at the non-striker's end",
      dismissalCategory: "runout",
    };
    steps.push({
      kind: "run-out",
      label: "Run out",
      detail: `Direct hit going for the ${before.type === "runs" ? before.value : "?"}! ${input.batsman.name} caught short of the crease.`,
      before,
      after: outcome,
      applied: true,
    });
  }

  // ───── Step 17: Inside edge (bowled wicket only) ─────
  // 5% chance a bowled-mode wicket trickles past the stumps off the
  // inside edge for 1-4 runs. Different escape from the bye system —
  // these are bat runs, not extras.
  if (
    perksEnabled &&
    !rebowled &&
    outcome.type === "wicket" &&
    outcome.dismissalCategory === "bowled" &&
    random() < INSIDE_EDGE_CHANCE
  ) {
    const before = outcome;
    // Cricket-believable: usually 1 or 2 runs, occasionally 4 to fine leg.
    const r = random();
    const value: RunValue = r < 0.5 ? 1 : r < 0.85 ? 2 : 4;
    outcome = {
      type: "runs",
      value,
      shot: "inside edge past the stumps",
      shotCategory: "mistime",
    };
    steps.push({
      kind: "inside-edge",
      label: "Inside edge",
      detail: `Ball clipped the inside edge and skimmed past the stumps — ${value} run${value === 1 ? "" : "s"} instead of bowled.`,
      before,
      after: outcome,
      applied: true,
    });
  }

  // ───── Step 18: Wicket save (byes / leg-byes) ─────
  // Any wicket has a chance to become 2 or 4 byes/leg-byes with a
  // dismissal-typed reason ("LBW down leg side", "edge fell short",
  // "bails didn't dislodge", etc.). The two buckets are mutually
  // exclusive — single roll picks one of three outcomes.
  if (perksEnabled && !rebowled && outcome.type === "wicket") {
    const roll = random();
    const saveTotal = WICKET_SAVE_2_BYE_CHANCE + WICKET_SAVE_4_BYE_CHANCE;
    if (roll < saveTotal) {
      const is4 = roll >= WICKET_SAVE_2_BYE_CHANCE;
      const byes = is4 ? 4 : 2;
      const before = outcome;
      const { kind: byeKind, narrative } = wicketSaveNarrative(before.dismissalCategory, byes);
      outcome = { type: "dot" };
      extraRuns += byes;
      extrasNote = byeKind; // "byes" | "leg-byes"
      steps.push({
        kind: "wicket-save",
        label: `Saved → ${byes} ${byeKind === "leg-byes" ? "leg byes" : "byes"}`,
        detail: narrative,
        before,
        after: outcome,
        applied: true,
      });
    }
  }

  // ───── Step 19: Bowler in-phase wicket (dot → wicket) ─────
  // 10% chance a dot ball becomes a wicket when the bowler is in the
  // right phase. Yorker / new-ball nip / death-overs slower-ball.
  // Runs LAST so this wicket is NOT undone by wicket-save.
  if (
    !rebowled &&
    bowlerInPhase &&
    outcome.type === "dot" &&
    random() < BOWLER_IN_PHASE_WICKET_CHANCE
  ) {
    const before = outcome;
    const phaseDismissal: { mode: string; dismissalCategory: "bowled" | "lbw" | "caught-keeper" } =
      input.phase === "powerplay"
        ? { mode: "nicked behind — new-ball nip", dismissalCategory: "caught-keeper" }
        : input.phase === "death"
          ? { mode: "yorker through the gate", dismissalCategory: "bowled" }
          : { mode: "trapped LBW", dismissalCategory: "lbw" };
    outcome = {
      type: "wicket",
      mode: phaseDismissal.mode,
      dismissalCategory: phaseDismissal.dismissalCategory,
    };
    // Clear any "byes" extras that accumulated from a prior wicket-save
    // (shouldn't happen — we're transitioning dot → wicket, not the
    // other direction — but defensive).
    steps.push({
      kind: "bowler-in-phase-wicket",
      label: "Phase wicket",
      detail: `${input.bowler.name} is a ${input.bowler.role} in the ${input.phase} — they find the breakthrough. ${phaseDismissal.mode}!`,
      before,
      after: outcome,
      applied: true,
    });
  }

  return {
    steps,
    finalOutcome: outcome,
    extraRuns,
    extrasNote,
    rebowled,
    lookupZone: lookupOnBatter,
  };
}

/**
 * Build a believable "the wicket didn't actually happen" narrative based on
 * the dismissal that almost was. Returns "byes" vs "leg-byes" as the
 * extras-note key (used by the scoring + UI).
 */
function wicketSaveNarrative(
  category:
    | "bowled"
    | "lbw"
    | "caught-keeper"
    | "caught-slip"
    | "caught-cover"
    | "caught-midwicket"
    | "caught-point"
    | "caught-deep"
    | "caught-and-bowled"
    | "stumped"
    | "runout",
  byes: number,
): { kind: "byes" | "leg-byes"; narrative: string } {
  switch (category) {
    case "lbw":
      return {
        kind: "leg-byes",
        narrative: `Ball was sliding down leg — umpire turns down the appeal. Batters scramble ${byes} leg byes.`,
      };
    case "bowled":
      return {
        kind: "byes",
        narrative: `Ball skimmed the stumps — bails refused to come off! Batters jog through for ${byes}.`,
      };
    case "caught-keeper":
      return {
        kind: "byes",
        narrative: `Keeper got fingers to it but couldn't hold — ${byes} byes through the gloves.`,
      };
    case "caught-slip":
      return {
        kind: "byes",
        narrative: `Dropped at slip! Edge dies on the grass — batters take ${byes}.`,
      };
    case "caught-cover":
    case "caught-point":
    case "caught-midwicket":
    case "caught-deep":
      return {
        kind: "byes",
        narrative: `Fielder grasses the catch — ${byes} taken while the ball is misfielded.`,
      };
    case "caught-and-bowled":
      return {
        kind: "byes",
        narrative: `Bowler reached for the return catch and palmed it down — ${byes} taken in the confusion.`,
      };
    case "stumped":
      return {
        kind: "byes",
        narrative: `Keeper fumbled the stumping! Batter back in their crease, ${byes} byes.`,
      };
    case "runout":
      return {
        kind: "byes",
        narrative: `Throw missed the stumps — ${byes} overthrows for free.`,
      };
  }
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
            return { type: "wicket", mode: "out", dismissalCategory: "caught-deep" };
          }
          return {
            type: "wicket",
            mode: o.outcome.mode,
            dismissalCategory: o.outcome.dismissalCategory,
          };
        }
        if (o.outcome.type !== "runs") {
          return { type: "dot" };
        }
        return {
          type: "runs",
          value: o.outcome.value,
          shot: o.outcome.shot,
          shotCategory: o.outcome.shotCategory,
        };
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
  // Same shot, just timed worse — preserve the category.
  return { type: "runs", value: next, shot: o.shot, shotCategory: o.shotCategory };
}

function upgrade(o: BallOutcome): BallOutcome {
  if (o.type === "wicket") return o;
  if (o.type === "dot") {
    return {
      type: "runs",
      value: 1,
      shot: "scrambled single",
      shotCategory: "defend",  // a scrambled single is a defensive nudge
    };
  }
  const next = TIER_UP[o.value as RunValue];
  return { type: "runs", value: next, shot: o.shot, shotCategory: o.shotCategory };
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
  "Outside off",
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

/**
 * Deep in the Crease lengthens the effective length: Full → Good length,
 * Good length → Short. Short would cap, but the engine handles "Short →
 * auto-wide" upstream — this helper only sees Full or Good length.
 */
function shiftLengthOut(length: Length): Length {
  if (length === "Full") return "Good length";
  if (length === "Good length") return "Short";
  return "Short";
}

/** Switch Hit mirrors the line on the batter's card. Outside off mirrors to Leg. */
function mirrorLine(line: Line): Line {
  switch (line) {
    case "Off stump": return "Leg stump";
    case "Leg stump": return "Off stump";
    case "Outside off": return "Leg stump";
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
  delivery: Zone,
  effective: Zone,
  batsman: BatsmanCard,
  outcome: BallOutcome,
): string {
  const fmt = (z: Zone) => `${z.length} ${z.line.toLowerCase()}`;
  const same = delivery.line === effective.line && delivery.length === effective.length;
  // When zone modifiers shifted the lookup, spell out the chain so the
  // player understands why a delivery on Off stump may have been looked
  // up at Middle stump on the batter's card.
  const prefix = same
    ? `${bowler.name} bowls ${fmt(delivery)}`
    : `${bowler.name} bowls ${fmt(delivery)}, looked up as ${fmt(effective)} on ${batsman.name}'s card after modifiers`;
  if (outcome.type === "runs") {
    return `${prefix} → ${batsman.name} ${outcome.shot} for ${outcome.value}.`;
  }
  if (outcome.type === "wicket") {
    return `${prefix} → ${batsman.name} ${outcome.mode}.`;
  }
  return `${prefix} → no scoring shot on ${batsman.name}'s card here, dot ball.`;
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
  "no-ball",
  "shuffle-across",
  "deep-in-crease",
  "mankad",
  "review-appeal",
  "cramps",
  "invariable-bounce",
  "day-5-pitch",
  "biryani",
  "old-school-batting",
  "old-school-bowling",
];
void _;
