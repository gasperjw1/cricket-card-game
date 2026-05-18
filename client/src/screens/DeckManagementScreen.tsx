import { useEffect, useState } from "react";
import type { AnyCard } from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { HorizontalScroller } from "../components/HorizontalScroller.tsx";
import { resolveCardIds } from "../lib/career-deck.ts";
import {
  getCareer,
  subscribeCareer,
  swapDeckInventoryCard,
  type WCRun,
} from "../lib/career.ts";

interface Props {
  onBack: () => void;
}

type Role = "batting" | "bowling";

/** Where the currently-selected card lives. Bidirectional: tap either
 *  side first, and eligible swap targets on the other side light up. */
type Selection =
  | { side: "deck"; cardId: string; slotIndex: number }
  | { side: "inventory"; cardId: string; slotIndex: number }
  | null;

/**
 * Between-matches deck management. Player can swap cards between the
 * active deck and the run inventory. Selection is bidirectional — tap
 * a card on either side, then tap an eligible swap target on the other
 * side to complete the swap. Same-kind / same-deck-side enforcement
 * keeps swaps legal.
 */
export function DeckManagementScreen({ onBack }: Props) {
  const [save, setSave] = useState(getCareer);
  useEffect(() => subscribeCareer(setSave), []);
  const run = save.currentRun;

  const [role, setRole] = useState<Role>("batting");
  const [selection, setSelection] = useState<Selection>(null);

  // Reset selection when role changes — cards in one tab aren't
  // swappable with cards in the other.
  useEffect(() => {
    setSelection(null);
  }, [role]);

  if (!run || !run.deck) {
    return (
      <main>
        <h1>No active run</h1>
        <button className="btn primary" onClick={onBack}>Back</button>
      </main>
    );
  }

  const activeIds = role === "batting" ? run.deck.battingDeck : run.deck.bowlingDeck;
  // Render each deck position separately even when cards repeat (e.g.
  // multiple DRS Reviews). slotIndex distinguishes them.
  const activeCards = activeIds.map((id, i) => ({
    card: resolveCardIds([id])[0] ?? null,
    slotIndex: i,
    id,
  })).filter((x): x is { card: AnyCard; slotIndex: number; id: string } => x.card !== null);

  const inventoryEligible = filterInventoryForRole(run, role);

  // Compute swap targets based on the current selection.
  const selectedCard = selection
    ? selection.side === "deck"
      ? activeCards.find((x) => x.slotIndex === selection.slotIndex)?.card ?? null
      : inventoryEligible.find((x) => x.slotIndex === selection.slotIndex)?.card ?? null
    : null;

  const eligibleDeckTargets = new Set<number>(); // slotIndex values
  const eligibleInventoryTargets = new Set<number>();
  if (selection && selectedCard) {
    if (selection.side === "inventory") {
      // Highlight eligible deck cards
      for (const { card, slotIndex } of activeCards) {
        if (canSwap(card, selectedCard)) eligibleDeckTargets.add(slotIndex);
      }
    } else {
      // Highlight eligible inventory cards
      for (const { card, slotIndex } of inventoryEligible) {
        if (canSwap(card, selectedCard)) eligibleInventoryTargets.add(slotIndex);
      }
    }
  }

  const pickDeckSlot = (slotIndex: number, cardId: string): void => {
    if (selection?.side === "deck" && selection.slotIndex === slotIndex) {
      // Tapping the same selected card → deselect.
      setSelection(null);
      return;
    }
    if (selection?.side === "inventory") {
      // Other side is selected → this is the swap target.
      if (eligibleDeckTargets.has(slotIndex)) {
        swapDeckInventoryCard(role, cardId, selection.cardId);
        setSelection(null);
      }
      return;
    }
    setSelection({ side: "deck", cardId, slotIndex });
  };

  const pickInventorySlot = (slotIndex: number, cardId: string): void => {
    if (selection?.side === "inventory" && selection.slotIndex === slotIndex) {
      setSelection(null);
      return;
    }
    if (selection?.side === "deck") {
      if (eligibleInventoryTargets.has(slotIndex)) {
        swapDeckInventoryCard(role, selection.cardId, cardId);
        setSelection(null);
      }
      return;
    }
    setSelection({ side: "inventory", cardId, slotIndex });
  };

  const bannerText = selection
    ? selection.side === "deck"
      ? "Deck card selected. Tap a glowing card in your Inventory to swap, or the same card again to deselect."
      : "Inventory card selected. Tap a glowing card in your Deck to swap, or the same card again to deselect."
    : "Tap a card in either section to start a swap. Eligible swap targets on the other side will glow.";

  return (
    <main>
      <button className="btn ghost small" onClick={onBack} style={{ marginBottom: "1rem" }}>
        ← Back
      </button>
      <h1>📋 Deck Management</h1>

      <div className="deck-mgmt-tabs">
        <button
          className={`btn ghost small ${role === "batting" ? "active" : ""}`}
          onClick={() => setRole("batting")}
        >
          🏏 Batting Deck
        </button>
        <button
          className={`btn ghost small ${role === "bowling" ? "active" : ""}`}
          onClick={() => setRole("bowling")}
        >
          🎯 Bowling Deck
        </button>
      </div>

      <div className="deck-mgmt-banner">{bannerText}</div>

      <section className="deck-mgmt-section">
        <header className="deck-mgmt-section-head">
          <h2>Active Deck ({activeCards.length})</h2>
        </header>
        <HorizontalScroller count={activeCards.length} noun="card">
          <div className="deck-mgmt-grid">
            {activeCards.map(({ card, slotIndex, id }) => {
              const isSelected =
                selection?.side === "deck" && selection.slotIndex === slotIndex;
              const isSwapTarget = eligibleDeckTargets.has(slotIndex);
              const cls = [
                "deck-mgmt-slot",
                "deck",
                isSelected ? "picked" : "",
                isSwapTarget ? "swap-target" : "",
              ].filter(Boolean).join(" ");
              return (
                <div
                  key={`deck-${slotIndex}`}
                  className={cls}
                  onClick={() => pickDeckSlot(slotIndex, id)}
                >
                  <Card card={card} size="hand" selected={isSelected} />
                </div>
              );
            })}
          </div>
        </HorizontalScroller>
      </section>

      <section className="deck-mgmt-section">
        <header className="deck-mgmt-section-head">
          <h2>Inventory ({inventoryEligible.length})</h2>
          {inventoryEligible.length === 0 && (
            <span className="dim-text">
              Win matches to earn packs — your picks will appear here.
            </span>
          )}
        </header>
        <HorizontalScroller count={inventoryEligible.length} noun="card">
          <div className="deck-mgmt-grid">
            {inventoryEligible.map(({ card, slotIndex, id }) => {
              const isSelected =
                selection?.side === "inventory" && selection.slotIndex === slotIndex;
              const isSwapTarget = eligibleInventoryTargets.has(slotIndex);
              const cls = [
                "deck-mgmt-slot",
                "inventory",
                isSelected ? "picked" : "",
                isSwapTarget ? "swap-target" : "",
              ].filter(Boolean).join(" ");
              return (
                <div
                  key={`inv-${slotIndex}`}
                  className={cls}
                  onClick={() => pickInventorySlot(slotIndex, id)}
                >
                  <Card card={card} size="hand" selected={isSelected} />
                </div>
              );
            })}
          </div>
        </HorizontalScroller>
      </section>
    </main>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

/**
 * Inventory cards eligible for the active role's deck.
 * Returns one entry per inventory slot (duplicates kept distinct via
 * slotIndex), with the resolved card and the original inventory id.
 */
function filterInventoryForRole(
  run: WCRun,
  role: Role,
): { card: AnyCard; slotIndex: number; id: string }[] {
  const ids = run.inventory.cardIds;
  const out: { card: AnyCard; slotIndex: number; id: string }[] = [];
  ids.forEach((id, i) => {
    const card = resolveCardIds([id])[0] ?? null;
    if (!card) return;
    if (role === "batting") {
      if (card.kind === "batsman" || (card.kind === "situation" && card.deck === "batting")) {
        out.push({ card, slotIndex: i, id });
      }
    } else {
      if (card.kind === "bowler" || (card.kind === "situation" && card.deck === "bowling")) {
        out.push({ card, slotIndex: i, id });
      }
    }
  });
  return out;
}

/** Two cards are swappable if same kind and same deck-side (sits only). */
function canSwap(a: AnyCard, b: AnyCard): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "situation" && b.kind === "situation") {
    return a.deck === b.deck;
  }
  return true;
}
