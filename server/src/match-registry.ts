import { randomBytes, randomUUID } from "node:crypto";
import type {
  PlayerSlot,
  PublicMatchState,
  PublicPlayerInfo,
} from "@swipe-sixer/shared";

/**
 * Authoritative server-side match state. Lives in memory only — matches are
 * ephemeral, no DB. Each connected socket holds a reference to its Match via
 * a session map kept on the registry.
 */

interface ServerPlayer {
  slot: PlayerSlot;
  displayName: string;
  playerToken: string; // returned to client; used to reclaim slot on reconnect
  socketId: string | null;
}

export interface ServerMatch {
  matchId: string;
  inviteCode: string;
  phase: PublicMatchState["phase"];
  players: { A: ServerPlayer; B: ServerPlayer | null };
  createdAt: number;
}

/**
 * Charset excludes 0/O/1/I/L to avoid mistakes when typing codes.
 * 31^6 ≈ 887M combinations — collisions are not a concern at v1 scale.
 */
const INVITE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 6;

function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_LENGTH; i++) {
    code += INVITE_CHARSET[bytes[i]! % INVITE_CHARSET.length];
  }
  return code;
}

export class MatchRegistry {
  private matchesById = new Map<string, ServerMatch>();
  private matchIdByInvite = new Map<string, string>();
  private socketToSession = new Map<
    string,
    { matchId: string; slot: PlayerSlot }
  >();

  createMatch(displayName: string, socketId: string): {
    match: ServerMatch;
    playerToken: string;
  } {
    let inviteCode = generateInviteCode();
    while (this.matchIdByInvite.has(inviteCode)) {
      inviteCode = generateInviteCode();
    }
    const matchId = randomUUID();
    const playerToken = randomUUID();
    const match: ServerMatch = {
      matchId,
      inviteCode,
      phase: "lobby",
      players: {
        A: {
          slot: "A",
          displayName: displayName.trim() || "Player A",
          playerToken,
          socketId,
        },
        B: null,
      },
      createdAt: Date.now(),
    };
    this.matchesById.set(matchId, match);
    this.matchIdByInvite.set(inviteCode, matchId);
    this.socketToSession.set(socketId, { matchId, slot: "A" });
    return { match, playerToken };
  }

  joinMatch(
    inviteCode: string,
    displayName: string,
    socketId: string,
  ):
    | { ok: true; match: ServerMatch; playerToken: string }
    | { ok: false; reason: string } {
    const matchId = this.matchIdByInvite.get(inviteCode.toUpperCase());
    if (!matchId) return { ok: false, reason: "Invite code not found" };
    const match = this.matchesById.get(matchId);
    if (!match) return { ok: false, reason: "Match no longer exists" };
    if (match.players.B) {
      return { ok: false, reason: "Match is already full" };
    }
    const playerToken = randomUUID();
    match.players.B = {
      slot: "B",
      displayName: displayName.trim() || "Player B",
      playerToken,
      socketId,
    };
    this.socketToSession.set(socketId, { matchId, slot: "B" });
    return { ok: true, match, playerToken };
  }

  reconnect(
    matchId: string,
    playerToken: string,
    socketId: string,
  ): { ok: true; match: ServerMatch; slot: PlayerSlot } | { ok: false; reason: string } {
    const match = this.matchesById.get(matchId);
    if (!match) return { ok: false, reason: "Match no longer exists" };

    for (const slot of ["A", "B"] as const) {
      const player = match.players[slot];
      if (player && player.playerToken === playerToken) {
        // Detach prior socket binding if any
        if (player.socketId && player.socketId !== socketId) {
          this.socketToSession.delete(player.socketId);
        }
        player.socketId = socketId;
        this.socketToSession.set(socketId, { matchId, slot });
        return { ok: true, match, slot };
      }
    }
    return { ok: false, reason: "Player token not recognized for this match" };
  }

  /**
   * Mark a socket as disconnected. During the lobby phase we treat any
   * disconnect as a hard exit — the match is closed for both players, since
   * pre-game there's no state worth preserving. Once gameplay starts the
   * caller should switch to `markPlayerOffline` so reconnect-with-token works.
   */
  handleSocketDisconnect(
    socketId: string,
  ): { match: ServerMatch | null; closed: boolean } {
    const session = this.socketToSession.get(socketId);
    if (!session) return { match: null, closed: false };
    this.socketToSession.delete(socketId);
    const match = this.matchesById.get(session.matchId);
    if (!match) return { match: null, closed: false };
    const player = match.players[session.slot];
    if (player && player.socketId === socketId) {
      player.socketId = null;
    }
    if (match.phase === "lobby") {
      this.closeMatch(match.matchId);
      return { match, closed: true };
    }
    return { match, closed: false };
  }

  /**
   * Explicit user-initiated leave. Always closes the match (only the lobby
   * phase reaches this code path in v1, but the close semantics apply
   * regardless of phase if we wire it elsewhere).
   */
  leaveMatch(socketId: string): { match: ServerMatch | null } {
    const session = this.socketToSession.get(socketId);
    if (!session) return { match: null };
    const match = this.matchesById.get(session.matchId);
    if (!match) {
      this.socketToSession.delete(socketId);
      return { match: null };
    }
    this.closeMatch(match.matchId);
    return { match };
  }

  private closeMatch(matchId: string): void {
    const match = this.matchesById.get(matchId);
    if (!match) return;
    this.matchesById.delete(matchId);
    this.matchIdByInvite.delete(match.inviteCode);
    for (const slot of ["A", "B"] as const) {
      const player = match.players[slot];
      if (player?.socketId) {
        this.socketToSession.delete(player.socketId);
      }
    }
  }

  getMatchBySocket(socketId: string): ServerMatch | null {
    const session = this.socketToSession.get(socketId);
    if (!session) return null;
    return this.matchesById.get(session.matchId) ?? null;
  }

  getMatchById(matchId: string): ServerMatch | null {
    return this.matchesById.get(matchId) ?? null;
  }

  /**
   * Build a sanitized public view that's safe to send to either player.
   */
  toPublicState(match: ServerMatch): PublicMatchState {
    const playerView = (player: ServerPlayer): PublicPlayerInfo => ({
      slot: player.slot,
      displayName: player.displayName,
      connected: player.socketId !== null,
      handSize: 0,
      deckRemaining: 0,
    });
    return {
      matchId: match.matchId,
      inviteCode: match.inviteCode,
      phase: match.phase,
      players: {
        A: playerView(match.players.A),
        B: match.players.B ? playerView(match.players.B) : null,
      },
      currentInnings: null,
      innings1: null,
      innings2: null,
      result: null,
    };
  }
}
