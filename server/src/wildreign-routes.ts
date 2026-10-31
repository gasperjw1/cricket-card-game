import { Router, type Request, type Response } from "express";
import prisma from "./db.js";
import { type Card, makeFCDeck, bestDw } from "@swipe-sixer/shared/games/wildreign";

const router = Router();

const GAME_ID = "wildreign-singleton";
const STALL_MS = 5 * 60_000;
const MATCH_WIN_COINS = 5;
const TOTAL_ROUNDS = 11;
const MAX_LOG_ENTRIES = 6;

type House = "left" | "right";
type GameRow = NonNullable<Awaited<ReturnType<typeof prisma.cottageWildReignGame.findUnique>>>;

// Rolling window of recent moves, shown client-side as an optional per-player
// log (each viewer toggles it themselves) — newest entry last.
type LogEntry =
  | { type: "dealt"; round: number }
  | { type: "draw"; house: House; source: "deck" | "discard" }
  | { type: "discard"; house: House; card: Card }
  | { type: "goOut"; house: House }
  | { type: "pass"; house: House };

function appendLog(log: unknown, entry: LogEntry): LogEntry[] {
  return [...(log as LogEntry[]), entry].slice(-MAX_LOG_ENTRIES);
}

function other(house: House): House {
  return house === "left" ? "right" : "left";
}

async function authenticate(req: Request, res: Response) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const token = auth.slice(7);
  const player = await prisma.cottagePlayer.findUnique({ where: { sessionToken: token } });
  if (!player) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
  return player;
}

function handOf(game: GameRow, house: House): Card[] {
  return (house === "left" ? game.leftHand : game.rightHand) as unknown as Card[];
}

// Read-only — never called from GET /state, so polling never resets the stall timer.
async function dealRound(round: number, resetScores: boolean, previousLog: unknown = []) {
  const deck = makeFCDeck();
  const handSize = round + 2;
  const leftHand: Card[] = [];
  const rightHand: Card[] = [];
  for (let i = 0; i < handSize; i++) {
    leftHand.push(deck.pop()!);
    rightHand.push(deck.pop()!);
  }
  const discardTop = deck.pop()!;
  const turnHouse: House = Math.random() < 0.5 ? "left" : "right";
  const moveLog = appendLog(resetScores ? [] : previousLog, { type: "dealt", round });

  return prisma.cottageWildReignGame.update({
    where: { id: GAME_ID },
    data: {
      status: "active",
      round,
      deck: deck as any,
      discard: [discardTop] as any,
      leftHand: leftHand as any,
      rightHand: rightHand as any,
      ...(resetScores ? { leftScore: 0, rightScore: 0, roundScores: [] as any } : {}),
      phase: "draw",
      turnHouse,
      wentOut: null,
      readyLeft: false,
      readyRight: false,
      readyNextLeft: false,
      readyNextRight: false,
      moveLog: moveLog as any,
    },
  });
}

function buildStateResponse(game: GameRow | null, house: House) {
  if (!game) {
    return {
      status: "waiting", readyLeft: false, readyRight: false,
      round: 1, phase: "draw", turnHouse: "left", wentOut: null,
      hand: [], partnerCardCount: 0, partnerHand: undefined, discardTop: null, deckCount: 0,
      leftScore: 0, rightScore: 0, roundScores: [],
      readyNextLeft: false, readyNextRight: false, stalled: false, winner: null, moveLog: [],
    };
  }

  const myHand = handOf(game, house);
  const partnerHouse = other(house);
  const partnerHand = handOf(game, partnerHouse);
  const discard = game.discard as unknown as Card[];
  const deckCount = (game.deck as unknown as Card[]).length;

  const revealPartner = game.status === "roundEnd" || game.status === "gameEnd";
  const isRoundEndWaiting = game.status === "roundEnd" && !(game.readyNextLeft && game.readyNextRight);
  const stalled = (game.status === "active" || isRoundEndWaiting) &&
    Date.now() - game.updatedAt.getTime() > STALL_MS;

  const winner = game.status === "gameEnd"
    ? (game.leftScore < game.rightScore ? "left" : game.rightScore < game.leftScore ? "right" : "tie")
    : null;

  return {
    status: game.status,
    readyLeft: game.readyLeft, readyRight: game.readyRight,
    round: game.round, phase: game.phase, turnHouse: game.turnHouse, wentOut: game.wentOut,
    hand: myHand,
    partnerCardCount: partnerHand.length,
    partnerHand: revealPartner ? partnerHand : undefined,
    discardTop: discard.length ? discard[discard.length - 1] : null,
    deckCount,
    leftScore: game.leftScore, rightScore: game.rightScore, roundScores: game.roundScores,
    readyNextLeft: game.readyNextLeft, readyNextRight: game.readyNextRight,
    stalled, winner, moveLog: game.moveLog,
  };
}

// Scores both hands, applies the completed round, and either deals into
// roundEnd or gameEnd (awarding the +5 coin match prize). Called from the
// discard handler when the discarder is taking their forced final turn
// after the partner went out.
async function finishRound(
  game: GameRow, actingHouse: House, actingNewHand: Card[], newDiscard: Card[], moveLog: unknown, res: Response,
) {
  const leftHand = actingHouse === "left" ? actingNewHand : handOf(game, "left");
  const rightHand = actingHouse === "right" ? actingNewHand : handOf(game, "right");

  const leftDw = bestDw(leftHand, game.round);
  const rightDw = bestDw(rightHand, game.round);

  const newLeftScore = game.leftScore + leftDw;
  const newRightScore = game.rightScore + rightDw;
  const roundScores = [...(game.roundScores as any[]), { round: game.round, left: leftDw, right: rightDw }];

  const isFinalRound = game.round >= TOTAL_ROUNDS;
  const newStatus = isFinalRound ? "gameEnd" : "roundEnd";
  const coinsAwardedHouse: House | null = !isFinalRound ? null :
    newLeftScore < newRightScore ? "left" :
    newRightScore < newLeftScore ? "right" : null;

  await prisma.$transaction(async (tx) => {
    await tx.cottageWildReignGame.update({
      where: { id: GAME_ID },
      data: {
        leftHand: leftHand as any,
        rightHand: rightHand as any,
        discard: newDiscard as any,
        leftScore: newLeftScore,
        rightScore: newRightScore,
        roundScores: roundScores as any,
        status: newStatus,
        moveLog: moveLog as any,
      },
    });
    if (coinsAwardedHouse) {
      await tx.cottagePlayer.update({
        where: { house: coinsAwardedHouse },
        data: { coins: { increment: MATCH_WIN_COINS } },
      });
    }
  });

  const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(updated, actingHouse));
}

// POST /cottage/api/wildreign/ready
router.post("/ready", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;

  const existing = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (existing && existing.status !== "waiting") {
    res.status(400).json({ error: "Game already in progress" });
    return;
  }

  const readyData = house === "left" ? { readyLeft: true } : { readyRight: true };
  let game: GameRow;
  if (existing) {
    game = await prisma.cottageWildReignGame.update({ where: { id: GAME_ID }, data: readyData });
  } else {
    try {
      game = await prisma.cottageWildReignGame.create({ data: { id: GAME_ID, ...readyData } });
    } catch {
      // Partner's concurrent /ready call created the row first — just apply our flag to it.
      game = await prisma.cottageWildReignGame.update({ where: { id: GAME_ID }, data: readyData });
    }
  }

  if (game.readyLeft && game.readyRight) {
    game = await dealRound(1, true);
  }

  res.json(buildStateResponse(game, house));
});

// POST /cottage/api/wildreign/unready
router.post("/unready", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;

  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (!game || game.status !== "waiting") {
    res.json(buildStateResponse(game, house));
    return;
  }

  const readyData = house === "left" ? { readyLeft: false } : { readyRight: false };
  const updated = await prisma.cottageWildReignGame.update({ where: { id: GAME_ID }, data: readyData });
  res.json(buildStateResponse(updated, house));
});

// GET /cottage/api/wildreign/state — pure read, never mutates (keeps the stall timer honest)
router.get("/state", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;
  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(game, house));
});

// POST /cottage/api/wildreign/draw
router.post("/draw", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;
  const { source } = req.body as { source?: "deck" | "discard" };

  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (!game || game.status !== "active") { res.status(400).json({ error: "No active game" }); return; }
  if (game.turnHouse !== house) { res.status(400).json({ error: "Not your turn" }); return; }
  if (game.phase !== "draw") { res.status(400).json({ error: "Not draw phase" }); return; }

  const deck = game.deck as unknown as Card[];
  const discard = game.discard as unknown as Card[];
  let drawn: Card;
  let newDeck = deck;
  let newDiscard = discard;

  if (source === "discard") {
    if (discard.length === 0) { res.status(400).json({ error: "Discard pile empty" }); return; }
    drawn = discard[discard.length - 1]!;
    newDiscard = discard.slice(0, -1);
  } else {
    if (deck.length === 0) { res.status(400).json({ error: "Deck empty" }); return; }
    drawn = deck[deck.length - 1]!;
    newDeck = deck.slice(0, -1);
  }

  const newHand = [...handOf(game, house), drawn];
  const handData = house === "left" ? { leftHand: newHand as any } : { rightHand: newHand as any };
  const newLog = appendLog(game.moveLog, { type: "draw", house, source: source === "discard" ? "discard" : "deck" });

  await prisma.cottageWildReignGame.update({
    where: { id: GAME_ID },
    data: { deck: newDeck as any, discard: newDiscard as any, ...handData, phase: "discard", moveLog: newLog as any },
  });

  const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(updated, house));
});

// POST /cottage/api/wildreign/discard
router.post("/discard", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;
  const { cardId } = req.body as { cardId?: number };

  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (!game || game.status !== "active") { res.status(400).json({ error: "No active game" }); return; }
  if (game.turnHouse !== house) { res.status(400).json({ error: "Not your turn" }); return; }
  if (game.phase !== "discard") { res.status(400).json({ error: "Not discard phase" }); return; }

  const hand = handOf(game, house);
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx < 0) { res.status(400).json({ error: "Card not in hand" }); return; }

  const card = hand[idx]!;
  const newHand = hand.filter((_, i) => i !== idx);
  const discard = game.discard as unknown as Card[];
  const newDiscard = [...discard, card];
  const newLog = appendLog(game.moveLog, { type: "discard", house, card });

  // wentOut !== null means this discard is the partner's forced final turn — round ends here.
  if (game.wentOut !== null) {
    await finishRound(game, house, newHand, newDiscard, newLog, res);
    return;
  }

  const handData = house === "left" ? { leftHand: newHand as any } : { rightHand: newHand as any };

  // Only offer the go-out decision on the hand as it now stands, i.e. after this
  // discard resolved it back to its normal size — matching the original game's
  // checkGoOut()-after-discard rule instead of checking the pre-discard hand.
  const dw = bestDw(newHand, game.round);
  if (dw === 0) {
    await prisma.cottageWildReignGame.update({
      where: { id: GAME_ID },
      data: { ...handData, discard: newDiscard as any, phase: "goOutDecision", moveLog: newLog as any },
    });
    const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
    res.json(buildStateResponse(updated, house));
    return;
  }

  await prisma.cottageWildReignGame.update({
    where: { id: GAME_ID },
    data: { ...handData, discard: newDiscard as any, turnHouse: other(house), phase: "draw", moveLog: newLog as any },
  });

  const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(updated, house));
});

// POST /cottage/api/wildreign/go-out — server independently recomputes deadwood; never trusts the client.
router.post("/go-out", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;

  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (!game || game.status !== "active") { res.status(400).json({ error: "No active game" }); return; }
  if (game.turnHouse !== house) { res.status(400).json({ error: "Not your turn" }); return; }
  if (game.phase !== "goOutDecision") { res.status(400).json({ error: "Not your go-out decision" }); return; }
  if (game.wentOut !== null) { res.status(400).json({ error: "Someone already went out" }); return; }

  const hand = handOf(game, house);
  const deadwood = bestDw(hand, game.round);
  if (deadwood !== 0) { res.status(400).json({ error: "Hand is not fully melded" }); return; }

  const newLog = appendLog(game.moveLog, { type: "goOut", house });

  await prisma.cottageWildReignGame.update({
    where: { id: GAME_ID },
    data: { wentOut: house, turnHouse: other(house), phase: "draw", moveLog: newLog as any },
  });

  const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(updated, house));
});

// POST /cottage/api/wildreign/pass-go-out — player discarded down to a meldable hand but chooses not to go out.
router.post("/pass-go-out", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;

  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (!game || game.status !== "active") { res.status(400).json({ error: "No active game" }); return; }
  if (game.turnHouse !== house) { res.status(400).json({ error: "Not your turn" }); return; }
  if (game.phase !== "goOutDecision") { res.status(400).json({ error: "Not your go-out decision" }); return; }

  const newLog = appendLog(game.moveLog, { type: "pass", house });

  await prisma.cottageWildReignGame.update({
    where: { id: GAME_ID },
    data: { turnHouse: other(house), phase: "draw", moveLog: newLog as any },
  });

  const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(updated, house));
});

// POST /cottage/api/wildreign/next-round
router.post("/next-round", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;

  const game = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  if (!game || game.status !== "roundEnd") { res.status(400).json({ error: "Round not over" }); return; }

  const readyData = house === "left" ? { readyNextLeft: true } : { readyNextRight: true };
  let updated = await prisma.cottageWildReignGame.update({ where: { id: GAME_ID }, data: readyData });

  if (updated.readyNextLeft && updated.readyNextRight) {
    updated = await dealRound(updated.round + 1, false, updated.moveLog);
  }

  res.json(buildStateResponse(updated, house));
});

// POST /cottage/api/wildreign/abandon — manual reset; also clears any stall.
router.post("/abandon", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const house = player.house as House;

  const resetData = {
    status: "waiting",
    readyLeft: false, readyRight: false,
    round: 1,
    deck: [] as any, discard: [] as any,
    leftHand: [] as any, rightHand: [] as any,
    leftScore: 0, rightScore: 0, roundScores: [] as any,
    phase: "draw", turnHouse: "left", wentOut: null,
    readyNextLeft: false, readyNextRight: false,
    moveLog: [] as any,
  };

  await prisma.cottageWildReignGame.upsert({
    where: { id: GAME_ID },
    create: { id: GAME_ID },
    update: resetData,
  });

  const updated = await prisma.cottageWildReignGame.findUnique({ where: { id: GAME_ID } });
  res.json(buildStateResponse(updated, house));
});

export default router;
