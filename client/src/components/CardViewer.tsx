import { useEffect } from "react";
import type { AnyCard } from "@swipe-sixer/shared";
import { Card } from "./Card.tsx";

interface Props {
  card: AnyCard;
  /** Whether selecting this card is currently allowed (e.g. correct kind for this turn). */
  canSelect: boolean;
  /** True when this card is already the current selection — Submit becomes "Deselect". */
  isCurrentlySelected: boolean;
  /** Reason text shown when canSelect is false (e.g. "You already locked in"). */
  disabledReason?: string;
  onSubmit: () => void;
  onClose: () => void;
}

/**
 * Modal-style full-card viewer. Players land here when they click a card in
 * their hand. From here they can use the card (Submit) or go back.
 */
export function CardViewer({
  card,
  canSelect,
  isCurrentlySelected,
  disabledReason,
  onSubmit,
  onClose,
}: Props) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitLabel = isCurrentlySelected ? "Remove from selection" : useLabel(card);
  const submitDisabled = !canSelect && !isCurrentlySelected;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <Card card={card} size="view" />

        {submitDisabled && disabledReason && (
          <div className="notice viewer-notice">{disabledReason}</div>
        )}

        <div className="viewer-actions">
          <button className="btn ghost" onClick={onClose}>
            Back to hand
          </button>
          <button
            className={`btn ${isCurrentlySelected ? "danger" : "primary"}`}
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useLabel(card: AnyCard): string {
  if (card.kind === "batsman") return "Use this batsman";
  if (card.kind === "bowler") return "Use this bowler";
  return "Add this situation";
}
