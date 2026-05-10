import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  /** Plain-English explanation. Shown on tap (mobile), hover (desktop), or focus (keyboard). */
  text: string;
  children: ReactNode;
  /** Allow the wrapper to inherit display: inline | inline-flex etc. */
  className?: string;
}

/**
 * Tooltip wrapper. Triggers:
 *   - tap/click: toggles open (sticky until tap-outside or Escape) — mobile-friendly
 *   - mouse hover: shows passively while hovering — desktop convenience
 *   - keyboard focus: shows while focused — accessibility
 *
 * The aria-label + role="button" make this work for screen readers too.
 *
 * Use around any icon, abbreviation, or non-text indicator so a cricket
 * novice can find out what something means without leaving the page.
 */
export function Tip({ text, children, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Tap-outside or Escape closes the sticky tooltip.
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  return (
    <span
      ref={wrapRef}
      className={`tip ${isOpen ? "open" : ""} ${className ?? ""}`.trim()}
      aria-label={text}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen((v) => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsOpen((v) => !v);
        }
      }}
    >
      {children}
      <span className="tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
