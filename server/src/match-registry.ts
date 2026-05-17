import { randomBytes, randomUUID } from "node:crypto";
import type {
  AnyCard,
  BallSelection,
  BatsmanCard,
  BotDifficulty,
  BowlerCard,
  CoinTossState,
  InningsState,
  MatchFormat,
  MatchResult,
  PendingSwap,
  PlayerSlot,
  PublicMatchState,
  PublicPlayerInfo,
  ResolutionStep,
  SituationCard,
} from "@swipe-sixer/shared";
import { DEFAULT_MATCH_FORMAT } from "@swipe-sixer/shared";
import { pickBotIdentity } from "./bot/names.js";

/**
 * Authoritative server-side match state. Lives in memory only — matches are
 * ephemeral, no DB. Each connected socket holds a reference to its Match via
 * a session map kept on the registry.
 */

interface ServerPlayer {
  slot: PlayerSlot;
  displayName: string;
  /** 2–4 char team abbreviation shown in the scorebug. */
  abbreviation: string;
  playerToken: string; // returned to client; used to reclaim slot on reconnect
  socketId: string | null;
  /** True when this slot is a CPU controlled by the server. Bots have no
   *  socket; coin-toss / innings code intercepts and auto-fills their inputs. */
  isBot: boolean;
  botDifficulty: import("@swipe-sixer/shared").BotDifficulty | null;
  /** Nation the bot represents (for cosmetic flag/abbreviation + for
   *  building a single-nation deck when the nation is a Test nation). */
  botNation: import("@swipe-sixer/shared").Nation | null;
}

/** Normalize a user-provided abbreviation; fall back to deriving from the display name. */
function deriveAbbreviation(raw: string, displayName: string, slot: PlayerSlot): string {
  const cleanedRaw = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (cleanedRaw.length >= 2) return cleanedRaw;
  const cleanedName = displayName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (cleanedName.length >= 2) return cleanedName;
  return slot === "A" ? "P1" : "P2";
}

/** Per-player deck pair + current hand. Decks are populated when innings 1 starts. */
export interface ServerDecks {
  battingDeck: AnyCard[];
  bowlingDeck: AnyCard[];
  /** Currently active hand (drawn from whichever deck matches this player's role this innings). */
  hand: AnyCard[];
  /** Cards already played and discarded this match. Kept for UI/debug. */
  discard: AnyCard[];
}

/**
 * Carries per-ball resolution state between the moment both players submit
 * and the final ball:reveal broadcast. Needed because resolution can pause
 * on swap-pick prompts (Mankad / Retired Out / Cramps) — the engine sees
 * the post-swap cards.
 */
export interface BallResolutionContext {
  battingSlot: PlayerSlot;
  bowlingSlot: PlayerSlot;
  battingMandatory: BatsmanCard;
  bowlingMandatory: BowlerCard;
  battingSituation: SituationCard | null;
  bowlingSituation: SituationCard | null;
  /** Steps recorded before the engine runs (Old School cancels, swap notes). */
  upstreamSteps: ResolutionStep[];
  /** Mankad fired but no swap target available — engine output gets a one-tier downgrade. */
  forcedDowngradeFromMankad: boolean;
  /** Cards (by original played id) to discard from each player's hand at end of ball. */
  battingPlayedIds: string[];
  bowlingPlayedIds: string[];
  /** Was the original mandatory submission auto-picked by the server? */
  battingAutoPicked: boolean;
  bowlingAutoPicked: boolean;
  /** Was the timer's expiry the trigger? Used for telemetry / future UX. */
  timedOut: boolean;
}

export interface ServerMatch {
  matchId: string;
  inviteCode: string;
  /** Set at creation time; immutable for the lifetime of the match. */
  format: MatchFormat;
  phase: PublicMatchState["phase"];
  players: { A: ServerPlayer; B: ServerPlayer | null };
  createdAt: number;
  coinToss: CoinTossState | null;
  /** Innings flow state. Populated when the first innings starts. */
  decks: { A: ServerDecks; B: ServerDecks } | null;
  innings1: InningsState | null;
  innings2: InningsState | null;
  currentInnings: 1 | 2 | null;
  /** Selections held while we wait for both players to lock in. */
  pendingSelections: { A: BallSelection | null; B: BallSelection | null };
  /** Epoch-ms deadline for the active ball's submit timer; null when not awaiting selections. */
  currentBallDeadlineEpochMs: number | null;
  /** Epoch-ms deadline for the post-reveal pause; null outside that window. */
  postBallDeadlineEpochMs: number | null;
  /** In-flight ball resolution context, populated after both players submit and torn down on reveal. */
  ballContext: BallResolutionContext | null;
  /** Public view of the current swap pick request; null when resolution isn't paused on a swap. */
  pendingSwap: PendingSwap | null;
  result: MatchResult | null;
  /**
   * Per-match scheduled timeouts keyed by name (e.g. "coin-countdown",
   * "coin-call", "coin-choose", "ball-timer"). Always cleared on closeMatch
   * so leaks can't outlive a match.
   */
  timers: Map<string, NodeJS.Timeout>;
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

  createMatch(
    displayName: string,
    abbreviation: string,
    socketId: string,
    format: MatchFormat = DEFAULT_MATCH_FORMAT,
  ): {
    match: ServerMatch;
    playerToken: string;
  } {
    let inviteCode = generateInviteCode();
    while (this.matchIdByInvite.has(inviteCode)) {
      inviteCode = generateInviteCode();
    }
    const matchId = randomUUID();
    const playerToken = randomUUID();
    const finalName = displayName.trim() || "Player A";
    const match: ServerMatch = {
      matchId,
      inviteCode,
      format,
      phase: "lobby",
      players: {
        A: {
          slot: "A",
          displayName: finalName,
          abbreviation: deriveAbbreviation(abbreviation, finalName, "A"),
          playerToken,
          socketId,
          isBot: false,
          botDifficulty: null,
          botNation: null,
        },
        B: null,
      },
      createdAt: Date.now(),
      coinToss: null,
      decks: null,
      innings1: null,
      innings2: null,
      currentInnings: null,
      pendingSelections: { A: null, B: null },
      currentBallDeadlineEpochMs: null,
      postBallDeadlineEpochMs: null,
      ballContext: null,
      pendingSwap: null,
      result: null,
      timers: new Map(),
    };
    this.matchesById.set(matchId, match);
    this.matchIdByInvite.set(inviteCode, matchId);
    this.socketToSession.set(socketId, { matchId, slot: "A" });
    return { match, playerToken };
  }

  /**
   * Spawn a single-player match where slot B is a CPU bot. The bot has
   * no socket; coin-toss / innings / swap-pick code intercepts and
   * auto-fills its inputs. See server/src/bot/.
   */
  createBotMatch(
    displayName: string,
    abbreviation: string,
    difficulty: BotDifficulty,
    socketId: string,
    format: MatchFormat = DEFAULT_MATCH_FORMAT,
  ): { match: ServerMatch; playerToken: string } {
    const { match, playerToken } = this.createMatch(
      displayName,
      abbreviation,
      socketId,
      format,
    );
    const bot = pickBotIdentity();
    match.players.B = {
      slot: "B",
      displayName: bot.name,
      abbreviation: bot.abbreviation,
      playerToken: randomUUID(),  // never sent to a socket; placeholder
      socketId: null,
      isBot: true,
      botDifficulty: difficulty,
      botNation: bot.nation,
    };
    return { match, playerToken };
  }

  joinMatch(
    inviteCode: string,
    displayName: string,
    abbreviation: string,
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
    const finalName = displayName.trim() || "Player B";
    match.players.B = {
      slot: "B",
      displayName: finalName,
      abbreviation: deriveAbbreviation(abbreviation, finalName, "B"),
      playerToken,
      socketId,
      isBot: false,
      botDifficulty: null,
      botNation: null,
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
    // Pre-gameplay phases (lobby, coin toss, draft) have no state worth
    // preserving — disconnect kills the match for both players. Once
    // gameplay starts (innings) we should switch to mark-offline semantics
    // so reconnect-with-token works.
    if (
      match.phase === "lobby" ||
      match.phase === "coin-toss" ||
      match.phase === "draft"
    ) {
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
    for (const timer of match.timers.values()) {
      clearTimeout(timer);
    }
    match.timers.clear();
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
    const playerView = (slot: PlayerSlot, player: ServerPlayer): PublicPlayerInfo => {
      const decks = match.decks ? match.decks[slot] : null;
      const handSize = decks?.hand.length ?? 0;
      // "Active deck remaining" — pick the deck this player draws from this innings.
      const role = activeRoleForSlot(match, slot);
      const deckRemaining =
        decks && role === "batting"
          ? decks.battingDeck.length
          : decks && role === "bowling"
            ? decks.bowlingDeck.length
            : 0;
      return {
        slot: player.slot,
        displayName: player.displayName,
        // Bots are always "connected" (server-controlled). Surfacing
        // socketId !== null would show them as offline.
        connected: player.isBot ? true : player.socketId !== null,
        abbreviation: player.abbreviation,
        handSize,
        deckRemaining,
        isBot: player.isBot || undefined,
        botDifficulty: player.botDifficulty ?? undefined,
      };
    };
    return {
      matchId: match.matchId,
      inviteCode: match.inviteCode,
      format: match.format,
      phase: match.phase,
      players: {
        A: playerView("A", match.players.A),
        B: match.players.B ? playerView("B", match.players.B) : null,
      },
      currentInnings: match.currentInnings,
      innings1: match.innings1,
      innings2: match.innings2,
      coinToss: match.coinToss,
      currentBallDeadlineEpochMs: match.currentBallDeadlineEpochMs,
      postBallDeadlineEpochMs: match.postBallDeadlineEpochMs,
      pendingSwap: match.pendingSwap,
      result: match.result,
    };
  }
}

/**
 * Helper exported for use by the innings flow: which role does this slot have
 * in the current innings? Returns null when there's no active innings.
 */
export function activeRoleForSlot(
  match: ServerMatch,
  slot: PlayerSlot,
): "batting" | "bowling" | null {
  const innings =
    match.currentInnings === 1
      ? match.innings1
      : match.currentInnings === 2
        ? match.innings2
        : null;
  if (!innings) return null;
  if (innings.battingPlayer === slot) return "batting";
  if (innings.bowlingPlayer === slot) return "bowling";
  return null;
}
