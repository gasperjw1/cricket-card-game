/**
 * Build the player's mutable WC deck from their drafted picks +
 * format-required Silver/Bronze auto-fill.
 *
 * Pure functions — no localStorage or React. The deck shape returned
 * here matches what the server's buildDeck function expects to be
 * present in the player's hand each ball.
 */

import {
  MATCH_FORMATS,
  type AnyCard,
  type BatsmanCard,
  type BowlerCard,
  type MatchFormat,
  type SituationCard,
  type Tier,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import type { DraftedDeck, RunDeck } from "./career.ts";

/**
 * Build the initial RunDeck (card ids only) from the player's draft +
 * auto-fill. This is what populates the player's deck the moment
 * drafting completes. Players can then swap inventory cards in/out via
 * the deck management screen.
 */
export function buildInitialRunDeck(
  format: MatchFormat,
  draft: DraftedDeck,
): RunDeck {
  const fmt = MATCH_FORMATS[format];
  const tierDist = fmt.tierDistribution;

  // Batting deck
  const battingDeck: string[] = [];
  battingDeck.push(...draft.batterPicks); // Elite + Gold from draft
  battingDeck.push(
    ...sampleByTier(CARDS.batsmen, "Silver", tierDist.Silver, draft.batterPicks),
  );
  battingDeck.push(
    ...sampleByTier(CARDS.batsmen, "Bronze", tierDist.Bronze, draft.batterPicks),
  );
  // Situations: drafted picks first, then auto-fill remainder
  const battingSitNeeded = fmt.situationCount;
  const battingSitsFromDraft = draft.battingSituationPicks.slice(0, battingSitNeeded);
  battingDeck.push(...battingSitsFromDraft);
  if (battingSitsFromDraft.length < battingSitNeeded) {
    battingDeck.push(
      ...sampleSituations(
        "batting",
        battingSitNeeded - battingSitsFromDraft.length,
        battingSitsFromDraft,
      ),
    );
  }

  // Bowling deck (mirror)
  const bowlingDeck: string[] = [];
  bowlingDeck.push(...draft.bowlerPicks);
  bowlingDeck.push(
    ...sampleByTier(CARDS.bowlers, "Silver", tierDist.Silver, draft.bowlerPicks),
  );
  bowlingDeck.push(
    ...sampleByTier(CARDS.bowlers, "Bronze", tierDist.Bronze, draft.bowlerPicks),
  );
  const bowlingSitNeeded = fmt.situationCount;
  const bowlingSitsFromDraft = draft.bowlingSituationPicks.slice(0, bowlingSitNeeded);
  bowlingDeck.push(...bowlingSitsFromDraft);
  if (bowlingSitsFromDraft.length < bowlingSitNeeded) {
    bowlingDeck.push(
      ...sampleSituations(
        "bowling",
        bowlingSitNeeded - bowlingSitsFromDraft.length,
        bowlingSitsFromDraft,
      ),
    );
  }

  return { battingDeck, bowlingDeck };
}

/**
 * Resolve a deck of card ids into full card objects. Used at match
 * start time to send the cards to the server.
 *
 * If any id is missing from the card pool (shouldn't happen — defensive),
 * filters silently.
 */
export function resolveCardIds(ids: string[]): AnyCard[] {
  const all = new Map<string, AnyCard>();
  for (const c of CARDS.batsmen) all.set(c.id, c);
  for (const c of CARDS.bowlers) all.set(c.id, c);
  for (const c of CARDS.situations) all.set(c.id, c);
  return ids.map((id) => all.get(id)).filter((c): c is AnyCard => !!c);
}

/**
 * Validate a deck composition: must equal format's deckSize, must
 * contain at least one batter and at least one bowler (whichever the
 * deck is for), tier distribution is FLEXIBLE (player can rebalance
 * via deck management).
 */
export function validateDeck(
  format: MatchFormat,
  deck: RunDeck,
  role: "batting" | "bowling",
): { ok: true } | { ok: false; reason: string } {
  const fmt = MATCH_FORMATS[format];
  const ids = role === "batting" ? deck.battingDeck : deck.bowlingDeck;
  if (ids.length !== fmt.deckSize) {
    return {
      ok: false,
      reason: `Deck has ${ids.length} cards but ${fmt.label} expects ${fmt.deckSize}.`,
    };
  }
  const cards = resolveCardIds(ids);
  const requiredKind = role === "batting" ? "batsman" : "bowler";
  const hasRequired = cards.some((c) => c.kind === requiredKind);
  if (!hasRequired) {
    return { ok: false, reason: `Deck needs at least one ${requiredKind} card.` };
  }
  return { ok: true };
}

// ─────────────────────────── Helpers ───────────────────────────

function sampleByTier(
  pool: (BatsmanCard | BowlerCard)[],
  tier: Tier,
  count: number,
  exclude: string[],
): string[] {
  const excludeSet = new Set(exclude);
  const filtered = pool.filter((c) => c.tier === tier && !excludeSet.has(c.id));
  return sample(filtered, count).map((c) => c.id);
}

function sampleSituations(
  deck: "batting" | "bowling",
  count: number,
  exclude: string[],
): string[] {
  // Situations CAN repeat per Yash's spec, but for an INITIAL deck
  // auto-fill we still prefer variety. So exclude already-picked.
  const pool = CARDS.situations.filter(
    (s) => s.deck === deck && !exclude.includes(s.id),
  );
  return sample(pool, count).map((c) => c.id);
}

function sample<T>(pool: readonly T[], n: number): T[] {
  const a = [...pool];
  const out: T[] = [];
  while (out.length < n && a.length > 0) {
    const j = Math.floor(Math.random() * a.length);
    out.push(a.splice(j, 1)[0]!);
  }
  return out;
}

/** Re-export SituationCard / etc. so callers don't have to dual-import. */
export type { BatsmanCard, BowlerCard, SituationCard };
