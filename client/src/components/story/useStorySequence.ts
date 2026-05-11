import { useEffect, useRef, useState } from "react";
import type { BallResult } from "@swipe-sixer/shared";
import { playSfx, playSfxRandom, type SfxName } from "../../lib/sfx.ts";
import { getSettings } from "../../lib/settings.ts";

/** Each conditional stage maps to a step in the resolution trail. The
 *  story shows every applicable stage in this order; stages whose
 *  trigger isn't present in the result get skipped entirely. */
export type StoryStage =
  | "pitch"          // always — pitch backdrop (regular or Day 5)
  | "bowler"         // always — bowler delivers (with no-ball/wide signal inline)
  | "batter"         // always — batter plays shot (skipped on clean wide)
  | "result"         // always — runs flash or wicket moment
  | "drs"            // only if DRS Review fired post-wicket
  | "biryani";       // only if Biryani cancelled a no-ball/wide

export interface StoryState {
  /** Stages that will play for this ball, in order. */
  plan: StoryStage[];
  /** Index into `plan` of the currently-visible stage. */
  currentIndex: number;
  /** True once the last stage has finished. */
  isComplete: boolean;
  /** Jump immediately to the end (skip-to-cards). */
  skipToEnd: () => void;
  // Convenience flags so the renderer can check what's about to fire.
  isDay5: boolean;
  hasNoBall: boolean;
  hasWide: boolean;
  hasBiryani: boolean;
  hasDRS: boolean;
  isWicket: boolean;
}

/** Per-stage duration in milliseconds at "normal" speed.
 *  Sized to give the matching SFX (stadium hum, run-up, bat thwack,
 *  crowd reaction) room to land — playing them at faster cadence
 *  feels rushed and the audio gets clipped.
 *  The Story-speed user setting scales these via SPEED_MULTIPLIER. */
const STAGE_DURATION_MS: Record<StoryStage, number> = {
  pitch: 800,
  bowler: 1500,
  batter: 1200,
  result: 1500,
  drs: 2000,
  biryani: 1200,
};

/** Multiplier applied to STAGE_DURATION_MS based on the user's
 *  storySpeed setting. */
const SPEED_MULTIPLIER = {
  fast: 0.55,    // ~55% of normal — snappy
  normal: 1.0,
  slow: 1.4,    // 40% longer — savor each beat
} as const;

export function useStorySequence(result: BallResult): StoryState {
  // Detect which conditional stages apply to this ball by scanning the
  // resolution trail. Every situation has its own ResolutionStepKind.
  const isDay5 = result.resolutionSteps.some(
    (s) => s.kind === "day-5-pitch" && s.applied,
  );
  const hasNoBall = result.resolutionSteps.some(
    (s) => s.kind === "no-ball" && s.applied,
  );
  const hasWide = result.resolutionSteps.some(
    (s) => s.kind === "wide" && s.applied,
  );
  const hasBiryani = result.resolutionSteps.some(
    (s) => s.kind === "biryani" && s.applied,
  );
  const hasDRS = result.resolutionSteps.some((s) => s.kind === "drs-review");
  const isWicket = result.finalOutcome.type === "wicket";

  // Build the plan. Most balls: pitch → bowler → batter → result.
  // Wide balls skip the batter shot (nothing to play).
  const cleanWide = hasWide && !hasNoBall;
  const plan: StoryStage[] = ["pitch", "bowler"];
  if (!cleanWide) plan.push("batter");
  plan.push("result");
  if (hasDRS) plan.push("drs");
  if (hasBiryani) plan.push("biryani");

  const [currentIndex, setCurrentIndex] = useState(0);
  // Lock the plan in a ref so the timer effect doesn't restart when
  // the parent re-renders (which would happen as state advances).
  const planRef = useRef(plan);

  // Lock the result + flags in refs so the SFX side-effect doesn't
  // re-fire on parent re-renders (the closure would re-evaluate).
  const resultRef = useRef(result);
  const flagsRef = useRef({ isDay5, hasNoBall, hasWide, isWicket });

  useEffect(() => {
    if (currentIndex >= planRef.current.length) return;
    const stage = planRef.current[currentIndex]!;

    // Fire the matching SFX as the stage opens. Each call is a no-op
    // when sounds are off / files missing — see lib/sfx.ts.
    const sfx = sfxForStage(stage, resultRef.current, flagsRef.current);
    if (sfx) playSfxRandom(...sfx);

    const speedMult = SPEED_MULTIPLIER[getSettings().storySpeed];
    const t = setTimeout(() => {
      setCurrentIndex((i) => i + 1);
    }, STAGE_DURATION_MS[stage] * speedMult);
    return () => clearTimeout(t);
  }, [currentIndex]);

  return {
    plan,
    currentIndex,
    isComplete: currentIndex >= plan.length,
    skipToEnd: () => setCurrentIndex(plan.length),
    isDay5,
    hasNoBall,
    hasWide,
    hasBiryani,
    hasDRS,
    isWicket,
  };
}

/** Pick the right SFX (or set of variants) for a given story stage. */
function sfxForStage(
  stage: StoryStage,
  result: BallResult,
  flags: { isDay5: boolean; hasNoBall: boolean; hasWide: boolean; isWicket: boolean },
): SfxName[] | null {
  switch (stage) {
    case "pitch":
      return null;  // optional ambient hum — leave silent for now
    case "bowler":
      if (flags.hasNoBall || flags.hasWide) return ["umpire-whistle"];
      return null;  // the bat-thwack on stage "batter" is the audio star
    case "batter":
      if (flags.isWicket) {
        if (result.finalOutcome.type === "wicket") {
          switch (result.finalOutcome.dismissalCategory) {
            case "bowled": return ["stumps-shatter"];
            case "stumped": return ["stumps-shatter"];
            case "caught-keeper": return ["glove-catch"];
            default: return ["bat-thwack-light"];  // edge before the catch
          }
        }
      }
      // Runs: pick light/heavy by value
      if (result.finalOutcome.type === "runs") {
        return result.finalOutcome.value >= 4
          ? ["bat-thwack-heavy"]
          : ["bat-thwack-light"];
      }
      return ["bat-thwack-light"];  // dot ball thunk
    case "result":
      if (flags.isWicket) return ["crowd-gasp"];
      if (result.finalOutcome.type === "runs" && result.finalOutcome.value >= 4) {
        return ["crowd-cheer"];
      }
      return null;
    case "drs":
      return ["umpire-whistle"];
    case "biryani":
      return null;
  }
  // Suppress unused-import warning on playSfx (alias kept for future use).
  void playSfx;
}

