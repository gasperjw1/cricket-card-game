import { useEffect, useState } from "react";

/**
 * Re-renders every 250ms while the deadline is in the future. Returns the
 * remaining whole seconds (clamped to >= 0). Pass `null` to disable.
 */
export function useCountdown(deadlineEpochMs: number | null): number {
  const compute = () =>
    deadlineEpochMs === null
      ? 0
      : Math.max(0, Math.ceil((deadlineEpochMs - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState<number>(compute);

  useEffect(() => {
    if (deadlineEpochMs === null) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(compute);
    const id = setInterval(() => {
      const next = Math.max(
        0,
        Math.ceil((deadlineEpochMs - Date.now()) / 1000),
      );
      setSecondsLeft(next);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineEpochMs]);

  return secondsLeft;
}
