import { Router, type Request, type Response } from "express";
import prisma from "./db.js";

const router = Router();

const ONE_DAY_MS = 86_400_000;
const WEEK_MS    = 7 * ONE_DAY_MS;
const MIN_WATER_GAP_MS = 20 * 3_600_000; // must wait 20h before watering again
const WITHER_MS         = 48 * 3_600_000; // miss 24h window → wither
const BLOOM_STREAK      = 3;              // days of consecutive watering to bloom

function other(house: string) {
  return house === "left" ? "right" : "left";
}

async function getPlayerByToken(token: string) {
  return prisma.cottagePlayer.findUnique({
    where: { sessionToken: token },
    include: { vase: true, mailbox: true, inventory: true, scrapbook: { orderBy: { archivedAt: "desc" } } },
  });
}

function buildPlayerState(player: Awaited<ReturnType<typeof getPlayerByToken>>) {
  if (!player) return null;
  return {
    name: player.name,
    avatar: player.avatar,
    coins: player.coins,
    lastLetterSent: player.lastLetterSent?.getTime() ?? 0,
    lastSeen: player.lastSeen?.getTime() ?? null,
    currentView: player.currentView ?? "exterior",
    mailbox: player.mailbox.map(m => ({
      id: m.id,
      letterText: m.letterText,
      flowerName: m.flowerName,
      flowerEmoji: m.flowerEmoji,
      fromHouse: m.fromHouse,
      sentAt: m.sentAt.getTime(),
    })),
    vase: player.vase
      ? {
          letter: player.vase.letterText
            ? {
                text: player.vase.letterText,
                from: player.vase.letterFrom,
                sentAt: player.vase.letterSentAt?.getTime() ?? null,
              }
            : null,
          flower: player.vase.flowerName
            ? {
                name: player.vase.flowerName,
                emoji: player.vase.flowerEmoji,
                from: player.vase.flowerFrom,
                sentAt: player.vase.flowerSentAt?.getTime() ?? null,
                lastWatered: player.vase.lastWatered?.getTime() ?? null,
                streak: player.vase.streak,
                phase: player.vase.flowerPhase,
              }
            : null,
        }
      : null,
    inventory: player.inventory.map(i => ({
      id: i.id,
      flowerName: i.flowerName,
      flowerEmoji: i.flowerEmoji,
      boughtAt: i.boughtAt.getTime(),
    })),
    scrapbook: player.scrapbook.map(s => ({
      id: s.id,
      letterText: s.letterText,
      letterFrom: s.letterFrom,
      letterSentAt: s.letterSentAt?.getTime() ?? null,
      flowerName: s.flowerName,
      flowerEmoji: s.flowerEmoji,
      flowerPhase: s.flowerPhase,
      archivedAt: s.archivedAt.getTime(),
    })),
  };
}

async function authenticate(req: Request, res: Response) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const token = auth.slice(7);
  const player = await getPlayerByToken(token);
  if (!player) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
  return player;
}

const PLAYER_INCLUDE = {
  vase: true, mailbox: true, inventory: true,
  scrapbook: { orderBy: { archivedAt: "desc" as const } },
} as const;

type PlayerWithRelations = Awaited<ReturnType<typeof getPlayerByToken>>;

async function buildGlobalState(myHouse: string) {
  const [left, right] = await Promise.all([
    prisma.cottagePlayer.findUnique({ where: { house: "left"  }, include: PLAYER_INCLUDE }),
    prisma.cottagePlayer.findUnique({ where: { house: "right" }, include: PLAYER_INCLUDE }),
  ]);

  // Wither check — update DB and patch in-memory so no second fetch needed
  await Promise.all([left, right].map(async (player) => {
    if (!player?.vase?.flowerName || player.vase.flowerPhase === "withered") return;
    const ref = player.vase.lastWatered ?? player.vase.flowerSentAt;
    if (ref && Date.now() - ref.getTime() > WITHER_MS) {
      await prisma.cottageVase.update({ where: { playerId: player.id }, data: { flowerPhase: "withered" } });
      player.vase.flowerPhase = "withered";
    }
  }));

  return {
    myHouse,
    bothSetup: !!(left && right),
    global: {
      left:  buildPlayerState(left  as PlayerWithRelations),
      right: buildPlayerState(right as PlayerWithRelations),
    },
  };
}

// POST /cottage/api/setup
router.post("/setup", async (req: Request, res: Response) => {
  const { name, house, avatar } = req.body as { name?: string; house?: string; avatar?: string };
  if (!name || !house || !["left", "right"].includes(house)) {
    res.status(400).json({ error: "name and house (left|right) are required" });
    return;
  }

  const existing = await prisma.cottagePlayer.findUnique({ where: { house } });
  if (existing) {
    if (avatar && avatar !== existing.avatar) {
      await prisma.cottagePlayer.update({ where: { house }, data: { avatar } });
    }
    const token = existing.sessionToken;
    const state = await buildGlobalState(house);
    res.json({ token, ...state });
    return;
  }

  const player = await prisma.cottagePlayer.create({
    data: { name: name.trim(), house, avatar: avatar ?? "girl" },
    include: { vase: true, mailbox: true, inventory: true, scrapbook: true },
  });

  const state = await buildGlobalState(house);
  res.json({ token: player.sessionToken, ...state });
});

// POST /cottage/api/ping — lightweight presence update, returns only lastSeen + currentView for both players
router.post("/ping", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const { view } = req.body as { view?: string };
  await prisma.cottagePlayer.update({
    where: { id: player.id },
    data: { lastSeen: new Date(), currentView: view ?? "exterior" },
  });
  const [left, right] = await Promise.all([
    prisma.cottagePlayer.findUnique({ where: { house: "left"  }, select: { lastSeen: true, currentView: true } }),
    prisma.cottagePlayer.findUnique({ where: { house: "right" }, select: { lastSeen: true, currentView: true } }),
  ]);
  res.json({
    left:  { lastSeen: left?.lastSeen?.getTime()  ?? null, currentView: left?.currentView  ?? "exterior" },
    right: { lastSeen: right?.lastSeen?.getTime() ?? null, currentView: right?.currentView ?? "exterior" },
  });
});

// GET /cottage/api/state
router.get("/state", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;
  const view = (req.query.view as string | undefined) ?? "exterior";
  await prisma.cottagePlayer.update({
    where: { id: player.id },
    data: { lastSeen: new Date(), currentView: view },
  });
  const state = await buildGlobalState(player.house);
  res.json(state);
});

// POST /cottage/api/buy-flower
router.post("/buy-flower", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;

  const { flowerName, flowerEmoji, price } = req.body as {
    flowerName?: string;
    flowerEmoji?: string;
    price?: number;
  };
  if (!flowerName || !flowerEmoji) {
    res.status(400).json({ error: "flowerName and flowerEmoji required" });
    return;
  }

  const cost = price ?? 10;
  if (player.coins < cost) {
    res.status(400).json({ error: "Not enough coins" });
    return;
  }

  await prisma.$transaction([
    prisma.cottagePlayer.update({
      where: { id: player.id },
      data: { coins: { decrement: cost } },
    }),
    prisma.cottageInventoryItem.create({
      data: { playerId: player.id, flowerName, flowerEmoji },
    }),
  ]);

  const state = await buildGlobalState(player.house);
  res.json(state);
});

// POST /cottage/api/send-letter
router.post("/send-letter", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;

  const { text, inventoryItemId } = req.body as {
    text?: string;
    inventoryItemId?: string | null;
  };
  if (!text?.trim()) {
    res.status(400).json({ error: "Letter text required" });
    return;
  }

  const cooldown = player.lastLetterSent
    ? WEEK_MS - (Date.now() - player.lastLetterSent.getTime())
    : 0;
  if (cooldown > 0) {
    res.status(429).json({ error: "Cooldown active", cooldownMs: cooldown });
    return;
  }

  const recipient = await prisma.cottagePlayer.findUnique({ where: { house: other(player.house) } });
  if (!recipient) {
    res.status(404).json({ error: "Other player hasn't set up yet" });
    return;
  }

  let flowerName: string | null = null;
  let flowerEmoji: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.cottagePlayer.update({
      where: { id: player.id },
      data: { lastLetterSent: new Date() },
    });

    if (inventoryItemId) {
      const item = await tx.cottageInventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (item && item.playerId === player.id) {
        flowerName  = item.flowerName;
        flowerEmoji = item.flowerEmoji;
        await tx.cottageInventoryItem.delete({ where: { id: inventoryItemId } });
      }
    }

    await tx.cottageMailItem.create({
      data: {
        toPlayerId: recipient.id,
        letterText: text.trim(),
        flowerName,
        flowerEmoji,
        fromHouse: player.house,
      },
    });
  });

  const state = await buildGlobalState(player.house);
  res.json(state);
});

// POST /cottage/api/collect-mail
router.post("/collect-mail", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;

  await prisma.$transaction(async (tx) => {
    const mail = await tx.cottageMailItem.findMany({ where: { toPlayerId: player.id } });
    if (mail.length === 0) return;

    const latest = mail[mail.length - 1]!;

    // Archive current vase contents to scrapbook
    const currentVase = await tx.cottageVase.findUnique({ where: { playerId: player.id } });
    if (currentVase?.letterText) {
      const flowerAlive = currentVase.flowerName && currentVase.flowerPhase !== "withered";
      await tx.cottageScrapEntry.create({
        data: {
          playerId: player.id,
          letterText: currentVase.letterText,
          letterFrom: currentVase.letterFrom,
          letterSentAt: currentVase.letterSentAt,
          flowerName:  flowerAlive ? currentVase.flowerName  : null,
          flowerEmoji: flowerAlive ? currentVase.flowerEmoji : null,
          flowerPhase: flowerAlive ? currentVase.flowerPhase : null,
        },
      });
    }

    // Archive all but the latest directly (no flower phase available from mail items)
    for (const item of mail.slice(0, -1)) {
      await tx.cottageScrapEntry.create({
        data: {
          playerId: player.id,
          letterText: item.letterText,
          letterFrom: item.fromHouse,
          letterSentAt: item.sentAt,
          flowerName:  item.flowerName,
          flowerEmoji: item.flowerEmoji,
          flowerPhase: item.flowerName ? "unbloomed" : null,
        },
      });
    }

    // Put latest letter + flower into vase; flower always starts unbloomed
    const now = new Date();
    await tx.cottageVase.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        letterText:  latest.letterText,
        letterFrom:  latest.fromHouse,
        letterSentAt: latest.sentAt,
        flowerName:   latest.flowerName,
        flowerEmoji:  latest.flowerEmoji,
        flowerFrom:   latest.flowerName ? latest.fromHouse : null,
        flowerSentAt: latest.flowerName ? now : null,
        lastWatered:  null,
        streak:       0,
        flowerPhase:  "unbloomed",
      },
      update: {
        letterText:  latest.letterText,
        letterFrom:  latest.fromHouse,
        letterSentAt: latest.sentAt,
        flowerName:   latest.flowerName,
        flowerEmoji:  latest.flowerEmoji,
        flowerFrom:   latest.flowerName ? latest.fromHouse : null,
        flowerSentAt: latest.flowerName ? now : null,
        lastWatered:  null,
        streak:       0,
        flowerPhase:  "unbloomed",
      },
    });

    await tx.cottageMailItem.deleteMany({ where: { toPlayerId: player.id } });
  });

  const state = await buildGlobalState(player.house);
  res.json(state);
});

// POST /cottage/api/water
router.post("/water", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;

  const vase = player.vase;
  if (!vase?.flowerName) {
    res.status(400).json({ error: "No flower to water" });
    return;
  }
  if (vase.flowerPhase === "withered") {
    res.status(400).json({ error: "Flower has already withered" });
    return;
  }

  // Cooldown only applies after the first watering — sentAt is not a cooldown reference
  const msSinceWatered = vase.lastWatered ? Date.now() - vase.lastWatered.getTime() : Infinity;
  const msSinceRef     = (vase.lastWatered ?? vase.flowerSentAt);

  if (msSinceWatered < MIN_WATER_GAP_MS) {
    res.status(400).json({ error: "Already watered today" });
    return;
  }

  // Missed the window — wither in place (defensive; autoMarkWithered handles this on state fetch too)
  const msSince = msSinceRef ? Date.now() - msSinceRef.getTime() : Infinity;
  if (msSince > WITHER_MS) {
    await prisma.cottageVase.update({
      where: { playerId: player.id },
      data: { flowerPhase: "withered" },
    });
    res.status(400).json({ error: "Flower has withered from neglect" });
    return;
  }

  const newStreak   = vase.streak + 1;
  const justBloomed = vase.flowerPhase === "unbloomed" && newStreak >= BLOOM_STREAK;
  const newPhase    = justBloomed ? "bloomed" : vase.flowerPhase;

  await prisma.$transaction(async (tx) => {
    // +1 coin to the person who watered
    await tx.cottagePlayer.update({
      where: { id: player.id },
      data: { coins: { increment: 1 } },
    });

    await tx.cottageVase.update({
      where: { playerId: player.id },
      data: { lastWatered: new Date(), streak: newStreak, flowerPhase: newPhase },
    });

    // +3 coins to the sender when their flower blooms
    if (justBloomed && vase.flowerFrom) {
      const sender = await tx.cottagePlayer.findUnique({ where: { house: vase.flowerFrom } });
      if (sender) {
        await tx.cottagePlayer.update({
          where: { id: sender.id },
          data: { coins: { increment: 3 } },
        });
      }
    }
  });

  const state = await buildGlobalState(player.house);
  res.json({ ...state, justBloomed });
});

// POST /cottage/api/trash-flower
router.post("/trash-flower", async (req: Request, res: Response) => {
  const player = await authenticate(req, res);
  if (!player) return;

  if (!player.vase?.flowerName) {
    res.status(400).json({ error: "No flower in vase" });
    return;
  }
  if (player.vase.flowerPhase !== "withered") {
    res.status(400).json({ error: "Only withered flowers can be removed" });
    return;
  }

  await prisma.cottageVase.update({
    where: { playerId: player.id },
    data: {
      flowerName:  null,
      flowerEmoji: null,
      flowerFrom:  null,
      flowerSentAt: null,
      lastWatered: null,
      streak:      0,
      flowerPhase: "unbloomed",
    },
  });

  const state = await buildGlobalState(player.house);
  res.json(state);
});

export default router;
