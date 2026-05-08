import type {
  BallResult,
  BallSelection,
  DraftState,
  PrivatePlayerView,
  PublicMatchState,
} from "./game.js";

/**
 * Socket event contracts. Both client and server import these so the wire
 * protocol stays type-safe end-to-end.
 *
 * Naming: <namespace>:<verb> — namespaces are lobby, match, draft, ball.
 */

export interface LobbyCredentials {
  matchId: string;
  playerToken: string;
  slot: "A" | "B";
}

export type LobbyJoinResult =
  | ({ ok: true; inviteCode: string } & LobbyCredentials)
  | { ok: false; reason: string };

// ───── Client → Server ─────
export interface ClientToServerEvents {
  "lobby:create": (
    payload: { displayName: string },
    ack: (res: { inviteCode: string } & LobbyCredentials) => void,
  ) => void;

  "lobby:join": (
    payload: { inviteCode: string; displayName: string },
    ack: (res: LobbyJoinResult) => void,
  ) => void;

  "match:reconnect": (
    payload: { matchId: string; playerToken: string },
    ack: (res: { ok: true; slot: "A" | "B" } | { ok: false; reason: string }) => void,
  ) => void;

  "lobby:leave": () => void;

  "draft:pick": (payload: { roundIndex: number; cardId: string }) => void;

  "cointoss:call": (payload: { call: "heads" | "tails" }) => void;

  "cointoss:choose": (payload: { choose: "bat" | "bowl" }) => void;

  "ball:submit": (payload: { selection: BallSelection }) => void;
}

// ───── Server → Client ─────
export interface ServerToClientEvents {
  "match:state": (state: PublicMatchState) => void;

  "match:private": (view: PrivatePlayerView) => void;

  "draft:state": (state: DraftState) => void;

  "cointoss:result": (payload: {
    flip: "heads" | "tails";
    callerSlot: "A" | "B";
    winnerSlot: "A" | "B";
  }) => void;

  "ball:opponent-locked": () => void;

  "ball:reveal": (result: BallResult) => void;

  "match:closed": (payload: { reason: string }) => void;

  "match:error": (payload: { code: string; message: string }) => void;
}
