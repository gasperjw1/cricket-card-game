import { useEffect, useRef, useState } from "react";
import type {
  BallResult,
  BallSelection,
  PlayerSlot,
  PrivatePlayerView,
  PublicMatchState,
} from "@swipe-sixer/shared";
import { socket } from "./socket.ts";

const STORAGE_MATCH_ID = "swipeSixer.matchId";
const STORAGE_PLAYER_TOKEN = "swipeSixer.playerToken";

interface PersistedSession {
  matchId: string;
  playerToken: string;
}

function readPersistedSession(): PersistedSession | null {
  const matchId = sessionStorage.getItem(STORAGE_MATCH_ID);
  const playerToken = sessionStorage.getItem(STORAGE_PLAYER_TOKEN);
  if (!matchId || !playerToken) return null;
  return { matchId, playerToken };
}

function persistSession(matchId: string, playerToken: string): void {
  sessionStorage.setItem(STORAGE_MATCH_ID, matchId);
  sessionStorage.setItem(STORAGE_PLAYER_TOKEN, playerToken);
}

function clearPersistedSession(): void {
  sessionStorage.removeItem(STORAGE_MATCH_ID);
  sessionStorage.removeItem(STORAGE_PLAYER_TOKEN);
}

export interface CoinTossResultEvent {
  flip: "heads" | "tails";
  callerSlot: PlayerSlot;
  winnerSlot: PlayerSlot;
  /** Wall-clock time of receipt; clients use this to drive the flip animation. */
  receivedAt: number;
}

export interface MatchClient {
  connected: boolean;
  matchState: PublicMatchState | null;
  mySlot: PlayerSlot | null;
  errorMessage: string | null;
  /** Latest cointoss:result event; null until the call is resolved. */
  coinTossResult: CoinTossResultEvent | null;
  /** Latest private view (your hand contents). */
  privateView: PrivatePlayerView | null;
  /** Selection currently being assembled for this ball (cleared after submit). */
  pendingSelection: BallSelection | null;
  /** True after we've sent ball:submit and are waiting for opponent or reveal. */
  awaitingReveal: boolean;
  /** True when the server told us the opponent has locked in. */
  opponentLocked: boolean;
  /** Latest ball:reveal payload; null until revealed (cleared when next ball begins). */
  lastReveal: BallResult | null;
  createMatch: (displayName: string) => Promise<void>;
  joinMatch: (inviteCode: string, displayName: string) => Promise<void>;
  leaveMatch: () => void;
  callCoinToss: (call: "heads" | "tails") => void;
  chooseBatOrBowl: (choose: "bat" | "bowl") => void;
  selectMandatory: (cardId: string | null) => void;
  selectSituation: (cardId: string | null) => void;
  submitBall: () => void;
  dismissReveal: () => void;
  clearError: () => void;
}

const EMPTY_PENDING: BallSelection = {
  mandatoryCardId: "",
  situationCardId: null,
  autoPicked: false,
};

export function useMatchClient(): MatchClient {
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [matchState, setMatchState] = useState<PublicMatchState | null>(null);
  const [mySlot, setMySlot] = useState<PlayerSlot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coinTossResult, setCoinTossResult] =
    useState<CoinTossResultEvent | null>(null);
  const [privateView, setPrivateView] = useState<PrivatePlayerView | null>(null);
  const [pendingSelection, setPendingSelection] = useState<BallSelection | null>(null);
  const [awaitingReveal, setAwaitingReveal] = useState<boolean>(false);
  const [opponentLocked, setOpponentLocked] = useState<boolean>(false);
  const [lastReveal, setLastReveal] = useState<BallResult | null>(null);

  // Track persisted session in a ref so handlers can read latest without re-binding.
  const sessionRef = useRef<PersistedSession | null>(readPersistedSession());

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Auto-reconnect if we have a persisted session.
      const persisted = sessionRef.current;
      if (persisted) {
        socket.emit(
          "match:reconnect",
          { matchId: persisted.matchId, playerToken: persisted.playerToken },
          (res) => {
            if (res.ok) {
              setMySlot(res.slot);
            } else {
              clearPersistedSession();
              sessionRef.current = null;
              setMatchState(null);
              setMySlot(null);
            }
          },
        );
      }
    };
    const onDisconnect = () => {
      setConnected(false);
    };
    const onMatchState = (state: PublicMatchState) => {
      setMatchState(state);
    };
    const onMatchClosed = ({ reason }: { reason: string }) => {
      clearPersistedSession();
      sessionRef.current = null;
      setMatchState(null);
      setMySlot(null);
      setCoinTossResult(null);
      setErrorMessage(reason);
    };
    const onCoinTossResult = (payload: {
      flip: "heads" | "tails";
      callerSlot: PlayerSlot;
      winnerSlot: PlayerSlot;
    }) => {
      setCoinTossResult({ ...payload, receivedAt: Date.now() });
    };
    const onPrivate = (view: PrivatePlayerView) => {
      setPrivateView(view);
      // New hand = new ball; clear any in-progress selection if it references missing cards.
      setPendingSelection((prev) => {
        if (!prev) return prev;
        const ids = new Set(view.hand.cards.map((c) => c.id));
        const mandatoryStillThere =
          prev.mandatoryCardId === "" || ids.has(prev.mandatoryCardId);
        const sitStillThere =
          prev.situationCardId === null || ids.has(prev.situationCardId);
        if (mandatoryStillThere && sitStillThere) return prev;
        return null;
      });
    };
    const onOpponentLocked = () => setOpponentLocked(true);
    const onReveal = (result: BallResult) => {
      setLastReveal(result);
      setAwaitingReveal(false);
      setOpponentLocked(false);
      setPendingSelection(null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("match:state", onMatchState);
    socket.on("match:closed", onMatchClosed);
    socket.on("cointoss:result", onCoinTossResult);
    socket.on("match:private", onPrivate);
    socket.on("ball:opponent-locked", onOpponentLocked);
    socket.on("ball:reveal", onReveal);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("match:state", onMatchState);
      socket.off("match:closed", onMatchClosed);
      socket.off("cointoss:result", onCoinTossResult);
      socket.off("match:private", onPrivate);
      socket.off("ball:opponent-locked", onOpponentLocked);
      socket.off("ball:reveal", onReveal);
    };
  }, []);

  /**
   * Wipe all transient per-match state. Called when entering a new match
   * (create/join success) and when a match closes — otherwise leftover
   * coinTossResult / lastReveal / etc. from a previous match leaks into the
   * new match's UI (e.g. the coin flip animation firing before the call).
   */
  const resetMatchTransients = (): void => {
    setCoinTossResult(null);
    setPrivateView(null);
    setPendingSelection(null);
    setAwaitingReveal(false);
    setOpponentLocked(false);
    setLastReveal(null);
  };

  const createMatch = async (displayName: string): Promise<void> => {
    setErrorMessage(null);
    return new Promise<void>((resolve) => {
      socket.emit("lobby:create", { displayName }, (res) => {
        persistSession(res.matchId, res.playerToken);
        sessionRef.current = { matchId: res.matchId, playerToken: res.playerToken };
        resetMatchTransients();
        setMySlot(res.slot);
        resolve();
      });
    });
  };

  const joinMatch = async (
    inviteCode: string,
    displayName: string,
  ): Promise<void> => {
    setErrorMessage(null);
    return new Promise<void>((resolve) => {
      socket.emit(
        "lobby:join",
        { inviteCode: inviteCode.trim().toUpperCase(), displayName },
        (res) => {
          if (!res.ok) {
            setErrorMessage(res.reason);
            resolve();
            return;
          }
          persistSession(res.matchId, res.playerToken);
          sessionRef.current = {
            matchId: res.matchId,
            playerToken: res.playerToken,
          };
          resetMatchTransients();
          setMySlot(res.slot);
          resolve();
        },
      );
    });
  };

  const leaveMatch = (): void => {
    socket.emit("lobby:leave");
    clearPersistedSession();
    sessionRef.current = null;
    setMatchState(null);
    setMySlot(null);
    setCoinTossResult(null);
    setPrivateView(null);
    setPendingSelection(null);
    setAwaitingReveal(false);
    setOpponentLocked(false);
    setLastReveal(null);
    setErrorMessage(null);
  };

  const callCoinToss = (call: "heads" | "tails"): void => {
    socket.emit("cointoss:call", { call });
  };

  const chooseBatOrBowl = (choose: "bat" | "bowl"): void => {
    socket.emit("cointoss:choose", { choose });
  };

  const selectMandatory = (cardId: string | null): void => {
    setPendingSelection((prev) => {
      const base = prev ?? { ...EMPTY_PENDING };
      return { ...base, mandatoryCardId: cardId ?? "" };
    });
  };

  const selectSituation = (cardId: string | null): void => {
    setPendingSelection((prev) => {
      const base = prev ?? { ...EMPTY_PENDING };
      return { ...base, situationCardId: cardId };
    });
  };

  const submitBall = (): void => {
    if (!pendingSelection || !pendingSelection.mandatoryCardId) return;
    socket.emit("ball:submit", { selection: pendingSelection });
    setAwaitingReveal(true);
  };

  const dismissReveal = (): void => {
    setLastReveal(null);
  };

  const clearError = (): void => setErrorMessage(null);

  return {
    connected,
    matchState,
    mySlot,
    errorMessage,
    coinTossResult,
    privateView,
    pendingSelection,
    awaitingReveal,
    opponentLocked,
    lastReveal,
    createMatch,
    joinMatch,
    leaveMatch,
    callCoinToss,
    chooseBatOrBowl,
    selectMandatory,
    selectSituation,
    submitBall,
    dismissReveal,
    clearError,
  };
}
