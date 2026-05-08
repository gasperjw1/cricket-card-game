import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
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
    broadcastMatchState(match);
    console.log(
      `[lobby] "${displayName}" joined ${match.matchId} (${match.inviteCode})`,
    );
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
