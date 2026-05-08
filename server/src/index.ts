import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
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
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

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

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

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

  socket.on("lobby:create", ({ displayName }, ack) => {
    const { match, playerToken } = registry.createMatch(displayName, socket.id);
    socket.join(matchRoom(match.matchId));
    ack({
      matchId: match.matchId,
      inviteCode: match.inviteCode,
      playerToken,
      slot: "A",
    });
    broadcastMatchState(match);
    console.log(
      `[lobby] created ${match.matchId} (${match.inviteCode}) by "${displayName}"`,
    );
  });

  socket.on("lobby:join", ({ inviteCode, displayName }, ack) => {
    const result = registry.joinMatch(inviteCode, displayName, socket.id);
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
      `[lobby] "${displayName}" joined ${match.matchId} (${match.inviteCode})`,
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
