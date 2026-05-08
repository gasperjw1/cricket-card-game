/**
 * Server-authoritative innings flow.
 *
 * Drives the per-ball loop: deals hands, holds simultaneous selections, runs
 * the resolution engine, broadcasts reveals, advances ball/innings, ends the
 * match. Pure-ish: side effects (broadcasting, timers) are passed in via
 * callbacks so this module is easy to reason about.
 */

import {
  DECK_SIZE,
  HAND_SIZE,
  MAX_BALLS_PER_INNINGS,
  MAX_WICKETS_PER_INNINGS,
  POST_BALL_PAUSE_SECONDS,
  SWAP_PICK_TIMER_SECONDS,
  TURN_TIMER_SECONDS,
  resolveBall,
  type AnyCard,
  type BallOutcome,
  type BallResult,
  type BallSelection,
  type BatsmanCard,
  type BowlerCard,
  type InningsState,
  type MatchResult,
  type PendingSwap,
  type PlayerSlot,
  type PrivatePlayerView,
  type ResolutionStep,
  type RevealedSelection,
  type SituationCard,
  type SituationDeck,
  type SwapReason,
  type TableSnapshot,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import {
  activeRoleForSlot,
  type BallResolutionContext,
  type ServerDecks,
  type ServerMatch,
} from "./match-registry.js";

const BALL_TIMER_KEY = "ball-timer";
const SWAP_TIMER_KEY = "swap-timer";
const POST_BALL_TIMER_KEY = "post-ball-pause";

export interface InningsCallbacks {
  /** Push the latest match:state to both players. */
  broadcastState: (match: ServerMatch) => void;
  /** Send the per-player private view (hand contents). */
  broadcastPrivate: (
    match: ServerMatch,
    slot: PlayerSlot,
    view: PrivatePlayerView,
  ) => void;
  /** Notify both clients that the opponent has locked in (post-submit, pre-reveal). */
  notifyOpponentLocked: (match: ServerMatch, lockingSlot: PlayerSlot) => void;
  /** Emit ball:reveal to both players. */
  emitReveal: (match: ServerMatch, result: BallResult) => void;
}

// ─────────────────────────── Public entry points ───────────────────────────

/**
 * Called when the coin toss completes. Builds both players' decks, sets up
 * innings 1, deals opening hands, and starts the first ball timer.
 */
export function startInnings1(match: ServerMatch, cb: InningsCallbacks): void {
  if (!match.coinToss?.battingSlot) return;
  match.decks = {
    A: makePlayerDecks(),
    B: makePlayerDecks(),
  };
  const battingSlot = match.coinToss.battingSlot;
  const bowlingSlot: PlayerSlot = battingSlot === "A" ? "B" : "A";
  match.innings1 = {
    battingPlayer: battingSlot,
    bowlingPlayer: bowlingSlot,
    runs: 0,
    wickets: 0,
    ballsBowled: 0,
    target: null,
    isComplete: false,
    log: [],
  };
  match.currentInnings = 1;
  match.phase = "innings";
  dealOpeningHands(match);
  startBallTimer(match, cb);
  cb.broadcastState(match);
  pushPrivateViews(match, cb);
}

/**
 * Player submitted a ball selection. Validates, stores, and either advances
 * to resolution (if both have submitted) or notifies the opponent that this
 * player has locked in.
 */
export function submitBallSelection(
  match: ServerMatch,
  slot: PlayerSlot,
  selection: BallSelection,
  cb: InningsCallbacks,
): { ok: boolean; reason?: string } {
  if (match.phase !== "innings") {
    return { ok: false, reason: "Not in an innings" };
  }
  const validation = validateSelection(match, slot, selection);
  if (!validation.ok) return validation;

  if (match.pendingSelections[slot]) {
    return { ok: false, reason: "Already submitted this ball" };
  }
  match.pendingSelections[slot] = selection;

  // Notify the opponent that this player locked in.
  cb.notifyOpponentLocked(match, slot);

  const otherSlot: PlayerSlot = slot === "A" ? "B" : "A";
  if (match.pendingSelections[otherSlot]) {
    // Both submitted — resolve.
    resolveBallTurn(match, cb, /* timedOut */ false);
  }
  return { ok: true };
}

// ─────────────────────────── Internal flow ───────────────────────────

function startBallTimer(match: ServerMatch, cb: InningsCallbacks): void {
  clearBallTimer(match);
  match.currentBallDeadlineEpochMs = Date.now() + TURN_TIMER_SECONDS * 1000;
  const t = setTimeout(() => {
    resolveBallTurn(match, cb, /* timedOut */ true);
  }, TURN_TIMER_SECONDS * 1000);
  match.timers.set(BALL_TIMER_KEY, t);
}

function clearBallTimer(match: ServerMatch): void {
  const t = match.timers.get(BALL_TIMER_KEY);
  if (t) {
    clearTimeout(t);
    match.timers.delete(BALL_TIMER_KEY);
  }
  match.currentBallDeadlineEpochMs = null;
}

function resolveBallTurn(
  match: ServerMatch,
  cb: InningsCallbacks,
  timedOut: boolean,
): void {
  if (match.phase !== "innings") return;
  clearBallTimer(match);

  // Auto-fill missing selections on timeout.
  for (const slot of ["A", "B"] as const) {
    if (!match.pendingSelections[slot]) {
      const auto = autoPickSelection(match, slot);
      if (auto) match.pendingSelections[slot] = auto;
    }
  }

  const innings = currentInnings(match);
  if (!innings || !match.decks) return;
  const battingSlot = innings.battingPlayer;
  const bowlingSlot = innings.bowlingPlayer;

  const battingSelection = match.pendingSelections[battingSlot];
  const bowlingSelection = match.pendingSelections[bowlingSlot];
  if (!battingSelection || !bowlingSelection) {
    advanceAfterBall(match, cb, makeNoOpResult(match));
    return;
  }

  // Resolve the played cards into the actual card objects.
  const battingHand = match.decks[battingSlot].hand;
  const bowlingHand = match.decks[bowlingSlot].hand;
  const battingMandatory = findCardById(battingHand, battingSelection.mandatoryCardId);
  const bowlingMandatory = findCardById(bowlingHand, bowlingSelection.mandatoryCardId);
  const battingSituation = battingSelection.situationCardId
    ? (findCardById(battingHand, battingSelection.situationCardId) as SituationCard | null)
    : null;
  const bowlingSituation = bowlingSelection.situationCardId
    ? (findCardById(bowlingHand, bowlingSelection.situationCardId) as SituationCard | null)
    : null;

  if (
    !battingMandatory ||
    battingMandatory.kind !== "batsman" ||
    !bowlingMandatory ||
    bowlingMandatory.kind !== "bowler"
  ) {
    advanceAfterBall(match, cb, makeNoOpResult(match));
    return;
  }

  // Build the resolution context. The pipeline below mutates it and may
  // pause on a swap; on resume (handleBallSwapPick) we continue from the
  // same context.
  const ctx: BallResolutionContext = {
    battingSlot,
    bowlingSlot,
    battingMandatory,
    bowlingMandatory,
    battingSituation,
    bowlingSituation,
    upstreamSteps: [],
    forcedDowngradeFromMankad: false,
    battingPlayedIds: [
      battingSelection.mandatoryCardId,
      battingSelection.situationCardId,
    ].filter((s): s is string => Boolean(s)),
    bowlingPlayedIds: [
      bowlingSelection.mandatoryCardId,
      bowlingSelection.situationCardId,
    ].filter((s): s is string => Boolean(s)),
    battingAutoPicked: battingSelection.autoPicked,
    bowlingAutoPicked: bowlingSelection.autoPicked,
    timedOut,
  };
  match.ballContext = ctx;

  // ─── Step 1: Old School cancellation ───
  applyOldSchoolCancel(ctx);

  // ─── Step 2: Mankad / Retired Out / Cramps swaps ───
  // continueResolution looks for the next swap-trigger. If found and the
  // affected player has candidate cards, it sets match.pendingSwap and
  // returns; the actual replacement is fed in later via handleBallSwapPick.
  // If no candidates, it applies the spec's penalty inline and continues.
  continueResolution(match, cb);
}

/**
 * Applies pending swap-card effects in order, prompting the affected player
 * via match.pendingSwap when a pick is required. Falls through to
 * runEngineAndAdvance when no more swaps are pending.
 */
function continueResolution(match: ServerMatch, cb: InningsCallbacks): void {
  const ctx = match.ballContext;
  if (!ctx || !match.decks) return;

  // Order: Mankad first (forced on opponent), then Retired Out (batter's
  // own choice), then Cramps (bowler's own choice). Spec doesn't mandate
  // order but each is independent at this point.

  if (ctx.bowlingSituation?.id === "mankad") {
    if (promptSwap(match, cb, "mankad", ctx.battingSlot, ctx.battingMandatory.id, "batsman")) {
      return; // paused on user input
    }
    // No swap target — apply spec penalty inline and consume the card.
    ctx.forcedDowngradeFromMankad = true;
    ctx.upstreamSteps.push({
      kind: "mankad",
      label: "Mankad",
      detail: `No other batsman available — ${ctx.battingMandatory.name} stays but takes a one-tier downgrade.`,
      applied: true,
    });
    ctx.bowlingSituation = null;
  }

  if (ctx.battingSituation?.id === "retired-out") {
    if (promptSwap(match, cb, "retired-out", ctx.battingSlot, ctx.battingMandatory.id, "batsman")) {
      return;
    }
    ctx.upstreamSteps.push({
      kind: "retired-out",
      label: "Retired Out",
      detail: `No other batsman in hand — Retired Out fizzles.`,
      applied: false,
    });
    ctx.battingSituation = null;
  }

  if (ctx.bowlingSituation?.id === "cramps") {
    if (promptSwap(match, cb, "cramps", ctx.bowlingSlot, ctx.bowlingMandatory.id, "bowler")) {
      return;
    }
    ctx.upstreamSteps.push({
      kind: "cramps",
      label: "Cramps",
      detail: `No other bowler in hand — Cramps fizzles.`,
      applied: false,
    });
    ctx.bowlingSituation = null;
  }

  runEngineAndAdvance(match, cb);
}

/**
 * If the affected player has any candidate cards of the right kind, sets
 * match.pendingSwap and broadcasts state. Returns true when paused for
 * user input; false when no candidates were available (caller falls back).
 */
function promptSwap(
  match: ServerMatch,
  cb: InningsCallbacks,
  reason: SwapReason,
  fromSlot: PlayerSlot,
  excludeId: string,
  kind: "batsman" | "bowler",
): boolean {
  if (!match.decks || !match.ballContext) return false;
  const hand = match.decks[fromSlot].hand;
  const candidates = hand.filter((c) => c.kind === kind && c.id !== excludeId);
  if (candidates.length === 0) return false;

  const original = hand.find((c) => c.id === excludeId);
  const originalName = original ? (original as BatsmanCard | BowlerCard).name : "your card";

  const ctx = match.ballContext;
  const table: TableSnapshot = {
    battingSlot: ctx.battingSlot,
    bowlingSlot: ctx.bowlingSlot,
    battingMandatory: ctx.battingMandatory,
    bowlingMandatory: ctx.bowlingMandatory,
    battingSituation: ctx.battingSituation,
    bowlingSituation: ctx.bowlingSituation,
  };

  const deadline = Date.now() + SWAP_PICK_TIMER_SECONDS * 1000;
  const swap: PendingSwap = {
    fromSlot,
    reason,
    originalCardId: excludeId,
    originalCardName: originalName,
    candidateIds: candidates.map((c) => c.id),
    deadlineEpochMs: deadline,
    table,
  };
  match.pendingSwap = swap;

  // Auto-pick on timeout.
  scheduleSwapTimer(match, cb, deadline, () => {
    const fallback = candidates[0];
    if (fallback) applySwapPick(match, cb, fromSlot, fallback.id, /* auto */ true);
  });

  cb.broadcastState(match);
  return true;
}

/**
 * Public entry for client ball:swap-pick. Validates and applies, then
 * resumes the resolution pipeline.
 */
export function handleBallSwapPick(
  match: ServerMatch,
  fromSlot: PlayerSlot,
  cardId: string,
  cb: InningsCallbacks,
): { ok: boolean; reason?: string } {
  if (!match.pendingSwap) return { ok: false, reason: "No swap pending" };
  if (match.pendingSwap.fromSlot !== fromSlot) {
    return { ok: false, reason: "Not your swap pick" };
  }
  if (!match.pendingSwap.candidateIds.includes(cardId)) {
    return { ok: false, reason: "Not a valid replacement" };
  }
  applySwapPick(match, cb, fromSlot, cardId, /* auto */ false);
  return { ok: true };
}

function applySwapPick(
  match: ServerMatch,
  cb: InningsCallbacks,
  fromSlot: PlayerSlot,
  cardId: string,
  auto: boolean,
): void {
  if (!match.pendingSwap || !match.ballContext || !match.decks) return;
  const reason = match.pendingSwap.reason;
  const ctx = match.ballContext;
  const replacement = match.decks[fromSlot].hand.find((c) => c.id === cardId);
  if (!replacement) return;

  if (reason === "mankad" || reason === "retired-out") {
    if (replacement.kind !== "batsman") return;
    ctx.upstreamSteps.push({
      kind: reason,
      label: reason === "mankad" ? "Mankad" : "Retired Out",
      detail:
        reason === "mankad"
          ? `Mankad! ${ctx.battingMandatory.name} forced off — ${replacement.name} comes in${auto ? " (auto-picked, timer expired)" : ""}.`
          : `${ctx.battingMandatory.name} retired out — ${replacement.name} replaces them${auto ? " (auto-picked)" : ""}.`,
      applied: true,
    });
    // The new batsman is now the one whose card the engine looks up. The
    // ORIGINAL played mandatory is also discarded at end of ball, AND the
    // replacement is consumed — so add it to the discard list.
    if (!ctx.battingPlayedIds.includes(replacement.id)) {
      ctx.battingPlayedIds.push(replacement.id);
    }
    ctx.battingMandatory = replacement;
    if (reason === "mankad") ctx.bowlingSituation = null;
    if (reason === "retired-out") ctx.battingSituation = null;
  } else if (reason === "cramps") {
    if (replacement.kind !== "bowler") return;
    ctx.upstreamSteps.push({
      kind: "cramps",
      label: "Cramps",
      detail: `${ctx.bowlingMandatory.name} pulls up — ${replacement.name} bowls instead${auto ? " (auto-picked)" : ""}.`,
      applied: true,
    });
    if (!ctx.bowlingPlayedIds.includes(replacement.id)) {
      ctx.bowlingPlayedIds.push(replacement.id);
    }
    ctx.bowlingMandatory = replacement;
    ctx.bowlingSituation = null;
  }

  match.pendingSwap = null;
  clearSwapTimer(match);
  cb.broadcastState(match);
  continueResolution(match, cb);
}

function applyOldSchoolCancel(ctx: BallResolutionContext): void {
  if (
    ctx.battingSituation?.id === "old-school-batting" &&
    ctx.bowlingSituation
  ) {
    ctx.upstreamSteps.push({
      kind: "old-school-cancel",
      label: "Old School (batting)",
      detail: `Cancels ${ctx.bowlingSituation.name}.`,
      applied: true,
    });
    ctx.bowlingSituation = null;
    ctx.battingSituation = null;
  } else if (
    ctx.bowlingSituation?.id === "old-school-bowling" &&
    ctx.battingSituation
  ) {
    ctx.upstreamSteps.push({
      kind: "old-school-cancel",
      label: "Old School (bowling)",
      detail: `Cancels ${ctx.battingSituation.name}.`,
      applied: true,
    });
    ctx.battingSituation = null;
    ctx.bowlingSituation = null;
  } else if (
    ctx.battingSituation?.id === "old-school-batting" ||
    ctx.bowlingSituation?.id === "old-school-bowling"
  ) {
    ctx.upstreamSteps.push({
      kind: "old-school-cancel",
      label: "Old School",
      detail: "Played but opponent had no situation card to cancel.",
      applied: false,
    });
    if (ctx.battingSituation?.id === "old-school-batting") ctx.battingSituation = null;
    if (ctx.bowlingSituation?.id === "old-school-bowling") ctx.bowlingSituation = null;
  }
}

function runEngineAndAdvance(match: ServerMatch, cb: InningsCallbacks): void {
  const ctx = match.ballContext;
  const innings = currentInnings(match);
  if (!ctx || !innings || !match.decks) return;

  const engineResult = resolveBall({
    batsman: ctx.battingMandatory,
    bowler: ctx.bowlingMandatory,
    battingSituation: ctx.battingSituation,
    bowlingSituation: ctx.bowlingSituation,
  });

  let finalOutcome: BallOutcome = engineResult.finalOutcome;
  const allSteps: ResolutionStep[] = [...ctx.upstreamSteps, ...engineResult.steps];
  if (ctx.forcedDowngradeFromMankad) {
    const before = finalOutcome;
    finalOutcome = downgradeOnce(finalOutcome);
    allSteps.push({
      kind: "mankad",
      label: "Mankad penalty",
      detail: "Forced batsman couldn't be swapped — outcome downgraded one tier.",
      before,
      after: finalOutcome,
      applied: !sameOutcome(before, finalOutcome),
    });
  }

  // Build the BallResult for broadcast.
  const battingHand = match.decks[ctx.battingSlot].hand;
  const bowlingHand = match.decks[ctx.bowlingSlot].hand;
  const battingReveal: RevealedSelection = {
    player: ctx.battingSlot,
    role: "batting",
    mandatoryCard: ctx.battingMandatory,
    situationCard: ctx.battingSituation,
    autoPicked: ctx.battingAutoPicked,
  };
  const bowlingReveal: RevealedSelection = {
    player: ctx.bowlingSlot,
    role: "bowling",
    mandatoryCard: ctx.bowlingMandatory,
    situationCard: ctx.bowlingSituation,
    autoPicked: ctx.bowlingAutoPicked,
  };

  const ballNumber = innings.ballsBowled + 1;
  const result: BallResult = {
    ballNumber,
    battingSelection: battingReveal,
    bowlingSelection: bowlingReveal,
    resolutionSteps: allSteps,
    finalOutcome,
  };

  // Discard played cards (incl. swap replacements added to ctx.*PlayedIds).
  consumePlayedByIds(match.decks[ctx.battingSlot], ctx.battingPlayedIds);
  consumePlayedByIds(match.decks[ctx.bowlingSlot], ctx.bowlingPlayedIds);

  // Tear down ball context now that we're done with it.
  match.ballContext = null;
  // Ensure any stale swap state is cleared.
  match.pendingSwap = null;
  clearSwapTimer(match);

  // Suppress unused lint on hand variables
  void battingHand;
  void bowlingHand;

  advanceAfterBall(match, cb, result);
}

function scheduleSwapTimer(
  match: ServerMatch,
  cb: InningsCallbacks,
  deadlineEpochMs: number,
  fn: () => void,
): void {
  clearSwapTimer(match);
  const delay = Math.max(0, deadlineEpochMs - Date.now());
  const t = setTimeout(fn, delay);
  match.timers.set(SWAP_TIMER_KEY, t);
  void cb;
}

function clearSwapTimer(match: ServerMatch): void {
  const t = match.timers.get(SWAP_TIMER_KEY);
  if (t) {
    clearTimeout(t);
    match.timers.delete(SWAP_TIMER_KEY);
  }
}

function advanceAfterBall(
  match: ServerMatch,
  cb: InningsCallbacks,
  result: BallResult,
): void {
  const innings = currentInnings(match);
  if (!innings || !match.decks) return;

  // Score / wickets / log
  innings.ballsBowled += 1;
  if (result.finalOutcome.type === "runs") {
    innings.runs += result.finalOutcome.value;
  } else if (result.finalOutcome.type === "wicket") {
    innings.wickets += 1;
  }
  innings.log.push(result);

  cb.emitReveal(match, result);

  // Reset pending selections.
  match.pendingSelections = { A: null, B: null };

  const inningsDone =
    innings.ballsBowled >= MAX_BALLS_PER_INNINGS ||
    innings.wickets >= MAX_WICKETS_PER_INNINGS ||
    (match.currentInnings === 2 &&
      match.innings1 &&
      innings.runs > match.innings1.runs);

  // If another ball is coming, refill hands now so the post-ball pause
  // shows the player their next-ball hand.
  if (!inningsDone) {
    for (const slot of ["A", "B"] as const) {
      refillHand(match.decks[slot], activeDeckKey(match, slot));
      applyAntiClog(match.decks[slot], activeDeckKey(match, slot));
    }
  }

  // Always go through the post-ball pause — gives players a beat to read
  // the resolution trail before the next ball, the innings break, or the
  // match-over screen appears.
  match.postBallDeadlineEpochMs = Date.now() + POST_BALL_PAUSE_SECONDS * 1000;
  cb.broadcastState(match);
  pushPrivateViews(match, cb);

  scheduleTimer(match, POST_BALL_TIMER_KEY, match.postBallDeadlineEpochMs, () => {
    match.postBallDeadlineEpochMs = null;
    if (!inningsDone) {
      startBallTimer(match, cb);
      cb.broadcastState(match);
      return;
    }
    innings.isComplete = true;
    if (match.currentInnings === 1) {
      transitionToInnings2(match, cb);
    } else {
      endMatch(match, cb);
    }
  });
}

function scheduleTimer(
  match: ServerMatch,
  key: string,
  whenEpochMs: number,
  fn: () => void,
): void {
  clearScheduledTimer(match, key);
  const delay = Math.max(0, whenEpochMs - Date.now());
  const timer = setTimeout(fn, delay);
  match.timers.set(key, timer);
}

function clearScheduledTimer(match: ServerMatch, key: string): void {
  const t = match.timers.get(key);
  if (t) {
    clearTimeout(t);
    match.timers.delete(key);
  }
}

function transitionToInnings2(match: ServerMatch, cb: InningsCallbacks): void {
  if (!match.innings1 || !match.decks) return;
  const innings1 = match.innings1;
  const battingSlot: PlayerSlot = innings1.bowlingPlayer; // roles swap
  const bowlingSlot: PlayerSlot = innings1.battingPlayer;
  match.innings2 = {
    battingPlayer: battingSlot,
    bowlingPlayer: bowlingSlot,
    runs: 0,
    wickets: 0,
    ballsBowled: 0,
    target: innings1.runs + 1,
    isComplete: false,
    log: [],
  };
  match.currentInnings = 2;
  match.phase = "innings";
  // Re-deal opening hands from each player's NEW active deck.
  for (const slot of ["A", "B"] as const) {
    const decks = match.decks[slot];
    decks.discard.push(...decks.hand); // discard leftover hand from innings 1
    decks.hand = [];
    refillHand(decks, activeDeckKey(match, slot));
    applyAntiClog(decks, activeDeckKey(match, slot));
  }
  startBallTimer(match, cb);
  cb.broadcastState(match);
  pushPrivateViews(match, cb);
}

function endMatch(match: ServerMatch, cb: InningsCallbacks): void {
  clearBallTimer(match);
  match.phase = "match-over";
  match.result = computeResult(match);
  cb.broadcastState(match);
}

function computeResult(match: ServerMatch): MatchResult {
  if (!match.innings1 || !match.innings2) {
    return { winner: "tie", margin: "match incomplete" };
  }
  const r1 = match.innings1.runs;
  const r2 = match.innings2.runs;
  if (r2 > r1) {
    const wicketsRemaining = MAX_WICKETS_PER_INNINGS - match.innings2.wickets;
    return {
      winner: match.innings2.battingPlayer,
      margin: `won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`,
    };
  }
  if (r1 > r2) {
    return {
      winner: match.innings1.battingPlayer,
      margin: `won by ${r1 - r2} run${r1 - r2 === 1 ? "" : "s"}`,
    };
  }
  return { winner: "tie", margin: "scores level" };
}

// ─────────────────────────── Helpers ───────────────────────────

function makePlayerDecks(): ServerDecks {
  return {
    battingDeck: buildDeck("batting"),
    bowlingDeck: buildDeck("bowling"),
    hand: [],
    discard: [],
  };
}

const TIER_DISTRIBUTION: Record<"Elite" | "Gold" | "Silver" | "Bronze", number> = {
  Elite: 2,
  Gold: 3,
  Silver: 5,
  Bronze: 5, // 15 player cards + 5 situation cards = 20
};

function buildDeck(role: SituationDeck): AnyCard[] {
  const playerPool = role === "batting" ? CARDS.batsmen : CARDS.bowlers;
  const sitPool = CARDS.situations.filter((s) => s.deck === role);

  const deck: AnyCard[] = [];
  for (const tier of ["Elite", "Gold", "Silver", "Bronze"] as const) {
    const count = TIER_DISTRIBUTION[tier];
    const tierPool = playerPool.filter((c) => c.tier === tier);
    deck.push(...sample(tierPool, count));
  }
  // 5 of 6 situation cards per pool
  deck.push(...sample(sitPool, 5));
  if (deck.length !== DECK_SIZE) {
    throw new Error(
      `buildDeck(${role}) produced ${deck.length} cards; expected ${DECK_SIZE}`,
    );
  }
  return shuffle(deck);
}

function sample<T>(arr: readonly T[], n: number): T[] {
  const a = [...arr];
  const out: T[] = [];
  while (out.length < n && a.length > 0) {
    const j = Math.floor(Math.random() * a.length);
    out.push(a.splice(j, 1)[0]!);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function dealOpeningHands(match: ServerMatch): void {
  if (!match.decks) return;
  for (const slot of ["A", "B"] as const) {
    const decks = match.decks[slot];
    refillHand(decks, activeDeckKey(match, slot));
    applyAntiClog(decks, activeDeckKey(match, slot));
  }
}

function activeDeckKey(
  match: ServerMatch,
  slot: PlayerSlot,
): "battingDeck" | "bowlingDeck" {
  const role = activeRoleForSlot(match, slot);
  return role === "batting" ? "battingDeck" : "bowlingDeck";
}

function refillHand(decks: ServerDecks, deckKey: "battingDeck" | "bowlingDeck"): void {
  const deck = decks[deckKey];
  while (decks.hand.length < HAND_SIZE && deck.length > 0) {
    decks.hand.push(deck.shift()!);
  }
}

function applyAntiClog(
  decks: ServerDecks,
  deckKey: "battingDeck" | "bowlingDeck",
): void {
  const requiredKind = deckKey === "battingDeck" ? "batsman" : "bowler";
  const deck = decks[deckKey];
  // Cap iterations to hand size to avoid infinite loops if the entire
  // remaining deck is also situations.
  for (let iter = 0; iter < HAND_SIZE; iter++) {
    const hasMandatory = decks.hand.some((c) => c.kind === requiredKind);
    if (hasMandatory) return;
    if (deck.length === 0) return;
    const sitIdx = decks.hand.findIndex((c) => c.kind === "situation");
    if (sitIdx < 0) return;
    decks.discard.push(decks.hand.splice(sitIdx, 1)[0]!);
    decks.hand.push(deck.shift()!);
  }
}

function findCardById(hand: AnyCard[], id: string): AnyCard | null {
  return hand.find((c) => c.id === id) ?? null;
}

function consumePlayedByIds(decks: ServerDecks, ids: string[]): void {
  for (const id of ids) {
    const idx = decks.hand.findIndex((c) => c.id === id);
    if (idx >= 0) {
      decks.discard.push(decks.hand.splice(idx, 1)[0]!);
    }
  }
}

function autoPickSelection(
  match: ServerMatch,
  slot: PlayerSlot,
): BallSelection | null {
  if (!match.decks) return null;
  const role = activeRoleForSlot(match, slot);
  if (!role) return null;
  const requiredKind = role === "batting" ? "batsman" : "bowler";
  const hand = match.decks[slot].hand;
  const mandatoryCandidates = hand.filter((c) => c.kind === requiredKind);
  if (mandatoryCandidates.length === 0) return null;
  const mandatory =
    mandatoryCandidates[Math.floor(Math.random() * mandatoryCandidates.length)]!;
  return {
    mandatoryCardId: mandatory.id,
    situationCardId: null,
    autoPicked: true,
  };
}

function validateSelection(
  match: ServerMatch,
  slot: PlayerSlot,
  selection: BallSelection,
): { ok: true } | { ok: false; reason: string } {
  if (!match.decks) return { ok: false, reason: "Decks not initialized" };
  const role = activeRoleForSlot(match, slot);
  if (!role) return { ok: false, reason: "Not your innings yet" };
  const requiredKind = role === "batting" ? "batsman" : "bowler";
  const hand = match.decks[slot].hand;
  const mandatory = hand.find((c) => c.id === selection.mandatoryCardId);
  if (!mandatory) {
    return { ok: false, reason: "Mandatory card not in hand" };
  }
  if (mandatory.kind !== requiredKind) {
    return { ok: false, reason: `Must play a ${requiredKind} card this turn` };
  }
  if (selection.situationCardId) {
    const sit = hand.find((c) => c.id === selection.situationCardId);
    if (!sit) return { ok: false, reason: "Situation card not in hand" };
    if (sit.kind !== "situation") {
      return { ok: false, reason: "Second card must be a situation card" };
    }
  }
  return { ok: true };
}

function pushPrivateViews(match: ServerMatch, cb: InningsCallbacks): void {
  if (!match.decks) return;
  for (const slot of ["A", "B"] as const) {
    const decks = match.decks[slot];
    const role = activeRoleForSlot(match, slot);
    if (!role) continue;
    const deckRemaining =
      role === "batting" ? decks.battingDeck.length : decks.bowlingDeck.length;
    const view: PrivatePlayerView = {
      slot,
      hand: { cards: [...decks.hand], deckRemaining },
      activeDeck: role,
    };
    cb.broadcastPrivate(match, slot, view);
  }
}

function makeNoOpResult(match: ServerMatch): BallResult {
  // Fallback used when validation can't produce a real ball (extremely rare).
  // Emit a dot ball for the current state.
  const innings = currentInnings(match)!;
  const battingSlot = innings.battingPlayer;
  const bowlingSlot = innings.bowlingPlayer;
  // Synthesize empty selections — UI will show "no card played" gracefully.
  const filler: RevealedSelection = {
    player: battingSlot,
    role: "batting",
    // We intentionally cast — this branch only fires on a malformed turn,
    // and the UI won't render the reveal in detail.
    mandatoryCard: {} as BatsmanCard,
    situationCard: null,
    autoPicked: true,
  };
  return {
    ballNumber: innings.ballsBowled + 1,
    battingSelection: filler,
    bowlingSelection: { ...filler, player: bowlingSlot, role: "bowling", mandatoryCard: {} as BowlerCard },
    resolutionSteps: [],
    finalOutcome: { type: "dot" },
  };
}

function currentInnings(match: ServerMatch): InningsState | null {
  if (match.currentInnings === 1) return match.innings1;
  if (match.currentInnings === 2) return match.innings2;
  return null;
}

function downgradeOnce(o: BallOutcome): BallOutcome {
  if (o.type !== "runs") return o;
  switch (o.value) {
    case 6:
      return { type: "runs", value: 4, shot: o.shot };
    case 4:
      return { type: "runs", value: 2, shot: o.shot };
    case 2:
      return { type: "runs", value: 1, shot: o.shot };
    case 1:
      return { type: "dot" };
    default:
      return { type: "dot" };
  }
}

function sameOutcome(a: BallOutcome, b: BallOutcome): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "runs" && b.type === "runs") return a.value === b.value;
  return true;
}
