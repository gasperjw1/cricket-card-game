import { useEffect, useState } from "react";
import type { Nation } from "@swipe-sixer/shared";
import {
  TOURNAMENT_FORMATS,
  type WCOpponent,
  type WCRun,
} from "../lib/career.ts";
import { stadiumFor } from "../lib/stadiums.ts";
import { NATION_FLAG } from "../components/icons.ts";

interface Props {
  run: WCRun;
  opponent: WCOpponent;
  /** Called when the user (or the auto-timer) is ready to proceed. */
  onStart: () => void;
}

/**
 * Pre-match "vs" overlay shown when the user taps "Play match" in the
 * career hub. Displays both teams + flags + stage name + stadium for
 * cricket-broadcast flavor. Tap to skip; auto-dismisses after 3s.
 *
 * Backdrop is themed to the tournament (color + emblem).
 */
export function PreMatchOverlay({ run, opponent, onStart }: Props) {
  const config = TOURNAMENT_FORMATS[run.tournament];
  const stadium = stadiumFor(opponent.nation, opponent.matchIndex);
  const myAbbr = "YOU"; // We're always slot A; bot is the opponent.

  // Try to render the opponent's flag — only Test nations have flags
  // in NATION_FLAG; fallback to a generic emoji.
  const oppFlag = (NATION_FLAG as Record<string, string>)[opponent.nation] ?? "🏏";

  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!autoStarted) {
        setAutoStarted(true);
        onStart();
      }
    }, 3500);
    return () => clearTimeout(t);
  }, [autoStarted, onStart]);

  const handleSkip = (): void => {
    if (autoStarted) return;
    setAutoStarted(true);
    onStart();
  };

  return (
    <main
      className="pre-match"
      onClick={handleSkip}
      style={{
        background: config.headerGradient,
        cursor: "pointer",
      }}
    >
      <div className="pre-match-tournament">
        <span className="pre-match-tournament-emblem">{config.emblem}</span>
        <span className="pre-match-tournament-name">{config.shortName.toUpperCase()}</span>
      </div>

      <div className="pre-match-stage">
        {stageDisplayName(opponent.stageLabel, opponent.matchIndex, run)}
      </div>

      <div
        className="pre-match-vs"
        style={{ borderColor: config.accentColor }}
      >
        <div className="pre-match-team">
          <div className="pre-match-flag">🏏</div>
          <div className="pre-match-team-abbr">{myAbbr}</div>
          <div className="pre-match-team-label dim-text">Your team</div>
        </div>

        <div
          className="pre-match-versus"
          style={{ color: config.accentColor }}
        >
          VS
        </div>

        <div className="pre-match-team">
          <div className="pre-match-flag">{oppFlag}</div>
          <div className="pre-match-team-abbr">{opponent.nation.toUpperCase()}</div>
          <div className="pre-match-team-label dim-text">Opponent</div>
        </div>
      </div>

      <div className="pre-match-stadium">
        <div className="pre-match-stadium-name">{stadium.name}</div>
        <div className="pre-match-stadium-city dim-text">{stadium.city}</div>
        <div className="pre-match-stadium-tagline dim-text">{stadium.tagline}</div>
      </div>

      <p className="pre-match-tap-hint">Tap anywhere to start →</p>
    </main>
  );
}

function stageDisplayName(
  stage: WCOpponent["stageLabel"],
  matchIndex: number,
  run: WCRun,
): string {
  switch (stage) {
    case "group": {
      const groupOnly = run.ladder.filter((o) => o.stageLabel === "group");
      const groupIdx = groupOnly.findIndex((o) => o.matchIndex === matchIndex);
      return `Group Match ${groupIdx + 1} of ${groupOnly.length}`;
    }
    case "qf":
      return "Quarter-Final";
    case "semi":
      return "Semi-Final";
    case "final":
      return "★ THE FINAL ★";
  }
}
