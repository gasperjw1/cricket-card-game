import {
  MAX_BALLS_PER_INNINGS,
  MAX_WICKETS_PER_INNINGS,
  type BallResult,
  type InningsState,
  type PublicMatchState,
  type PublicPlayerInfo,
} from "@swipe-sixer/shared";
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

  const ballsCounted = display.ballsBowled;
  const overs = `0.${ballsCounted}`;

  return (
    <section className="scorebug">
      <div className="scorebug-row">
        <div className="scorebug-teams">
          <Tip text={`${A.displayName} (${A.abbreviation}) vs ${B?.displayName ?? "—"} (${B?.abbreviation ?? "—"})`}>
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
          <Tip text={`${display.runs} run${display.runs === 1 ? "" : "s"} for ${display.wickets} wicket${display.wickets === 1 ? "" : "s"} (max ${MAX_WICKETS_PER_INNINGS}).`}>
            <span>
              {display.runs}
              <span className="sep">-</span>
              {display.wickets}
            </span>
          </Tip>
        </div>
        <div className="scorebug-overs">
          <Tip text={`${ballsCounted} ball${ballsCounted === 1 ? "" : "s"} bowled out of ${MAX_BALLS_PER_INNINGS} this innings (rebowled deliveries don't count).`}>
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
      </div>

      <div className="scorebug-balls-row">
        <div className="scorebug-balls-meta">
          <Tip text={`Bowler this innings.`}>
            <span className="bowler-name">
              {bowlingPlayer?.displayName.toUpperCase() ?? "—"}
            </span>
          </Tip>
        </div>
        <BallsRow log={innings?.log ?? display.log} />
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
    return (
      <span>
        TARGET {innings.target} · {battingAbbr} NEED {need}
      </span>
    );
  }

  if (innings && matchState.currentInnings === 1) {
    return (
      <span>
        INNINGS 1 · {battingAbbr} BATTING · {bowlingAbbr} BOWLING
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

/** Per-ball circle row. */
function BallsRow({ log }: { log: BallResult[] }) {
  // log entries (oldest first) + pending circles for remaining "real" balls
  const ballsCounted = log.filter((r) => !r.rebowled).length;
  const remaining = Math.max(0, MAX_BALLS_PER_INNINGS - ballsCounted);

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

// Re-export PublicPlayerInfo so type checkers see the import.
export type { PublicPlayerInfo };
