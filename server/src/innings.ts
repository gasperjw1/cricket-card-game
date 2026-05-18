/**
 * Server-authoritative innings flow.
 *
 * Drives the per-ball loop: deals hands, holds simultaneous selections, runs
 * the resolution engine, broadcasts reveals, advances ball/innings, ends the
 * match. Pure-ish: side effects (broadcasting, timers) are passed in via
 * callbacks so this module is easy to reason about.
 */

import {
  HAND_SIZE,
  MATCH_FORMATS,
  POST_BALL_PAUSE_SECONDS,
  SWAP_PICK_TIMER_SECONDS,
  TURN_TIMER_SECONDS,
  phaseForBall,
  resolveBall,
  type AnyCard,
  type BallOutcome,
  type BallResult,
  type BallSelection,
  type BatsmanCard,
  type BowlerCard,
  type InningsState,
  type MatchFormat,
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
  botPickBallSelection,
  botPickSwap,
  lastOpponentMandatory,
} from "./bot/controller.js";
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
  // Each player's deck is built independently:
  //  - Bots: themed single-nation deck (own roster + associate Silvers)
  //    when nation is a Test nation; random multi-nation otherwise.
  //  - Humans: random multi-nation pool, UNLESS the client supplied a
  //    custom deck (WC career mode). Custom deck is validated and any
  //    missing card ids get filled in from the auto-build path.
  // Explicit null check on players.B — otherwise `!undefined?.isBot` is
  // `true` and bCustom would be set against a non-existent player.
  const aCustom = !match.players.A.isBot ? match.playerCustomDeck : null;
  const bCustom = match.players.B && !match.players.B.isBot
    ? match.playerCustomDeck
    : null;
  match.decks = {
    A: aCustom
      ? buildPlayerDecksFromCustom(match.format, aCustom)
      : makePlayerDecks(match.format, {
          botNation: match.players.A.isBot ? match.players.A.botNation : null,
        }),
    B: bCustom
      ? buildPlayerDecksFromCustom(match.format, bCustom)
      : makePlayerDecks(match.format, {
          botNation: match.players.B?.isBot ? match.players.B.botNation : null,
        }),
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
  // Reject submissions during the post-ball pause / between innings — the
  // ball isn't live, so any submit would either get stranded or carry over
  // into the next innings's first ball.
  if (match.currentBallDeadlineEpochMs === null) {
    return { ok: false, reason: "Ball isn't live — wait for the next one" };
  }
  if (match.pendingSwap) {
    return { ok: false, reason: "Ball is paused on a swap pick" };
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

  // Bot intercept: each bot player auto-submits after a short "thinking"
  // delay so the human sees realistic pacing.
  for (const slot of ["A", "B"] as const) {
    if (match.players[slot]?.isBot) {
      scheduleBotBallSubmit(match, slot, cb);
    }
  }
}

/** Schedule a bot's ball submission with a short randomized delay (~1.5-3s)
 *  so the human sees realistic pacing rather than instant picks. */
function scheduleBotBallSubmit(
  match: ServerMatch,
  botSlot: PlayerSlot,
  cb: InningsCallbacks,
): void {
  const delay = 1500 + Math.random() * 1500;  // 1.5-3 seconds
  const timerKey = `bot-submit-${botSlot}`;
  const existing = match.timers.get(timerKey);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    match.timers.delete(timerKey);
    botSubmitBall(match, botSlot, cb);
  }, delay);
  match.timers.set(timerKey, t);
}

/** Bot picks a card and submits via the same code path a human would. */
function botSubmitBall(
  match: ServerMatch,
  botSlot: PlayerSlot,
  cb: InningsCallbacks,
): void {
  const player = match.players[botSlot];
  if (!player?.isBot || !player.botDifficulty) return;
  if (match.pendingSelections[botSlot]) return;  // already submitted
  if (match.currentBallDeadlineEpochMs === null) return;  // ball isn't live
  if (match.pendingSwap) return;  // paused on swap

  const decks = match.decks?.[botSlot];
  if (!decks) return;
  const innings = match.currentInnings === 1 ? match.innings1 : match.innings2;
  if (!innings) return;
  const role: "batting" | "bowling" =
    innings.battingPlayer === botSlot ? "batting" : "bowling";

  const fmt = MATCH_FORMATS[match.format];
  const selection = botPickBallSelection({
    hand: decks.hand,
    role,
    difficulty: player.botDifficulty,
    ballsBowled: innings.ballsBowled,
    wicketsFallen: innings.wickets,
    ballsPerInnings: fmt.ballsPerInnings,
    wicketsPerInnings: fmt.wicketsPerInnings,
    lastOpponentCard: lastOpponentMandatory(match, botSlot),
  });
  submitBallSelection(match, botSlot, selection, cb);
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

  // Diagnostic log: every ball, dump which situation cards (if any) are
  // on the table. Makes it possible to investigate post-hoc when a player
  // reports "I played X but it didn't fire" — server logs persist in Fly
  // via `fly logs`.
  console.log(
    `[ball] match=${match.matchId.slice(0, 8)} innings=${match.currentInnings} ` +
    `bat=${ctx.battingSlot}(${ctx.battingMandatory.name}, sit=${ctx.battingSituation?.id ?? "—"}) ` +
    `bowl=${ctx.bowlingSlot}(${ctx.bowlingMandatory.name}, sit=${ctx.bowlingSituation?.id ?? "—"})`,
  );

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

  // Bot intercept: if the swap is for a bot, auto-resolve after a short
  // "thinking" delay so the human sees the action happen with realistic
  // pacing, not instantly.
  if (match.players[fromSlot]?.isBot) {
    const t = setTimeout(() => {
      if (!match.pendingSwap || match.pendingSwap.fromSlot !== fromSlot) return;
      const pick = botPickSwap(match.pendingSwap.candidateIds);
      applySwapPick(match, cb, fromSlot, pick, /* auto */ true);
    }, 1200);
    match.timers.set(`bot-swap-${fromSlot}`, t);
  }

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

  const upcomingBallNumber = innings.ballsBowled + 1;
  const engineResult = resolveBall({
    batsman: ctx.battingMandatory,
    bowler: ctx.bowlingMandatory,
    battingSituation: ctx.battingSituation,
    bowlingSituation: ctx.bowlingSituation,
    phase: phaseForBall(match.format, upcomingBallNumber),
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
  const extraRuns = engineResult.extraRuns;
  const extrasNote = engineResult.extrasNote;
  const rebowled = engineResult.rebowled;
  const lookupZone = engineResult.lookupZone;

  // Build the BallResult for broadcast.
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
    extraRuns,
    extrasNote,
    rebowled,
    lookupZone,
  };

  // Discard played cards (incl. swap replacements added to ctx.*PlayedIds).
  // EXCEPTION: when the delivery is rebowled (No Ball or Wide), the
  // delivery wasn't legal — return BOTH the bowler's mandatory card AND
  // the batter's mandatory card to the bottom of their active decks.
  // Situation cards played still get discarded (they were "used up");
  // only the mandatory pair survives.
  if (rebowled) {
    const bowlerMandatoryId = ctx.bowlingMandatory.id;
    const batterMandatoryId = ctx.battingMandatory.id;
    const bowlingPlayedMinusMandatory = ctx.bowlingPlayedIds.filter(
      (id) => id !== bowlerMandatoryId,
    );
    const battingPlayedMinusMandatory = ctx.battingPlayedIds.filter(
      (id) => id !== batterMandatoryId,
    );
    returnCardToActiveDeck(match, ctx.bowlingSlot, bowlerMandatoryId);
    returnCardToActiveDeck(match, ctx.battingSlot, batterMandatoryId);
    consumePlayedByIds(
      match.decks[ctx.bowlingSlot],
      bowlingPlayedMinusMandatory,
    );
    consumePlayedByIds(
      match.decks[ctx.battingSlot],
      battingPlayedMinusMandatory,
    );
  } else {
    consumePlayedByIds(match.decks[ctx.bowlingSlot], ctx.bowlingPlayedIds);
    consumePlayedByIds(match.decks[ctx.battingSlot], ctx.battingPlayedIds);
  }

  // Tear down ball context now that we're done with it.
  match.ballContext = null;
  // Ensure any stale swap state is cleared.
  match.pendingSwap = null;
  clearSwapTimer(match);

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

  // Score / wickets / log. A rebowled delivery (No Ball / Wide) doesn't
  // count toward the over but does add the run-outcome runs (often 0 since
  // No Ball overturns wickets) plus the extra run.
  if (!result.rebowled) {
    innings.ballsBowled += 1;
  }
  if (result.finalOutcome.type === "runs") {
    innings.runs += result.finalOutcome.value;
  } else if (result.finalOutcome.type === "wicket") {
    innings.wickets += 1;
  }
  innings.runs += result.extraRuns;
  innings.log.push(result);

  cb.emitReveal(match, result);

  // Reset pending selections.
  match.pendingSelections = { A: null, B: null };

  const fmt = MATCH_FORMATS[match.format];
  const inningsDone =
    innings.ballsBowled >= fmt.ballsPerInnings ||
    innings.wickets >= fmt.wicketsPerInnings ||
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
  } else {
    // Mark the innings complete BEFORE the post-ball pause so clients
    // immediately know not to render the hand / selection UI even if
    // the player dismisses the reveal overlay early.
    innings.isComplete = true;
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
    const fmt = MATCH_FORMATS[match.format];
    const wicketsRemaining = fmt.wicketsPerInnings - match.innings2.wickets;
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

function makePlayerDecks(
  format: MatchFormat,
  opts?: { botNation?: import("@swipe-sixer/shared").Nation | null },
): ServerDecks {
  return {
    battingDeck: buildDeck(format, "batting", opts?.botNation ?? null),
    bowlingDeck: buildDeck(format, "bowling", opts?.botNation ?? null),
    hand: [],
    discard: [],
  };
}

/**
 * Build the player's decks from a client-supplied card-id list (WC
 * career mode). Each id is resolved to a card from the global roster.
 * Unknown ids are dropped; any shortfall is filled by the standard
 * tier-based build so the deck always reaches format.deckSize (the
 * engine assumes it).
 */
function buildPlayerDecksFromCustom(
  format: MatchFormat,
  custom: { battingDeck: string[]; bowlingDeck: string[] },
): ServerDecks {
  return {
    battingDeck: resolveAndTopUp(format, "batting", custom.battingDeck),
    bowlingDeck: resolveAndTopUp(format, "bowling", custom.bowlingDeck),
    hand: [],
    discard: [],
  };
}

function resolveAndTopUp(
  format: MatchFormat,
  role: "batting" | "bowling",
  ids: string[],
): AnyCard[] {
  const fmt = MATCH_FORMATS[format];
  const allById = new Map<string, AnyCard>();
  for (const c of CARDS.batsmen) allById.set(c.id, c);
  for (const c of CARDS.bowlers) allById.set(c.id, c);
  for (const c of CARDS.situations) allById.set(c.id, c);
  // Resolve client ids (preserves duplicates — situations can repeat).
  // Filter to cards valid for this deck role.
  const resolved: AnyCard[] = [];
  for (const id of ids) {
    const card = allById.get(id);
    if (!card) continue;
    if (card.kind === "situation" && card.deck !== role) continue;
    if (card.kind === "batsman" && role !== "batting") continue;
    if (card.kind === "bowler" && role !== "bowling") continue;
    resolved.push(card);
  }
  // Top up if the client's deck is short. Use the standard build pool
  // (avoiding already-used non-situation cards by id).
  if (resolved.length < fmt.deckSize) {
    const used = new Set(resolved.filter((c) => c.kind !== "situation").map((c) => c.id));
    const filler = buildDeck(format, role, null).filter(
      (c) => !used.has(c.id),
    );
    while (resolved.length < fmt.deckSize && filler.length > 0) {
      resolved.push(filler.shift()!);
    }
  }
  // Truncate if client's deck is too long.
  while (resolved.length > fmt.deckSize) resolved.pop();
  // Shuffle so the play order isn't the client's submission order.
  for (let i = resolved.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resolved[i], resolved[j]] = [resolved[j]!, resolved[i]!];
  }
  return resolved;
}

/** Test nations are the 12 with full rosters. Associate nations have
 *  partial rosters (single-nation deck impossible) — bot picking an
 *  associate falls back to a multi-nation random deck. */
const TEST_NATIONS = new Set<import("@swipe-sixer/shared").Nation>([
  "India", "Australia", "England", "South Africa", "New Zealand", "Pakistan",
  "Sri Lanka", "West Indies", "Bangladesh", "Zimbabwe", "Afghanistan", "Ireland",
]);

function buildDeck(
  format: MatchFormat,
  role: SituationDeck,
  botNation: import("@swipe-sixer/shared").Nation | null,
): AnyCard[] {
  const fmt = MATCH_FORMATS[format];
  const tierDist = fmt.tierDistribution;
  const playerPool = role === "batting" ? CARDS.batsmen : CARDS.bowlers;
  const sitPool = CARDS.situations.filter((s) => s.deck === role);

  // For Test-nation bots: build a single-nation themed deck.
  // - Elite + Gold + Bronze come from the bot's own nation.
  // - Silver pulls from the bot's nation PLUS the associate-nation pool
  //   (the bot's nation only has 3 Silvers per role, so the associate
  //   pool fills the gap up to whatever the format needs).
  // For longer formats (T3+), Bronze and Gold may also need fallback
  // from other Test nations' rosters because a single nation only has
  // 3 Gold / 5 Bronze per role. The fallback block below handles that.
  // For human players + Associate-nation bots: random multi-nation pool.
  const useThemedDeck = botNation !== null && TEST_NATIONS.has(botNation);

  const deck: AnyCard[] = [];
  for (const tier of ["Elite", "Gold", "Silver", "Bronze"] as const) {
    const count = tierDist[tier];
    let tierPool = playerPool.filter((c) => c.tier === tier);
    if (useThemedDeck) {
      if (tier === "Silver") {
        // Own nation Silvers + associate Silvers (always available).
        tierPool = tierPool.filter(
          (c) => c.nation === botNation || !TEST_NATIONS.has(c.nation),
        );
      } else {
        tierPool = tierPool.filter((c) => c.nation === botNation);
      }
      // Fallback: if the themed pool is too small, top up from the
      // global pool. Handles AFG's missing Gold in T1, and Gold/Bronze
      // shortfalls in T3+.
      if (tierPool.length < count) {
        const extras = playerPool.filter(
          (c) => c.tier === tier && !tierPool.includes(c),
        );
        tierPool = [...tierPool, ...sample(extras, count - tierPool.length)];
      }
    }
    deck.push(...sample(tierPool, count));
  }
  // Situations: format-controlled count (always pulled from full sit pool).
  deck.push(...sample(sitPool, fmt.situationCount));
  if (deck.length !== fmt.deckSize) {
    throw new Error(
      `buildDeck(${format},${role}) produced ${deck.length} cards; expected ${fmt.deckSize}`,
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

/**
 * Pull a card out of the player's hand and push it to the bottom of their
 * currently-active deck. Used when a No Ball / Wide rebowl preserves the
 * bowler card — they didn't get to deliver a legal ball, so they get to
 * bowl it again later (after the deck cycles).
 */
function returnCardToActiveDeck(
  match: ServerMatch,
  slot: PlayerSlot,
  cardId: string,
): void {
  if (!match.decks) return;
  const decks = match.decks[slot];
  const idx = decks.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = decks.hand.splice(idx, 1)[0]!;
  const deckKey = activeDeckKey(match, slot);
  decks[deckKey].push(card);
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
    extraRuns: 0,
    extrasNote: null,
    rebowled: false,
    lookupZone: { line: "Middle stump", length: "Good length" },
  };
}

function currentInnings(match: ServerMatch): InningsState | null {
  if (match.currentInnings === 1) return match.innings1;
  if (match.currentInnings === 2) return match.innings2;
  return null;
}

function downgradeOnce(o: BallOutcome): BallOutcome {
  if (o.type !== "runs") return o;
  // Same shot, just timed worse — preserve the category so the result
  // screen still shows the right action image.
  switch (o.value) {
    case 6:
      return { type: "runs", value: 4, shot: o.shot, shotCategory: o.shotCategory };
    case 4:
      return { type: "runs", value: 2, shot: o.shot, shotCategory: o.shotCategory };
    case 2:
      return { type: "runs", value: 1, shot: o.shot, shotCategory: o.shotCategory };
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
