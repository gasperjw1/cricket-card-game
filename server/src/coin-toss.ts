import {
  COIN_TOSS_CALL_TIMER_SECONDS,
  COIN_TOSS_CHOOSE_TIMER_SECONDS,
  COIN_TOSS_COUNTDOWN_SECONDS,
  type PlayerSlot,
} from "@swipe-sixer/shared";
import { botCallCoinToss, botChooseRole } from "./bot/controller.js";
import type { ServerMatch } from "./match-registry.js";

const COUNTDOWN_TIMER_KEY = "coin-countdown";
const CALL_TIMER_KEY = "coin-call";
const CHOOSE_TIMER_KEY = "coin-choose";

export interface CoinTossCallbacks {
  /** Push the latest match:state to both players. */
  broadcastState: (match: ServerMatch) => void;
  /** Emit the cointoss:result event after a successful call. */
  emitResult: (
    match: ServerMatch,
    payload: { flip: "heads" | "tails"; callerSlot: PlayerSlot; winnerSlot: PlayerSlot },
  ) => void;
  /** Called once the toss is complete; the host should kick off innings 1. */
  onComplete: (match: ServerMatch) => void;
}

/**
 * Called the moment Player B joins. Transitions the match into the coin-toss
 * phase with a 10s countdown so both players have a moment to settle in (or
 * realize they joined the wrong match).
 */
export function startCoinToss(match: ServerMatch, cb: CoinTossCallbacks): void {
  if (match.coinToss) return;
  match.phase = "coin-toss";
  const deadline = Date.now() + COIN_TOSS_COUNTDOWN_SECONDS * 1000;
  match.coinToss = {
    stage: "countdown",
    callerSlot: "B",
    deadlineEpochMs: deadline,
    call: null,
    flip: null,
    winnerSlot: null,
    battingSlot: null,
    autoCalled: false,
    autoChose: false,
  };
  scheduleTimer(match, COUNTDOWN_TIMER_KEY, deadline, () => {
    enterCallingStage(match, cb);
  });
  cb.broadcastState(match);
}

function enterCallingStage(match: ServerMatch, cb: CoinTossCallbacks): void {
  if (!match.coinToss) return;
  const callerSlot = match.coinToss.callerSlot;  // always "B" in v1
  const callerIsBot = match.players[callerSlot]?.isBot ?? false;
  const deadline = Date.now() + COIN_TOSS_CALL_TIMER_SECONDS * 1000;
  match.coinToss = {
    ...match.coinToss,
    stage: "calling",
    deadlineEpochMs: deadline,
  };
  // Bot intercept: auto-call after a short "thinking" delay (~1s) so the
  // human sees the call happen with realistic pacing, not instantly.
  if (callerIsBot) {
    scheduleTimer(match, CALL_TIMER_KEY, Date.now() + 1000, () => {
      const call = botCallCoinToss();
      handleCall(match, callerSlot, call, cb, /* auto */ true);
    });
  } else {
    scheduleTimer(match, CALL_TIMER_KEY, deadline, () => {
      handleCall(match, callerSlot, "heads", cb, /* auto */ true);
    });
  }
  cb.broadcastState(match);
}

export function handleCall(
  match: ServerMatch,
  fromSlot: PlayerSlot,
  call: "heads" | "tails",
  cb: CoinTossCallbacks,
  auto = false,
): { ok: boolean; reason?: string } {
  if (!match.coinToss || match.coinToss.stage !== "calling") {
    return { ok: false, reason: "Not in calling stage" };
  }
  if (fromSlot !== match.coinToss.callerSlot) {
    return { ok: false, reason: "Only the caller can call" };
  }
  clearTimer(match, CALL_TIMER_KEY);

  const flip = flipCoin();
  const winnerSlot: PlayerSlot = call === flip ? match.coinToss.callerSlot : otherSlot(match.coinToss.callerSlot);

  match.coinToss = {
    ...match.coinToss,
    call,
    flip,
    winnerSlot,
    autoCalled: auto,
  };
  cb.emitResult(match, {
    flip,
    callerSlot: match.coinToss.callerSlot,
    winnerSlot,
  });
  enterChoosingStage(match, cb);
  return { ok: true };
}

function enterChoosingStage(match: ServerMatch, cb: CoinTossCallbacks): void {
  if (!match.coinToss || match.coinToss.winnerSlot === null) return;
  const winner: PlayerSlot = match.coinToss.winnerSlot;
  const winnerIsBot = match.players[winner]?.isBot ?? false;
  const deadline = Date.now() + COIN_TOSS_CHOOSE_TIMER_SECONDS * 1000;
  match.coinToss = {
    ...match.coinToss,
    stage: "choosing",
    deadlineEpochMs: deadline,
  };
  if (winnerIsBot) {
    // Bot intercept: short "thinking" delay then choose.
    scheduleTimer(match, CHOOSE_TIMER_KEY, Date.now() + 1500, () => {
      const choose = botChooseRole();
      handleChoose(match, winner, choose, cb, /* auto */ true);
    });
  } else {
    scheduleTimer(match, CHOOSE_TIMER_KEY, deadline, () => {
      handleChoose(match, winner, "bat", cb, /* auto */ true);
    });
  }
  cb.broadcastState(match);
}

export function handleChoose(
  match: ServerMatch,
  fromSlot: PlayerSlot,
  choose: "bat" | "bowl",
  cb: CoinTossCallbacks,
  auto = false,
): { ok: boolean; reason?: string } {
  if (!match.coinToss || match.coinToss.stage !== "choosing") {
    return { ok: false, reason: "Not in choosing stage" };
  }
  if (fromSlot !== match.coinToss.winnerSlot) {
    return { ok: false, reason: "Only the toss winner can choose" };
  }
  clearTimer(match, CHOOSE_TIMER_KEY);

  const battingSlot: PlayerSlot =
    choose === "bat" ? match.coinToss.winnerSlot : otherSlot(match.coinToss.winnerSlot);

  match.coinToss = {
    ...match.coinToss,
    stage: "complete",
    deadlineEpochMs: null,
    battingSlot,
    autoChose: auto,
  };
  cb.broadcastState(match);
  cb.onComplete(match);
  return { ok: true };
}

function scheduleTimer(
  match: ServerMatch,
  key: string,
  whenEpochMs: number,
  fn: () => void,
): void {
  clearTimer(match, key);
  const delay = Math.max(0, whenEpochMs - Date.now());
  const timer = setTimeout(fn, delay);
  match.timers.set(key, timer);
}

function clearTimer(match: ServerMatch, key: string): void {
  const t = match.timers.get(key);
  if (t) {
    clearTimeout(t);
    match.timers.delete(key);
  }
}

function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === "A" ? "B" : "A";
}

/**
 * The actual coin flip. Math.random() is uniform on [0, 1) so a < 0.5 cutoff
 * yields exactly 50/50 in expectation. Math.random() in Node uses xorshift128+,
 * which is uniform and statistically sound but not cryptographically secure —
 * fine for a casual two-player game; if stakes were involved we'd swap to
 * crypto.randomInt(2).
 */
export function flipCoin(): "heads" | "tails" {
  return Math.random() < 0.5 ? "heads" : "tails";
}
