/**
 * Pure ball resolution engine.
 *
 * Given the post-swap, post-cancellation cards both players played, plus a
 * deterministic-or-random hook for Review Appeal, computes the final outcome
 * and a step-by-step breakdown the UI can use to animate the result.
 *
 * Resolution tree (in order):
 *
 *   UPSTREAM (before this function):
 *     Old School cancel · Mankad / Retired Out / Cramps swaps
 *
 *   ZONE MODIFIERS (Step 3):
 *     Day 5 Pitch · Trot Down · Deep in Crease · Switch Hit · Shuffle Across
 *     → auto-wide? Biryani → dot | else → wide (+1, rebowl)
 *
 *   BASE LOOKUP (Step 4) → RUNS / WICKET / DOT branch
 *
 *   RUNS branch:
 *     Invariable Bounce → Adjectives → Fielding → Power Surge
 *     → Batter in-phase upgrade → Batter out-of-phase dot (terminal)
 *     → Run-out on 1/2 (runs scored + wicket flag, terminal)
 *     [0-run downgrades feed DOT branch]
 *
 *   DOT branch:
 *     Bowler in-phase wicket (10%) → feeds WICKET branch
 *     DRS + Review Appeal mutual cancel (if both played, neither fires)
 *     Review Appeal (40%) → feeds WICKET branch
 *     Wide call (Biryani → dot | else → wide +1, rebowl)
 *
 *   WICKET branch (receives: base lookup, bowler in-phase, Review Appeal):
 *     DRS Review → protected dot (terminal) [or mutual cancel]
 *     No Ball → dot +1, rebowl (terminal) [Biryani cancels No Ball]
 *     Lucky escape (20%, batter in-phase ONLY — OOP batters get no escape):
 *       bowled     → bails stay on → 2 byes (length-aware narrative)
 *       lbw        → not out → 2 leg byes (delivery-line-aware narrative)
 *       caught-*   → dropped catch → 1/2/4 bat runs (position-specific)
 *       stumped    → inside edge → 2 bat runs
 *     else → match wicket
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
  LUCKY_ESCAPE_CHANCE,
  REVIEW_APPEAL_WICKET_CHANCE,
  WIDE_CHANCE_BY_TIER,
} from "../constants.js";
import type {
  Adjective,
  BatsmanCard,
  BatsmanOutcome,
  BowlerCard,
  DismissalCategory,
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
  /** Free runs awarded on top of finalOutcome (No Ball / Wide / byes). */
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
  if (battingSit === "deep-in-crease") {
    const before = lookupZone;
    if (before.length === "Short") {
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
  if (input.bowler.adjectives.length > 0) {
    const resisted: Adjective[] = [];
    const unresisted: Adjective[] = [];
    for (const a of input.bowler.adjectives) {
      if (input.batsman.resistances.includes(a)) resisted.push(a);
      else unresisted.push(a);
    }
    if (unresisted.length > 0) {
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

  // ─────────────────────────────────────────────────────────────────
  // Phase variables — declared here so they're available for the bowler
  // in-phase step (which fires right after Power Surge), the wide-call
  // mechanic, and batter perks later.
  // ─────────────────────────────────────────────────────────────────
  const perksEnabled = input.phase !== undefined;
  const batterPhase = input.batsman.role
    ? BATTER_ROLE_TO_PHASE[input.batsman.role]
    : null;
  const batterInPhase =
    !!input.phase && !!batterPhase && input.phase === batterPhase;
  const batterOutOfPhase =
    !!input.phase && !!batterPhase && input.phase !== batterPhase;
  const bowlerPhase = input.bowler.role
    ? BOWLER_ROLE_TO_PHASE[input.bowler.role]
    : null;
  const bowlerOutOfPhase =
    !!input.phase && !!bowlerPhase && input.phase !== bowlerPhase;
  const bowlerInPhase =
    !!input.phase && !!bowlerPhase && input.phase === bowlerPhase;

  // Declare delivery-level tracking vars early so all subsequent steps can
  // read/write them. rebowled gates phase perks; extraRuns / extrasNote
  // accumulate across No Ball, Wide, and lucky escape.
  let extraRuns = 0;
  let extrasNote: string | null = null;
  let rebowled = false;

  // ───── Bowler in-phase wicket [MOVED: fires right after Power Surge] ─────
  // Now fires early so DRS Review, No Ball, and the lucky escape can all
  // interact with the resulting wicket. Previously ran last (Step 19)
  // which made it immune to all subsequent protections.
  //
  // The dot→wicket transition only fires before DRS has had a chance to
  // run, so there is no DRS-protected-dot concern here — the ordering
  // itself ensures that a DRS-saved dot cannot be re-hit by this step.
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
    steps.push({
      kind: "bowler-in-phase-wicket",
      label: "Phase wicket",
      detail: `${input.bowler.name} is a ${input.bowler.role} in the ${input.phase} — they find the breakthrough. ${phaseDismissal.mode}!`,
      before,
      after: outcome,
      applied: true,
    });
  }

  // ───── DRS Review + Review Appeal mutual cancel ─────
  // If the batting side plays DRS Review AND the bowling side plays Review
  // Appeal on the same ball, the two situation cards cancel each other:
  // neither the wicket-save (DRS) nor the dot-to-wicket appeal (RA) fires.
  // The base outcome passes through unaffected.
  const bothDrsAndRa = battingSit === "drs-review" && bowlingSit === "review-appeal";
  if (bothDrsAndRa) {
    steps.push({
      kind: "drs-review",
      label: "DRS Review",
      detail: `DRS Review and Review Appeal played simultaneously — they cancel each other out. Neither fires.`,
      before: outcome,
      after: outcome,
      applied: false,
    });
    steps.push({
      kind: "review-appeal",
      label: "Review Appeal",
      detail: `Review Appeal and DRS Review played simultaneously — they cancel each other out. Neither fires.`,
      before: outcome,
      after: outcome,
      applied: false,
    });
  }

  // ───── Step 9: DRS Review ─────
  if (!bothDrsAndRa && battingSit === "drs-review") {
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
  if (!bothDrsAndRa && bowlingSit === "review-appeal") {
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
  if (!rebowled && outcome.type === "dot") {
    const line = input.bowler.delivery.line;
    let chance = 0;
    if (line === "Outside off") {
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
  // Steps 13+ : Batter / bowler phase perks. All gated by perksEnabled
  // (phase provided) and !rebowled (no-ball or wide already resolved).
  // ─────────────────────────────────────────────────────────────────

  // ───── Step 13: Batter in-phase upgrade ─────
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

  // ───── Step 15: Run-out on a neutral ─────
  // Bowler perk: 10% chance a 1 or 2 becomes a run-out. Unlike most wickets,
  // a run-out still credits the runs already scored (the batter was caught
  // short while attempting the run). The runOut flag tells the innings handler
  // to decrement a wicket while also crediting the run value.
  //
  // A batter IN their preferred phase reads the game better and calls runs
  // more safely — they are immune to this perk. Only OOP batters are exposed.
  if (
    perksEnabled &&
    !rebowled &&
    !batterInPhase &&
    outcome.type === "runs" &&
    (outcome.value === 1 || outcome.value === 2) &&
    random() < BOWLER_NEUTRAL_RUNOUT_CHANCE
  ) {
    const before = outcome;
    outcome = {
      type: "runs",
      value: outcome.value,
      shot: outcome.shot,
      shotCategory: outcome.shotCategory,
      runOut: true,
    };
    steps.push({
      kind: "run-out",
      label: "Run out",
      detail: `Direct hit at the non-striker's end going for the ${before.type === "runs" ? before.value : "?"}! ${input.batsman.name} short of the crease — run out. Runs scored, wicket falls.`,
      before,
      after: outcome,
      applied: true,
    });
  }

  // ───── Step 16: Lucky escape ─────
  // A single probability roll determines whether a non-run-out wicket
  // escapes dismissal. What the escape looks like depends entirely on
  // the dismissal category — see buildLuckyEscape() below.
  //
  // Situation cards (DRS Review, No Ball) have already resolved above, so
  // this step only sees wickets that survived those layers.
  //
  // PHASE GATE: escape only fires when the batter is IN their preferred
  // phase (e.g. top-order in powerplay). Playing an OOP batter forfeits
  // all escape protection — wickets stick immediately. This makes
  // role-vs-phase matching the primary skill expression in the system.
  if (
    perksEnabled &&
    !rebowled &&
    batterInPhase &&
    outcome.type === "wicket" &&
    outcome.dismissalCategory !== "runout" &&
    random() < LUCKY_ESCAPE_CHANCE
  ) {
    const before = outcome;
    const escape = buildLuckyEscape(
      outcome.dismissalCategory,
      input.bowler.delivery, // original delivery, not modified zone (LBW law uses where ball pitched)
    );
    if (escape.outputType === "extras") {
      outcome = { type: "dot" };
      extraRuns += escape.runs;
      extrasNote = escape.extrasNote;
    } else {
      outcome = {
        type: "runs",
        value: escape.runs,
        shot: escape.shot,
        shotCategory: "mistime",
      };
    }
    steps.push({
      kind: "lucky-escape",
      label: escape.label,
      detail: escape.detail,
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

// ─────────────────────────── Lucky escape builder ───────────────────────────

interface LuckyEscapeExtras {
  outputType: "extras";
  runs: number;
  extrasNote: "byes" | "leg-byes";
  label: string;
  detail: string;
}
interface LuckyEscapeBatRuns {
  outputType: "bat-runs";
  runs: RunValue;
  shot: string;
  label: string;
  detail: string;
}
type LuckyEscapeResult = LuckyEscapeExtras | LuckyEscapeBatRuns;

/**
 * Build the narrative and outcome for a lucky escape, driven by dismissal type.
 *
 *   bowled    → bails don't fall → 2 byes (length-aware)
 *   lbw       → not out → 2 leg byes (delivery-line-aware)
 *   stumped   → inside edge, keeper stranded → 2 bat runs
 *   caught-*  → dropped catch → 1/2/4 bat runs (per fielding position)
 *
 * Uses the original bowler delivery (pre-modifier) for LBW and bowled
 * narratives — LBW law and stumping geometry reference where the ball
 * actually pitched, not where the batter stood.
 */
function buildLuckyEscape(
  category: DismissalCategory,
  delivery: Zone,
): LuckyEscapeResult {
  switch (category) {
    case "bowled":
      return {
        outputType: "extras",
        runs: 2,
        extrasNote: "byes",
        label: "Bails stay on",
        detail: luckyEscapeBowledDetail(delivery.length),
      };

    case "lbw":
      return {
        outputType: "extras",
        runs: 2,
        extrasNote: "leg-byes",
        label: "Not out — LBW turned down",
        detail: luckyEscapeLbwDetail(delivery.line),
      };

    case "stumped":
      return {
        outputType: "bat-runs",
        runs: 2,
        shot: "inside edge races to fine leg",
        label: "Inside edge — stumping missed",
        detail: `Stepped out of the crease, but the inside edge sent the ball racing to fine leg — keeper stranded, couldn't gather. Batters run 2.`,
      };

    case "caught-keeper":
      return {
        outputType: "bat-runs",
        runs: 2,
        shot: "gloved to fine leg",
        label: "Dropped by keeper",
        detail: `Edged — keeper gets fingers to it but can't hold on. Ball squirts to fine leg, batters steal 2.`,
      };

    case "caught-slip":
      return {
        outputType: "bat-runs",
        runs: 2,
        shot: "edge races to third man",
        label: "Grassed at slip",
        detail: `Thick edge to slip — grassed! Ball races to third man, they come back for 2.`,
      };

    case "caught-cover":
      return {
        outputType: "bat-runs",
        runs: 2,
        shot: "mishit runs on",
        label: "Dropped at cover",
        detail: `Mishit to cover who shells it — ball runs on, 2 taken.`,
      };

    case "caught-point":
      return {
        outputType: "bat-runs",
        runs: 2,
        shot: "skied to point",
        label: "Dropped at point",
        detail: `Skied to point, sun in the eyes — dropped! Batters scramble 2.`,
      };

    case "caught-midwicket":
      return {
        outputType: "bat-runs",
        runs: 1,
        shot: "top edge to midwicket",
        label: "Fumbled at midwicket",
        detail: `Top edge to midwicket who fumbles — 1 taken in the confusion.`,
      };

    case "caught-deep":
      return {
        outputType: "bat-runs",
        runs: 4,
        shot: "boundary off the drop",
        label: "Dropped on the rope",
        detail: `Hit long — fielder on the rope can't hold, ball goes for 4.`,
      };

    case "caught-and-bowled":
      return {
        outputType: "bat-runs",
        runs: 1,
        shot: "palmed down off the return catch",
        label: "C&B shelled",
        detail: `Bowler got a hand to the return catch but palmed it down — batters scramble 1.`,
      };

    case "runout":
      // Run-outs are excluded upstream — should never reach here.
      return {
        outputType: "extras",
        runs: 0,
        extrasNote: "byes",
        label: "",
        detail: "",
      };
  }
}

/** Length-aware bowled escape: ball hits stumps but both bails stay on. */
function luckyEscapeBowledDetail(length: Length): string {
  switch (length) {
    case "Full":
      return `Drilled into the base of off stump — somehow both bails refuse to budge. Keeper collects, 2 byes.`;
    case "Good length":
      return `Nips back into middle stump — bails rattle but hold on. 2 byes.`;
    case "Short":
      return `Rears up and clips the top of the stumps — bails wobble but stay put. 2 byes.`;
  }
}

/** Delivery-line-aware LBW escape: the umpire turns down the appeal. */
function luckyEscapeLbwDetail(line: Line): string {
  switch (line) {
    case "Outside off":
      return `Pitched outside off stump — batter played a shot, not out under LBW law. Scampered 2 leg byes.`;
    case "Off stump":
      return `Good appeal, but the angle takes it past leg stump. Not out. 2 leg byes.`;
    case "Middle stump":
      return `Straight and full but too high — would clear the bails on impact. Not out. 2 leg byes.`;
    case "Leg stump":
      return `Sliding down leg side — umpire turns it down. Batters jog 2 leg byes.`;
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
  return { type: "runs", value: next, shot: o.shot, shotCategory: o.shotCategory };
}

function upgrade(o: BallOutcome): BallOutcome {
  if (o.type === "wicket") return o;
  if (o.type === "dot") {
    return {
      type: "runs",
      value: 1,
      shot: "scrambled single",
      shotCategory: "defend",
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

function describeOutcome(o: BallOutcome): string {
  if (o.type === "runs") return `${o.shot} (${o.value})`;
  if (o.type === "wicket") return `wicket — ${o.mode}`;
  return "a dot ball";
}

function describeChange(before: BallOutcome, after: BallOutcome): string {
  return `${describeOutcome(before)} becomes ${describeOutcome(after)}`;
}

const LINE_ORDER: Line[] = [
  "Leg stump",
  "Middle stump",
  "Off stump",
  "Outside off",
];

function shiftLineAway(line: Line): Line {
  const idx = LINE_ORDER.indexOf(line);
  if (idx < 0) return line;
  return LINE_ORDER[Math.min(idx + 1, LINE_ORDER.length - 1)]!;
}

function shiftLengthDown(length: Length): Length {
  if (length === "Short") return "Good length";
  if (length === "Good length") return "Full";
  return "Full";
}

function shiftLengthOut(length: Length): Length {
  if (length === "Full") return "Good length";
  if (length === "Good length") return "Short";
  return "Short";
}

function mirrorLine(line: Line): Line {
  switch (line) {
    case "Off stump": return "Leg stump";
    case "Leg stump": return "Off stump";
    case "Outside off": return "Leg stump";
    case "Middle stump": return "Middle stump";
  }
}

function shiftLineToward(line: Line, direction: "leg" | "off"): Line {
  const idx = LINE_ORDER.indexOf(line);
  if (idx < 0) return line;
  const next = direction === "leg" ? Math.max(idx - 1, 0) : Math.min(idx + 1, LINE_ORDER.length - 1);
  return LINE_ORDER[next]!;
}

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
