import type { ReactNode } from "react";

/**
 * Wraps a horizontal card row with edge-fade gradients + a count hint
 * so the user knows there's more content offscreen. The inner row is
 * expected to be a flex/grid scroller (`.draft-grid`, `.deck-mgmt-grid`,
 * or any compatible custom class).
 *
 * Pure presentation — the scroll behaviour itself lives on the inner row.
 */
export function HorizontalScroller({
  count,
  noun,
  children,
}: {
  /** Total number of items in the row. */
  count: number;
  /** Singular noun for the count label ("option", "card"). Pluralized
   *  automatically. */
  noun: string;
  children: ReactNode;
}) {
  return (
    <div className="scroll-shell">
      {count > 0 && (
        <p className="scroll-count">
          <strong>{count}</strong> {noun}{count === 1 ? "" : "s"}
          <span className="scroll-arrow-hint"> · swipe →</span>
        </p>
      )}
      {children}
    </div>
  );
}
