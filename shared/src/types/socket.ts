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

// ───── Client → Server ─────
export interface ClientToServerEvents {
  "lobby:create": (
    payload: { displayName: string },
    ack: (res: { matchId: string; inviteCode: string }) => void,
  ) => void;

  "lobby:join": (
    payload: { inviteCode: string; displayName: string },
    ack: (res: { ok: true; matchId: string } | { ok: false; reason: string }) => void,
  ) => void;

  "match:reconnect": (
    payload: { matchId: string },
    ack: (res: { ok: boolean; reason?: string }) => void,
  ) => void;

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

  "match:error": (payload: { code: string; message: string }) => void;
}
