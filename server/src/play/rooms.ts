import type { Server } from "socket.io";
import prisma from "../db.js";

// Shared by index.ts (lobby handlers) and wildreign.ts (in-game handlers) —
// kept in its own module so neither has to import from the other.

const ACTIVE_STATUSES = ["lobby", "active"] as const;

export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** The room this user is currently seated in (lobby or active — not completed/abandoned). */
export function findMyMembership(userId: string) {
  return prisma.platformRoomPlayer.findFirst({
    where: { userId, room: { status: { in: [...ACTIVE_STATUSES] } } },
    include: { room: true },
  });
}

export async function buildRoomState(roomId: string) {
  const room = await prisma.platformRoom.findUnique({
    where: { id: roomId },
    include: { players: { include: { user: true }, orderBy: { seat: "asc" } } },
  });
  if (!room) return null;
  return {
    roomId: room.id,
    code: room.code,
    gameType: room.gameType,
    status: room.status,
    hostUserId: room.hostUserId,
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    players: room.players.map(p => ({
      userId: p.userId,
      username: p.user.username,
      avatarEmoji: p.user.avatarEmoji,
      seat: p.seat,
      ready: p.ready,
      connected: p.connected,
      isHost: p.userId === room.hostUserId,
    })),
  };
}

export async function broadcastRoomState(io: Server, roomId: string): Promise<void> {
  const state = await buildRoomState(roomId);
  if (!state) return;
  io.of("/play").to(roomChannel(roomId)).emit("room:state", state);
}
