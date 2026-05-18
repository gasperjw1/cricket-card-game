import { useEffect, useState } from "react";
import type { AnyCard, Nation } from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import {
  DIFFICULTY_BLURB,
  DIFFICULTY_LABEL,
  TOURNAMENT_FORMATS,
  abandonRun,
  endRun,
  getCareer,
  startNewRun,
  startWCMatch,
  subscribeCareer,
  type CareerSave,
  type DifficultyMode,
  type TournamentFormat,
  type WCRun,
} from "../lib/career.ts";
import { generateLadder } from "../lib/career-pack.ts";
import { NewspaperRunSummary } from "./NewspaperRunSummary.tsx";
import { PreMatchOverlay } from "./PreMatchOverlay.tsx";
import type { MatchClient } from "../state.ts";
import { DraftScreen } from "./DraftScreen.tsx";
import { DeckManagementScreen } from "./DeckManagementScreen.tsx";

interface Props {
  onBack: () => void;
  /** Match client — used to spin up a WC match against the bot. */
  client: MatchClient;
}

type SubMode = "home" | "draft" | "deck" | "abandon-confirm" | "collection" | "stats";

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
  /** True while the pre-match "vs" overlay is showing — between
   *  "Play match" tap and the actual match-create call. */
  const [showPreMatch, setShowPreMatch] = useState(false);

  useEffect(() => subscribeCareer(setSave), []);

  const run = save.currentRun;

  // Auto-route into the draft screen if a fresh run is in drafting state.
  useEffect(() => {
    if (run?.stage === "drafting" && subMode === "home") {
      setSubMode("draft");
    }
  }, [run?.stage, subMode]);

  if (showPreMatch && run) {
    const opp = run.ladder[run.history.length];
    if (opp) {
      return (
        <PreMatchOverlay
          run={run}
          opponent={opp}
          onStart={() => void startMatchAfterOverlay()}
        />
      );
    }
  }

  if (subMode === "draft") {
    return (
      <DraftScreen
        onComplete={() => setSubMode("home")}
        // Abandoning the draft kills the run — route through the
        // confirmation modal so the user can't lose progress with one
        // tap. (Previously: silent abandonRun on Back.)
        onCancel={() => setSubMode("abandon-confirm")}
      />
    );
  }

  if (subMode === "deck") {
    return <DeckManagementScreen onBack={() => setSubMode("home")} />;
  }

  return (
    <main>
      <button className="btn ghost small" onClick={onBack} style={{ marginBottom: "1rem" }}>
        ← Back to menu
      </button>
      {/* Tournament-themed header. Shows the player which cup they're in
          (or "Career mode" before a run starts) and color-codes the
          accent across the hub. */}
      {run ? (
        <header
          className="career-hub-header"
          style={{
            background: TOURNAMENT_FORMATS[run.tournament].headerGradient,
            borderColor: TOURNAMENT_FORMATS[run.tournament].accentColor,
          }}
        >
          <span className="career-hub-emblem">{TOURNAMENT_FORMATS[run.tournament].emblem}</span>
          <h1 className="career-hub-title">
            {TOURNAMENT_FORMATS[run.tournament].shortName}
          </h1>
          <span className="career-hub-difficulty">{DIFFICULTY_LABEL[run.difficulty]}</span>
        </header>
      ) : (
        <h1>🏆 Career Mode</h1>
      )}

      {!run && <NoRunView onStart={startRunAndDraft} stats={save} />}
      {subMode === "stats" && (
        <CareerStatsModal save={save} onClose={() => setSubMode("home")} />
      )}

      {run && run.stage === "won" && (
        <NewspaperRunSummary
          run={run}
          onClose={() => {
            // Trophy pack was already opened by WCMatchOverFlow; just
            // clean up the run state and route back to the MAIN home
            // menu (not the career hub's "Start new run" state, which
            // felt like the page was resetting to invite a new run
            // unexpectedly).
            endRun();
            onBack();
          }}
        />
      )}

      {run && run.stage === "lost" && (
        <LostView
          run={run}
          onClose={() => {
            endRun();
            onBack();
          }}
        />
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
          context={run?.stage === "drafting" ? "drafting" : "active"}
          onConfirm={() => {
            abandonRun();
            setSubMode("home");
          }}
          onCancel={() => setSubMode("home")}
        />
      )}

      <div className="career-stats-footer">
        <p>
          🏆 {save.permanentCollection.trophies} trophies ·{" "}
          📦 {Object.values(save.permanentCollection.cards).reduce((a, b) => a + b, 0)} cards in stash ·{" "}
          {save.permanentCollection.runsPlayed} runs played
        </p>
        <div className="career-stats-footer-actions">
          {Object.keys(save.permanentCollection.cards).length > 0 && (
            <button
              className="btn ghost small"
              onClick={() => setSubMode("collection")}
            >
              View stash →
            </button>
          )}
          <button
            className="btn ghost small"
            onClick={() => setSubMode("stats")}
          >
            📊 Career stats
          </button>
        </div>
      </div>

      {subMode === "collection" && (
        <CollectionModal
          collection={save.permanentCollection}
          onClose={() => setSubMode("home")}
        />
      )}
    </main>
  );

  function startRunAndDraft(
    tournament: TournamentFormat,
    difficulty: DifficultyMode,
  ): void {
    const ladder = generateLadder(tournament, difficulty);
    startNewRun("T3", tournament, difficulty, ladder);
    setSubMode("draft");
  }

  /**
   * Kick off the next WC match: spin up a bot match with the player's
   * current deck and the locked-in opponent. The bot will be themed to
   * the opponent's nation; the player's deck comes from their custom
   * RunDeck.
   *
   * After the match runs through InningsScreen and ends, MatchOverView
   * detects the wcMatchInFlight flag and routes into WCMatchOverFlow,
   * which records the result on the ladder, opens the appropriate pack,
   * and routes back here on completion.
   */
  /** Show the pre-match "vs" overlay. Actual match creation kicks off
   *  when the overlay finishes (tap-to-skip or auto-timeout). */
  function playNextWCMatch(run: WCRun): void {
    if (!run.deck) return;
    const opp = run.ladder[run.history.length];
    if (!opp) return;
    setShowPreMatch(true);
  }

  /** Called from PreMatchOverlay when the player taps to start or the
   *  auto-timer fires. Spins up the bot match. */
  async function startMatchAfterOverlay(): Promise<void> {
    if (!run?.deck) return;
    const opp = run.ladder[run.history.length];
    if (!opp) return;
    setShowPreMatch(false);
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

function NoRunView({
  onStart,
  stats,
}: {
  onStart: (tournament: TournamentFormat, difficulty: DifficultyMode) => void;
  stats: CareerSave;
}) {
  const [tournament, setTournament] = useState<TournamentFormat>("world-cup");
  const [difficulty, setDifficulty] = useState<DifficultyMode>("realistic");

  return (
    <div className="career-block">
      <p className="dim-text">
        Pick a tournament + difficulty, then draft a deck. Every match
        win earns a 6-card pack (pick 2 to add to your run inventory).
        Win the trophy to add cards to your permanent collection.
      </p>

      <fieldset className="career-picker">
        <legend>Tournament</legend>
        {(Object.keys(TOURNAMENT_FORMATS) as TournamentFormat[]).map((t) => {
          const cfg = TOURNAMENT_FORMATS[t];
          const wins = stats.stats.trophiesByTournament[t];
          return (
            <label key={t} className={tournament === t ? "selected" : ""}>
              <input
                type="radio"
                name="tournament"
                value={t}
                checked={tournament === t}
                onChange={() => setTournament(t)}
              />
              <strong>{cfg.label}</strong>
              <small className="dim-text">{cfg.blurb}</small>
              {wins > 0 && (
                <span className="career-picker-badge">
                  {wins} won
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      <fieldset className="career-picker">
        <legend>Difficulty</legend>
        {(["casual", "realistic", "legend"] as DifficultyMode[]).map((d) => {
          const wins = stats.stats.trophiesByDifficulty[d];
          return (
            <label key={d} className={difficulty === d ? "selected" : ""}>
              <input
                type="radio"
                name="difficulty"
                value={d}
                checked={difficulty === d}
                onChange={() => setDifficulty(d)}
              />
              <strong>{DIFFICULTY_LABEL[d]}</strong>
              <small className="dim-text">{DIFFICULTY_BLURB[d]}</small>
              {wins > 0 && (
                <span className="career-picker-badge">
                  {wins} won
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      <button
        className="btn primary big"
        onClick={() => onStart(tournament, difficulty)}
        style={{ marginTop: "1rem", width: "100%" }}
      >
        🎲 Start {TOURNAMENT_FORMATS[tournament].label.replace(/^[^\s]+ /, "")} ({DIFFICULTY_LABEL[difficulty]})
      </button>
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

function LostView({ run, onClose }: { run: WCRun; onClose: () => void }) {
  const lastMatch = run.history[run.history.length - 1];
  const wins = run.history.filter((h) => h.result === "win").length;
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
        Won {wins} match{wins === 1 ? "" : "es"}.
        Run inventory discarded — your permanent collection is unchanged.
      </p>
      <RunRecapList history={run.history} />
      <button className="btn primary" onClick={onClose} style={{ marginTop: "1rem" }}>
        Back to home
      </button>
    </div>
  );
}

/** Compact per-match recap shown on the lost / won screens. Same shape
 *  as the ladder row but only renders played matches, with the result
 *  prominent. Gives the player a sense of "how far did I get + who beat
 *  me where" without re-opening the ladder. */
function RunRecapList({ history }: { history: WCRun["history"] }) {
  if (history.length === 0) return null;
  return (
    <ol className="career-ladder run-recap" style={{ marginTop: "1rem" }}>
      {history.map((h, i) => (
        <li key={i} className={`career-ladder-item ${h.result}`}>
          <span className="career-ladder-stage">{stageBadge(h.opponent.stageLabel)}</span>
          <span className="career-ladder-nation">{h.opponent.nation}</span>
          <span className="career-ladder-diff dim-text">{h.opponent.difficulty}</span>
          <span className={`career-ladder-result ${h.result}`}>
            {h.result === "win" ? "WON" : h.result === "loss" ? "LOST" : "TIE"}
          </span>
        </li>
      ))}
    </ol>
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
        // Knockout opponents stay hidden as "???" until reached so the
        // user doesn't see who's waiting at semi/final.
        const isUnreachedKnockout =
          !played &&
          i > history.length &&
          opp.stageLabel !== "group";
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
        // Per v5: difficulty (Gully / Domestic / International) is hidden
        // from the in-run ladder. The user picked their difficulty mode
        // at run-start; surfacing per-match tier would just spoil the
        // pressure curve. Stays in the data for the bot config, just
        // not shown.
        return (
          <li key={i} className={`career-ladder-item ${cls}`}>
            <span className="career-ladder-stage">{stageBadge(opp.stageLabel)}</span>
            <span className="career-ladder-nation">
              {isUnreachedKnockout ? "???" : opp.nation}
            </span>
            {result && <span className={`career-ladder-result ${result}`}>{result === "win" ? "WON" : result === "loss" ? "LOST" : "TIE"}</span>}
            {!result && i === history.length && <span className="career-ladder-result next">NEXT</span>}
          </li>
        );
      })}
    </ol>
  );
}

function AbandonConfirm({
  context,
  onConfirm,
  onCancel,
}: {
  /** Drives the message: "Abandon draft?" vs "Abandon run?". */
  context: "drafting" | "active";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const draftMode = context === "drafting";
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{draftMode ? "Abandon this draft?" : "Abandon this run?"}</h2>
        <p>
          {draftMode
            ? "You'll lose your draft progress and have to start a new World Cup from scratch."
            : "You'll lose your current deck and run inventory."}{" "}
          Trophies earned previously are unaffected. This can't be undone.
        </p>
        <div className="form-actions">
          <button className="btn ghost" onClick={onCancel}>
            {draftMode ? "Back to draft" : "Stay in the run"}
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
    case "qf": return "Quarter-Final";
    case "semi": return "Semi-Final";
    case "final": return "Final";
    case "won": return "Champion!";
    case "lost": return "Eliminated";
    case "abandoned": return "Abandoned";
  }
}

function stageBadge(label: import("../lib/career.ts").StageLabel): string {
  switch (label) {
    case "group": return "G";
    case "qf": return "QF";
    case "semi": return "SF";
    case "final": return "F";
  }
}

/** Read-only modal showing the player's permanent collection. Cards are
 *  resolved from ids + grouped by tier; duplicates show a small count
 *  badge. v1 has no filter/sort UI — just a scrollable grid grouped
 *  Elite → Gold → Silver → Bronze → Situations. */
function CollectionModal({
  collection,
  onClose,
}: {
  collection: import("../lib/career.ts").PermanentCollection;
  onClose: () => void;
}) {
  // Resolve card ids to full cards. Counts the duplicates so a 3x DRS
  // Review shows once with a "×3" badge instead of three slots.
  const entries: { card: AnyCard; count: number }[] = [];
  for (const [id, count] of Object.entries(collection.cards)) {
    const card = resolvePermCard(id);
    if (card) entries.push({ card, count });
  }

  // Group by category: situations last, players by tier (Elite → Bronze).
  const tierOrder: Record<string, number> = { Elite: 0, Gold: 1, Silver: 2, Bronze: 3 };
  const players = entries.filter(
    (e): e is { card: Exclude<AnyCard, { kind: "situation" }>; count: number } =>
      e.card.kind !== "situation",
  );
  players.sort((a, b) => {
    const ta = tierOrder[a.card.tier] ?? 99;
    const tb = tierOrder[b.card.tier] ?? 99;
    if (ta !== tb) return ta - tb;
    return a.card.name.localeCompare(b.card.name);
  });
  const situations = entries.filter((e) => e.card.kind === "situation");
  situations.sort((a, b) => a.card.name.localeCompare(b.card.name));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content collection-modal" onClick={(e) => e.stopPropagation()}>
        <header className="collection-modal-header">
          <h2>📦 Your stash</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <p className="dim-text">
          {entries.length === 0
            ? "Empty. Win a World Cup trophy to earn cards for your permanent collection."
            : `${entries.reduce((a, e) => a + e.count, 0)} cards across ${entries.length} unique entries. Earned from ${collection.trophies} trophy${collection.trophies === 1 ? "" : "s"}.`}
        </p>

        {players.length > 0 && (
          <>
            <h3 className="collection-section-head">Players</h3>
            <ul className="collection-list">
              {players.map(({ card, count }) => (
                <li key={card.id} className="collection-row">
                  <span className={`tier-pill tier-${card.tier.toLowerCase()}`}>
                    {card.tier}
                  </span>
                  <span className="collection-name">{card.name}</span>
                  <span className="collection-nation dim-text">{card.nation}</span>
                  {count > 1 && <span className="collection-count">×{count}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {situations.length > 0 && (
          <>
            <h3 className="collection-section-head">Situation cards</h3>
            <ul className="collection-list">
              {situations.map(({ card, count }) => (
                <li key={card.id} className="collection-row">
                  <span className="tier-pill tier-situation">SIT</span>
                  <span className="collection-name">{card.name}</span>
                  {count > 1 && <span className="collection-count">×{count}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="form-actions" style={{ marginTop: "1rem" }}>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function resolvePermCard(id: string): AnyCard | null {
  const all: AnyCard[] = [
    ...CARDS.batsmen,
    ...CARDS.bowlers,
    ...CARDS.situations,
  ];
  return all.find((c) => c.id === id) ?? null;
}

/** Lifetime career stats modal — totals, win rate, per-tournament +
 *  per-difficulty trophy counts, longest streak. */
function CareerStatsModal({
  save,
  onClose,
}: {
  save: CareerSave;
  onClose: () => void;
}) {
  const s = save.stats;
  const totalTrophies = save.permanentCollection.trophies;
  const winRate =
    s.matchesPlayed > 0
      ? `${Math.round((s.matchesWon / s.matchesPlayed) * 100)}%`
      : "—";

  const tournamentRows = (Object.keys(TOURNAMENT_FORMATS) as TournamentFormat[]).map(
    (t) => ({
      label: TOURNAMENT_FORMATS[t].label,
      wins: s.trophiesByTournament[t],
    }),
  );
  const difficultyRows = (["legend", "realistic", "casual"] as DifficultyMode[]).map(
    (d) => ({
      label: DIFFICULTY_LABEL[d],
      wins: s.trophiesByDifficulty[d],
    }),
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content collection-modal" onClick={(e) => e.stopPropagation()}>
        <header className="collection-modal-header">
          <h2>📊 Career stats</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="career-stats-grid">
          <StatCard label="Trophies" value={totalTrophies} />
          <StatCard label="Matches played" value={s.matchesPlayed} />
          <StatCard label="Win rate" value={winRate} />
          <StatCard label="Longest win streak" value={s.longestWinStreak} />
          <StatCard label="Current streak" value={s.currentWinStreak} />
          <StatCard label="Runs abandoned" value={s.runsAbandoned} />
        </div>

        <h3 className="collection-section-head">Trophies by tournament</h3>
        <ul className="collection-list">
          {tournamentRows.map((row) => (
            <li key={row.label} className="collection-row">
              <span className="collection-name">{row.label}</span>
              <span className="collection-count">{row.wins}</span>
            </li>
          ))}
        </ul>

        <h3 className="collection-section-head">Trophies by difficulty</h3>
        <ul className="collection-list">
          {difficultyRows.map((row) => (
            <li key={row.label} className="collection-row">
              <span className="collection-name">{row.label}</span>
              <span className="collection-count">{row.wins}</span>
            </li>
          ))}
        </ul>

        <div className="form-actions" style={{ marginTop: "1rem" }}>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="career-stat-card">
      <div className="career-stat-value">{value}</div>
      <div className="career-stat-label">{label}</div>
    </div>
  );
}
