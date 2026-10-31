import type { Server, Socket } from "socket.io";
import prisma from "../db.js";
import { type Card, makeFCDeck, bestDw } from "@swipe-sixer/shared/games/wildreign";
import { userChannel, roomChannel, findMyMembership, broadcastRoomState } from "./rooms.js";

const TOTAL_ROUNDS = 11;
const MAX_LOG_ENTRIES = 6;

type GameRow = NonNullable<Awaited<ReturnType<typeof prisma.platformWildReignGame.findUnique>>>;

// Rolling window of recent moves, shown client-side as an optional per-player
// log (each viewer toggles it themselves) — newest entry last.
type LogEntry =
  | { type: "dealt"; round: number }
  | { type: "draw"; userId: string; source: "deck" | "discard" }
  | { type: "discard"; userId: string; card: Card }
  | { type: "goOut"; userId: string }
  | { type: "pass"; userId: string };

function appendLog(log: unknown, entry: LogEntry): LogEntry[] {
  return [...(log as LogEntry[]), entry].slice(-MAX_LOG_ENTRIES);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function isMyTurn(game: GameRow, userId: string): boolean {
  const turnOrder = game.turnOrder as unknown as string[];
  return turnOrder[game.turnIndex] === userId;
}

async function dealRound(
  roomId: string, userIds: string[], round: number, resetScores: boolean, previousLog: unknown = [],
): Promise<void> {
  const deck = makeFCDeck();
  const handSize = round + 2;
  const hands: Record<string, Card[]> = {};
  for (const uid of userIds) hands[uid] = [];
  for (let i = 0; i < handSize; i++) {
    for (const uid of userIds) hands[uid]!.push(deck.pop()!);
  }
  const discardTop = deck.pop()!;
  const turnOrder = [...userIds];
  const turnIndex = Math.floor(Math.random() * turnOrder.length);

  const scoresDefault: Record<string, number> = {};
  for (const uid of userIds) scoresDefault[uid] = 0;

  const moveLog = appendLog(resetScores ? [] : previousLog, { type: "dealt", round });

  await prisma.platformWildReignGame.upsert({
    where: { roomId },
    create: {
      roomId,
      round,
      deck: deck as any,
      discard: [discardTop] as any,
      hands: hands as any,
      scores: scoresDefault as any,
      roundScores: [] as any,
      turnOrder: turnOrder as any,
      turnIndex,
      phase: "draw",
      wentOutUserId: null,
      owesFinalTurn: [] as any,
      readyNext: [] as any,
      moveLog: moveLog as any,
    },
    update: {
      round,
      deck: deck as any,
      discard: [discardTop] as any,
      hands: hands as any,
      ...(resetScores ? { scores: scoresDefault as any, roundScores: [] as any } : {}),
      turnOrder: turnOrder as any,
      turnIndex,
      phase: "draw",
      wentOutUserId: null,
      owesFinalTurn: [] as any,
      readyNext: [] as any,
      moveLog: moveLog as any,
    },
  });
}

/** Called by the room lobby once the host starts a "wildreign" room. */
export async function startWildReignGame(io: Server, roomId: string, userIds: string[]): Promise<void> {
  await dealRound(roomId, userIds, 1, true);
  await pushStateToAll(io, roomId);
}

async function dealNextRound(roomId: string): Promise<void> {
  const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
  if (!game) return;
  const userIds = game.turnOrder as unknown as string[];
  await dealRound(roomId, userIds, game.round + 1, false, game.moveLog);
}

function buildWildReignState(game: GameRow, userId: string) {
  const hands = game.hands as unknown as Record<string, Card[]>;
  const scores = game.scores as unknown as Record<string, number>;
  const turnOrder = game.turnOrder as unknown as string[];
  const discard = game.discard as unknown as Card[];
  const deck = game.deck as unknown as Card[];
  const owesFinalTurn = game.owesFinalTurn as unknown as string[];
  const readyNext = game.readyNext as unknown as string[];

  // Hands are revealed once a round finishes (nothing left to hide); mid-round
  // everyone but the caller is exposed only as a card count — except the player
  // who went out, whose laid-down melds the whole table gets to see during the
  // others' final turns (as in real rummy).
  const revealAll = game.phase === "roundEnd" || game.phase === "gameEnd";
  const handsOut: Record<string, { count: number; cards?: Card[] }> = {};
  for (const uid of turnOrder) {
    const hand = hands[uid] ?? [];
    const revealed = uid === userId || revealAll || uid === game.wentOutUserId;
    handsOut[uid] = revealed ? { count: hand.length, cards: hand } : { count: hand.length };
  }

  return {
    roomId: game.roomId,
    round: game.round,
    phase: game.phase,
    turnOrder,
    turnUserId: turnOrder[game.turnIndex] ?? null,
    wentOutUserId: game.wentOutUserId,
    owesFinalTurn,
    hands: handsOut,
    myHand: hands[userId] ?? [],
    discardTop: discard.length ? discard[discard.length - 1] : null,
    deckCount: deck.length,
    scores,
    roundScores: game.roundScores,
    readyNext,
    moveLog: game.moveLog,
  };
}

export async function pushWildReignStateTo(io: Server, roomId: string, userId: string): Promise<void> {
  const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
  if (!game) return;
  io.of("/play").to(userChannel(userId)).emit("wildreign:state", buildWildReignState(game, userId));
}

async function pushStateToAll(io: Server, roomId: string): Promise<void> {
  const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
  if (!game) return;
  const turnOrder = game.turnOrder as unknown as string[];
  const playNs = io.of("/play");
  for (const uid of turnOrder) {
    playNs.to(userChannel(uid)).emit("wildreign:state", buildWildReignState(game, uid));
  }
}

/**
 * Scores every hand for the round that just ended, records the match result
 * (and per-user stats) if this was round 11, and pushes the final state.
 */
async function finishRound(
  io: Server, roomId: string, game: GameRow,
  finalHands: Record<string, Card[]>, finalDiscard: Card[], moveLog: unknown,
): Promise<void> {
  const turnOrder = game.turnOrder as unknown as string[];
  const oldScores = game.scores as unknown as Record<string, number>;

  const roundResult: Record<string, number> = {};
  for (const uid of turnOrder) roundResult[uid] = bestDw(finalHands[uid] ?? [], game.round);

  const newScores: Record<string, number> = {};
  for (const uid of turnOrder) newScores[uid] = (oldScores[uid] ?? 0) + roundResult[uid]!;

  const roundScores = [...(game.roundScores as unknown as Array<{ round: number; scores: Record<string, number> }>), {
    round: game.round, scores: roundResult,
  }];
  const isFinalRound = game.round >= TOTAL_ROUNDS;
  const newPhase = isFinalRound ? "gameEnd" : "roundEnd";

  await prisma.platformWildReignGame.update({
    where: { roomId },
    data: {
      hands: finalHands as any,
      discard: finalDiscard as any,
      scores: newScores as any,
      roundScores: roundScores as any,
      phase: newPhase,
      moveLog: moveLog as any,
    },
  });

  if (isFinalRound) {
    await recordResult(roomId, turnOrder, newScores);
    // recordResult flips PlatformRoom.status to "completed" — tell the lobby
    // layer's clients too, not just the in-game wildreign:state listeners.
    await broadcastRoomState(io, roomId);
  }

  await pushStateToAll(io, roomId);
}

/** Match-history log + rollup stats, written once when round 11 finishes. */
async function recordResult(roomId: string, turnOrder: string[], scores: Record<string, number>): Promise<void> {
  const minScore = Math.min(...turnOrder.map(uid => scores[uid]!));
  const winners = turnOrder.filter(uid => scores[uid] === minScore);
  const sorted = [...turnOrder].sort((a, b) => scores[a]! - scores[b]!);

  await prisma.$transaction(async (tx) => {
    const result = await tx.platformGameResult.create({ data: { roomId, gameType: "wildreign" } });

    for (const uid of turnOrder) {
      const won = winners.length === 1 && winners[0] === uid;
      const rank = sorted.indexOf(uid) + 1;
      const score = scores[uid]!;

      await tx.platformGameResultPlayer.create({
        data: { resultId: result.id, userId: uid, won, score, rank },
      });

      const existing = await tx.platformUserGameStats.findUnique({
        where: { userId_gameType: { userId: uid, gameType: "wildreign" } },
      });
      // Lower is better for Wild Reign specifically — this comparison
      // direction is this game's own scoring rule, not a platform-wide one.
      const bestScore = existing?.bestScore == null || score < existing.bestScore ? score : existing.bestScore;

      await tx.platformUserGameStats.upsert({
        where: { userId_gameType: { userId: uid, gameType: "wildreign" } },
        create: { userId: uid, gameType: "wildreign", gamesPlayed: 1, wins: won ? 1 : 0, losses: won ? 0 : 1, bestScore },
        update: {
          gamesPlayed: { increment: 1 },
          wins: won ? { increment: 1 } : undefined,
          losses: won ? undefined : { increment: 1 },
          bestScore,
        },
      });
    }

    await tx.platformRoom.update({ where: { id: roomId }, data: { status: "completed" } });
  });
}

type Ack = (response: { ok: true } | { ok: false; reason: string }) => void;

export function registerWildReignHandlers(io: Server, socket: Socket, userId: string): void {
  socket.on("wildreign:draw", async (payload: { roomId?: string; source?: "deck" | "discard" }, ack?: Ack) => {
    const roomId = payload?.roomId;
    if (!roomId) { ack?.({ ok: false, reason: "roomId required" }); return; }
    const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
    if (!game) { ack?.({ ok: false, reason: "No active game" }); return; }
    if (!isMyTurn(game, userId)) { ack?.({ ok: false, reason: "Not your turn" }); return; }
    if (game.phase !== "draw") { ack?.({ ok: false, reason: "Not draw phase" }); return; }

    let deck = game.deck as unknown as Card[];
    let discard = game.discard as unknown as Card[];
    let drawn: Card;

    if (payload.source === "discard") {
      if (discard.length === 0) { ack?.({ ok: false, reason: "Discard pile empty" }); return; }
      drawn = discard[discard.length - 1]!;
      discard = discard.slice(0, -1);
    } else {
      if (deck.length === 0) {
        // Reshuffle-on-empty: everything but the visible top card goes back
        // into the deck. Deck+discard is conserved by the draw/discard cycle
        // (see the design doc), so this can only fail if <=1 card remains
        // total across both piles — effectively unreachable within a round.
        if (discard.length <= 1) { ack?.({ ok: false, reason: "No cards left to draw" }); return; }
        deck = shuffle(discard.slice(0, -1));
        discard = discard.slice(-1);
      }
      drawn = deck[deck.length - 1]!;
      deck = deck.slice(0, -1);
    }

    const hands = game.hands as unknown as Record<string, Card[]>;
    const newHands = { ...hands, [userId]: [...(hands[userId] ?? []), drawn] };
    const newLog = appendLog(game.moveLog, { type: "draw", userId, source: payload.source === "discard" ? "discard" : "deck" });

    await prisma.platformWildReignGame.update({
      where: { roomId },
      data: { deck: deck as any, discard: discard as any, hands: newHands as any, phase: "discard", moveLog: newLog as any },
    });

    ack?.({ ok: true });
    await pushStateToAll(io, roomId);
  });

  socket.on("wildreign:discard", async (payload: { roomId?: string; cardId?: number }, ack?: Ack) => {
    const roomId = payload?.roomId;
    if (!roomId) { ack?.({ ok: false, reason: "roomId required" }); return; }
    const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
    if (!game) { ack?.({ ok: false, reason: "No active game" }); return; }
    if (!isMyTurn(game, userId)) { ack?.({ ok: false, reason: "Not your turn" }); return; }
    if (game.phase !== "discard") { ack?.({ ok: false, reason: "Not discard phase" }); return; }

    const hands = game.hands as unknown as Record<string, Card[]>;
    const hand = hands[userId] ?? [];
    const idx = hand.findIndex(c => c.id === payload.cardId);
    if (idx < 0) { ack?.({ ok: false, reason: "Card not in hand" }); return; }

    const card = hand[idx]!;
    const newHands = { ...hands, [userId]: hand.filter((_, i) => i !== idx) };
    const discard = game.discard as unknown as Card[];
    const newDiscard = [...discard, card];
    const newLog = appendLog(game.moveLog, { type: "discard", userId, card });

    const turnOrder = game.turnOrder as unknown as string[];
    const nextIndex = (game.turnIndex + 1) % turnOrder.length;

    if (game.wentOutUserId !== null) {
      const remainingOwed = (game.owesFinalTurn as unknown as string[]).filter(u => u !== userId);
      if (remainingOwed.length === 0) {
        await finishRound(io, roomId, game, newHands, newDiscard, newLog);
        ack?.({ ok: true });
        return;
      }
      await prisma.platformWildReignGame.update({
        where: { roomId },
        data: {
          hands: newHands as any, discard: newDiscard as any,
          owesFinalTurn: remainingOwed as any, turnIndex: nextIndex, phase: "draw", moveLog: newLog as any,
        },
      });
      ack?.({ ok: true });
      await pushStateToAll(io, roomId);
      return;
    }

    // Only ever offer the go-out decision on the hand as it now stands, i.e. after
    // this discard has resolved it back to its normal size — matching the original
    // game's checkGoOut()-after-discard rule instead of checking the pre-discard hand.
    const dw = bestDw(newHands[userId]!, game.round);
    if (dw === 0) {
      await prisma.platformWildReignGame.update({
        where: { roomId },
        data: { hands: newHands as any, discard: newDiscard as any, phase: "goOutDecision", moveLog: newLog as any },
      });
      ack?.({ ok: true });
      await pushStateToAll(io, roomId);
      return;
    }

    await prisma.platformWildReignGame.update({
      where: { roomId },
      data: { hands: newHands as any, discard: newDiscard as any, turnIndex: nextIndex, phase: "draw", moveLog: newLog as any },
    });
    ack?.({ ok: true });
    await pushStateToAll(io, roomId);
  });

  // Server independently recomputes deadwood — nothing from the client is trusted for scoring.
  socket.on("wildreign:go-out", async (payload: { roomId?: string }, ack?: Ack) => {
    const roomId = payload?.roomId;
    if (!roomId) { ack?.({ ok: false, reason: "roomId required" }); return; }
    const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
    if (!game) { ack?.({ ok: false, reason: "No active game" }); return; }
    if (!isMyTurn(game, userId)) { ack?.({ ok: false, reason: "Not your turn" }); return; }
    if (game.phase !== "goOutDecision") { ack?.({ ok: false, reason: "Not your go-out decision" }); return; }
    if (game.wentOutUserId !== null) { ack?.({ ok: false, reason: "Someone already went out" }); return; }

    const hands = game.hands as unknown as Record<string, Card[]>;
    const hand = hands[userId] ?? [];
    const deadwood = bestDw(hand, game.round);
    if (deadwood !== 0) { ack?.({ ok: false, reason: "Hand is not fully melded" }); return; }

    const turnOrder = game.turnOrder as unknown as string[];
    const owesFinalTurn = turnOrder.filter(u => u !== userId);
    const nextIndex = (game.turnIndex + 1) % turnOrder.length;
    const newLog = appendLog(game.moveLog, { type: "goOut", userId });

    await prisma.platformWildReignGame.update({
      where: { roomId },
      data: { wentOutUserId: userId, owesFinalTurn: owesFinalTurn as any, turnIndex: nextIndex, phase: "draw", moveLog: newLog as any },
    });

    ack?.({ ok: true });
    await pushStateToAll(io, roomId);
  });

  // Player discarded down to a meldable hand but chooses not to go out this turn.
  socket.on("wildreign:pass-go-out", async (payload: { roomId?: string }, ack?: Ack) => {
    const roomId = payload?.roomId;
    if (!roomId) { ack?.({ ok: false, reason: "roomId required" }); return; }
    const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
    if (!game) { ack?.({ ok: false, reason: "No active game" }); return; }
    if (!isMyTurn(game, userId)) { ack?.({ ok: false, reason: "Not your turn" }); return; }
    if (game.phase !== "goOutDecision") { ack?.({ ok: false, reason: "Not your go-out decision" }); return; }

    const turnOrder = game.turnOrder as unknown as string[];
    const nextIndex = (game.turnIndex + 1) % turnOrder.length;
    const newLog = appendLog(game.moveLog, { type: "pass", userId });

    await prisma.platformWildReignGame.update({
      where: { roomId },
      data: { turnIndex: nextIndex, phase: "draw", moveLog: newLog as any },
    });

    ack?.({ ok: true });
    await pushStateToAll(io, roomId);
  });

  socket.on("wildreign:ready-next-round", async (payload: { roomId?: string }, ack?: Ack) => {
    const roomId = payload?.roomId;
    if (!roomId) { ack?.({ ok: false, reason: "roomId required" }); return; }
    const game = await prisma.platformWildReignGame.findUnique({ where: { roomId } });
    if (!game || game.phase !== "roundEnd") { ack?.({ ok: false, reason: "Round not over" }); return; }

    const turnOrder = game.turnOrder as unknown as string[];
    const readyNext = new Set(game.readyNext as unknown as string[]);
    readyNext.add(userId);

    if (readyNext.size >= turnOrder.length) {
      await dealNextRound(roomId);
    } else {
      await prisma.platformWildReignGame.update({
        where: { roomId },
        data: { readyNext: [...readyNext] as any },
      });
    }

    ack?.({ ok: true });
    await pushStateToAll(io, roomId);
  });

  // Any seated player can end a stuck/unwanted game — no stall-timer built
  // yet, this is a manual escape hatch (reasonable for a private group). The
  // client confirms first; the server insists the caller is actually seated
  // here, otherwise anyone who learned a roomId could end someone else's game.
  socket.on("wildreign:abandon", async (payload: { roomId?: string }, ack?: Ack) => {
    const roomId = payload?.roomId;
    if (!roomId) { ack?.({ ok: false, reason: "roomId required" }); return; }
    const membership = await findMyMembership(userId);
    if (!membership || membership.roomId !== roomId) { ack?.({ ok: false, reason: "You're not in this game" }); return; }
    const room = await prisma.platformRoom.findUnique({ where: { id: roomId } });
    if (!room || room.status !== "active") { ack?.({ ok: false, reason: "No active game" }); return; }

    await prisma.platformRoom.update({ where: { id: roomId }, data: { status: "abandoned" } });
    ack?.({ ok: true });
    // So the other players know why their table just vanished.
    io.of("/play").to(roomChannel(roomId)).emit("room:notice", {
      text: `${(socket.data.username as string | undefined) ?? "Someone"} ended the game`,
    });
    await broadcastRoomState(io, roomId);
  });
}
