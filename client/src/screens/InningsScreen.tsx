import { useEffect, useRef, useState } from "react";
import {
  HAND_SIZE,
  type AnyCard,
  type BallOutcome,
  type BallResult,
  type PlayerSlot,
  type ResolutionStep,
} from "@swipe-sixer/shared";
import { Card, type RevealContext } from "../components/Card.tsx";
import { CardViewer } from "../components/CardViewer.tsx";
import { Scorebug } from "../components/Scorebug.tsx";
import { StorySequence } from "../components/story/StorySequence.tsx";
import { useStorySequence } from "../components/story/useStorySequence.ts";
import { Tip } from "../components/Tip.tsx";
import type { MatchClient } from "../state.ts";
import { useCountdown } from "../useCountdown.ts";
import { useStagedReveal } from "../useStagedReveal.ts";
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

  // The ball is "live" only when the server has set a submit deadline.
  // During post-ball pauses (between balls or before innings/match-over),
  // pending swaps, or after the innings is complete, the hand UI must be
  // disabled so the player can't try to play a card that won't reach
  // resolution.
  const ballLive =
    matchState.currentBallDeadlineEpochMs !== null &&
    !matchState.pendingSwap &&
    !innings.isComplete;
  const canSubmit = !!mandatoryId && !awaitingReveal && !lastReveal && ballLive;
  const inPostBallPause = matchState.postBallDeadlineEpochMs !== null;

  return (
    <main className="innings">
      <Scorebug matchState={matchState} />

      <RoleBanner
        role={role}
        myName={me.displayName}
        deadline={awaitingReveal ? null : matchState.currentBallDeadlineEpochMs}
        innings1Complete={
          matchState.currentInnings === 1 && innings.isComplete
        }
        matchEndingSoon={
          matchState.currentInnings === 2 &&
          innings.isComplete &&
          matchState.phase === "innings"
        }
        inPostBallPause={inPostBallPause}
        postBallDeadline={matchState.postBallDeadlineEpochMs}
      />

      <HandArea
        handCards={handCards}
        deckRemaining={privateView?.hand.deckRemaining ?? 0}
        mandatoryId={mandatoryId}
        situationId={situationId}
        ballLive={ballLive}
        onCardOpen={(id) => setViewingCardId(id)}
      />

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
        ballLive={ballLive}
        inningsComplete={innings.isComplete}
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
          canSelect={
            ballLive &&
            canSelectCard(viewingCard, requiredKind, !!awaitingReveal || !!lastReveal)
          }
          disabledReason={
            !ballLive
              ? "No live ball — wait for the next one."
              : awaitingReveal
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

// ─────────────────────────── Hand area ───────────────────────────

/** Renders the hand. Two layouts depending on viewport (CSS-driven):
 *  - Desktop (>=540px): 4-column grid showing all cards at once.
 *  - Mobile (<540px): horizontal scroll-snap carousel showing one card
 *    at a time, with prev/next arrows and a dot indicator.
 *  Both share the same JSX; CSS toggles the layout.
 */
function HandArea(props: {
  handCards: AnyCard[];
  deckRemaining: number;
  mandatoryId: string | null;
  situationId: string | null;
  ballLive: boolean;
  onCardOpen: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Keep React state in sync with native swipe scrolling. Throttled-ish via
  // rAF so we don't thrash on every scroll pixel.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        const idx = Math.round(el.scrollLeft / w);
        setCarouselIndex(idx);
      });
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Reset to first card whenever the hand changes (new ball drew new cards).
  useEffect(() => {
    setCarouselIndex(0);
    scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [props.handCards.map((c) => c.id).join(",")]);

  const scrollToIndex = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(props.handCards.length - 1, idx));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  const isFirst = carouselIndex === 0;
  const isLast = carouselIndex >= props.handCards.length - 1;

  return (
    <div className="hand-area">
      <div className="hand-meta">
        <Tip text="Your hand. Each ball you must play one mandatory card (batsman if batting, bowler if bowling). You can optionally also play one situation card.">
          <span>
            Hand ({props.handCards.length}/{HAND_SIZE})
          </span>
        </Tip>
        <Tip text="Cards remaining in your active deck. You draw back to a full hand after every ball.">
          <span className="dim-text">deck: {props.deckRemaining}</span>
        </Tip>
      </div>
      <div
        ref={scrollerRef}
        className={`hand-grid ${props.ballLive ? "" : "dimmed"}`}
      >
        {props.handCards.length === 0 && (
          <div className="hint">Waiting for hand…</div>
        )}
        {props.handCards.map((card) => (
          <div className="hand-slot" key={card.id}>
            <Card
              card={card}
              size="hand"
              selected={
                card.id === props.mandatoryId || card.id === props.situationId
              }
              onClick={
                props.ballLive ? () => props.onCardOpen(card.id) : undefined
              }
            />
          </div>
        ))}
      </div>
      {props.handCards.length > 1 && (
        <div className="hand-carousel-controls" aria-hidden="true">
          <button
            type="button"
            className="hand-arrow"
            onClick={() => scrollToIndex(carouselIndex - 1)}
            disabled={isFirst}
            aria-label="Previous card"
          >
            ‹
          </button>
          <div className="hand-dots">
            {props.handCards.map((c, i) => (
              <span
                key={c.id}
                className={`hand-dot ${i === carouselIndex ? "active" : ""}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="hand-arrow"
            onClick={() => scrollToIndex(carouselIndex + 1)}
            disabled={isLast}
            aria-label="Next card"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Banners ───────────────────────────

function RoleBanner(props: {
  role: "batting" | "bowling";
  myName: string;
  /** Epoch-ms deadline; null means timer not running (e.g. while waiting for reveal). */
  deadline: number | null;
  innings1Complete: boolean;
  matchEndingSoon: boolean;
  inPostBallPause: boolean;
  postBallDeadline: number | null;
}) {
  const seconds = useCountdown(props.deadline);
  const postBallSeconds = useCountdown(props.postBallDeadline);
  const tickingClass = props.deadline !== null && seconds <= 5 ? "urgent" : "";

  // Innings 1 finished — innings 2 starting after the pause.
  if (props.innings1Complete) {
    return (
      <section className={`role-banner ${props.role} ending`}>
        <div className="role-banner-row">
          <span>
            <strong>Innings 1 complete.</strong> Roles swap — innings 2 starts soon.
          </span>
          {props.postBallDeadline !== null && (
            <span className="turn-timer">{postBallSeconds}s</span>
          )}
        </div>
      </section>
    );
  }

  // Innings 2 finished — match ending after the pause.
  if (props.matchEndingSoon) {
    return (
      <section className={`role-banner ${props.role} ending`}>
        <div className="role-banner-row">
          <span>
            <strong>Innings 2 complete.</strong> Match result coming up.
          </span>
          {props.postBallDeadline !== null && (
            <span className="turn-timer">{postBallSeconds}s</span>
          )}
        </div>
      </section>
    );
  }

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
        ) : props.inPostBallPause ? (
          <Tip text="Resolution pause — next ball starts when the timer hits 0.">
            <span className="dim-text">next ball in {postBallSeconds}s</span>
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
  ballLive: boolean;
  inningsComplete: boolean;
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
  if (props.inningsComplete) {
    return (
      <section className="selection-footer locked">
        <span>🏁 Innings complete — sit tight.</span>
      </section>
    );
  }
  if (!props.ballLive) {
    return (
      <section className="selection-footer locked">
        <span className="dim-text">No live ball — waiting for the next one…</span>
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

function buildRevealContext(result: BallResult): RevealContext {
  // Derive what fired this ball from the resolution steps + the engine's
  // lookupZone (post-zone-modifiers). Used by Card components in reveal
  // mode to filter their displayed sections.
  // The FIRING adjective is the first applied "adjective" step's label
  // (label is "<Adjective name> adjective" — strip the suffix).
  const firedAdjStep = result.resolutionSteps.find(
    (s) => s.kind === "adjective" && s.applied,
  );
  let firedAdjective: RevealContext["firedAdjective"] = null;
  if (firedAdjStep) {
    const m = firedAdjStep.label.match(/^(.+?)\s+adjective$/);
    if (m) firedAdjective = m[1] as RevealContext["firedAdjective"];
  }

  const fieldingStep = result.resolutionSteps.find((s) => s.kind === "fielding");
  let firedFielding: RevealContext["firedFielding"] = null;
  if (fieldingStep && fieldingStep.applied) {
    const m = fieldingStep.label.match(/^Fielding:\s+(.+)$/);
    if (m) firedFielding = m[1] as RevealContext["firedFielding"];
  }
  return {
    lookupZone: result.lookupZone,
    firedAdjective,
    firedFielding,
  };
}

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
  const bowlingSel = result.bowlingSelection;
  const battingSel = result.battingSelection;
  const bowlerName =
    bowlingSel.player === mySlot
      ? "you"
      : bowlingSel.player === "A"
        ? props.aName
        : props.bName;
  const batterName =
    battingSel.player === mySlot
      ? "you"
      : battingSel.player === "A"
        ? props.aName
        : props.bName;
  const seconds = useCountdown(props.postBallDeadline);
  const reveal = buildRevealContext(result);

  // Two-phase reveal:
  //   Phase 1: storytelling pre-roll (pitch → bowler → batter → result → ...)
  //   Phase 2: existing card-reveal + resolution trail (the "see why" follow-up)
  const story = useStorySequence(result);
  const stage = useStagedReveal(result.resolutionSteps.length);

  const continueLabel = !story.isComplete
    ? "Skip story"
    : stage.isComplete
      ? props.isFinalBall
        ? "See result"
        : "Continue"
      : "Skip";

  const handleContinue = (): void => {
    if (!story.isComplete) {
      story.skipToEnd();
      return;
    }
    if (!stage.isComplete) {
      stage.skipToEnd();
      return;
    }
    props.onContinue();
  };

  return (
    <div className="reveal-overlay">
      <div className="reveal-inner">
        <h2>Ball {result.ballNumber}</h2>

        {!story.isComplete ? (
          <StorySequence result={result} story={story} />
        ) : (
          <>
            <div className="reveal-cards">
              <div className="reveal-side reveal-side-bowler">
                <div className="reveal-side-label">Bowler — {bowlerName}</div>
                <Card card={bowlingSel.mandatoryCard} size="hand" reveal={reveal} />
                {bowlingSel.situationCard && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <Card card={bowlingSel.situationCard} size="hand" />
                  </div>
                )}
              </div>
              <div className="reveal-side reveal-side-batter">
                <div className="reveal-side-label">Batter — {batterName}</div>
                <Card card={battingSel.mandatoryCard} size="hand" reveal={reveal} />
                {battingSel.situationCard && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <Card card={battingSel.situationCard} size="hand" />
                  </div>
                )}
              </div>
            </div>

            <ResolutionTrail
              steps={result.resolutionSteps}
              visibleCount={stage.visibleCount}
            />
            {stage.isComplete && (
              <FinalOutcome
                outcome={result.finalOutcome}
                extras={result.extraRuns}
                extrasNote={result.extrasNote}
                rebowled={result.rebowled}
              />
            )}
          </>
        )}

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
          <button className="btn primary big" onClick={handleContinue}>
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolutionTrail({
  steps,
  visibleCount,
}: {
  steps: ResolutionStep[];
  visibleCount: number;
}) {
  if (steps.length === 0) return null;
  return (
    <ol className="resolution-trail">
      {steps.map((step, i) => {
        const visible = i < visibleCount;
        const just = i === visibleCount - 1;
        const valueChanged =
          step.before &&
          step.after &&
          fmtOutcome(step.before) !== fmtOutcome(step.after);
        return (
          <li
            key={i}
            className={[
              step.applied ? "applied" : "skipped",
              visible ? "revealed" : "pending",
              just ? "just-revealed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden={!visible}
          >
            <Tip text={step.detail}>
              <strong>{step.label}</strong>
            </Tip>
            {step.before && step.after ? (
              <span className="step-change">
                {valueChanged ? (
                  <>
                    {" "}
                    <span className={`val-before${just ? " slashing" : " slashed"}`}>
                      {fmtOutcome(step.before)}
                    </span>{" "}
                    <span className={`val-arrow${just ? " arriving" : ""}`}>→</span>{" "}
                    <span className={`val-after${just ? " arriving" : ""}`}>
                      {fmtOutcome(step.after)}
                    </span>
                  </>
                ) : (
                  <>
                    {" "}
                    <span className="val-static">{fmtOutcome(step.after)}</span>
                  </>
                )}
              </span>
            ) : null}
            {!step.applied && <span className="dim-text"> (no effect)</span>}
          </li>
        );
      })}
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

      {i1 && i1.log.length > 0 && (
        <BallByBallLog innings={i1} inningsNumber={1} aName={aName} bName={bName} />
      )}
      {i2 && i2.log.length > 0 && (
        <BallByBallLog innings={i2} inningsNumber={2} aName={aName} bName={bName} />
      )}
    </section>
  );
}

/** Per-ball recap shown on the match-over screen. Walks through each
 *  ball's bowler → batter → outcome so the player can see how the
 *  innings unfolded after the final result. */
function BallByBallLog(props: {
  innings: import("@swipe-sixer/shared").InningsState;
  inningsNumber: 1 | 2;
  aName: string;
  bName: string;
}) {
  const { innings, inningsNumber, aName, bName } = props;
  return (
    <div className="ball-log">
      <h3 className="ball-log-heading">Innings {inningsNumber} — ball by ball</h3>
      <ol className="ball-log-list">
        {innings.log.map((b, idx) => (
          <li key={idx} className={`ball-log-item ${ballLogClass(b)}`}>
            <span className="ball-log-num">
              {inningsNumber}.{b.ballNumber}
            </span>
            <span className="ball-log-bowler">
              {(b.bowlingSelection.player === "A" ? aName : bName).split(" ")[0]}
              {" → "}
              <strong>{cardName(b.bowlingSelection.mandatoryCard)}</strong>
            </span>
            <span className="ball-log-batter">
              vs <strong>{cardName(b.battingSelection.mandatoryCard)}</strong>
            </span>
            <span className="ball-log-outcome">{ballLogOutcome(b)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ballLogClass(b: BallResult): string {
  if (b.finalOutcome.type === "wicket") return "is-wicket";
  if (b.finalOutcome.type === "runs" && b.finalOutcome.value >= 4) return "is-boundary";
  if (b.finalOutcome.type === "dot" && b.extraRuns === 0) return "is-dot";
  return "";
}

function ballLogOutcome(b: BallResult): string {
  const o = b.finalOutcome;
  const extras = b.extraRuns > 0 ? ` (+${b.extraRuns} ${b.extrasNote ?? "extras"})` : "";
  const rebowled = b.rebowled ? " 🔁" : "";
  if (o.type === "wicket") return `WICKET — ${o.dismissalCategory.replace("-", " ")}${extras}${rebowled}`;
  if (o.type === "runs") return `${o.value} (${o.shot})${extras}${rebowled}`;
  return `dot${extras}${rebowled}`;
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
