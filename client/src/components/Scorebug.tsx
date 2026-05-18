import {
  MATCH_FORMATS,
  PHASE_LABEL,
  phaseForBall,
  type BallResult,
  type InningsState,
  type PublicMatchState,
  type PublicPlayerInfo,
} from "@swipe-sixer/shared";
import { useCountdown } from "../useCountdown.ts";
import { Tip } from "./Tip.tsx";

interface Props {
  matchState: PublicMatchState;
}

/**
 * TV-style scorebug. Three horizontal cells (team strip / score / overs)
 * + a status strip below + a per-ball circle row.
 *
 * Design references the standard cricket broadcast graphic — see the
 * docs/situation-cards.md notes on No Ball / Wide for how rebowled
 * deliveries push extra circles into the row.
 */
export function Scorebug({ matchState }: Props) {
  const innings =
    matchState.currentInnings === 1
      ? matchState.innings1
      : matchState.currentInnings === 2
        ? matchState.innings2
        : null;

  // Show the previous innings score (if any) when the active innings hasn't
  // begun yet — gives the post-innings-1 pause something to display.
  const display = innings ?? matchState.innings1;
  if (!display) return null;

  const A = matchState.players.A;
  const B = matchState.players.B;
  const battingPlayer = display.battingPlayer === "A" ? A : B;
  const bowlingPlayer = display.bowlingPlayer === "A" ? A : B;

  const fmt = MATCH_FORMATS[matchState.format];
  const ballsCounted = display.ballsBowled;
  // T1 stays "0.4" (single-over format); T3+ shows "1.4 / 3" so players
  // know how deep into the innings they are.
  const overs =
    fmt.oversPerInnings > 1
      ? `${Math.floor(ballsCounted / 6)}.${ballsCounted % 6}/${fmt.oversPerInnings}`
      : `0.${ballsCounted}`;

  return (
    <section className="scorebug">
      <div className="scorebug-row">
        <div className="scorebug-teams">
          <Tip text={`${A.displayName} (${A.abbreviation}) vs ${B?.displayName ?? "—"} (${B?.abbreviation ?? "—"}) — ${fmt.label}`}>
            <span>
              <strong className={display.battingPlayer === "A" ? "batting" : ""}>
                {A.abbreviation}
              </strong>
              <span className="vs">v</span>
              <strong className={display.battingPlayer === "B" ? "batting" : ""}>
                {B?.abbreviation ?? "—"}
              </strong>
            </span>
          </Tip>
        </div>
        <div className="scorebug-score">
          <Tip text={`${display.runs} run${display.runs === 1 ? "" : "s"} for ${display.wickets} wicket${display.wickets === 1 ? "" : "s"} (max ${fmt.wicketsPerInnings}).`}>
            <span>
              {display.runs}
              <span className="sep">-</span>
              {display.wickets}
            </span>
          </Tip>
        </div>
        <div className="scorebug-overs">
          <Tip text={`${ballsCounted} ball${ballsCounted === 1 ? "" : "s"} bowled out of ${fmt.ballsPerInnings} this innings (${fmt.oversPerInnings} over${fmt.oversPerInnings === 1 ? "" : "s"}; rebowled deliveries don't count).`}>
            <span>{overs}</span>
          </Tip>
        </div>
      </div>

      <div className="scorebug-status">
        <StatusStrip
          matchState={matchState}
          innings={innings}
          battingAbbr={battingPlayer?.abbreviation ?? "—"}
          bowlingAbbr={bowlingPlayer?.abbreviation ?? "—"}
        />
        <ScorebugTimer matchState={matchState} />
      </div>

      <div className="scorebug-balls-row">
        <div className="scorebug-balls-meta">
          <Tip text={`Bowler this innings.`}>
            <span className="bowler-name">
              {bowlingPlayer?.displayName.toUpperCase() ?? "—"}
            </span>
          </Tip>
        </div>
        <BallsRow
          log={innings?.log ?? display.log}
          ballsPerInnings={fmt.ballsPerInnings}
        />
      </div>
    </section>
  );
}

function StatusStrip({
  matchState,
  innings,
  battingAbbr,
  bowlingAbbr,
}: {
  matchState: PublicMatchState;
  innings: InningsState | null;
  battingAbbr: string;
  bowlingAbbr: string;
}) {
  // Match over takes precedence.
  if (matchState.phase === "match-over" && matchState.result) {
    if (matchState.result.winner === "tie") {
      return <span>MATCH TIED · scores level</span>;
    }
    const winnerAbbr =
      matchState.result.winner === "A"
        ? matchState.players.A.abbreviation
        : matchState.players.B?.abbreviation ?? "—";
    return <span>{winnerAbbr} {matchState.result.margin.toUpperCase()}</span>;
  }

  // Between innings (innings 1 just complete, innings 2 not yet started).
  if (
    matchState.innings1?.isComplete &&
    !matchState.innings2 &&
    matchState.postBallDeadlineEpochMs !== null
  ) {
    const battingAbbrI1 =
      matchState.innings1.battingPlayer === "A"
        ? matchState.players.A.abbreviation
        : matchState.players.B?.abbreviation ?? "—";
    const target = matchState.innings1.runs + 1;
    return (
      <span>
        {battingAbbrI1} SET TARGET OF {target}
      </span>
    );
  }

  if (innings && matchState.currentInnings === 2 && innings.target !== null) {
    const need = Math.max(0, innings.target - innings.runs);
    const phase = phaseForBall(matchState.format, innings.ballsBowled + 1);
    return (
      <span>
        TARGET {innings.target} · {battingAbbr} NEED {need} ·{" "}
        <Tip text={`Each batter/bowler role plays best in its matching phase.`}>
          <span className="phase-pill">{PHASE_LABEL[phase].toUpperCase()}</span>
        </Tip>
      </span>
    );
  }

  if (innings && matchState.currentInnings === 1) {
    const phase = phaseForBall(matchState.format, innings.ballsBowled + 1);
    return (
      <span>
        INNINGS 1 · {battingAbbr} BAT · {bowlingAbbr} BOWL ·{" "}
        <Tip text={`Each batter/bowler role plays best in its matching phase. ${PHASE_LABEL[phase]} fires bonuses for matched roles, penalties for mismatched ones.`}>
          <span className="phase-pill">{PHASE_LABEL[phase].toUpperCase()}</span>
        </Tip>
      </span>
    );
  }

  // Coin toss recap (briefly visible right after innings 1 starts).
  if (matchState.coinToss?.battingSlot && matchState.currentInnings === null) {
    const tossWinnerAbbr =
      matchState.coinToss.winnerSlot === "A"
        ? matchState.players.A.abbreviation
        : matchState.players.B?.abbreviation ?? "—";
    return <span>{tossWinnerAbbr} WON THE TOSS</span>;
  }

  return <span>·</span>;
}

/** Per-ball circle row. For longer formats the row would get unwieldy,
 *  so we collapse the past into "delivered" pills per over and only show
 *  the current-over's six circles in detail. */
function BallsRow({
  log,
  ballsPerInnings,
}: {
  log: BallResult[];
  ballsPerInnings: number;
}) {
  const ballsCounted = log.filter((r) => !r.rebowled).length;
  const remaining = Math.max(0, ballsPerInnings - ballsCounted);

  // T1: show every ball inline (max 6 + maybe a couple rebowls = fine).
  if (ballsPerInnings <= 6) {
    return (
      <div className="scorebug-balls">
        {log.map((b, i) => (
          <BallCircle key={i} result={b} />
        ))}
        {Array.from({ length: remaining }).map((_, i) => (
          <span key={`pending-${i}`} className="ball-circle pending" aria-label="pending">
            {/* empty */}
          </span>
        ))}
      </div>
    );
  }

  // T3+: split log into completed overs + current over.
  // We walk the log accumulating "real" deliveries; once 6 land, the
  // over is complete and gets a compact summary chip.
  const completedOvers: BallResult[][] = [];
  let currentOver: BallResult[] = [];
  let realInOver = 0;
  for (const b of log) {
    currentOver.push(b);
    if (!b.rebowled) {
      realInOver += 1;
      if (realInOver === 6) {
        completedOvers.push(currentOver);
        currentOver = [];
        realInOver = 0;
      }
    }
  }

  const ballsLeftInCurrentOver = Math.max(0, 6 - realInOver);
  const oversLeftAfterCurrent = Math.max(
    0,
    Math.ceil(remaining / 6) - (currentOver.length > 0 ? 1 : 0),
  );

  return (
    <div className="scorebug-balls scorebug-balls-multi-over">
      {completedOvers.map((overBalls, oi) => (
        <CompletedOverChip key={`over-${oi}`} balls={overBalls} index={oi} />
      ))}
      {/* Detailed current over (always 6 slots; fills as balls land). */}
      <div className="scorebug-balls-current-over">
        {currentOver.map((b, i) => (
          <BallCircle key={`cur-${i}`} result={b} />
        ))}
        {Array.from({ length: ballsLeftInCurrentOver }).map((_, i) => (
          <span
            key={`cur-pending-${i}`}
            className="ball-circle pending"
            aria-label="pending"
          />
        ))}
      </div>
      {/* Pill placeholders for upcoming overs (just dim dots). */}
      {Array.from({ length: oversLeftAfterCurrent }).map((_, i) => (
        <span
          key={`upc-${i}`}
          className="over-chip pending"
          aria-label="upcoming over"
        >
          ·
        </span>
      ))}
    </div>
  );
}

/** Compact summary of a completed over: total runs + wicket count. */
function CompletedOverChip({ balls, index }: { balls: BallResult[]; index: number }) {
  let runs = 0;
  let wickets = 0;
  for (const b of balls) {
    if (b.finalOutcome.type === "runs") runs += b.finalOutcome.value;
    // Wickets that were SAVED into byes/leg-byes don't count toward
    // the wicket tally — the extras already roll into `runs` below.
    else if (b.finalOutcome.type === "wicket") wickets += 1;
    runs += b.extraRuns;
  }
  const tip = `Over ${index + 1}: ${runs} run${runs === 1 ? "" : "s"}${wickets > 0 ? `, ${wickets} wicket${wickets === 1 ? "" : "s"}` : ""}.`;
  return (
    <Tip text={tip}>
      <span className={`over-chip ${wickets > 0 ? "had-wicket" : ""}`}>
        {runs}
        {wickets > 0 && <span className="w-mark">W{wickets > 1 ? wickets : ""}</span>}
      </span>
    </Tip>
  );
}

function BallCircle({ result }: { result: BallResult }) {
  // Determine the visual + tooltip for this ball.
  let className = "ball-circle";
  let label = "";
  let tip = "";

  if (result.rebowled) {
    if (result.extrasNote === "no-ball") {
      className += " nb";
      label = "nb";
      tip = `Ball ${result.ballNumber}: No Ball — +1 extra, ball re-bowled.`;
    } else if (result.extrasNote === "wide") {
      className += " wd";
      label = "wd";
      tip = `Ball ${result.ballNumber}: Wide called — +1 extra, ball re-bowled.`;
    } else {
      className += " rb";
      label = "+";
      tip = `Ball ${result.ballNumber}: re-bowled.`;
    }
  } else if (result.finalOutcome.type === "wicket") {
    className += " wicket";
    label = "W";
    tip = `Ball ${result.ballNumber}: WICKET — ${result.finalOutcome.mode}.`;
  } else if (result.finalOutcome.type === "runs") {
    const v = result.finalOutcome.value;
    className += ` r-${v}`;
    label = String(v);
    tip = `Ball ${result.ballNumber}: ${v} run${v === 1 ? "" : "s"} (${result.finalOutcome.shot}).`;
  } else if (result.extrasNote === "byes" || result.extrasNote === "leg-byes") {
    // Wicket-save fired — outcome is dot but extraRuns went to byes /
    // leg byes. Show as "2b" / "4lb" with a tier-coloured background
    // so the player can see the save in the ball log.
    const isLb = result.extrasNote === "leg-byes";
    className += isLb ? " lb" : " by";
    label = `${result.extraRuns}${isLb ? "lb" : "b"}`;
    tip = `Ball ${result.ballNumber}: ${result.extraRuns} ${isLb ? "leg byes" : "byes"} (wicket overturned).`;
  } else {
    className += " dot";
    label = "•";
    tip = `Ball ${result.ballNumber}: dot ball.`;
  }

  return (
    <Tip text={tip}>
      <span className={className} aria-label={tip}>
        {label}
      </span>
    </Tip>
  );
}

/** Pitch-clock-style timer baked into the scorebug. Shows whichever
 *  clock is active: ball-pick deadline (red below 5s) or post-ball
 *  pause countdown (dim/blue). Lives inside the scorebug status strip
 *  so the player never has to look elsewhere for "how long do I have". */
function ScorebugTimer({ matchState }: { matchState: PublicMatchState }) {
  const ballSeconds = useCountdown(matchState.currentBallDeadlineEpochMs);
  const pauseSeconds = useCountdown(matchState.postBallDeadlineEpochMs);

  if (matchState.currentBallDeadlineEpochMs !== null) {
    const urgent = ballSeconds <= 5;
    return (
      <Tip text="Time to lock in your card. If 0s passes without a pick, the server auto-plays your highest-tier valid card.">
        <span className={`scorebug-timer pick ${urgent ? "urgent" : ""}`}>
          ⏱ {ballSeconds}s
        </span>
      </Tip>
    );
  }
  if (matchState.postBallDeadlineEpochMs !== null) {
    return (
      <Tip text="Resolution pause — next ball begins when this hits 0.">
        <span className="scorebug-timer pause">
          ⏸ {pauseSeconds}s
        </span>
      </Tip>
    );
  }
  return null;
}

// Re-export PublicPlayerInfo so type checkers see the import.
export type { PublicPlayerInfo };
