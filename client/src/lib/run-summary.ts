/**
 * Run-summary generator — analyses a completed WC run and produces a
 * "newspaper headline" framing of the tournament. Used by
 * NewspaperRunSummary to render a front-page-style victory recap.
 *
 * Pure function — no React, no localStorage. Takes a WCRun and the
 * final match's BallResult log (via WCMatchRecord — but we don't
 * have access to per-ball outcomes here; the recap is built from
 * match-level metadata only).
 */

import { TOURNAMENT_FORMATS, type WCRun } from "./career.ts";

export type SummaryTone =
  | "dominant"   // won every match, never lost
  | "comeback"   // lost in group, came back to win
  | "close-call" // won the final by < 10 runs / 2 wickets
  | "underdog"   // won on Legend difficulty
  | "standard";  // unremarkable victory

export interface RunSummary {
  headline: string;
  subheadline: string;
  tone: SummaryTone;
  /** 3-5 short narrative bullets for the front page. */
  highlights: string[];
  /** Single sentence: who they beat in the final, in what form. */
  finalRecap: string;
  /** Optional "manager's quote" — flavour line, tongue-in-cheek. */
  managerQuote: string;
  /** Cosmetic — the newspaper's "edition" date string. */
  editionDate: string;
}

/**
 * Build a newspaper-style summary of a completed run. Only meaningful
 * when run.stage === "won"; otherwise generates a "post-mortem" version.
 */
export function generateRunSummary(run: WCRun): RunSummary {
  const cfg = TOURNAMENT_FORMATS[run.tournament];
  const wins = run.history.filter((h) => h.result === "win").length;
  const losses = run.history.filter((h) => h.result === "loss").length;
  const finalMatch = run.history[run.history.length - 1];
  const won = run.stage === "won";

  // Determine tone
  let tone: SummaryTone = "standard";
  if (won && losses === 0) tone = "dominant";
  else if (won && losses > 0 && run.history.findIndex((h) => h.result === "loss") < run.history.length - 1) {
    tone = "comeback";
  }
  if (won && run.difficulty === "legend") tone = "underdog";

  const headline = buildHeadline(run, tone, wins, losses);
  const subheadline = buildSubheadline(run, tone);
  const finalRecap = buildFinalRecap(run);
  const highlights = buildHighlights(run, wins, losses);
  const managerQuote = buildManagerQuote(run, tone);

  void finalMatch;
  return {
    headline,
    subheadline,
    tone,
    highlights,
    finalRecap,
    managerQuote,
    editionDate: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).toUpperCase(),
  };
}

// ─────────────────────────── Builders ───────────────────────────

function buildHeadline(
  run: WCRun,
  tone: SummaryTone,
  wins: number,
  losses: number,
): string {
  const cfg = TOURNAMENT_FORMATS[run.tournament];
  const tournamentName = cfg.label.replace(/^[^\s]+ /, ""); // strip emoji
  const finalMatch = run.history[run.history.length - 1];
  const finalOpp = finalMatch?.opponent.nation ?? "opponent";

  if (run.stage !== "won") {
    // Loss / abandon — different headlines
    if (run.stage === "abandoned") {
      return `${tournamentName.toUpperCase()} CAMPAIGN ABANDONED`;
    }
    return `${tournamentName.toUpperCase()} HOPES DASHED BY ${finalOpp.toUpperCase()}`;
  }

  switch (tone) {
    case "dominant":
      return `INVINCIBLE! UNBEATEN RUN CLAIMS ${tournamentName.toUpperCase()}`;
    case "comeback":
      return `RISE FROM THE ASHES — ${tournamentName.toUpperCase()} TROPHY AGAINST THE ODDS`;
    case "close-call":
      return `NAIL-BITER! ${tournamentName.toUpperCase()} WON ON THE FINAL BALL*`;
    case "underdog":
      return `LEGENDS BORN — ${tournamentName.toUpperCase()} CONQUERED ON LEGEND DIFFICULTY`;
    case "standard":
    default:
      return `${tournamentName.toUpperCase()} CHAMPIONS!`;
  }
}

function buildSubheadline(run: WCRun, tone: SummaryTone): string {
  const finalMatch = run.history[run.history.length - 1];
  const finalOpp = finalMatch?.opponent.nation ?? "the final opponent";
  if (run.stage !== "won") {
    return `Campaign ends after ${run.history.filter((h) => h.result === "win").length} wins.`;
  }
  switch (tone) {
    case "dominant":
      return `Not a single defeat in the entire tournament. ${finalOpp} brushed aside in the final.`;
    case "comeback":
      return `After early stumbles, the team found its rhythm and edged ${finalOpp} when it mattered.`;
    case "underdog":
      return `On the hardest difficulty setting, every opponent was an International-tier giant. They fell anyway.`;
    case "close-call":
      return `${finalOpp} pushed the chase to the wire. The trophy is ours.`;
    case "standard":
    default:
      return `${finalOpp} bested in the final to lift the trophy.`;
  }
}

function buildFinalRecap(run: WCRun): string {
  const finalMatch = run.history[run.history.length - 1];
  if (!finalMatch) return "";
  const opp = finalMatch.opponent.nation;
  if (run.stage === "won") {
    return `In the final, the side took on ${opp} and emerged victorious — a moment the captain will remember for years.`;
  }
  return `The campaign ended with a defeat to ${opp} in the ${finalMatch.opponent.stageLabel === "final" ? "final" : finalMatch.opponent.stageLabel}.`;
}

function buildHighlights(run: WCRun, wins: number, losses: number): string[] {
  const out: string[] = [];
  const cfg = TOURNAMENT_FORMATS[run.tournament];

  // Group stage performance
  if (cfg.groupMatches > 0) {
    const groupWins = run.history.filter(
      (h) => h.opponent.stageLabel === "group" && h.result === "win",
    ).length;
    const groupLosses = run.history.filter(
      (h) => h.opponent.stageLabel === "group" && h.result === "loss",
    ).length;
    if (groupWins === cfg.groupMatches) {
      out.push(`🌟 Perfect group stage — ${groupWins} wins, no losses.`);
    } else if (groupWins >= cfg.groupWinsToAdvance) {
      out.push(`📊 Topped the group with ${groupWins}–${groupLosses}.`);
    } else if (run.stage === "lost") {
      out.push(`💔 Group stage fell short at ${groupWins}–${groupLosses}.`);
    }
  }

  // Knockouts
  const koStages = cfg.knockoutStages;
  for (const stage of koStages) {
    const match = run.history.find((h) => h.opponent.stageLabel === stage);
    if (!match) continue;
    const stageLabel = stage === "qf" ? "Quarter-final" : stage === "semi" ? "Semi-final" : "Final";
    if (match.result === "win") {
      out.push(`✅ ${stageLabel}: beat ${match.opponent.nation}.`);
    } else {
      out.push(`🛑 ${stageLabel}: lost to ${match.opponent.nation}.`);
    }
  }

  // Difficulty flavour
  if (run.difficulty === "legend" && run.stage === "won") {
    out.push(`💪 On Legend difficulty — every opponent was an International-grade bot.`);
  } else if (run.difficulty === "casual" && run.stage === "won") {
    out.push(`🎓 Casual difficulty — a confidence-building campaign.`);
  }

  // Win/loss summary
  out.push(`📈 Overall record: ${wins}W ${losses}L.`);

  return out;
}

function buildManagerQuote(run: WCRun, tone: SummaryTone): string {
  if (run.stage !== "won") {
    return `"We'll be back, stronger." — the captain, post-loss.`;
  }
  switch (tone) {
    case "dominant":
      return `"Honestly, we never even felt threatened. Brilliant team effort." — captain, beaming.`;
    case "comeback":
      return `"The early losses lit a fire under us. Best feeling in the world." — captain, hugging the trophy.`;
    case "close-call":
      return `"What a final. I aged ten years tonight. Worth it." — captain, exhausted.`;
    case "underdog":
      return `"Legend mode? They said it couldn't be done. We just did it." — captain, mic drop.`;
    case "standard":
    default:
      return `"A great tournament. Proud of every player out there." — captain.`;
  }
}
