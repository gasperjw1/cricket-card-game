import { useEffect, useState } from "react";
import {
  COIN_TOSS_FLIP_VISUAL_MS,
  type CoinTossState,
  type PlayerSlot,
  type PublicMatchState,
} from "@swipe-sixer/shared";
import type { MatchClient } from "../state.ts";
import { useCountdown } from "../useCountdown.ts";

interface Props {
  client: MatchClient;
}

export function CoinTossScreen({ client }: Props) {
  const { matchState, mySlot, coinTossResult } = client;
  if (!matchState || !mySlot || !matchState.coinToss) return null;

  const [showFlipAnim, setShowFlipAnim] = useState(false);

  // Trigger ~1.5s flip animation when a fresh result event arrives. Only
  // play when the result actually matches the match's current flip — guards
  // against a stale coinTossResult from a previous match leaking through.
  useEffect(() => {
    if (!coinTossResult) return;
    if (!matchState?.coinToss) return;
    if (matchState.coinToss.flip !== coinTossResult.flip) return;
    if (matchState.coinToss.stage !== "choosing" && matchState.coinToss.stage !== "complete") return;
    setShowFlipAnim(true);
    const id = setTimeout(() => setShowFlipAnim(false), COIN_TOSS_FLIP_VISUAL_MS);
    return () => clearTimeout(id);
  }, [coinTossResult?.receivedAt, matchState?.coinToss?.flip, matchState?.coinToss?.stage]);

  const ct = matchState.coinToss;
  const opponentSlot: PlayerSlot = mySlot === "A" ? "B" : "A";
  const me =
    mySlot === "A" ? matchState.players.A : matchState.players.B!;
  const opponent =
    opponentSlot === "A" ? matchState.players.A : matchState.players.B!;

  return (
    <main>
      <h1>Coin Toss</h1>

      {showFlipAnim ? (
        <FlipAnimation result={coinTossResult!.flip} />
      ) : ct.stage === "countdown" ? (
        <CountdownView
          state={ct}
          callerName={
            ct.callerSlot === mySlot ? "you" : opponent.displayName
          }
        />
      ) : ct.stage === "calling" ? (
        <CallingView
          state={ct}
          mySlot={mySlot}
          meName={me.displayName}
          opponentName={opponent.displayName}
          onCall={client.callCoinToss}
        />
      ) : ct.stage === "choosing" ? (
        <ChoosingView
          state={ct}
          mySlot={mySlot}
          meName={me.displayName}
          opponentName={opponent.displayName}
          callerName={
            ct.callerSlot === mySlot ? me.displayName : opponent.displayName
          }
          winnerName={
            ct.winnerSlot === mySlot ? me.displayName : opponent.displayName
          }
          onChoose={client.chooseBatOrBowl}
        />
      ) : (
        <CompleteView state={ct} matchState={matchState} mySlot={mySlot} />
      )}

      <div className="lobby-actions">
        <button className="btn ghost" onClick={client.leaveMatch}>
          Leave
        </button>
      </div>
    </main>
  );
}

function CountdownView({
  state,
  callerName,
}: {
  state: CoinTossState;
  callerName: string;
}) {
  const seconds = useCountdown(state.deadlineEpochMs);
  return (
    <>
      <p className="tagline">Get ready — coin toss starts in</p>
      <div className="big-countdown">{seconds}</div>
      <p className="hint">
        {callerName === "you"
          ? "You'll call heads or tails."
          : `${callerName} will call heads or tails.`}
      </p>
    </>
  );
}

function CallingView(props: {
  state: CoinTossState;
  mySlot: PlayerSlot;
  meName: string;
  opponentName: string;
  onCall: (c: "heads" | "tails") => void;
}) {
  const seconds = useCountdown(props.state.deadlineEpochMs);
  const isCaller = props.mySlot === props.state.callerSlot;
  const [submitted, setSubmitted] = useState(false);

  const handleClick = (call: "heads" | "tails") => {
    if (submitted) return;
    setSubmitted(true);
    props.onCall(call);
  };

  if (isCaller) {
    return (
      <>
        <p className="tagline">Your call. {seconds}s</p>
        <div className="call-buttons">
          <button
            className="btn primary big"
            disabled={submitted}
            onClick={() => handleClick("heads")}
          >
            HEADS
          </button>
          <button
            className="btn primary big"
            disabled={submitted}
            onClick={() => handleClick("tails")}
          >
            TAILS
          </button>
        </div>
        {submitted && <p className="hint">Tossing the coin…</p>}
      </>
    );
  }
  return (
    <>
      <p className="tagline">
        Waiting for <strong>{props.opponentName}</strong> to call… {seconds}s
      </p>
      <div className="big-countdown muted">…</div>
    </>
  );
}

function ChoosingView(props: {
  state: CoinTossState;
  mySlot: PlayerSlot;
  meName: string;
  opponentName: string;
  callerName: string;
  winnerName: string;
  onChoose: (c: "bat" | "bowl") => void;
}) {
  const seconds = useCountdown(props.state.deadlineEpochMs);
  const isWinner = props.mySlot === props.state.winnerSlot;
  const [submitted, setSubmitted] = useState(false);

  const handleClick = (choose: "bat" | "bowl") => {
    if (submitted) return;
    setSubmitted(true);
    props.onChoose(choose);
  };

  return (
    <>
      <CallSummary state={props.state} callerName={props.callerName} />
      {isWinner ? (
        <>
          <p className="tagline">You won the toss! Your call. {seconds}s</p>
          <div className="call-buttons">
            <button
              className="btn primary big"
              disabled={submitted}
              onClick={() => handleClick("bat")}
            >
              BAT FIRST
            </button>
            <button
              className="btn primary big"
              disabled={submitted}
              onClick={() => handleClick("bowl")}
            >
              BOWL FIRST
            </button>
          </div>
        </>
      ) : (
        <p className="tagline">
          <strong>{props.winnerName}</strong> won the toss — waiting for them
          to choose. {seconds}s
        </p>
      )}
    </>
  );
}

function CompleteView({
  state,
  matchState,
  mySlot,
}: {
  state: CoinTossState;
  matchState: PublicMatchState;
  mySlot: PlayerSlot;
}) {
  if (!state.battingSlot) return null;
  const battingPlayer =
    state.battingSlot === "A" ? matchState.players.A : matchState.players.B!;
  const meBatsFirst = state.battingSlot === mySlot;
  return (
    <>
      <CallSummary
        state={state}
        callerName={
          state.callerSlot === mySlot
            ? "you"
            : state.callerSlot === "A"
              ? matchState.players.A.displayName
              : matchState.players.B!.displayName
        }
      />
      <div className="result-card">
        <div className="result-headline">
          {meBatsFirst ? "You bat first." : `${battingPlayer.displayName} bats first.`}
        </div>
        <p className="hint">Innings 1 starts here in the next iteration.</p>
      </div>
    </>
  );
}

function CallSummary({
  state,
  callerName,
}: {
  state: CoinTossState;
  callerName: string;
}) {
  if (!state.call || !state.flip) return null;
  const correct = state.call === state.flip;
  return (
    <div className="call-summary">
      <span>
        {callerName} called <strong>{state.call.toUpperCase()}</strong>
      </span>
      <span> — coin landed </span>
      <strong>{state.flip.toUpperCase()}</strong>
      <span className={correct ? "good" : "bad"}>
        {" "}
        ({correct ? "correct" : "incorrect"})
      </span>
    </div>
  );
}

function FlipAnimation({ result }: { result: "heads" | "tails" }) {
  return (
    <div className="flip-stage">
      <div className={`coin flipping ${result}`}>
        <div className="face heads">H</div>
        <div className="face tails">T</div>
      </div>
      <p className="tagline">Tossing…</p>
    </div>
  );
}
