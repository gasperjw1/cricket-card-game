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

/** Tournament variant — picked at run creation. Changes the ladder shape
 *  + which nations are eligible. */
export type TournamentFormat = "world-cup" | "asia-cup" | "champions-trophy";

/** Difficulty mode — picked at run creation. Tunes bot levels across the
 *  whole ladder. Hidden from the in-run UI per spec. */
export type DifficultyMode = "casual" | "realistic" | "legend";

/** Stage of a tournament run. */
export type WCStage =
  | "drafting"     // player is in the draft, deck not yet built
  | "group"        // playing group-stage matches (WC + Asia Cup only)
  | "qf"           // quarter-final (Champions Trophy only)
  | "semi"         // semi-final (1 match)
  | "final"        // final (1 match)
  | "won"          // trophy won, post-final state
  | "lost"         // eliminated (group failed-to-advance, KO loss)
  | "abandoned";   // player dropped out

/** Labels visible on the ladder UI. Subset of WCStage. */
export type StageLabel = "group" | "qf" | "semi" | "final";

/** A single opponent on the ladder, set at run creation. */
export interface WCOpponent {
  /** Display name of the nation (matches Nation type values). */
  nation: string;
  /** Server-side bot difficulty for this matchup. Drives the bot
   *  Phase-1 controller. Hidden from the player's in-run ladder UI. */
  difficulty: "Gully" | "Domestic" | "International";
  /** Drives UI labels + advancement logic. */
  stageLabel: StageLabel;
  /** Has this match been played? Result is captured separately in record. */
  matchIndex: number;
}

/** Per-tournament shape: which nations are eligible, ladder layout,
 *  group-advancement requirement. */
export interface TournamentConfig {
  format: TournamentFormat;
  label: string;
  /** Short display name without the emoji prefix ("T20 World Cup"). */
  shortName: string;
  /** Single emoji used as the tournament emblem in headers + pre-match. */
  emblem: string;
  blurb: string;
  /** Test-nation pool eligible for this tournament. */
  eligibleNations: readonly string[];
  /** Number of group-stage matches before knockouts. 0 for sudden-death
   *  tournaments (Champions Trophy). */
  groupMatches: number;
  /** Wins required from group to advance to the first knockout stage. */
  groupWinsToAdvance: number;
  /** Knockout stages in order. Last entry is always "final". */
  knockoutStages: ("qf" | "semi" | "final")[];
  /** Accent color for UI theming (hex). Drives header backgrounds,
   *  border accents on the career hub, pre-match overlay color, etc. */
  accentColor: string;
  /** Background gradient for the career-hub header. */
  headerGradient: string;
}

const ALL_TEST_NATIONS: readonly string[] = [
  "India", "Australia", "England", "South Africa", "New Zealand", "Pakistan",
  "Sri Lanka", "West Indies", "Bangladesh", "Zimbabwe", "Afghanistan", "Ireland",
];

/** Subcontinental nations for Asia Cup. */
const ASIA_CUP_NATIONS: readonly string[] = [
  "India", "Pakistan", "Sri Lanka", "Bangladesh", "Afghanistan",
];

/** Top 8 nations for Champions Trophy (sudden-death knockout). */
const CHAMPIONS_TROPHY_NATIONS: readonly string[] = [
  "India", "Australia", "England", "South Africa", "New Zealand", "Pakistan",
  "West Indies", "Bangladesh",
];

export const TOURNAMENT_FORMATS: Record<TournamentFormat, TournamentConfig> = {
  "world-cup": {
    format: "world-cup",
    label: "🌍 T20 World Cup",
    shortName: "T20 World Cup",
    emblem: "🌍",
    blurb: "12-nation pool · 5 group matches (3 wins to advance) · semi · final.",
    eligibleNations: ALL_TEST_NATIONS,
    groupMatches: 5,
    groupWinsToAdvance: 3,
    knockoutStages: ["semi", "final"],
    accentColor: "#2563eb",
    headerGradient: "linear-gradient(135deg, #1c2a3a 0%, #11253e 60%, #0c1d33 100%)",
  },
  "asia-cup": {
    format: "asia-cup",
    label: "🌏 Asia Cup",
    shortName: "Asia Cup",
    emblem: "🌏",
    blurb: "Subcontinent only · 4 group matches (3 wins to advance) · semi · final.",
    eligibleNations: ASIA_CUP_NATIONS,
    groupMatches: 4,
    groupWinsToAdvance: 3,
    knockoutStages: ["semi", "final"],
    accentColor: "#d4a72c",
    headerGradient: "linear-gradient(135deg, #2a1f0d 0%, #3a2912 60%, #1f1709 100%)",
  },
  "champions-trophy": {
    format: "champions-trophy",
    label: "🏆 Champions Trophy",
    shortName: "Champions Trophy",
    emblem: "🏆",
    blurb: "Top 8 · pure knockouts: quarter-final → semi → final. One loss and you're out.",
    eligibleNations: CHAMPIONS_TROPHY_NATIONS,
    groupMatches: 0,
    groupWinsToAdvance: 0,
    knockoutStages: ["qf", "semi", "final"],
    accentColor: "#c0c5cd",
    headerGradient: "linear-gradient(135deg, #1a1c22 0%, #2a2d36 60%, #11141a 100%)",
  },
};

/** UI labels + colors for difficulty modes. */
export const DIFFICULTY_LABEL: Record<DifficultyMode, string> = {
  casual: "Casual",
  realistic: "Realistic",
  legend: "Legend",
};
export const DIFFICULTY_BLURB: Record<DifficultyMode, string> = {
  casual: "All opponents play at Gully level. Good for new players or quick wins.",
  realistic: "Ramps up: easier in the group stage, International in the final.",
  legend: "Every opponent plays at International level. Brutal — for vets only.",
};

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
  /** Tournament variant — picked at run-creation. Drives ladder shape +
   *  eligible nations. Defaults to "world-cup" for back-compat. */
  tournament: TournamentFormat;
  /** Difficulty mode — picked at run-creation. Hidden from the in-run
   *  ladder UI per spec. */
  difficulty: DifficultyMode;
  /** Full ladder (length varies by tournament), pre-rolled at run start
   *  so the player sees their "draw" up front. */
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
  /** Number of group matches won so far. Used for group→knockout gating. */
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

/**
 * Lifetime career stats — tracked across all runs. Powers the
 * dedicated CareerStatsScreen. Updated in recordMatch +
 * applyTrophyPack so the values stay accurate.
 */
export interface CareerStats {
  /** Total matches played (all results across all runs). */
  matchesPlayed: number;
  /** Total matches won (all stages, all runs). */
  matchesWon: number;
  /** Total runs scored by the player across every match (innings 1 +
   *  innings 2 when player batted). */
  totalRunsScored: number;
  /** Total wickets taken (when player was bowling, innings the
   *  opponent batted). */
  totalWicketsTaken: number;
  /** Longest consecutive matches won across runs. */
  longestWinStreak: number;
  /** Current streak — resets on any loss. */
  currentWinStreak: number;
  /** Trophies broken down by tournament. */
  trophiesByTournament: Record<TournamentFormat, number>;
  /** Trophies broken down by difficulty (records the hardest you've won). */
  trophiesByDifficulty: Record<DifficultyMode, number>;
  /** Total abandoned runs. */
  runsAbandoned: number;
}

export interface CareerSave {
  permanentCollection: PermanentCollection;
  currentRun: WCRun | null;
  /** Lifetime stats — see CareerStats. */
  stats: CareerStats;
  /** True when the user has kicked off a WC match and the actual
   *  gameplay (InningsScreen) is in progress. The match-over screen
   *  reads this to know whether to route into pack-opening (true) or
   *  back to home (false). Cleared on match completion. */
  wcMatchInFlight: boolean;
  savedAt: number;
}

const DEFAULT_STATS: CareerStats = {
  matchesPlayed: 0,
  matchesWon: 0,
  totalRunsScored: 0,
  totalWicketsTaken: 0,
  longestWinStreak: 0,
  currentWinStreak: 0,
  trophiesByTournament: { "world-cup": 0, "asia-cup": 0, "champions-trophy": 0 },
  trophiesByDifficulty: { casual: 0, realistic: 0, legend: 0 },
  runsAbandoned: 0,
};

const DEFAULTS: CareerSave = {
  permanentCollection: { cards: {}, trophies: 0, runsPlayed: 0 },
  currentRun: null,
  stats: DEFAULT_STATS,
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
    const migratedRun = parsed.currentRun
      ? {
          // Spread first so we don't overwrite existing fields, then
          // explicitly fall back to defaults when missing (pre-v5 saves).
          ...parsed.currentRun,
          tournament: parsed.currentRun.tournament ?? "world-cup",
          difficulty: parsed.currentRun.difficulty ?? "realistic",
        }
      : null;
    return {
      permanentCollection: {
        ...DEFAULTS.permanentCollection,
        ...(parsed.permanentCollection ?? {}),
        cards: {
          ...DEFAULTS.permanentCollection.cards,
          ...(parsed.permanentCollection?.cards ?? {}),
        },
      },
      currentRun: migratedRun,
      stats: {
        ...DEFAULT_STATS,
        ...(parsed.stats ?? {}),
        trophiesByTournament: {
          ...DEFAULT_STATS.trophiesByTournament,
          ...(parsed.stats?.trophiesByTournament ?? {}),
        },
        trophiesByDifficulty: {
          ...DEFAULT_STATS.trophiesByDifficulty,
          ...(parsed.stats?.trophiesByDifficulty ?? {}),
        },
      },
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

/**
 * Notify all subscribers with a fresh top-level CareerSave reference so
 * React `useState` consumers actually re-render. Without the clone,
 * setState would receive the same object reference and skip the render
 * (React uses reference equality, not deep comparison).
 *
 * We also shallow-clone nested branches that change frequently
 * (currentRun, currentRun.deck, currentRun.inventory) so consumers
 * destructuring those still see fresh references.
 */
function notify(): void {
  current = cloneShallow(current);
  for (const fn of listeners) fn(current);
}

function cloneShallow(save: CareerSave): CareerSave {
  const next: CareerSave = {
    ...save,
    permanentCollection: { ...save.permanentCollection, cards: { ...save.permanentCollection.cards } },
    stats: {
      ...save.stats,
      trophiesByTournament: { ...save.stats.trophiesByTournament },
      trophiesByDifficulty: { ...save.stats.trophiesByDifficulty },
    },
    currentRun: save.currentRun
      ? {
          ...save.currentRun,
          deck: save.currentRun.deck
            ? {
                battingDeck: [...save.currentRun.deck.battingDeck],
                bowlingDeck: [...save.currentRun.deck.bowlingDeck],
              }
            : null,
          inventory: { cardIds: [...save.currentRun.inventory.cardIds] },
          history: [...save.currentRun.history],
        }
      : null,
  };
  return next;
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
export function startNewRun(
  format: MatchFormat,
  tournament: TournamentFormat,
  difficulty: DifficultyMode,
  ladder: WCOpponent[],
): WCRun {
  if (current.currentRun) {
    throw new Error(
      "A run is already in progress. Call abandonRun() first.",
    );
  }
  const run: WCRun = {
    format,
    tournament,
    difficulty,
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

/**
 * Atomically swap one card in the active deck with one card in the run
 * inventory. The removed deck card goes back to the inventory (first
 * occurrence position); the inventory card slots into the deck at the
 * same index the removed card occupied.
 *
 * Caller validates that the swap is legal (same kind, etc.) — this
 * function only enforces the existence of both card ids.
 */
export function swapDeckInventoryCard(
  role: "batting" | "bowling",
  deckCardId: string,
  inventoryCardId: string,
): void {
  if (!current.currentRun?.deck) return;
  const run = current.currentRun;
  const deckList = role === "batting" ? run.deck!.battingDeck : run.deck!.bowlingDeck;
  const deckIdx = deckList.indexOf(deckCardId);
  const invIdx = run.inventory.cardIds.indexOf(inventoryCardId);
  if (deckIdx < 0 || invIdx < 0) return;

  // Build fresh arrays so React's reference comparison triggers re-render.
  const newDeckList = [...deckList];
  newDeckList[deckIdx] = inventoryCardId;
  const newInventoryIds = [...run.inventory.cardIds];
  newInventoryIds.splice(invIdx, 1, deckCardId); // replace at same index

  const newDeck: RunDeck = {
    battingDeck: role === "batting" ? newDeckList : [...run.deck!.battingDeck],
    bowlingDeck: role === "bowling" ? newDeckList : [...run.deck!.bowlingDeck],
  };
  current.currentRun = {
    ...run,
    deck: newDeck,
    inventory: { cardIds: newInventoryIds },
  };
  persist();
  notify();
}

/** Append cards to the run inventory (from a per-win pack pick).
 *  Immutable update so React subscribers see new array reference. */
export function addToInventory(cardIds: string[]): void {
  if (!current.currentRun) return;
  current.currentRun = {
    ...current.currentRun,
    inventory: {
      cardIds: [...current.currentRun.inventory.cardIds, ...cardIds],
    },
  };
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
  // Stats updates.
  current.stats.matchesPlayed += 1;
  if (result === "win") {
    current.stats.matchesWon += 1;
    current.stats.currentWinStreak += 1;
    if (current.stats.currentWinStreak > current.stats.longestWinStreak) {
      current.stats.longestWinStreak = current.stats.currentWinStreak;
    }
  } else {
    current.stats.currentWinStreak = 0;
  }
  advanceStageAfterMatch(opponent, result);
  persist();
  notify();
}

function advanceStageAfterMatch(opp: WCOpponent, result: WCMatchResult): void {
  if (!current.currentRun) return;
  const run = current.currentRun;
  const config = TOURNAMENT_FORMATS[run.tournament];

  if (opp.stageLabel === "group") {
    // Group-stage tournaments (WC, Asia Cup).
    const groupMatchesPlayed = run.history.filter(
      (h) => h.opponent.stageLabel === "group",
    ).length;
    if (groupMatchesPlayed >= config.groupMatches) {
      // Group stage over. Advance if enough wins.
      if (run.groupWins >= config.groupWinsToAdvance) {
        run.stage = config.knockoutStages[0]!;
      } else {
        run.stage = "lost";
      }
    }
    // else: still in group stage, no change
    return;
  }

  // Knockout stage — sudden death. On loss, run over.
  if (result === "loss" || result === "tie") {
    run.stage = "lost";
    return;
  }
  // Win — advance to next knockout, or "won" if this was the final.
  const stages = config.knockoutStages;
  const currentIdx = stages.indexOf(opp.stageLabel);
  if (currentIdx === stages.length - 1) {
    run.stage = "won";
  } else {
    run.stage = stages[currentIdx + 1]!;
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
  // Stats: per-tournament + per-difficulty trophy counts.
  current.stats.trophiesByTournament[current.currentRun.tournament] += 1;
  current.stats.trophiesByDifficulty[current.currentRun.difficulty] += 1;
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
  current.stats.runsAbandoned += 1;
  current.stats.currentWinStreak = 0;
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
