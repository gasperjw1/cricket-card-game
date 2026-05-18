import type { MatchFormat } from "../constants.js";
import type { Nation } from "./cards.js";
import type {
  BallResult,
  BallSelection,
  BotDifficulty,
  DraftState,
  PrivatePlayerView,
  PublicMatchState,
} from "./game.js";

/** Card ids for the player's pre-built deck in WC career mode. The
 *  server resolves these against the global CARDS roster — only valid
 *  ids accepted, anything missing falls back to the auto-build path. */
export interface CustomPlayerDeck {
  battingDeck: string[];
  bowlingDeck: string[];
}

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
    payload: { displayName: string; abbreviation: string; format?: MatchFormat },
    ack: (res: { inviteCode: string } & LobbyCredentials) => void,
  ) => void;

  "lobby:join": (
    payload: { inviteCode: string; displayName: string; abbreviation: string },
    ack: (res: LobbyJoinResult) => void,
  ) => void;

  /** Spawn a single-player match against a CPU bot. The server picks the
   *  bot's name + nation + abbreviation; client just chooses difficulty and
   *  format. */
  "match:create-bot": (
    payload: {
      displayName: string;
      abbreviation: string;
      difficulty: BotDifficulty;
      format?: MatchFormat;
      /** WC career mode only — client-supplied deck. Server validates
       *  each id; missing ids are filtered out and the deck is topped up
       *  via the standard build path. */
      playerDeck?: CustomPlayerDeck;
      /** WC career mode only — force the bot to be a specific nation
       *  (the WC opponent for this match). When omitted, the server
       *  picks at random. */
      botNation?: Nation;
      /** Bot's display name override (e.g. "TEAM AUSTRALIA"). */
      botName?: string;
    },
    ack: (res: { inviteCode: string } & LobbyCredentials) => void,
  ) => void;

  "match:reconnect": (
    payload: { matchId: string; playerToken: string },
    ack: (res: { ok: true; slot: "A" | "B" } | { ok: false; reason: string }) => void,
  ) => void;

  "lobby:leave": () => void;

  "ball:swap-pick": (payload: { cardId: string }) => void;

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
