import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { isAllowedEmoji, isAllowedGifUrl, REACTION_LIMIT } from "@swipe-sixer/shared/play/reactions";
import prisma from "../db.js";
import { resolveSession } from "../play-auth.js";
import { GAME_CONFIGS } from "./game-configs.js";
import { generateUniqueRoomCode } from "./invite-code.js";
import { roomChannel, userChannel, findMyMembership, buildRoomState, broadcastRoomState } from "./rooms.js";
import { startWildReignGame, registerWildReignHandlers, pushWildReignStateTo } from "./wildreign.js";

// Per-gameType hook run once a room transitions from "lobby" to "active".
// The extension point for Codenames/Catan later.
const GAME_STARTERS: Record<string, (io: Server, roomId: string, userIds: string[]) => Promise<void>> = {
  wildreign: startWildReignGame,
};

async function handleLeave(io: Server, roomId: string, userId: string): Promise<void> {
  const room = await prisma.platformRoom.findUnique({ where: { id: roomId } });
  if (!room) return;

  if (room.status === "lobby" && room.hostUserId === userId) {
    // Host leaving pre-start closes the room for everyone else in it.
    await prisma.platformRoomPlayer.deleteMany({ where: { roomId } });
    await prisma.platformRoom.update({ where: { id: roomId }, data: { status: "abandoned" } });
    const playNs = io.of("/play");
    playNs.to(roomChannel(roomId)).emit("room:closed", { reason: "Host left the lobby" });
    playNs.in(roomChannel(roomId)).socketsLeave(roomChannel(roomId));
    return;
  }

  await prisma.platformRoomPlayer.deleteMany({ where: { roomId, userId } });
  await broadcastRoomState(io, roomId);
}

type Ack<T> = (response: T) => void;
type CreateAck = Ack<{ ok: true; roomId: string; code: string; seat: number } | { ok: false; reason: string }>;
type JoinAck = Ack<{ ok: true; roomId: string; code: string; seat: number } | { ok: false; reason: string }>;
type StartAck = Ack<{ ok: true } | { ok: false; reason: string }>;
type ReactionAck = Ack<{ ok: true } | { ok: false; reason: string }>;

// Per-user sliding window for table reactions (keyed by user, not socket, so a
// second open tab doesn't double the budget). Cleared on the user's last disconnect.
const reactionHits = new Map<string, number[]>();

function reactionAllowed(userId: string): boolean {
  const now = Date.now();
  const hits = (reactionHits.get(userId) ?? []).filter(t => now - t < REACTION_LIMIT.windowMs);
  if (hits.length >= REACTION_LIMIT.max) {
    reactionHits.set(userId, hits);
    return false;
  }
  hits.push(now);
  reactionHits.set(userId, hits);
  return true;
}

export function registerPlayNamespace(io: Server): void {
  const playNs = io.of("/play");

  // Auth middleware — every socket in this namespace carries a resolved user.
  playNs.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }
    const user = await resolveSession(token);
    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.userId = user.id;
    socket.data.username = user.username;
    next();
  });

  playNs.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userChannel(userId));
    registerWildReignHandlers(io, socket, userId);

    // Reconnect is automatic: if this user is seated in a non-terminal room,
    // rejoin its channel, mark connected, and push it the current state
    // (room state always; game state too if a Wild Reign match is active).
    const membership = await findMyMembership(userId);
    if (membership) {
      socket.join(roomChannel(membership.roomId));
      await prisma.platformRoomPlayer.update({
        where: { id: membership.id },
        data: { connected: true },
      });
      const state = await buildRoomState(membership.roomId);
      socket.emit("room:state", state);
      await broadcastRoomState(io, membership.roomId);
      if (membership.room.status === "active" && membership.room.gameType === "wildreign") {
        await pushWildReignStateTo(io, membership.roomId, userId);
      }
    }

    socket.on("room:create", async (payload: { gameType?: string }, ack?: CreateAck) => {
      const gameType = payload?.gameType;
      const config = gameType ? GAME_CONFIGS[gameType] : undefined;
      if (!gameType || !config) {
        ack?.({ ok: false, reason: "Unknown game type" });
        return;
      }
      if (await findMyMembership(userId)) {
        ack?.({ ok: false, reason: "You're already in a room" });
        return;
      }

      const code = await generateUniqueRoomCode();
      const room = await prisma.platformRoom.create({
        data: {
          code,
          gameType,
          hostUserId: userId,
          minPlayers: config.minPlayers,
          maxPlayers: config.maxPlayers,
          players: { create: { userId, seat: 0, connected: true } },
        },
      });

      socket.join(roomChannel(room.id));
      ack?.({ ok: true, roomId: room.id, code: room.code, seat: 0 });
      await broadcastRoomState(io, room.id);
    });

    socket.on("room:join", async (payload: { code?: string }, ack?: JoinAck) => {
      const rawCode = payload?.code;
      if (!rawCode) {
        ack?.({ ok: false, reason: "Room code required" });
        return;
      }

      const room = await prisma.platformRoom.findUnique({
        where: { code: rawCode.trim().toUpperCase() },
        include: { players: true },
      });
      if (!room) {
        ack?.({ ok: false, reason: "Room not found" });
        return;
      }

      const existingSeat = room.players.find(p => p.userId === userId);
      if (existingSeat) {
        // Already seated (duplicate tab / reconnect via join) — just rejoin the channel.
        socket.join(roomChannel(room.id));
        ack?.({ ok: true, roomId: room.id, code: room.code, seat: existingSeat.seat });
        return;
      }

      if (room.status !== "lobby") {
        ack?.({ ok: false, reason: "That room has already started" });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        ack?.({ ok: false, reason: "Room is full" });
        return;
      }
      if (await findMyMembership(userId)) {
        ack?.({ ok: false, reason: "You're already in a room" });
        return;
      }

      const seat = room.players.length;
      await prisma.platformRoomPlayer.create({
        data: { roomId: room.id, userId, seat, connected: true },
      });

      socket.join(roomChannel(room.id));
      ack?.({ ok: true, roomId: room.id, code: room.code, seat });
      await broadcastRoomState(io, room.id);
    });

    socket.on("room:leave", async () => {
      const membership = await findMyMembership(userId);
      if (!membership) return;
      socket.leave(roomChannel(membership.roomId));
      await handleLeave(io, membership.roomId, userId);
    });

    socket.on("room:ready", async () => {
      const membership = await findMyMembership(userId);
      if (!membership || membership.room.status !== "lobby") return;
      await prisma.platformRoomPlayer.update({ where: { id: membership.id }, data: { ready: true } });
      await broadcastRoomState(io, membership.roomId);
    });

    socket.on("room:unready", async () => {
      const membership = await findMyMembership(userId);
      if (!membership || membership.room.status !== "lobby") return;
      await prisma.platformRoomPlayer.update({ where: { id: membership.id }, data: { ready: false } });
      await broadcastRoomState(io, membership.roomId);
    });

    // Host-only, Kahoot/Jackbox-style: the host decides when everyone
    // they're expecting has joined and starts manually.
    socket.on("room:start", async (_payload: unknown, ack?: StartAck) => {
      const membership = await findMyMembership(userId);
      if (!membership) {
        ack?.({ ok: false, reason: "You're not in a room" });
        return;
      }
      const room = await prisma.platformRoom.findUnique({
        where: { id: membership.roomId },
        include: { players: true },
      });
      if (!room) {
        ack?.({ ok: false, reason: "Room not found" });
        return;
      }
      if (room.hostUserId !== userId) {
        ack?.({ ok: false, reason: "Only the host can start" });
        return;
      }
      if (room.status !== "lobby") {
        ack?.({ ok: false, reason: "Already started" });
        return;
      }
      const config = GAME_CONFIGS[room.gameType];
      if (!config) {
        ack?.({ ok: false, reason: "Unknown game type" });
        return;
      }
      if (room.players.length < config.minPlayers) {
        ack?.({ ok: false, reason: `Need at least ${config.minPlayers} players` });
        return;
      }
      const notReady = room.players.some(p => p.userId !== room.hostUserId && !p.ready);
      if (notReady) {
        ack?.({ ok: false, reason: "Not everyone is ready" });
        return;
      }

      await prisma.platformRoom.update({ where: { id: room.id }, data: { status: "active" } });
      ack?.({ ok: true });
      await broadcastRoomState(io, room.id);
      await GAME_STARTERS[room.gameType]?.(io, room.id, room.players.map(p => p.userId));
    });

    // Ephemeral table reactions (emoji / GIF) — broadcast to the room, never
    // persisted. Membership is checked against the socket's own channel set
    // (it only ever joins rooms it's seated in), so this costs no DB round trip.
    socket.on("room:reaction", (payload: { roomId?: string; kind?: string; value?: string }, ack?: ReactionAck) => {
      const roomId = payload?.roomId;
      if (!roomId || !socket.rooms.has(roomChannel(roomId))) {
        ack?.({ ok: false, reason: "Not in this room" });
        return;
      }
      const kind = payload?.kind;
      const value = payload?.value;
      const valid = kind === "emoji" ? isAllowedEmoji(value) : kind === "gif" ? isAllowedGifUrl(value) : false;
      if (!valid) {
        ack?.({ ok: false, reason: "Invalid reaction" });
        return;
      }
      if (!reactionAllowed(userId)) {
        ack?.({ ok: false, reason: "Slow down 🙂" });
        return;
      }
      playNs.to(roomChannel(roomId)).emit("room:reaction", {
        id: randomUUID(),
        userId,
        username: socket.data.username as string,
        kind,
        value,
        at: Date.now(),
      });
      ack?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      // Socket.IO removes a socket from its rooms before emitting "disconnect",
      // so if this user still has another live tab/device, their user channel
      // still has members and we must NOT mark them away.
      const stillConnectedElsewhere = (playNs.adapter.rooms.get(userChannel(userId))?.size ?? 0) > 0;
      if (stillConnectedElsewhere) return;
      reactionHits.delete(userId);

      const membership = await findMyMembership(userId);
      if (!membership) return;
      await prisma.platformRoomPlayer.update({ where: { id: membership.id }, data: { connected: false } });
      await broadcastRoomState(io, membership.roomId);
    });
  });
}
