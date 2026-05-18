import { useEffect, useState } from "react";
import type { AnyCard, Tier } from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { HorizontalScroller } from "../components/HorizontalScroller.tsx";
import { playSfx } from "../lib/sfx.ts";

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

type Phase = "revealing" | "picking";

/**
 * Two-phase pack opening:
 *
 *   1. REVEALING — all 6 cards start face-down. Tap each to flip.
 *      Each flip plays a card-flip SFX, and Elite/Gold reveals get a
 *      brief flash/pulse to celebrate. The Confirm button is hidden;
 *      a "Reveal all" shortcut is offered for impatient players.
 *
 *   2. PICKING — once all cards are face-up, the prompt switches to
 *      "Pick N to keep." The player taps to select / deselect, then
 *      hits Confirm. Selection animates with a small lift.
 */
export function PackOpeningScreen({ label, offered, pickN, onConfirm }: Props) {
  const [phase, setPhase] = useState<Phase>("revealing");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<number[]>([]);

  // When the pack mounts, play the pack-tear SFX (graceful fallback if
  // the file isn't sourced yet — sfx.ts swallows missing files silently).
  useEffect(() => {
    playSfx("card-flip"); // closest approximation we have for "pack rip"
  }, []);

  // Auto-advance to "picking" phase once all 6 cards are revealed.
  useEffect(() => {
    if (revealed.size === offered.length && phase === "revealing") {
      // Small delay so the user appreciates the final reveal before
      // the "Pick N" prompt appears.
      const t = setTimeout(() => setPhase("picking"), 700);
      return () => clearTimeout(t);
    }
  }, [revealed.size, offered.length, phase]);

  const flip = (slotIdx: number, card: AnyCard): void => {
    if (revealed.has(slotIdx)) return;
    setRevealed(new Set([...revealed, slotIdx]));
    playSfx(sfxForTier(card.kind === "situation" ? "Silver" : card.tier));
  };

  const revealAll = (): void => {
    const all = new Set<number>();
    for (let i = 0; i < offered.length; i++) all.add(i);
    setRevealed(all);
  };

  const togglePick = (slotIdx: number): void => {
    if (phase !== "picking") return;
    if (picked.includes(slotIdx)) {
      setPicked(picked.filter((x) => x !== slotIdx));
    } else if (picked.length < pickN) {
      setPicked([...picked, slotIdx]);
    }
  };

  const canConfirm = phase === "picking" && picked.length === pickN;

  return (
    <main>
      <div className="pack-header">
        <span className="dim-text">CARD PACK</span>
        <h1>{label}</h1>
        {phase === "revealing" ? (
          <p className="dim-text">
            Tap each card to reveal. {revealed.size === 0 ? "All 6 face-down — start tapping!" : `${revealed.size} / ${offered.length} revealed`}
          </p>
        ) : (
          <p className="dim-text">
            Pick <strong>{pickN}</strong> of {offered.length} to keep — they
            go into your inventory.
          </p>
        )}
        {phase === "picking" && (
          <p className="pack-counter">
            {picked.length} / {pickN} picked
          </p>
        )}
      </div>

      <HorizontalScroller count={offered.length} noun="card">
        <div className="draft-grid">
          {offered.map((card, i) => {
            const isRevealed = revealed.has(i);
            const isPicked = picked.includes(i);
            const tierClass = isRevealed
              ? `pack-reveal-${tierForFlourish(card)}`
              : "";
            return (
              <div
                key={`pack-${i}`}
                className={`draft-slot pack-slot ${tierClass} ${isPicked ? "selected" : ""}`}
                onClick={() => {
                  if (phase === "revealing") flip(i, card);
                  else togglePick(i);
                }}
              >
                {isRevealed ? (
                  <Card card={card} size="hand" selected={isPicked} />
                ) : (
                  <FaceDownPackCard />
                )}
              </div>
            );
          })}
        </div>
      </HorizontalScroller>

      <div className="draft-actions">
        {phase === "revealing" && revealed.size < offered.length && (
          <button className="btn ghost" onClick={revealAll}>
            Reveal all
          </button>
        )}
        {phase === "picking" && (
          <button
            className="btn primary big"
            disabled={!canConfirm}
            onClick={() => {
              const pickedIds = picked.map((i) => offered[i]!.id);
              onConfirm(pickedIds);
            }}
          >
            {canConfirm ? "Confirm picks →" : `Pick ${pickN - picked.length} more`}
          </button>
        )}
      </div>
    </main>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

/** Face-down pack card — a wrapped, mysterious slip. Tappable. */
function FaceDownPackCard() {
  return (
    <div className="pack-face-down">
      <div className="pack-face-down-back" />
      <div className="pack-face-down-emblem">?</div>
    </div>
  );
}

/** Pick a tier-specific SFX for the reveal so Elite pulls SOUND
 *  different from Silvers. All map to existing SFX names (which
 *  graceful-fall-back if the .webm file isn't sourced yet). */
function sfxForTier(tier: Tier): import("../lib/sfx.ts").SfxName {
  switch (tier) {
    case "Elite": return "crowd-cheer";
    case "Gold": return "bat-thwack-heavy";
    case "Silver": return "bat-thwack-light";
    case "Bronze": return "card-flip";
  }
}

/** Visual flourish class — Elite/Gold get extra treatment on reveal. */
function tierForFlourish(card: AnyCard): "elite" | "gold" | "normal" {
  if (card.kind === "situation") return "normal";
  if (card.tier === "Elite") return "elite";
  if (card.tier === "Gold") return "gold";
  return "normal";
}
