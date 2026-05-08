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
  type PlayerSlot,
  type PrivatePlayerView,
  type ResolutionStep,
  type RevealedSelection,
  type SituationCard,
  type SituationDeck,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import {
  activeRoleForSlot,
  type ServerDecks,
  type ServerMatch,
} from "./match-registry.js";

const BALL_TIMER_KEY = "ball-timer";

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
  cb.broadcastState(match);
  pushPrivateViews(match, cb);
  startBallTimer(match, cb);
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
    // Neither player has any mandatory card — extremely rare; skip ball with dot.
    advanceAfterBall(match, cb, makeNoOpResult(match, timedOut));
    return;
  }

  // Resolve the played cards into the actual card objects.
  const battingHand = match.decks[battingSlot].hand;
  const bowlingHand = match.decks[bowlingSlot].hand;
  let battingMandatory = findCardById(battingHand, battingSelection.mandatoryCardId);
  let bowlingMandatory = findCardById(bowlingHand, bowlingSelection.mandatoryCardId);
  let battingSituation = battingSelection.situationCardId
    ? (findCardById(battingHand, battingSelection.situationCardId) as SituationCard | null)
    : null;
  let bowlingSituation = bowlingSelection.situationCardId
    ? (findCardById(bowlingHand, bowlingSelection.situationCardId) as SituationCard | null)
    : null;

  if (
    !battingMandatory ||
    battingMandatory.kind !== "batsman" ||
    !bowlingMandatory ||
    bowlingMandatory.kind !== "bowler"
  ) {
    // Defensive — submission validation should have caught this.
    advanceAfterBall(match, cb, makeNoOpResult(match, timedOut));
    return;
  }

  // ─── Step 1: Old School cancellation ───
  const upstreamSteps: ResolutionStep[] = [];
  if (battingSituation?.id === "old-school-batting" && bowlingSituation) {
    upstreamSteps.push({
      kind: "old-school-cancel",
      label: "Old School (batting)",
      detail: `Cancels ${bowlingSituation.name}.`,
      applied: true,
    });
    bowlingSituation = null;
    battingSituation = null; // Old School itself is consumed
  } else if (
    bowlingSituation?.id === "old-school-bowling" &&
    battingSituation
  ) {
    upstreamSteps.push({
      kind: "old-school-cancel",
      label: "Old School (bowling)",
      detail: `Cancels ${battingSituation.name}.`,
      applied: true,
    });
    battingSituation = null;
    bowlingSituation = null;
  } else if (
    battingSituation?.id === "old-school-batting" ||
    bowlingSituation?.id === "old-school-bowling"
  ) {
    // Played but no opponent situation to cancel.
    upstreamSteps.push({
      kind: "old-school-cancel",
      label: "Old School",
      detail: "Played but opponent had no situation card to cancel.",
      applied: false,
    });
    if (battingSituation?.id === "old-school-batting") battingSituation = null;
    if (bowlingSituation?.id === "old-school-bowling") bowlingSituation = null;
  }

  // ─── Step 2: Mankad / Retired Out / Cramps swaps ───
  let forcedDowngradeFromMankad = false;
  if (bowlingSituation?.id === "mankad") {
    // Force batting side to swap mandatory batsman.
    const replacement = pickAnotherFromHand(battingHand, "batsman", battingMandatory.id);
    if (replacement) {
      upstreamSteps.push({
        kind: "mankad",
        label: "Mankad",
        detail: `${battingMandatory.name} swapped for ${replacement.name}.`,
        applied: true,
      });
      battingMandatory = replacement;
    } else {
      forcedDowngradeFromMankad = true;
      upstreamSteps.push({
        kind: "mankad",
        label: "Mankad",
        detail: `No other batsman available — ${battingMandatory.name} stays but takes a one-tier downgrade.`,
        applied: true,
      });
    }
    bowlingSituation = null; // Mankad consumed regardless
  }
  if (battingSituation?.id === "retired-out") {
    const replacement = pickAnotherFromHand(battingHand, "batsman", battingMandatory.id);
    if (replacement) {
      upstreamSteps.push({
        kind: "retired-out",
        label: "Retired Out",
        detail: `${battingMandatory.name} retired — ${replacement.name} comes in.`,
        applied: true,
      });
      battingMandatory = replacement;
    } else {
      upstreamSteps.push({
        kind: "retired-out",
        label: "Retired Out",
        detail: `No other batsman in hand — Retired Out fizzles.`,
        applied: false,
      });
    }
    battingSituation = null;
  }
  if (bowlingSituation?.id === "cramps") {
    const replacement = pickAnotherFromHand(bowlingHand, "bowler", bowlingMandatory.id);
    if (replacement) {
      upstreamSteps.push({
        kind: "cramps",
        label: "Cramps",
        detail: `${bowlingMandatory.name} pulls up — ${replacement.name} bowls instead.`,
        applied: true,
      });
      bowlingMandatory = replacement;
    } else {
      upstreamSteps.push({
        kind: "cramps",
        label: "Cramps",
        detail: `No other bowler in hand — Cramps fizzles.`,
        applied: false,
      });
    }
    bowlingSituation = null;
  }

  // ─── Engine: steps 3–10 ───
  const engineResult = resolveBall({
    batsman: battingMandatory as BatsmanCard,
    bowler: bowlingMandatory as BowlerCard,
    battingSituation,
    bowlingSituation,
  });

  // Synthesize Mankad's "no-swap downgrade" by inserting an extra downgrade step.
  let finalOutcome: BallOutcome = engineResult.finalOutcome;
  let allSteps: ResolutionStep[] = [...upstreamSteps, ...engineResult.steps];
  if (forcedDowngradeFromMankad) {
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
  const battingPlayedCards: AnyCard[] = [battingSelection.mandatoryCardId, battingSelection.situationCardId]
    .filter((id): id is string => Boolean(id))
    .map((id) => findCardById(battingHand, id))
    .filter((c): c is AnyCard => c !== null);
  const bowlingPlayedCards: AnyCard[] = [bowlingSelection.mandatoryCardId, bowlingSelection.situationCardId]
    .filter((id): id is string => Boolean(id))
    .map((id) => findCardById(bowlingHand, id))
    .filter((c): c is AnyCard => c !== null);

  // The engine and pre-handling may have replaced the mandatory card via swap.
  // We reflect what was REVEALED, including the original played card and the
  // post-swap one. For v1 simplicity we surface only the post-swap mandatory.
  const battingReveal: RevealedSelection = {
    player: battingSlot,
    role: "batting",
    mandatoryCard: battingMandatory as BatsmanCard,
    situationCard:
      (findCardById(battingHand, battingSelection.situationCardId ?? "") as SituationCard | null) ??
      null,
    autoPicked: battingSelection.autoPicked,
  };
  const bowlingReveal: RevealedSelection = {
    player: bowlingSlot,
    role: "bowling",
    mandatoryCard: bowlingMandatory as BowlerCard,
    situationCard:
      (findCardById(bowlingHand, bowlingSelection.situationCardId ?? "") as SituationCard | null) ??
      null,
    autoPicked: bowlingSelection.autoPicked,
  };

  const ballNumber = innings.ballsBowled + 1;
  const result: BallResult = {
    ballNumber,
    battingSelection: battingReveal,
    bowlingSelection: bowlingReveal,
    resolutionSteps: allSteps,
    finalOutcome,
  };

  // Discard played cards from each player's hand.
  consumePlayed(match.decks[battingSlot], battingPlayedCards);
  consumePlayed(match.decks[bowlingSlot], bowlingPlayedCards);

  advanceAfterBall(match, cb, result);
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

  // Reset pending selections, refill hands.
  match.pendingSelections = { A: null, B: null };
  for (const slot of ["A", "B"] as const) {
    refillHand(match.decks[slot], activeDeckKey(match, slot));
    applyAntiClog(match.decks[slot], activeDeckKey(match, slot));
  }

  // Check innings end conditions
  const inningsDone =
    innings.ballsBowled >= MAX_BALLS_PER_INNINGS ||
    innings.wickets >= MAX_WICKETS_PER_INNINGS ||
    (match.currentInnings === 2 &&
      match.innings1 &&
      innings.runs > match.innings1.runs);

  if (inningsDone) {
    innings.isComplete = true;
    if (match.currentInnings === 1) {
      transitionToInnings2(match, cb);
    } else {
      endMatch(match, cb);
    }
    return;
  }

  // Continue: broadcast updated state and start next ball timer.
  cb.broadcastState(match);
  pushPrivateViews(match, cb);
  startBallTimer(match, cb);
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
  cb.broadcastState(match);
  pushPrivateViews(match, cb);
  startBallTimer(match, cb);
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

function consumePlayed(decks: ServerDecks, played: AnyCard[]): void {
  for (const card of played) {
    const idx = decks.hand.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      decks.discard.push(decks.hand.splice(idx, 1)[0]!);
    }
  }
}

function pickAnotherFromHand(
  hand: AnyCard[],
  kind: "batsman" | "bowler",
  excludeId: string,
): BatsmanCard | BowlerCard | null {
  const candidates = hand.filter(
    (c) => c.kind === kind && c.id !== excludeId,
  );
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  return pick as BatsmanCard | BowlerCard;
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

function makeNoOpResult(match: ServerMatch, _timedOut: boolean): BallResult {
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
