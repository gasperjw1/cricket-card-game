import { useEffect, useRef, useState } from "react";
import type { BallResult } from "@swipe-sixer/shared";

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

/** Per-stage duration in milliseconds. Tuned to feel fast but readable. */
const STAGE_DURATION_MS: Record<StoryStage, number> = {
  pitch: 400,
  bowler: 700,
  batter: 600,
  result: 700,
  drs: 900,
  biryani: 600,
};

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

  useEffect(() => {
    if (currentIndex >= planRef.current.length) return;
    const stage = planRef.current[currentIndex]!;
    const t = setTimeout(() => {
      setCurrentIndex((i) => i + 1);
    }, STAGE_DURATION_MS[stage]);
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
