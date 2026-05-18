import { useState } from "react";
import type { AnyCard } from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { HorizontalScroller } from "../components/HorizontalScroller.tsx";

interface Props {
  /** Title shown at the top — e.g. "Group-stage pack" or "🏆 Trophy pack". */
  label: string;
  /** 6 cards offered. */
  offered: AnyCard[];
  /** How many the player can pick (always 2 for v1). */
  pickN: number;
  /** Called with the picked card ids on confirm. */
  onConfirm: (pickedIds: string[]) => void;
}

/**
 * Pack-opening screen for WC matches. v1 keeps animations minimal —
 * cards are shown face-up immediately, player taps to select 2, hits
 * Confirm. Polished pull-the-card / pack-tear animation will come in a
 * future session with the SFX.
 */
export function PackOpeningScreen({ label, offered, pickN, onConfirm }: Props) {
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string): void => {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
    } else if (picked.length < pickN) {
      setPicked([...picked, id]);
    }
  };

  const canConfirm = picked.length === pickN;

  return (
    <main>
      <div className="pack-header">
        <span className="dim-text">CARD PACK</span>
        <h1>{label}</h1>
        <p className="dim-text">
          Pick <strong>{pickN}</strong> of {offered.length}. The cards you
          pick go into your run inventory — you can swap them into your deck
          between matches.
        </p>
        <p className="pack-counter">
          {picked.length} / {pickN} picked
        </p>
      </div>
      <HorizontalScroller count={offered.length} noun="card">
        <div className="draft-grid">
          {offered.map((card, i) => {
            // Cards in a pack are identified by index because situations
            // can repeat. Use index in the selection state, not id.
            const slotKey = `${card.id}-${i}`;
            const isPicked = picked.includes(slotKey);
            return (
              <div
                key={slotKey}
                className={`draft-slot ${isPicked ? "selected" : ""}`}
                onClick={() => toggle(slotKey)}
              >
                <Card card={card} size="hand" selected={isPicked} />
              </div>
            );
          })}
        </div>
      </HorizontalScroller>
      <div className="draft-actions">
        <button
          className="btn primary big"
          disabled={!canConfirm}
          onClick={() => {
            // Map slot-keys back to card ids for the consumer.
            const pickedIds = picked.map((slotKey) => {
              // slotKey is "cardId-index"; strip the index.
              const idx = parseInt(slotKey.split("-").pop() ?? "0", 10);
              const card = offered[idx];
              return card?.id ?? slotKey.split("-")[0]!;
            });
            onConfirm(pickedIds);
          }}
        >
          {canConfirm ? "Confirm picks →" : `Pick ${pickN - picked.length} more`}
        </button>
      </div>
    </main>
  );
}
