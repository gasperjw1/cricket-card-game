import type { ReactNode } from "react";

interface Props {
  /** Plain-English explanation shown on hover/focus. */
  text: string;
  children: ReactNode;
  /** Allow the wrapper to inherit display: inline | inline-flex etc. */
  className?: string;
}

/**
 * Lightweight tooltip wrapper. Renders a span with `data-tip` so the CSS
 * pseudo-element in index.css shows the text on hover/focus. Also adds
 * aria-label for screen readers and tabIndex so keyboard users can focus.
 *
 * Use this around every icon, abbreviation, or non-text indicator so a
 * cricket-novice can find out what something means without leaving the page.
 */
export function Tip({ text, children, className }: Props) {
  return (
    <span
      className={`tip ${className ?? ""}`}
      data-tip={text}
      aria-label={text}
      tabIndex={0}
    >
      {children}
    </span>
  );
}
