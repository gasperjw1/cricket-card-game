import { useEffect, useRef, useState } from "react";

export interface StagedReveal {
  /** Number of trail items currently visible (0 = none, stepCount = all). */
  visibleCount: number;
  /** True once all steps + the final outcome are showing. */
  isComplete: boolean;
  /** Skip ahead to the fully-revealed state. */
  skipToEnd: () => void;
}

/**
 * Progressively reveals N items with a per-item delay, then a final
 * "outcome" stage. Used by the ball reveal overlay to play the resolution
 * trail one step at a time. Players can skip via skipToEnd.
 */
export function useStagedReveal(
  stepCount: number,
  opts: {
    /** Delay before the first step appears, in ms. */
    initialDelay?: number;
    /** Delay between successive steps, in ms. */
    stepDelay?: number;
    /** Delay between the last step and the "isComplete" flip (for the outcome reveal). */
    outcomeDelay?: number;
  } = {},
): StagedReveal {
  const initialDelay = opts.initialDelay ?? 350;
  const stepDelay = opts.stepDelay ?? 450;
  const outcomeDelay = opts.outcomeDelay ?? 350;

  const [visibleCount, setVisibleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Reset on stepCount change (e.g., new ball).
    setVisibleCount(0);
    setIsComplete(false);
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];

    // Schedule each step's appearance.
    let elapsed = initialDelay;
    for (let i = 0; i < stepCount; i++) {
      const idx = i + 1;
      const t = setTimeout(() => setVisibleCount(idx), elapsed);
      timersRef.current.push(t);
      elapsed += stepDelay;
    }
    // Then the final outcome.
    const outcomeT = setTimeout(() => setIsComplete(true), elapsed + outcomeDelay);
    timersRef.current.push(outcomeT);

    return () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [stepCount, initialDelay, stepDelay, outcomeDelay]);

  const skipToEnd = (): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    setVisibleCount(stepCount);
    setIsComplete(true);
  };

  return { visibleCount, isComplete, skipToEnd };
}
