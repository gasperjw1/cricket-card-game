/**
 * Persistent single-player career state (localStorage-backed).
 *
 * Two layers of persistence:
 *   - Permanent collection: cards earned from World Cup trophies. Sticks
 *     around forever, will be used by future freeplay / online modes.
 *   - Current WC run: ephemeral state for an in-progress tournament.
 *     Wiped when the run ends (trophy / loss / dropout) — except the
 *     trophy-final pack, which moves to the permanent collection.
 *
 * Schema is versioned via STORAGE_KEY — bump if the shape changes.
 */

import type { MatchFormat } from "@swipe-sixer/shared";

const STORAGE_KEY = "swipe-sixer-career-v1";

// ─────────────────────────── Types ───────────────────────────

/** Stage of a World Cup run. */
export type WCStage =
  | "drafting"     // player is in the draft, deck not yet built
  | "group"        // playing group-stage matches (1-5)
  | "semi"         // semi-final (1 match)
  | "final"        // final (1 match)
  | "won"          // trophy won, post-final state
  | "lost"         // eliminated (group failed-to-advance, semi loss, final loss)
  | "abandoned";   // player dropped out

/** A single opponent on the WC ladder, set at run creation. */
export interface WCOpponent {
  /** Display name of the nation (matches Nation type values). */
  nation: string;
  /** Server-side bot difficulty for this matchup. */
  difficulty: "Gully" | "Domestic" | "International";
  /** "group", "semi", or "final" — drives UI labels. */
  stageLabel: "group" | "semi" | "final";
  /** Has this match been played? Result is captured separately in record. */
  matchIndex: number;
}

export type WCMatchResult = "win" | "loss" | "tie";

export interface WCMatchRecord {
  opponent: WCOpponent;
  result: WCMatchResult;
  finishedAt: number;
}

/**
 * The "drafted" tier of the deck — the cards the player picked during
 * the draft. The remainder of the deck (Silver / Bronze fillers) is
 * built fresh at every match-resolution time from the global pool so we
 * don't need to bake them into the save state.
 */
export interface DraftedDeck {
  /** Card ids of Elite + Gold batters picked in draft. */
  batterPicks: string[];
  /** Card ids of Elite + Gold bowlers picked in draft. */
  bowlerPicks: string[];
  /** Card ids of batting situations picked in draft. */
  battingSituationPicks: string[];
  /** Card ids of bowling situations picked in draft. */
  bowlingSituationPicks: string[];
}

/**
 * The player's MUTABLE deck for the current run. Starts as the drafted
 * deck + auto-filled Silver/Bronze, mutates as the player swaps in
 * cards from the run inventory between matches.
 *
 * Card ids only — full card objects are looked up from CARDS at use time.
 */
export interface RunDeck {
  battingDeck: string[]; // player + situation card ids, length === format.deckSize
  bowlingDeck: string[];
}

/**
 * The current run's "extra cards" pool. Grows when the player picks
 * cards from per-win packs; shrinks (only conceptually — cards move,
 * they're not destroyed) when the player swaps them into the deck.
 */
export interface RunInventory {
  /** Card ids the player owns this run but isn't currently using.
   *  Includes batter, bowler, AND situation cards. */
  cardIds: string[];
}

export interface WCRun {
  /** Set when the run starts. Locked to T3 for v1. */
  format: MatchFormat;
  /** Full ladder (5 group + 1 semi + 1 final = 7 opponents), pre-rolled
   *  at run start so the player sees their "draw" up front. */
  ladder: WCOpponent[];
  /** Match history; index aligns with the ladder. */
  history: WCMatchRecord[];
  /** Current stage of the run. */
  stage: WCStage;
  /** Picks made during the draft (immutable post-draft). */
  draft: DraftedDeck | null;
  /** Mutable deck for the current run. Built post-draft. */
  deck: RunDeck | null;
  /** Cards earned from per-win packs but not in the active deck. */
  inventory: RunInventory;
  /** Number of group matches won so far. Used for group→semi gating. */
  groupWins: number;
  startedAt: number;
}

/**
 * The permanent collection — cards the player has won across all
 * trophies. Currently used only by the read-only collection view; will
 * power freeplay / online modes when those ship.
 */
export interface PermanentCollection {
  /** cardId → count owned. Duplicates are allowed (esp. situation cards). */
  cards: Record<string, number>;
  /** Counts toward the "X trophies" stat in collection view. */
  trophies: number;
  /** Lifetime run attempts (won + lost + abandoned). */
  runsPlayed: number;
}

export interface CareerSave {
  permanentCollection: PermanentCollection;
  currentRun: WCRun | null;
  /** True when the user has kicked off a WC match and the actual
   *  gameplay (InningsScreen) is in progress. The match-over screen
   *  reads this to know whether to route into pack-opening (true) or
   *  back to home (false). Cleared on match completion. */
  wcMatchInFlight: boolean;
  savedAt: number;
}

const DEFAULTS: CareerSave = {
  permanentCollection: { cards: {}, trophies: 0, runsPlayed: 0 },
  currentRun: null,
  wcMatchInFlight: false,
  savedAt: 0,
};

// ─────────────────────────── Load / save ───────────────────────────

function load(): CareerSave {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as Partial<CareerSave>;
    // Shallow merge with defaults so older saves missing newer fields
    // don't crash. Nested objects fall back individually.
    return {
      permanentCollection: {
        ...DEFAULTS.permanentCollection,
        ...(parsed.permanentCollection ?? {}),
        cards: {
          ...DEFAULTS.permanentCollection.cards,
          ...(parsed.permanentCollection?.cards ?? {}),
        },
      },
      currentRun: parsed.currentRun ?? null,
      // Boot-time hygiene: if we restart with a stale wcMatchInFlight flag
      // (user refreshed during a match), the matchState is gone — drop the
      // flag so the UI doesn't expect a pack to open.
      wcMatchInFlight: false,
      savedAt: parsed.savedAt ?? 0,
    };
  } catch {
    return cloneDefaults();
  }
}

function cloneDefaults(): CareerSave {
  return JSON.parse(JSON.stringify(DEFAULTS)) as CareerSave;
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    current.savedAt = Date.now();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage can throw (private mode, quota). Silently swallow —
    // the in-memory state still works for the current session.
  }
}

let current: CareerSave = load();

const listeners = new Set<(s: CareerSave) => void>();

function notify(): void {
  for (const fn of listeners) fn(current);
}

// ─────────────────────────── Public read API ───────────────────────────

export function getCareer(): CareerSave {
  return current;
}

export function subscribeCareer(fn: (s: CareerSave) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ─────────────────────────── Run lifecycle ───────────────────────────

/**
 * Start a new WC run. Generates the ladder + opens the draft stage.
 * Returns the freshly-created run. The caller is responsible for
 * advancing through the draft (see setDraft) and into match play.
 *
 * If a run already exists, throws — callers must explicitly call
 * abandonRun() first to discard the previous run.
 */
export function startNewRun(format: MatchFormat, ladder: WCOpponent[]): WCRun {
  if (current.currentRun) {
    throw new Error(
      "A run is already in progress. Call abandonRun() first.",
    );
  }
  const run: WCRun = {
    format,
    ladder,
    history: [],
    stage: "drafting",
    draft: null,
    deck: null,
    inventory: { cardIds: [] },
    groupWins: 0,
    startedAt: Date.now(),
  };
  current.currentRun = run;
  current.permanentCollection.runsPlayed += 1;
  persist();
  notify();
  return run;
}

/**
 * Finalize the draft picks. Caller should also call setDeck() to set
 * the initial deck (drafted + auto-filled Silver/Bronze).
 */
export function setDraft(draft: DraftedDeck): void {
  if (!current.currentRun) return;
  current.currentRun.draft = draft;
  current.currentRun.stage = "group";
  persist();
  notify();
}

/** Replace the run's active deck. Caller validates composition. */
export function setDeck(deck: RunDeck): void {
  if (!current.currentRun) return;
  current.currentRun.deck = deck;
  persist();
  notify();
}

/** Flag that a WC match has been kicked off — the actual gameplay
 *  (InningsScreen) is now active. The match-over screen reads this to
 *  route into pack-opening instead of back to home. */
export function startWCMatch(): void {
  current.wcMatchInFlight = true;
  persist();
  notify();
}

/** Clear the in-flight flag — called once the post-match pack is opened
 *  (or skipped on a loss). */
export function endWCMatch(): void {
  current.wcMatchInFlight = false;
  persist();
  notify();
}

/** Append cards to the run inventory (from a per-win pack pick). */
export function addToInventory(cardIds: string[]): void {
  if (!current.currentRun) return;
  current.currentRun.inventory.cardIds.push(...cardIds);
  persist();
  notify();
}

/**
 * Record a match result. Advances the WC stage automatically:
 *  - Group wins increment groupWins; on the 5th group match, advance
 *    to semi (if ≥3 wins) or end the run as lost.
 *  - Semi win → final; semi loss → lost.
 *  - Final win → won; final loss → lost.
 */
export function recordMatch(result: WCMatchResult, opponent: WCOpponent): void {
  if (!current.currentRun) return;
  current.currentRun.history.push({
    opponent,
    result,
    finishedAt: Date.now(),
  });
  if (result === "win" && opponent.stageLabel === "group") {
    current.currentRun.groupWins += 1;
  }
  advanceStageAfterMatch(opponent, result);
  persist();
  notify();
}

function advanceStageAfterMatch(opp: WCOpponent, result: WCMatchResult): void {
  if (!current.currentRun) return;
  const run = current.currentRun;
  if (opp.stageLabel === "group") {
    const groupMatchesPlayed = run.history.filter(
      (h) => h.opponent.stageLabel === "group",
    ).length;
    if (groupMatchesPlayed >= 5) {
      // Group stage over. Advance if 3+ wins.
      if (run.groupWins >= 3) {
        run.stage = "semi";
      } else {
        run.stage = "lost";
      }
    }
    // else: still in group stage, no change
  } else if (opp.stageLabel === "semi") {
    run.stage = result === "win" ? "final" : "lost";
  } else if (opp.stageLabel === "final") {
    run.stage = result === "win" ? "won" : "lost";
  }
}

/** Return the next opponent to play, or null if the run is over. */
export function nextOpponent(): WCOpponent | null {
  if (!current.currentRun) return null;
  const run = current.currentRun;
  if (run.stage === "won" || run.stage === "lost" || run.stage === "abandoned") {
    return null;
  }
  if (run.stage === "drafting") return null;
  const played = run.history.length;
  return run.ladder[played] ?? null;
}

/**
 * Apply a trophy-final pack to the permanent collection. Caller passes
 * the 2 chosen card ids (after the player picked from the 6-option pack).
 */
export function applyTrophyPack(chosenCardIds: string[]): void {
  if (!current.currentRun || current.currentRun.stage !== "won") return;
  for (const id of chosenCardIds) {
    current.permanentCollection.cards[id] =
      (current.permanentCollection.cards[id] ?? 0) + 1;
  }
  current.permanentCollection.trophies += 1;
  persist();
  notify();
}

/**
 * End the current run — moves it out of currentRun and into the
 * permanent collection only via applyTrophyPack (which the caller
 * does separately if the run ended in a trophy). Wipes ephemeral
 * run state.
 */
export function endRun(): void {
  if (!current.currentRun) return;
  current.currentRun = null;
  persist();
  notify();
}

/**
 * Abandon the current run mid-way. Equivalent to endRun() but flips
 * the stage to "abandoned" first so any UI can reflect that.
 */
export function abandonRun(): void {
  if (!current.currentRun) return;
  current.currentRun.stage = "abandoned";
  endRun();
}

// ─────────────────────────── Dev / debug helpers ───────────────────────────

/** WARNING: nukes everything. Used only by tests + a dev-tools button. */
export function _resetCareer(): void {
  current = cloneDefaults();
  persist();
  notify();
}
