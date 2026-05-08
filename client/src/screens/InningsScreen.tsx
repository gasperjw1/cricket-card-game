import { useState } from "react";
import {
  HAND_SIZE,
  MAX_BALLS_PER_INNINGS,
  MAX_WICKETS_PER_INNINGS,
  type AnyCard,
  type BallOutcome,
  type BallResult,
  type InningsState,
  type PlayerSlot,
  type ResolutionStep,
} from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { CardViewer } from "../components/CardViewer.tsx";
import { Tip } from "../components/Tip.tsx";
import type { MatchClient } from "../state.ts";
import { useCountdown } from "../useCountdown.ts";
import { SwapPicker } from "./SwapPicker.tsx";

interface Props {
  client: MatchClient;
}

export function InningsScreen({ client }: Props) {
  const { matchState, mySlot, privateView, pendingSelection, awaitingReveal, opponentLocked, lastReveal } = client;
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);

  if (!matchState || !mySlot) return null;
  const innings =
    matchState.currentInnings === 1 ? matchState.innings1 : matchState.innings2;

  // Match-over view, but only AFTER the user has dismissed the final ball's
  // reveal. The server pauses 15s post-ball before transitioning to match-
  // over so this branch usually only fires once the player has clicked
  // Continue (or stayed past the auto-dismiss window).
  if (matchState.phase === "match-over" && !lastReveal) {
    return <MatchOverView client={client} />;
  }

  if (!innings) {
    return (
      <main>
        <h1>Innings starting…</h1>
        <p className="hint">Dealing hands.</p>
      </main>
    );
  }

  const role: "batting" | "bowling" =
    innings.battingPlayer === mySlot ? "batting" : "bowling";
  const opponentSlot: PlayerSlot = mySlot === "A" ? "B" : "A";
  const me = mySlot === "A" ? matchState.players.A : matchState.players.B!;
  const opponent =
    opponentSlot === "A" ? matchState.players.A : matchState.players.B!;

  const requiredKind = role === "batting" ? "batsman" : "bowler";
  const handCards = privateView?.hand.cards ?? [];
  const viewingCard = viewingCardId
    ? handCards.find((c) => c.id === viewingCardId) ?? null
    : null;

  const mandatoryId = pendingSelection?.mandatoryCardId || null;
  const situationId = pendingSelection?.situationCardId ?? null;
  const canSubmit = !!mandatoryId && !awaitingReveal && !lastReveal;

  return (
    <main className="innings">
      <Scoreboard
        innings={innings}
        currentInnings={matchState.currentInnings ?? 1}
        players={{
          batting:
            innings.battingPlayer === "A"
              ? matchState.players.A.displayName
              : matchState.players.B?.displayName ?? "—",
          bowling:
            innings.bowlingPlayer === "A"
              ? matchState.players.A.displayName
              : matchState.players.B?.displayName ?? "—",
        }}
      />

      <OpponentRow
        name={opponent.displayName}
        handSize={opponent.handSize}
        connected={opponent.connected}
        opponentLocked={opponentLocked}
      />

      <RoleBanner
        role={role}
        myName={me.displayName}
        deadline={awaitingReveal ? null : matchState.currentBallDeadlineEpochMs}
      />

      <div className="hand-area">
        <div className="hand-meta">
          <Tip text="Your hand. Each ball you must play one mandatory card (batsman if batting, bowler if bowling). You can optionally also play one situation card.">
            <span>
              Hand ({handCards.length}/{HAND_SIZE})
            </span>
          </Tip>
          <Tip text="Cards remaining in your active deck. You draw back to a full hand after every ball.">
            <span className="dim-text">deck: {privateView?.hand.deckRemaining ?? 0}</span>
          </Tip>
        </div>
        <div className="hand-grid">
          {handCards.length === 0 && (
            <div className="hint">Waiting for hand…</div>
          )}
          {handCards.map((card) => (
            <Card
              key={card.id}
              card={card}
              size="hand"
              selected={card.id === mandatoryId || card.id === situationId}
              onClick={() => setViewingCardId(card.id)}
            />
          ))}
        </div>
      </div>

      <SelectionFooter
        pendingMandatory={
          mandatoryId ? handCards.find((c) => c.id === mandatoryId) ?? null : null
        }
        pendingSituation={
          situationId ? handCards.find((c) => c.id === situationId) ?? null : null
        }
        canSubmit={canSubmit}
        awaitingReveal={awaitingReveal}
        opponentLocked={opponentLocked}
        onSubmit={client.submitBall}
        onClearMandatory={() => client.selectMandatory(null)}
        onClearSituation={() => client.selectSituation(null)}
      />

      {viewingCard && !matchState.pendingSwap && (
        <CardViewer
          card={viewingCard}
          isCurrentlySelected={
            viewingCard.id === mandatoryId || viewingCard.id === situationId
          }
          canSelect={canSelectCard(viewingCard, requiredKind, !!awaitingReveal || !!lastReveal)}
          disabledReason={
            awaitingReveal
              ? "You've already locked in for this ball."
              : lastReveal
                ? "Reveal in progress — dismiss it first."
                : viewingCard.kind !== requiredKind && viewingCard.kind !== "situation"
                  ? `You're ${role} this innings — only ${requiredKind} cards can be your mandatory pick.`
                  : undefined
          }
          onSubmit={() => {
            handleViewerSubmit(client, viewingCard, mandatoryId, situationId);
            setViewingCardId(null);
          }}
          onClose={() => setViewingCardId(null)}
        />
      )}

      {/* Swap picker takes precedence — shown only to the affected player. */}
      {matchState.pendingSwap && matchState.pendingSwap.fromSlot === mySlot && (
        <SwapPicker
          swap={matchState.pendingSwap}
          privateView={privateView}
          onPick={client.pickSwap}
        />
      )}

      {/* Other player sees a "waiting for swap pick" notice instead. */}
      {matchState.pendingSwap && matchState.pendingSwap.fromSlot !== mySlot && (
        <div className="reveal-overlay">
          <div className="reveal-inner">
            <h2>Mid-ball swap</h2>
            <p className="tagline">
              Waiting for {opponent.displayName} to pick a replacement…
            </p>
          </div>
        </div>
      )}

      {lastReveal && !matchState.pendingSwap && (
        <RevealOverlay
          result={lastReveal}
          mySlot={mySlot}
          aName={matchState.players.A.displayName}
          bName={matchState.players.B?.displayName ?? "B"}
          postBallDeadline={matchState.postBallDeadlineEpochMs}
          isFinalBall={matchState.phase === "match-over"}
          onContinue={client.dismissReveal}
        />
      )}

      <div className="lobby-actions">
        <button className="btn ghost" onClick={client.leaveMatch}>
          Leave match
        </button>
      </div>
    </main>
  );
}

// ─────────────────────────── Scoreboard / Banners ───────────────────────────

function Scoreboard({
  innings,
  currentInnings,
  players,
}: {
  innings: InningsState;
  currentInnings: number;
  players: { batting: string; bowling: string };
}) {
  const ballsLeft = MAX_BALLS_PER_INNINGS - innings.ballsBowled;
  return (
    <section className="scoreboard">
      <div className="scoreboard-row">
        <Tip text="Current innings — each player bats once.">
          <span className="sb-pill">Innings {currentInnings}</span>
        </Tip>
        <span className="sb-pill batting-pill">
          🏏 <strong>{players.batting}</strong> batting
        </span>
        <span className="sb-pill">
          🎯 <strong>{players.bowling}</strong> bowling
        </span>
      </div>
      <div className="scoreboard-score">
        <Tip text="Runs scored / wickets fallen this innings.">
          <span className="sb-score">
            {innings.runs}<span className="sb-slash">/</span>{innings.wickets}
          </span>
        </Tip>
        {innings.target !== null && (
          <Tip text={`Target — chase ${innings.target} runs to win.`}>
            <span className="sb-target">target {innings.target}</span>
          </Tip>
        )}
      </div>
      <div className="scoreboard-row dim-text">
        <Tip text={`${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} remaining (max ${MAX_BALLS_PER_INNINGS} per innings).`}>
          <span>Ball {innings.ballsBowled}/{MAX_BALLS_PER_INNINGS}</span>
        </Tip>
        <Tip text={`${MAX_WICKETS_PER_INNINGS} wickets ends the innings.`}>
          <span>Wickets {innings.wickets}/{MAX_WICKETS_PER_INNINGS}</span>
        </Tip>
      </div>
    </section>
  );
}

function OpponentRow(props: {
  name: string;
  handSize: number;
  connected: boolean;
  opponentLocked: boolean;
}) {
  return (
    <section className="opponent-row">
      <div className="opponent-info">
        <span className="opponent-name">{props.name}</span>
        <span className={`status ${props.connected ? "connected" : "disconnected"}`}>
          {props.connected ? "● online" : "○ offline"}
        </span>
        {props.opponentLocked && (
          <Tip text="Your opponent has locked in their selection — waiting for you.">
            <span className="status connected">🔒 locked in</span>
          </Tip>
        )}
      </div>
      <div className="opponent-hand">
        {Array.from({ length: props.handSize }).map((_, i) => (
          <Card key={i} card={{} as AnyCard} faceDown size="hand" />
        ))}
      </div>
    </section>
  );
}

function RoleBanner(props: {
  role: "batting" | "bowling";
  myName: string;
  /** Epoch-ms deadline; null means timer not running (e.g. while waiting for reveal). */
  deadline: number | null;
}) {
  const seconds = useCountdown(props.deadline);
  const tickingClass = props.deadline !== null && seconds <= 5 ? "urgent" : "";
  return (
    <section className={`role-banner ${props.role}`}>
      <div className="role-banner-row">
        <span>
          <strong>{props.myName}</strong> — you're {props.role} this ball.
        </span>
        {props.deadline !== null ? (
          <Tip text="Time remaining to lock in your selection. If you don't, the server picks a random mandatory card for you.">
            <span className={`turn-timer ${tickingClass}`}>{seconds}s</span>
          </Tip>
        ) : (
          <Tip text="Timer paused — locked in or revealing.">
            <span className="dim-text">paused</span>
          </Tip>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────── Selection footer ───────────────────────────

function SelectionFooter(props: {
  pendingMandatory: AnyCard | null;
  pendingSituation: AnyCard | null;
  canSubmit: boolean;
  awaitingReveal: boolean;
  opponentLocked: boolean;
  onSubmit: () => void;
  onClearMandatory: () => void;
  onClearSituation: () => void;
}) {
  if (props.awaitingReveal) {
    return (
      <section className="selection-footer locked">
        <Tip text="You've submitted this ball. Waiting for the opponent to lock in (or for the 30s timer to expire).">
          <span>🔒 Locked in</span>
        </Tip>
        {props.opponentLocked ? (
          <span className="dim-text">Both locked — revealing…</span>
        ) : (
          <span className="dim-text">Waiting for opponent…</span>
        )}
      </section>
    );
  }
  return (
    <section className="selection-footer">
      <div className="selection-slots">
        <SelectionSlot
          label="Mandatory"
          tip="Required pick — your batsman or bowler card. Click a card in hand to fill this slot."
          card={props.pendingMandatory}
          onClear={props.onClearMandatory}
        />
        <SelectionSlot
          label="Situation"
          tip="Optional pick — a one-time-use tactical card. Click a situation card in hand to fill this slot."
          card={props.pendingSituation}
          onClear={props.onClearSituation}
        />
      </div>
      <button className="btn primary big" disabled={!props.canSubmit} onClick={props.onSubmit}>
        Lock in
      </button>
    </section>
  );
}

function SelectionSlot(props: {
  label: string;
  tip: string;
  card: AnyCard | null;
  onClear: () => void;
}) {
  return (
    <div className={`selection-slot ${props.card ? "filled" : "empty"}`}>
      <div className="selection-slot-label">
        <Tip text={props.tip}>{props.label}</Tip>
      </div>
      {props.card ? (
        <div className="selection-slot-content">
          <span className="selection-card-name">{cardName(props.card)}</span>
          <button
            className="btn ghost small"
            onClick={props.onClear}
            aria-label="Remove from selection"
          >
            ×
          </button>
        </div>
      ) : (
        <span className="dim-text">empty</span>
      )}
    </div>
  );
}

function cardName(card: AnyCard): string {
  if (card.kind === "situation") return card.name;
  return card.name;
}

// ─────────────────────────── Reveal overlay ───────────────────────────

function RevealOverlay(props: {
  result: BallResult;
  mySlot: PlayerSlot;
  aName: string;
  bName: string;
  postBallDeadline: number | null;
  isFinalBall: boolean;
  onContinue: () => void;
}) {
  const { result, mySlot } = props;
  const myReveal =
    result.battingSelection.player === mySlot ? result.battingSelection : result.bowlingSelection;
  const oppReveal =
    result.battingSelection.player === mySlot ? result.bowlingSelection : result.battingSelection;
  const seconds = useCountdown(props.postBallDeadline);

  const continueLabel = props.isFinalBall ? "See result" : "Continue";

  return (
    <div className="reveal-overlay">
      <div className="reveal-inner">
        <h2>Ball {result.ballNumber}</h2>
        <div className="reveal-cards">
          <div>
            <div className="reveal-side-label">You played</div>
            <Card card={myReveal.mandatoryCard} size="hand" />
            {myReveal.situationCard && (
              <div style={{ marginTop: "0.5rem" }}>
                <Card card={myReveal.situationCard} size="hand" />
              </div>
            )}
          </div>
          <div className="reveal-vs">
            <Tip text="Both players revealed simultaneously.">
              <span>vs</span>
            </Tip>
          </div>
          <div>
            <div className="reveal-side-label">Opponent played</div>
            <Card card={oppReveal.mandatoryCard} size="hand" />
            {oppReveal.situationCard && (
              <div style={{ marginTop: "0.5rem" }}>
                <Card card={oppReveal.situationCard} size="hand" />
              </div>
            )}
          </div>
        </div>

        <ResolutionTrail steps={result.resolutionSteps} />
        <FinalOutcome outcome={result.finalOutcome} extras={result.extraRuns} extrasNote={result.extrasNote} rebowled={result.rebowled} />

        <div className="reveal-footer">
          {props.postBallDeadline !== null && (
            <Tip text="Resolution pause — gives both players time to read the trail. The next ball starts when the timer hits 0.">
              <span className="post-ball-countdown">
                {props.isFinalBall
                  ? `Result in ${seconds}s`
                  : `Next ball in ${seconds}s`}
              </span>
            </Tip>
          )}
          <button className="btn primary big" onClick={props.onContinue}>
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolutionTrail({ steps }: { steps: ResolutionStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="resolution-trail">
      {steps.map((step, i) => (
        <li key={i} className={step.applied ? "applied" : "skipped"}>
          <Tip text={step.detail}>
            <strong>{step.label}</strong>
          </Tip>
          {step.before && step.after ? (
            <span className="step-change">
              {" "}
              {fmtOutcome(step.before)} → {fmtOutcome(step.after)}
            </span>
          ) : null}
          {!step.applied && (
            <span className="dim-text"> (no effect)</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function FinalOutcome({
  outcome,
  extras,
  extrasNote,
  rebowled,
}: {
  outcome: BallOutcome;
  extras: number;
  extrasNote: string | null;
  rebowled: boolean;
}) {
  const extrasLabel =
    extrasNote === "no-ball" ? "No Ball" : extrasNote === "wide" ? "Wide" : "extras";
  const extrasTip =
    extrasNote === "no-ball"
      ? "No Ball: +1 extra run and the ball is re-bowled (doesn't count against the over)."
      : extrasNote === "wide"
        ? "Wide: +1 extra run and the ball is re-bowled (doesn't count against the over)."
        : "Extras awarded on top of the outcome runs.";

  let main: JSX.Element;
  if (outcome.type === "wicket") {
    main = (
      <div className="final-outcome wicket">
        <Tip text="The batter is out. They lose a wicket; max 2 per innings.">
          <span>WICKET — {outcome.mode}</span>
        </Tip>
      </div>
    );
  } else if (outcome.type === "runs") {
    main = (
      <div className={`final-outcome runs r-${outcome.value}`}>
        <Tip text={`The batter scores ${outcome.value} run${outcome.value === 1 ? "" : "s"}.`}>
          <span>
            {outcome.value} run{outcome.value === 1 ? "" : "s"} — {outcome.shot}
          </span>
        </Tip>
      </div>
    );
  } else {
    main = (
      <div className="final-outcome dot">
        <Tip text="No runs scored on this ball.">
          <span>Dot ball</span>
        </Tip>
      </div>
    );
  }

  return (
    <>
      {main}
      {(extras > 0 || rebowled) && (
        <div className="extras-row">
          {extras > 0 && (
            <Tip text={extrasTip}>
              <span className="extras-pill">
                +{extras} {extrasLabel}
              </span>
            </Tip>
          )}
          {rebowled && (
            <Tip text="This delivery doesn't count against the over — the bowler will re-bowl.">
              <span className="extras-pill rebowl">↻ re-bowled</span>
            </Tip>
          )}
        </div>
      )}
    </>
  );
}

function fmtOutcome(o: BallOutcome): string {
  if (o.type === "runs") return `${o.value}`;
  if (o.type === "wicket") return "WKT";
  return "·";
}

// ─────────────────────────── Match-over ───────────────────────────

function MatchOverView({ client }: { client: MatchClient }) {
  const { matchState, mySlot } = client;
  if (!matchState || !mySlot) return null;
  const result = matchState.result;
  const aName = matchState.players.A.displayName;
  const bName = matchState.players.B?.displayName ?? "B";
  return (
    <main>
      <h1>Match Over</h1>
      {result ? (
        <div className="result-card">
          <div className="result-headline">
            {result.winner === "tie"
              ? "Tied!"
              : result.winner === mySlot
                ? "You won!"
                : `${result.winner === "A" ? aName : bName} won.`}
          </div>
          <div className="dim-text">{result.margin}</div>
        </div>
      ) : (
        <div className="hint">Computing result…</div>
      )}
      <ScorecardSummary client={client} />
      <div className="lobby-actions">
        <button className="btn primary" onClick={client.leaveMatch}>
          Back to home
        </button>
      </div>
    </main>
  );
}

function ScorecardSummary({ client }: { client: MatchClient }) {
  const { matchState } = client;
  if (!matchState) return null;
  const aName = matchState.players.A.displayName;
  const bName = matchState.players.B?.displayName ?? "B";
  const i1 = matchState.innings1;
  const i2 = matchState.innings2;
  return (
    <section className="scorecard">
      {i1 && (
        <div className="scorecard-line">
          <span>
            Innings 1 — <strong>{i1.battingPlayer === "A" ? aName : bName}</strong> batting
          </span>
          <strong>{i1.runs}/{i1.wickets}</strong>
          <span className="dim-text">in {i1.ballsBowled} balls</span>
        </div>
      )}
      {i2 && (
        <div className="scorecard-line">
          <span>
            Innings 2 — <strong>{i2.battingPlayer === "A" ? aName : bName}</strong> chasing {i2.target}
          </span>
          <strong>{i2.runs}/{i2.wickets}</strong>
          <span className="dim-text">in {i2.ballsBowled} balls</span>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function canSelectCard(
  card: AnyCard,
  requiredKind: "batsman" | "bowler",
  locked: boolean,
): boolean {
  if (locked) return false;
  if (card.kind === "situation") return true;
  return card.kind === requiredKind;
}

function handleViewerSubmit(
  client: MatchClient,
  card: AnyCard,
  currentMandatoryId: string | null,
  currentSituationId: string | null,
): void {
  if (card.kind === "situation") {
    if (currentSituationId === card.id) {
      client.selectSituation(null);
    } else {
      client.selectSituation(card.id);
    }
  } else {
    if (currentMandatoryId === card.id) {
      client.selectMandatory(null);
    } else {
      client.selectMandatory(card.id);
    }
  }
}
