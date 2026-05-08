import { useEffect, useRef, useState } from "react";
import type { PlayerSlot, PublicMatchState } from "@swipe-sixer/shared";
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
  createMatch: (displayName: string) => Promise<void>;
  joinMatch: (inviteCode: string, displayName: string) => Promise<void>;
  leaveMatch: () => void;
  callCoinToss: (call: "heads" | "tails") => void;
  chooseBatOrBowl: (choose: "bat" | "bowl") => void;
  clearError: () => void;
}

export function useMatchClient(): MatchClient {
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [matchState, setMatchState] = useState<PublicMatchState | null>(null);
  const [mySlot, setMySlot] = useState<PlayerSlot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coinTossResult, setCoinTossResult] =
    useState<CoinTossResultEvent | null>(null);

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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("match:state", onMatchState);
    socket.on("match:closed", onMatchClosed);
    socket.on("cointoss:result", onCoinTossResult);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("match:state", onMatchState);
      socket.off("match:closed", onMatchClosed);
      socket.off("cointoss:result", onCoinTossResult);
    };
  }, []);

  const createMatch = async (displayName: string): Promise<void> => {
    setErrorMessage(null);
    return new Promise<void>((resolve) => {
      socket.emit("lobby:create", { displayName }, (res) => {
        persistSession(res.matchId, res.playerToken);
        sessionRef.current = { matchId: res.matchId, playerToken: res.playerToken };
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
    setErrorMessage(null);
  };

  const callCoinToss = (call: "heads" | "tails"): void => {
    socket.emit("cointoss:call", { call });
  };

  const chooseBatOrBowl = (choose: "bat" | "bowl"): void => {
    socket.emit("cointoss:choose", { choose });
  };

  const clearError = (): void => setErrorMessage(null);

  return {
    connected,
    matchState,
    mySlot,
    errorMessage,
    coinTossResult,
    createMatch,
    joinMatch,
    leaveMatch,
    callCoinToss,
    chooseBatOrBowl,
    clearError,
  };
}
