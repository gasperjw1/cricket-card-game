import { useState } from "react";
import type { AnyCard } from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { resolveCardIds } from "../lib/career-deck.ts";
import {
  getCareer,
  setDeck,
  subscribeCareer,
  type RunDeck,
  type WCRun,
} from "../lib/career.ts";
import { useEffect } from "react";

interface Props {
  onBack: () => void;
}

type Role = "batting" | "bowling";

/**
 * Between-matches deck management. Player can swap cards between their
 * active deck and the run inventory. Swap rules:
 *   - Same kind only (batter↔batter, bowler↔bowler, sit↔sit)
 *   - Same deck-role for sits (batting sits stay in batting deck etc.)
 *   - Total deck size always preserved
 *
 * UI: tap an inventory card → highlighted swap candidates appear in the
 * deck → tap one to confirm swap. Or tap a deck card → can drop to inventory
 * (need a replacement first).
 */
export function DeckManagementScreen({ onBack }: Props) {
  const [save, setSave] = useState(getCareer);
  useEffect(() => subscribeCareer(setSave), []);
  const run = save.currentRun;

  const [role, setRole] = useState<Role>("batting");
  const [pickedInventoryId, setPickedInventoryId] = useState<string | null>(null);

  if (!run || !run.deck) {
    return (
      <main>
        <h1>No active run</h1>
        <button className="btn primary" onClick={onBack}>Back</button>
      </main>
    );
  }

  const activeIds = role === "batting" ? run.deck.battingDeck : run.deck.bowlingDeck;
  const activeCards = resolveCardIds(activeIds);

  // Filter inventory to cards eligible for this deck role.
  const inventoryEligible = filterInventoryForRole(run, role);

  // When an inventory card is picked, which deck cards can it replace?
  const pickedInventoryCard = pickedInventoryId
    ? resolveCardIds([pickedInventoryId])[0] ?? null
    : null;
  const eligibleSwapTargets = pickedInventoryCard
    ? activeCards.filter((c) => canSwap(c, pickedInventoryCard))
    : [];

  const onPickInventory = (id: string): void => {
    setPickedInventoryId(pickedInventoryId === id ? null : id);
  };

  const onSwap = (deckCardId: string): void => {
    if (!pickedInventoryId || !run.deck) return;
    const updated: RunDeck = {
      battingDeck: [...run.deck.battingDeck],
      bowlingDeck: [...run.deck.bowlingDeck],
    };
    const list = role === "batting" ? updated.battingDeck : updated.bowlingDeck;
    const idx = list.indexOf(deckCardId);
    if (idx < 0) return;
    list[idx] = pickedInventoryId;
    setDeck(updated);

    // Move the swapped-out card to inventory, and remove the swapped-in
    // card from inventory (manually since `addToInventory` only adds).
    const newInventoryIds = run.inventory.cardIds
      .filter((id, i, arr) => {
        // Remove first occurrence of pickedInventoryId
        if (id === pickedInventoryId) {
          return arr.indexOf(pickedInventoryId) !== i;
        }
        return true;
      })
      .concat([deckCardId]);

    // Direct mutation of the in-memory save (we have to bypass setDeck
    // since it doesn't manage inventory). Persist via setDeck's call.
    // Side-effect: the next setDeck call writes the whole save including
    // the inventory we mutate here.
    run.inventory.cardIds = newInventoryIds;
    setDeck(updated); // re-persist

    setPickedInventoryId(null);
  };

  return (
    <main>
      <button className="btn ghost small" onClick={onBack} style={{ marginBottom: "1rem" }}>
        ← Back
      </button>
      <h1>📋 Deck Management</h1>

      <div className="deck-mgmt-tabs">
        <button
          className={`btn ghost small ${role === "batting" ? "active" : ""}`}
          onClick={() => { setRole("batting"); setPickedInventoryId(null); }}
        >
          🏏 Batting Deck
        </button>
        <button
          className={`btn ghost small ${role === "bowling" ? "active" : ""}`}
          onClick={() => { setRole("bowling"); setPickedInventoryId(null); }}
        >
          🎯 Bowling Deck
        </button>
      </div>

      <section className="deck-mgmt-section">
        <header className="deck-mgmt-section-head">
          <h2>Active Deck ({activeCards.length})</h2>
          {pickedInventoryId && (
            <span className="dim-text">
              Tap a highlighted card to swap in your selection
            </span>
          )}
        </header>
        <div className="deck-mgmt-grid">
          {activeCards.map((card, i) => {
            const isSwapTarget = eligibleSwapTargets.includes(card);
            return (
              <div
                key={`${card.id}-${i}`}
                className={`deck-mgmt-slot ${isSwapTarget ? "swap-target" : ""}`}
                onClick={isSwapTarget ? () => onSwap(card.id) : undefined}
              >
                <Card card={card} size="hand" />
              </div>
            );
          })}
        </div>
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
        <div className="deck-mgmt-grid">
          {inventoryEligible.map(({ card, instanceIndex }) => (
            <div
              key={`${card.id}-inv-${instanceIndex}`}
              className={`deck-mgmt-slot inventory ${pickedInventoryId === card.id ? "picked" : ""}`}
              onClick={() => onPickInventory(card.id)}
            >
              <Card card={card} size="hand" selected={pickedInventoryId === card.id} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

/**
 * Inventory cards eligible for the active role's deck. Filters:
 *   - Batting deck: batsmen + batting-side situations
 *   - Bowling deck: bowlers + bowling-side situations
 *
 * Returns cards with their instance index so duplicates render
 * separately (an inventory of 2x "DRS Review" shows as two slots).
 */
function filterInventoryForRole(
  run: WCRun,
  role: Role,
): { card: AnyCard; instanceIndex: number }[] {
  const resolved = resolveCardIds(run.inventory.cardIds);
  const counts = new Map<string, number>();
  const out: { card: AnyCard; instanceIndex: number }[] = [];
  for (const c of resolved) {
    const i = counts.get(c.id) ?? 0;
    counts.set(c.id, i + 1);
    if (role === "batting") {
      if (c.kind === "batsman" || (c.kind === "situation" && c.deck === "batting")) {
        out.push({ card: c, instanceIndex: i });
      }
    } else {
      if (c.kind === "bowler" || (c.kind === "situation" && c.deck === "bowling")) {
        out.push({ card: c, instanceIndex: i });
      }
    }
  }
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
