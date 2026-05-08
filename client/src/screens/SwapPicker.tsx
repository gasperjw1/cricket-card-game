import { useState } from "react";
import type {
  AnyCard,
  PendingSwap,
  PrivatePlayerView,
  SwapReason,
} from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { CardViewer } from "../components/CardViewer.tsx";
import { Tip } from "../components/Tip.tsx";
import { useCountdown } from "../useCountdown.ts";

interface Props {
  swap: PendingSwap;
  privateView: PrivatePlayerView | null;
  onPick: (cardId: string) => void;
}

const REASON_COPY: Record<
  SwapReason,
  { title: string; subtitle: string; tooltip: string }
> = {
  mankad: {
    title: "Mankad!",
    subtitle:
      "The bowler caught you backing up too far. Pick a different batsman from your hand to face this delivery.",
    tooltip:
      "Mankad is a bowling situation card that forces the batter to swap their played batsman.",
  },
  "retired-out": {
    title: "Retired Out",
    subtitle:
      "Pull your batsman off the field — pick a replacement from your hand to face this delivery.",
    tooltip:
      "Retired Out is a batting situation card that lets you swap your own played batsman.",
  },
  cramps: {
    title: "Cramps!",
    subtitle:
      "Your bowler pulls up. Pick a replacement bowler from your hand to deliver instead.",
    tooltip:
      "Cramps is a bowling situation card that lets you swap your own played bowler.",
  },
};

export function SwapPicker({ swap, privateView, onPick }: Props) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const seconds = useCountdown(swap.deadlineEpochMs);
  const copy = REASON_COPY[swap.reason];

  const candidates: AnyCard[] = (privateView?.hand.cards ?? []).filter((c) =>
    swap.candidateIds.includes(c.id),
  );
  const viewingCard = viewingCardId
    ? candidates.find((c) => c.id === viewingCardId) ?? null
    : null;

  const submit = (id: string) => {
    if (submittingId) return;
    setSubmittingId(id);
    onPick(id);
  };

  // The table snapshot is what's already on the table. We show the
  // opponent's mandatory card prominently so the player knows what they're
  // up against while picking a replacement.
  const myMandatory =
    swap.fromSlot === swap.table.battingSlot
      ? swap.table.battingMandatory
      : swap.table.bowlingMandatory;
  const opponentMandatory =
    swap.fromSlot === swap.table.battingSlot
      ? swap.table.bowlingMandatory
      : swap.table.battingMandatory;
  const mySituation =
    swap.fromSlot === swap.table.battingSlot
      ? swap.table.battingSituation
      : swap.table.bowlingSituation;
  const opponentSituation =
    swap.fromSlot === swap.table.battingSlot
      ? swap.table.bowlingSituation
      : swap.table.battingSituation;

  return (
    <div className="reveal-overlay">
      <div className="reveal-inner swap-picker">
        <Tip text={copy.tooltip}>
          <h2 className="swap-title">{copy.title}</h2>
        </Tip>
        <p className="swap-subtitle">{copy.subtitle}</p>

        <section className="swap-table">
          <div className="reveal-side-label">On the table</div>
          <div className="reveal-cards">
            <div>
              <div className="reveal-side-label">You played</div>
              <Card card={myMandatory} size="hand" />
              {mySituation && (
                <div style={{ marginTop: "0.5rem" }}>
                  <Card card={mySituation} size="hand" />
                </div>
              )}
            </div>
            <div className="reveal-vs">
              <Tip text="Both players revealed simultaneously, before the swap.">
                <span>vs</span>
              </Tip>
            </div>
            <div>
              <div className="reveal-side-label">Opponent played</div>
              <Card card={opponentMandatory} size="hand" />
              {opponentSituation && (
                <div style={{ marginTop: "0.5rem" }}>
                  <Card card={opponentSituation} size="hand" />
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="swap-meta">
          <Tip text="The card being swapped out — it'll be discarded after this ball.">
            <span>
              Swapping <strong>{swap.originalCardName}</strong>
            </span>
          </Tip>
          <span className={`turn-timer ${seconds <= 5 ? "urgent" : ""}`}>
            {seconds}s
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className="hint">No candidates in your hand — auto-resolving…</div>
        ) : (
          <>
            <div className="reveal-side-label">Choose a replacement</div>
            <div className="hand-grid swap-grid">
              {candidates.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  size="hand"
                  selected={submittingId === card.id}
                  onClick={() => setViewingCardId(card.id)}
                />
              ))}
            </div>
          </>
        )}

        <p className="hint">
          If you don't pick in time, the server will auto-pick the first
          available card.
        </p>
      </div>

      {viewingCard && (
        <CardViewer
          card={viewingCard}
          isCurrentlySelected={false}
          canSelect={!submittingId}
          disabledReason={
            submittingId ? "Submitting…" : undefined
          }
          onSubmit={() => {
            submit(viewingCard.id);
            setViewingCardId(null);
          }}
          onClose={() => setViewingCardId(null)}
        />
      )}
    </div>
  );
}
