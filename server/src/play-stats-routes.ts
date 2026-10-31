import { Router, type Request, type Response } from "express";
import prisma from "./db.js";
import { authenticatePlayer } from "./play-auth.js";

const router = Router();

// GET /play/api/stats/me — rollup counters (wins/losses/best score) per game.
router.get("/me", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const stats = await prisma.platformUserGameStats.findMany({ where: { userId: me.id } });
  res.json({
    stats: stats.map(s => ({
      gameType: s.gameType,
      gamesPlayed: s.gamesPlayed,
      wins: s.wins,
      losses: s.losses,
      bestScore: s.bestScore,
    })),
  });
});

// GET /play/api/stats/head-to-head?userId=X&gameType=wildreign
// Games where both the caller and `userId` participated, and who won each.
router.get("/head-to-head", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const otherUserId = req.query.userId as string | undefined;
  const gameType = req.query.gameType as string | undefined;
  if (!otherUserId) {
    res.status(400).json({ error: "userId query param required" });
    return;
  }

  const myResults = await prisma.platformGameResultPlayer.findMany({
    where: { userId: me.id, ...(gameType ? { result: { gameType } } : {}) },
    select: { resultId: true, won: true },
  });
  const theirResults = await prisma.platformGameResultPlayer.findMany({
    where: { userId: otherUserId, resultId: { in: myResults.map(r => r.resultId) } },
    select: { resultId: true, won: true },
  });
  const theirWonByResult = new Map(theirResults.map(r => [r.resultId, r.won]));

  let gamesTogether = 0;
  let myWins = 0;
  let theirWins = 0;
  for (const mine of myResults) {
    if (!theirWonByResult.has(mine.resultId)) continue; // they weren't in this particular match
    gamesTogether++;
    if (mine.won) myWins++;
    if (theirWonByResult.get(mine.resultId)) theirWins++;
  }

  res.json({ gamesTogether, myWins, theirWins });
});

export default router;
