import { useEffect, useState } from "react";
import type { Nation } from "@swipe-sixer/shared";
import {
  abandonRun,
  endRun,
  getCareer,
  startNewRun,
  startWCMatch,
  subscribeCareer,
  type CareerSave,
  type WCRun,
} from "../lib/career.ts";
import { generateLadder } from "../lib/career-pack.ts";
import type { MatchClient } from "../state.ts";
import { DraftScreen } from "./DraftScreen.tsx";
import { DeckManagementScreen } from "./DeckManagementScreen.tsx";

interface Props {
  onBack: () => void;
  /** Match client — used to spin up a WC match against the bot. */
  client: MatchClient;
}

type SubMode = "home" | "draft" | "deck" | "abandon-confirm";

/**
 * Hub for the World Cup career mode. Routes between:
 *   - Welcome / start-new-run (no current run)
 *   - Draft screen (run in "drafting" stage)
 *   - Match prep / ladder view (run in active stage)
 *   - Trophy / loss screen (run complete)
 */
export function CareerHomeScreen({ onBack, client }: Props) {
  const [save, setSave] = useState<CareerSave>(getCareer);
  const [subMode, setSubMode] = useState<SubMode>("home");

  useEffect(() => subscribeCareer(setSave), []);

  const run = save.currentRun;

  // Auto-route into the draft screen if a fresh run is in drafting state.
  useEffect(() => {
    if (run?.stage === "drafting" && subMode === "home") {
      setSubMode("draft");
    }
  }, [run?.stage, subMode]);

  if (subMode === "draft") {
    return <DraftScreen onComplete={() => setSubMode("home")} onCancel={() => {
      abandonRun();
      setSubMode("home");
    }} />;
  }

  if (subMode === "deck") {
    return <DeckManagementScreen onBack={() => setSubMode("home")} />;
  }

  return (
    <main>
      <button className="btn ghost small" onClick={onBack} style={{ marginBottom: "1rem" }}>
        ← Back to menu
      </button>
      <h1>🏆 World Cup</h1>

      {!run && <NoRunView onStart={startRunAndDraft} stats={save} />}

      {run && run.stage === "won" && (
        <WonView run={run} onClaim={() => {
          // Trophy-pack flow happens in Session 3. For now, just end the run.
          endRun();
        }} />
      )}

      {run && run.stage === "lost" && (
        <LostView run={run} onClose={() => endRun()} />
      )}

      {run && (run.stage === "group" || run.stage === "semi" || run.stage === "final") && (
        <ActiveRunView
          run={run}
          onOpenDeck={() => setSubMode("deck")}
          onPlayMatch={() => playNextWCMatch(run)}
          onAbandon={() => setSubMode("abandon-confirm")}
        />
      )}

      {subMode === "abandon-confirm" && (
        <AbandonConfirm
          onConfirm={() => {
            abandonRun();
            setSubMode("home");
          }}
          onCancel={() => setSubMode("home")}
        />
      )}

      <p className="career-stats-footer">
        🏆 {save.permanentCollection.trophies} trophies ·{" "}
        📦 {Object.values(save.permanentCollection.cards).reduce((a, b) => a + b, 0)} cards in stash ·{" "}
        {save.permanentCollection.runsPlayed} runs played
      </p>
    </main>
  );

  function startRunAndDraft(): void {
    const ladder = generateLadder();
    startNewRun("T3", ladder);
    setSubMode("draft");
  }

  /**
   * Kick off the next WC match: spin up a bot match with the player's
   * current deck and the locked-in opponent. The bot will be themed to
   * the opponent's nation; the player's deck comes from their custom
   * RunDeck.
   *
   * After the match runs through InningsScreen and ends, MatchOverView
   * detects the wcMatchInFlight flag, records the result, and routes
   * into pack-opening (Session 3.5, not yet built — for now it falls
   * back to "Back to home" which returns here).
   */
  async function playNextWCMatch(run: WCRun): Promise<void> {
    if (!run.deck) return;
    const opp = run.ladder[run.history.length];
    if (!opp) return;
    startWCMatch();
    await client.createBotMatch(
      "You",
      "YOU",
      opp.difficulty,
      run.format,
      {
        playerDeck: {
          battingDeck: run.deck.battingDeck,
          bowlingDeck: run.deck.bowlingDeck,
        },
        botNation: opp.nation as Nation,
        botName: opp.nation,
      },
    );
  }
}

// ─────────────────────────── Sub-views ───────────────────────────

function NoRunView({ onStart, stats }: { onStart: () => void; stats: CareerSave }) {
  return (
    <div className="career-block">
      <p className="dim-text">
        Draft a deck, beat 5 group-stage nations, advance through the
        semi-final and final. Every match win earns a pack — pick 2 of 6
        cards to swap into your deck. Win the trophy → permanent pack.
      </p>
      <p className="dim-text" style={{ marginTop: "0.5rem" }}>
        Format: <strong>T3 (3 overs)</strong>. ~30 minutes per run.
      </p>
      <button className="btn primary big" onClick={onStart} style={{ marginTop: "1.5rem" }}>
        🎲 Start new World Cup run
      </button>
      {stats.permanentCollection.trophies > 0 && (
        <p className="dim-text" style={{ marginTop: "1rem", fontSize: "0.78rem" }}>
          You've won {stats.permanentCollection.trophies} trophy{stats.permanentCollection.trophies === 1 ? "" : "s"} previously.
        </p>
      )}
    </div>
  );
}

function ActiveRunView({
  run,
  onOpenDeck,
  onPlayMatch,
  onAbandon,
}: {
  run: WCRun;
  onOpenDeck: () => void;
  onPlayMatch: () => void;
  onAbandon: () => void;
}) {
  const played = run.history.length;
  const nextOpp = run.ladder[played];
  const hasDeck = !!run.deck;

  return (
    <div className="career-block">
      <h2 className="career-stage-heading">
        {stageLabel(run.stage)} · {run.groupWins} group win{run.groupWins === 1 ? "" : "s"}
      </h2>

      <Ladder ladder={run.ladder} history={run.history} />

      {nextOpp && hasDeck && (
        <div className="career-next-match">
          <div className="career-next-headline">
            Next: <strong>{nextOpp.nation}</strong> ({nextOpp.difficulty}) — {nextOpp.stageLabel.toUpperCase()}
          </div>
          <div className="career-action-row">
            <button className="btn ghost" onClick={onOpenDeck}>
              📋 Manage Deck
            </button>
            <button className="btn primary big" onClick={onPlayMatch}>
              ▶ Play match
            </button>
          </div>
        </div>
      )}

      <button
        className="btn ghost small"
        onClick={onAbandon}
        style={{ marginTop: "1.5rem" }}
      >
        Abandon run
      </button>
    </div>
  );
}

function WonView({ run, onClaim }: { run: WCRun; onClaim: () => void }) {
  void run;
  return (
    <div className="career-block career-won">
      <div className="career-trophy-emoji">🏆</div>
      <h2>World Cup Champion!</h2>
      <p>
        You've conquered the tournament. Open your <strong>Trophy pack</strong> to
        add cards to your permanent collection.
      </p>
      <button className="btn primary big" onClick={onClaim}>
        Open Trophy pack
      </button>
    </div>
  );
}

function LostView({ run, onClose }: { run: WCRun; onClose: () => void }) {
  const lastMatch = run.history[run.history.length - 1];
  return (
    <div className="career-block career-lost">
      <h2>🛑 Run Ended</h2>
      {lastMatch && (
        <p>
          Lost to <strong>{lastMatch.opponent.nation}</strong> in the{" "}
          {lastMatch.opponent.stageLabel}.
        </p>
      )}
      <p className="dim-text">
        Won {run.history.filter((h) => h.result === "win").length} match
        {run.history.filter((h) => h.result === "win").length === 1 ? "" : "es"}.
        Run inventory discarded — your permanent collection is unchanged.
      </p>
      <button className="btn primary" onClick={onClose}>
        Back to home
      </button>
    </div>
  );
}

function Ladder({
  ladder,
  history,
}: {
  ladder: WCRun["ladder"];
  history: WCRun["history"];
}) {
  // Knockout opponents (semi + final) stay HIDDEN until the player reaches
  // that stage — otherwise the user knows exactly which nation is waiting
  // at the end of their run, killing the tournament suspense. Group-stage
  // opponents stay visible so the player can plan their group strategy.
  return (
    <ol className="career-ladder">
      {ladder.map((opp, i) => {
        const played = i < history.length;
        const result = played ? history[i]!.result : null;
        const isUnreachedKnockout =
          !played &&
          i > history.length &&
          (opp.stageLabel === "semi" || opp.stageLabel === "final");
        const cls = isUnreachedKnockout
          ? "hidden"
          : result === "win"
            ? "win"
            : result === "loss"
              ? "loss"
              : played
                ? "tied"
                : i === history.length
                  ? "next"
                  : "pending";
        return (
          <li key={i} className={`career-ladder-item ${cls}`}>
            <span className="career-ladder-stage">{stageBadge(opp.stageLabel)}</span>
            <span className="career-ladder-nation">
              {isUnreachedKnockout ? "???" : opp.nation}
            </span>
            <span className="career-ladder-diff dim-text">
              {isUnreachedKnockout ? "—" : opp.difficulty}
            </span>
            {result && <span className={`career-ladder-result ${result}`}>{result === "win" ? "WON" : result === "loss" ? "LOST" : "TIE"}</span>}
            {!result && i === history.length && <span className="career-ladder-result next">NEXT</span>}
          </li>
        );
      })}
    </ol>
  );
}

function AbandonConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Abandon this run?</h2>
        <p>
          You'll lose your current deck and run inventory. Trophies earned
          previously are unaffected. This can't be undone.
        </p>
        <div className="form-actions">
          <button className="btn ghost" onClick={onCancel}>
            Stay in the run
          </button>
          <button className="btn danger" onClick={onConfirm}>
            Abandon
          </button>
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage: WCRun["stage"]): string {
  switch (stage) {
    case "drafting": return "Drafting";
    case "group": return "Group Stage";
    case "semi": return "Semi-Final";
    case "final": return "Final";
    case "won": return "Champion!";
    case "lost": return "Eliminated";
    case "abandoned": return "Abandoned";
  }
}

function stageBadge(label: "group" | "semi" | "final"): string {
  return label === "group" ? "G" : label === "semi" ? "SF" : "F";
}
