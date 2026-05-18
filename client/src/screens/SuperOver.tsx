/**
 * SuperOver — client-side playoff tie-breaker.
 *
 * One ball per side with a freshly shuffled deck. The player picks a
 * batter card for their batting turn and a bowler card for their bowling
 * turn; the opponent bot picks randomly from its nation's card pool
 * (tier-weighted by difficulty). The shared resolveBall engine resolves
 * each ball. Most runs after both balls wins; ties go to another round.
 *
 * Props:
 *   playerDeck    — the player's RunDeck (batting + bowling card ids)
 *   opponentNation — the bot's nation string (e.g. "Australia")
 *   difficulty     — "Gully" | "Domestic" | "International" from the ladder
 *   onResult      — called when a winner is known: "player" or "opponent"
 */

import { useState, useMemo } from "react";
import type { BatsmanCard, BowlerCard } from "@swipe-sixer/shared";
import {
  resolveBall,
  type ResolutionResult,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import type { RunDeck } from "../lib/career.ts";
import { Card } from "../components/Card.tsx";

// ─── helpers ───────────────────────────────────────────────────────────────

type BotLevel = "Gully" | "Domestic" | "International";

/** Tier pool per bot difficulty. Gully = Bronze/Silver; International = Gold/Elite. */
const BOT_TIER_POOL: Record<BotLevel, ReadonlyArray<string>> = {
  Gully: ["Bronze", "Silver"],
  Domestic: ["Silver", "Gold"],
  International: ["Gold", "Elite"],
};

/** Shuffle an array in-place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Pick a random card for the bot from its nation's pool, filtered by difficulty tiers. */
function pickBotBatter(nation: string, difficulty: BotLevel): BatsmanCard | null {
  const tiers = BOT_TIER_POOL[difficulty];
  const pool = CARDS.batsmen.filter(
    (c) => c.nation === nation && tiers.includes(c.tier),
  );
  if (pool.length === 0) {
    // Fallback: any nation card
    const fallback = CARDS.batsmen.filter((c) => c.nation === nation);
    return fallback[Math.floor(Math.random() * fallback.length)] ?? null;
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function pickBotBowler(nation: string, difficulty: BotLevel): BowlerCard | null {
  const tiers = BOT_TIER_POOL[difficulty];
  const pool = CARDS.bowlers.filter(
    (c) => c.nation === nation && tiers.includes(c.tier),
  );
  if (pool.length === 0) {
    const fallback = CARDS.bowlers.filter((c) => c.nation === nation);
    return fallback[Math.floor(Math.random() * fallback.length)] ?? null;
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/** Draw N cards from a shuffled id list, looked up against the roster. */
function drawBatters(deckIds: string[], n: number): BatsmanCard[] {
  const shuffled = shuffle([...deckIds]);
  const result: BatsmanCard[] = [];
  for (const id of shuffled) {
    if (result.length >= n) break;
    const card = CARDS.batsmen.find((c) => c.id === id);
    if (card) result.push(card);
  }
  return result;
}

function drawBowlers(deckIds: string[], n: number): BowlerCard[] {
  const shuffled = shuffle([...deckIds]);
  const result: BowlerCard[] = [];
  for (const id of shuffled) {
    if (result.length >= n) break;
    const card = CARDS.bowlers.find((c) => c.id === id);
    if (card) result.push(card);
  }
  return result;
}

function runsFromResult(r: ResolutionResult): number {
  const o = r.finalOutcome;
  // Run-out is type "runs" with a runOut flag — the runs still count.
  // Regular wicket = 0 bat runs (extras still added via extraRuns).
  if (o.type === "runs") return o.value + r.extraRuns;
  // dot or wicket: only extras count (e.g. no-ball penalty)
  return r.extraRuns;
}

// ─── component ─────────────────────────────────────────────────────────────

type Phase =
  | "pick-batter"   // player picks their batter card
  | "batter-result" // show the player's batting ball result
  | "pick-bowler"   // player picks their bowler card
  | "bowler-result" // show the bot's batting result (player bowled)
  | "round-result"; // show round summary; go again or declare winner

interface RoundState {
  round: number;
  playerBatterHand: BatsmanCard[];
  botBowler: BowlerCard | null;
  playerBatterPick: BatsmanCard | null;
  playerRuns: number | null;
  playerBallResult: ResolutionResult | null;
  playerBowlerHand: BowlerCard[];
  botBatter: BatsmanCard | null;
  playerBowlerPick: BowlerCard | null;
  botRuns: number | null;
  botBallResult: ResolutionResult | null;
}

interface Props {
  playerDeck: RunDeck;
  opponentNation: string;
  difficulty: BotLevel;
  onResult: (winner: "player" | "opponent") => void;
}

export function SuperOver({ playerDeck, opponentNation, difficulty, onResult }: Props) {
  const [phase, setPhase] = useState<Phase>("pick-batter");
  const [round, setRound] = useState(1);

  // Deal hands once per round using useMemo keyed on `round`.
  const playerBatterHand = useMemo(
    () => drawBatters(playerDeck.battingDeck, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );
  const playerBowlerHand = useMemo(
    () => drawBowlers(playerDeck.bowlingDeck, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );
  const botBowler = useMemo(
    () => pickBotBowler(opponentNation, difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );
  const botBatter = useMemo(
    () => pickBotBatter(opponentNation, difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );

  const [roundState, setRoundState] = useState<Partial<RoundState>>({});

  // ── Phase: player picks their batter ──────────────────────────────────────
  if (phase === "pick-batter") {
    return (
      <main className="super-over-screen">
        <div className="super-over-header">
          <h1 className="super-over-title">⚡ SUPER OVER</h1>
          {round > 1 && <div className="super-over-round">Round {round}</div>}
          <p className="super-over-subtitle">
            Your batting — pick one card to face {opponentNation}'s{" "}
            <strong>{botBowler?.name ?? "bowler"}</strong>
          </p>
        </div>

        {botBowler && (
          <div className="super-over-opponent-card">
            <div className="reveal-side-label">They bowl</div>
            <Card card={botBowler} size="hand" />
          </div>
        )}

        <div className="super-over-pick-label">You bat — pick one:</div>
        <div className="hand-grid super-over-hand">
          {playerBatterHand.map((card) => (
            <div key={card.id} className="hand-slot">
              <Card
                card={card}
                size="hand"
                onClick={() => {
                  if (!botBowler) return;
                  const result = resolveBall({
                    batsman: card,
                    bowler: botBowler,
                    battingSituation: null,
                    bowlingSituation: null,
                    phase: "death", // super overs are always death-phase pressure
                  });
                  setRoundState((prev) => ({
                    ...prev,
                    playerBatterPick: card,
                    playerBallResult: result,
                    playerRuns: runsFromResult(result),
                  }));
                  setPhase("batter-result");
                }}
              />
            </div>
          ))}
        </div>
        {playerBatterHand.length === 0 && (
          <p className="hint">No batting cards available — auto-resolving…</p>
        )}
      </main>
    );
  }

  // ── Phase: show player's batting result ────────────────────────────────────
  if (phase === "batter-result") {
    const { playerRuns, playerBatterPick, playerBallResult } = roundState;
    const runs = playerRuns ?? 0;
    const outcome = playerBallResult?.finalOutcome;
    return (
      <main className="super-over-screen">
        <div className="super-over-header">
          <h1 className="super-over-title">⚡ SUPER OVER</h1>
          <p className="super-over-subtitle">Your batting result</p>
        </div>

        <div className="super-over-cards-row">
          {playerBatterPick && (
            <div>
              <div className="reveal-side-label">You batted</div>
              <Card card={playerBatterPick} size="hand" />
            </div>
          )}
          {botBowler && (
            <div>
              <div className="reveal-side-label">They bowled</div>
              <Card card={botBowler} size="hand" />
            </div>
          )}
        </div>

        <div className={`super-over-result-box ${outcome?.type === "wicket" ? "wicket" : runs >= 4 ? "boundary" : ""}`}>
          {outcome?.type === "wicket"
            ? `OUT — 0 runs`
            : outcome?.type === "runs"
              ? `${runs} run${runs === 1 ? "" : "s"}`
              : `${runs} run${runs === 1 ? "" : "s"}`}
        </div>

        <button className="btn primary big" onClick={() => setPhase("pick-bowler")}>
          Now bowl →
        </button>
      </main>
    );
  }

  // ── Phase: player picks their bowler ──────────────────────────────────────
  if (phase === "pick-bowler") {
    return (
      <main className="super-over-screen">
        <div className="super-over-header">
          <h1 className="super-over-title">⚡ SUPER OVER</h1>
          <p className="super-over-subtitle">
            Your bowling — pick one card to bowl at {opponentNation}'s{" "}
            <strong>{botBatter?.name ?? "batter"}</strong>
          </p>
        </div>

        {botBatter && (
          <div className="super-over-opponent-card">
            <div className="reveal-side-label">They bat</div>
            <Card card={botBatter} size="hand" />
          </div>
        )}

        <div className="super-over-pick-label">You bowl — pick one:</div>
        <div className="hand-grid super-over-hand">
          {playerBowlerHand.map((card) => (
            <div key={card.id} className="hand-slot">
              <Card
                card={card}
                size="hand"
                onClick={() => {
                  if (!botBatter) return;
                  const result = resolveBall({
                    batsman: botBatter,
                    bowler: card,
                    battingSituation: null,
                    bowlingSituation: null,
                    phase: "death",
                  });
                  setRoundState((prev) => ({
                    ...prev,
                    playerBowlerPick: card,
                    botBallResult: result,
                    botRuns: runsFromResult(result),
                  }));
                  setPhase("bowler-result");
                }}
              />
            </div>
          ))}
        </div>
        {playerBowlerHand.length === 0 && (
          <p className="hint">No bowling cards — auto-resolving…</p>
        )}
      </main>
    );
  }

  // ── Phase: show bot's batting result (player was bowling) ──────────────────
  if (phase === "bowler-result") {
    const { botRuns, playerBowlerPick, botBallResult } = roundState;
    const runs = botRuns ?? 0;
    const outcome = botBallResult?.finalOutcome;
    return (
      <main className="super-over-screen">
        <div className="super-over-header">
          <h1 className="super-over-title">⚡ SUPER OVER</h1>
          <p className="super-over-subtitle">{opponentNation}'s batting result</p>
        </div>

        <div className="super-over-cards-row">
          {botBatter && (
            <div>
              <div className="reveal-side-label">They batted</div>
              <Card card={botBatter} size="hand" />
            </div>
          )}
          {playerBowlerPick && (
            <div>
              <div className="reveal-side-label">You bowled</div>
              <Card card={playerBowlerPick} size="hand" />
            </div>
          )}
        </div>

        <div className={`super-over-result-box opponent ${outcome?.type === "wicket" ? "wicket" : runs >= 4 ? "boundary" : ""}`}>
          {outcome?.type === "wicket"
            ? `OUT — 0 runs`
            : `${runs} run${runs === 1 ? "" : "s"}`}
        </div>

        <button className="btn primary big" onClick={() => setPhase("round-result")}>
          See result →
        </button>
      </main>
    );
  }

  // ── Phase: round result + winner declaration ───────────────────────────────
  const playerRuns = roundState.playerRuns ?? 0;
  const botRuns = roundState.botRuns ?? 0;

  if (phase === "round-result") {
    const playerWins = playerRuns > botRuns;
    const tied = playerRuns === botRuns;

    return (
      <main className="super-over-screen">
        <div className="super-over-header">
          <h1 className="super-over-title">⚡ SUPER OVER</h1>
          <p className="super-over-subtitle">Round {round} result</p>
        </div>

        <div className="super-over-scoreline">
          <div className="super-over-score-block you">
            <div className="super-over-score-label">You</div>
            <div className="super-over-score-runs">{playerRuns}</div>
          </div>
          <div className="super-over-score-sep">vs</div>
          <div className="super-over-score-block opp">
            <div className="super-over-score-label">{opponentNation}</div>
            <div className="super-over-score-runs">{botRuns}</div>
          </div>
        </div>

        {tied ? (
          <>
            <div className="super-over-verdict tied">Tied again! Another super over…</div>
            <button
              className="btn primary big"
              onClick={() => {
                setRound((r) => r + 1);
                setRoundState({});
                setPhase("pick-batter");
              }}
            >
              Play Round {round + 1} →
            </button>
          </>
        ) : playerWins ? (
          <>
            <div className="super-over-verdict win">🏏 You win the super over!</div>
            <button className="btn primary big" onClick={() => onResult("player")}>
              Continue →
            </button>
          </>
        ) : (
          <>
            <div className="super-over-verdict loss">
              {opponentNation} wins the super over
            </div>
            <button className="btn primary big" onClick={() => onResult("opponent")}>
              Continue →
            </button>
          </>
        )}
      </main>
    );
  }

  return null;
}
