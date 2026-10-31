import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import cottageRouter from "./cottage-routes.js";
import wildReignRouter from "./wildreign-routes.js";
import playAuthRouter from "./play-auth-routes.js";
import playFriendsRouter from "./play-friends-routes.js";
import playStatsRouter from "./play-stats-routes.js";
import playGifsRouter from "./play-gifs-routes.js";
import { registerPlayNamespace } from "./play/index.js";
import type {
  BallResult,
  ClientToServerEvents,
  PlayerSlot,
  PrivatePlayerView,
  ServerToClientEvents,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import {
  handleCall as handleCoinTossCall,
  handleChoose as handleCoinTossChoose,
  startCoinToss,
} from "./coin-toss.js";
import {
  handleBallSwapPick,
  startInnings1,
  submitBallSelection,
} from "./innings.js";
import { MatchRegistry, type ServerMatch } from "./match-registry.js";

const PORT = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
// In production we serve the client from the same origin, so CORS is moot.
// In dev, Vite runs on a different port so CORS must allow it.
const CLIENT_ORIGIN = isProduction
  ? true // reflect request origin (same-origin in prod anyway)
  : (process.env.CLIENT_ORIGIN ?? "http://localhost:5173");

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Cottage REST API — mounted before static files so /cottage/api/* is never
// caught by the SPA fallback below.
app.use("/cottage/api", cottageRouter);
app.use("/cottage/api/wildreign", wildReignRouter);

// /play platform REST API — same "mount before static" rule as cottage above.
app.use("/play/api/auth", playAuthRouter);
app.use("/play/api/friends", playFriendsRouter);
app.use("/play/api/stats", playStatsRouter);
app.use("/play/api/gifs", playGifsRouter);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    cardCounts: {
      batsmen: CARDS.batsmen.length,
      bowlers: CARDS.bowlers.length,
      situations: CARDS.situations.length,
    },
  });
});

// In production, serve the built Vite client from the same origin.
// Resolves to /app/client/dist inside the Docker image (server runs from
// /app/server/dist/index.js → ../../client/dist).
if (isProduction) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const STATIC_DIR = process.env.STATIC_DIR
    ? resolve(process.env.STATIC_DIR)
    : resolve(__dirname, "../../client/dist");
  const COTTAGE_DIR = resolve(__dirname, "../../cottage/dist");
  const PLAY_DIR = resolve(__dirname, "../../play/dist");
  const DRAFT_DIR = resolve(__dirname, "../../draft/dist");

  // World Cup Draft SPA (Vite base "/draft/") — must come before the cricket catch-all below.
  app.use("/draft", express.static(DRAFT_DIR));
  app.get("/draft", (_req, res) => res.sendFile(join(DRAFT_DIR, "index.html")));
  app.get("/draft/*", (_req, res) => res.sendFile(join(DRAFT_DIR, "index.html")));

  // Cottage SPA — must come before the cricket catch-all below.
  app.use("/cottage", express.static(COTTAGE_DIR));
  app.get("/cottage", (_req, res) => res.sendFile(join(COTTAGE_DIR, "index.html")));
  app.get("/cottage/*", (_req, res) => res.sendFile(join(COTTAGE_DIR, "index.html")));

  // Play SPA — must come before the cricket catch-all below.
  app.use("/play", express.static(PLAY_DIR));
  app.get("/play", (_req, res) => res.sendFile(join(PLAY_DIR, "index.html")));
  app.get("/play/*", (_req, res) => res.sendFile(join(PLAY_DIR, "index.html")));

  // Cricket SPA — catch-all, must be last.
  app.use(express.static(STATIC_DIR));
  app.get("*", (_req, res) => {
    res.sendFile(join(STATIC_DIR, "index.html"));
  });
  console.log(`[server] serving cricket from ${STATIC_DIR}`);
  console.log(`[server] serving cottage from ${COTTAGE_DIR}`);
  console.log(`[server] serving play from ${PLAY_DIR}`);
  console.log(`[server] serving draft from ${DRAFT_DIR}`);
}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

// /play platform namespace — additive, doesn't touch the default-namespace
// cricket handlers registered below.
registerPlayNamespace(io);

const registry = new MatchRegistry();

function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}

function broadcastMatchState(match: ServerMatch): void {
  io.to(matchRoom(match.matchId)).emit(
    "match:state",
    registry.toPublicState(match),
  );
}

const inningsCallbacks = {
  broadcastState: broadcastMatchState,
  broadcastPrivate: (
    match: ServerMatch,
    slot: PlayerSlot,
    view: PrivatePlayerView,
  ) => {
    const player = slot === "A" ? match.players.A : match.players.B;
    if (!player?.socketId) return;
    io.to(player.socketId).emit("match:private", view);
  },
  notifyOpponentLocked: (match: ServerMatch, lockingSlot: PlayerSlot) => {
    const opponent = lockingSlot === "A" ? match.players.B : match.players.A;
    if (!opponent?.socketId) return;
    io.to(opponent.socketId).emit("ball:opponent-locked");
  },
  emitReveal: (match: ServerMatch, result: BallResult) => {
    io.to(matchRoom(match.matchId)).emit("ball:reveal", result);
  },
};

const coinTossCallbacks = {
  broadcastState: broadcastMatchState,
  emitResult: (match: ServerMatch, payload: {
    flip: "heads" | "tails";
    callerSlot: "A" | "B";
    winnerSlot: "A" | "B";
  }) => {
    io.to(matchRoom(match.matchId)).emit("cointoss:result", payload);
  },
  onComplete: (match: ServerMatch) => {
    // Briefly let clients show the "X bats first" card, then start innings 1.
    const t = setTimeout(() => {
      startInnings1(match, inningsCallbacks);
    }, 3000);
    match.timers.set("post-toss-pause", t);
  },
};

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("lobby:create", ({ displayName, abbreviation, format }, ack) => {
    const { match, playerToken } = registry.createMatch(
      displayName,
      abbreviation,
      socket.id,
      format,
    );
    socket.join(matchRoom(match.matchId));
    ack({
      matchId: match.matchId,
      inviteCode: match.inviteCode,
      playerToken,
      slot: "A",
    });
    broadcastMatchState(match);
    console.log(
      `[lobby] created ${match.matchId} (${match.inviteCode}) by "${displayName}" (${match.players.A.abbreviation})`,
    );
  });

  socket.on("match:create-bot", ({ displayName, abbreviation, difficulty, format, playerDeck, botNation, botName }, ack) => {
    const { match, playerToken } = registry.createBotMatch(
      displayName,
      abbreviation,
      difficulty,
      socket.id,
      format,
      { playerDeck, botNation, botName },
    );
    socket.join(matchRoom(match.matchId));
    ack({
      matchId: match.matchId,
      inviteCode: match.inviteCode,
      playerToken,
      slot: "A",
    });
    console.log(
      `[lobby] bot match ${match.matchId} (${match.format}) created by "${displayName}" vs ${match.players.B!.displayName} (${match.players.B!.botNation}, ${difficulty})`,
    );
    // Skip the lobby waiting room and jump straight to the coin toss.
    startCoinToss(match, coinTossCallbacks);
  });

  socket.on("lobby:join", ({ inviteCode, displayName, abbreviation }, ack) => {
    const result = registry.joinMatch(
      inviteCode,
      displayName,
      abbreviation,
      socket.id,
    );
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    const { match, playerToken } = result;
    socket.join(matchRoom(match.matchId));
    ack({
      ok: true,
      matchId: match.matchId,
      inviteCode: match.inviteCode,
      playerToken,
      slot: "B",
    });
    console.log(
      `[lobby] "${displayName}" (${match.players.B?.abbreviation}) joined ${match.matchId} (${match.inviteCode})`,
    );
    // Auto-advance into coin toss with a 10s countdown.
    startCoinToss(match, coinTossCallbacks);
  });

  socket.on("match:reconnect", ({ matchId, playerToken }, ack) => {
    const result = registry.reconnect(matchId, playerToken, socket.id);
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    socket.join(matchRoom(result.match.matchId));
    ack({ ok: true, slot: result.slot });
    broadcastMatchState(result.match);
    console.log(`[lobby] reconnect: ${result.slot} in ${matchId}`);
  });

  socket.on("cointoss:call", ({ call }) => {
    const match = registry.getMatchBySocket(socket.id);
    if (!match) return;
    const slot = match.players.A.socketId === socket.id ? "A" : "B";
    const res = handleCoinTossCall(match, slot, call, coinTossCallbacks);
    if (!res.ok && res.reason) {
      socket.emit("match:error", { code: "COINTOSS_CALL", message: res.reason });
    }
  });

  socket.on("cointoss:choose", ({ choose }) => {
    const match = registry.getMatchBySocket(socket.id);
    if (!match) return;
    const slot = match.players.A.socketId === socket.id ? "A" : "B";
    const res = handleCoinTossChoose(match, slot, choose, coinTossCallbacks);
    if (!res.ok && res.reason) {
      socket.emit("match:error", { code: "COINTOSS_CHOOSE", message: res.reason });
    }
  });

  socket.on("ball:submit", ({ selection }) => {
    const match = registry.getMatchBySocket(socket.id);
    if (!match) return;
    const slot: PlayerSlot =
      match.players.A.socketId === socket.id ? "A" : "B";
    const res = submitBallSelection(match, slot, selection, inningsCallbacks);
    if (!res.ok && res.reason) {
      socket.emit("match:error", {
        code: "BALL_SUBMIT",
        message: res.reason,
      });
    }
  });

  socket.on("ball:swap-pick", ({ cardId }) => {
    const match = registry.getMatchBySocket(socket.id);
    if (!match) return;
    const slot: PlayerSlot =
      match.players.A.socketId === socket.id ? "A" : "B";
    const res = handleBallSwapPick(match, slot, cardId, inningsCallbacks);
    if (!res.ok && res.reason) {
      socket.emit("match:error", {
        code: "BALL_SWAP_PICK",
        message: res.reason,
      });
    }
  });

  socket.on("lobby:leave", () => {
    const { match } = registry.leaveMatch(socket.id);
    if (match) {
      const reason = `${match.players.A.displayName ?? "A player"} left the lobby`;
      io.to(matchRoom(match.matchId)).emit("match:closed", { reason });
      io.in(matchRoom(match.matchId)).socketsLeave(matchRoom(match.matchId));
      console.log(`[lobby] leave: ${match.matchId}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    const { match, closed } = registry.handleSocketDisconnect(socket.id);
    if (!match) return;
    if (closed) {
      io.to(matchRoom(match.matchId)).emit("match:closed", {
        reason: "The other player left the lobby",
      });
      io.in(matchRoom(match.matchId)).socketsLeave(matchRoom(match.matchId));
    } else {
      broadcastMatchState(match);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(
    `[server] loaded ${CARDS.batsmen.length} batsmen, ${CARDS.bowlers.length} bowlers, ${CARDS.situations.length} situation cards`,
  );
});

// Graceful shutdown: Fly sends SIGTERM during rolling deploys, scale-to-zero,
// and `fly apps destroy`. Closing Socket.IO + the HTTP server lets in-flight
// requests finish and emits clean disconnect frames to connected clients
// instead of letting them see an abrupt drop. The hard-exit timer is a
// safety net — Fly's default kill grace is 5s, so we have to be done by then.
function shutdown(signal: string): void {
  console.log(`[server] ${signal} received, shutting down gracefully…`);
  io.close(() => {
    httpServer.close(() => {
      console.log("[server] closed cleanly");
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.warn("[server] forced exit after 4s (in-flight requests dropped)");
    process.exit(1);
  }, 4000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
