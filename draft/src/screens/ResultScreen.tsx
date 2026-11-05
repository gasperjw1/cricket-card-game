import { useEffect, useMemo, useState } from "react";
import type { EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import { CoverPage, FinalPage, MatchPage, type Fixtured } from "../components/Gazette.tsx";
import { MatchCard } from "../components/MatchCard.tsx";
import { MatchView } from "../components/MatchView.tsx";
import { PlayerRatings } from "../components/PlayerRatings.tsx";
import { MatchScorecard, tieBreakLabel } from "../components/Scorecard.tsx";
import { writePaper } from "../game/paper.ts";
import type { MatchPlan } from "../game/simulate.ts";
import type { Captaincy } from "../game/captain.ts";
import { journeyFor, residuals, souvenirLists, totalsKey } from "../game/souvenir.ts";
import { encodeRun, performance, runFrom } from "../game/score.ts";
import { usePicksFit } from "../game/fit-load.ts";
import { batInSlot, slotWeights } from "../game/slots.ts";
import { squadRatingHere } from "../game/rules.ts";
import { useExpectations } from "../game/souvenir-load.ts";
import { teamLabel } from "../lib/names.ts";
import type { RecordsOut } from "../../../wcdraft/src/analysis/records.ts";
import { verdictFor } from "../game/gazette.ts";
import type { SimulateInput } from "../game/simulate.ts";
import { datedStages, exitStageOf, inPlayOrder, stageIdOf, tournamentTotals } from "../game/stats.ts";
import { BUDGET, type PoolPlayer, type RunState } from "../game/types.ts";

type Auto = "read" | "fast";

const AUTO_MS: Record<Auto, number> = { read: 6500, fast: 2400 };
const TURN_MS = 700;

/** A match with its full scorecard, super over or bowl-out included, folded underneath. */
function Played({ f, me, venues, highlight }: { f: Fixtured; me: string; venues: VenueOut[]; highlight: Set<string> }) {
  const decider = f.tieBreak ? tieBreakLabel(f.tieBreak) : null;
  return (
    <MatchCard fixture={f} me={me} stageLabel={f.stageLabel} venues={venues} highlight={highlight}>
      {f.innings && (
        <details className="sc-details">
          <summary>Full scorecard{decider ? ` and ${decider.toLowerCase()}` : ""}</summary>
          <MatchScorecard innings={f.innings} highlight={highlight} me={me} tieBreak={f.tieBreak} />
        </details>
      )}
    </MatchCard>
  );
}

export function ResultScreen({ state, result: played, editions, venues, records, captaincy, onReplan, onAgain }: { state: RunState; result: TournamentResult; editions: EditionOut[]; venues: VenueOut[]; records: RecordsOut; captaincy: Captaincy; onReplan: (index: number, plan: MatchPlan) => void; onAgain: () => void }) {
  const me = state.identity!.team;
  const edition = editions.find((e) => e.id === played.editionId);
  const result = useMemo(() => ({ ...played, stages: datedStages(played.stages, edition?.lastMatch ?? null) }), [played, edition]);
  const id = result.identity!;
  const highlight = useMemo(() => new Set(state.picks.filter(Boolean).map((p) => p!.id)), [state.picks]);
  // Each man's numbers in this World Cup at his slot under the coach, as the draft and the lineup showed them.
  const pickFits = usePicksFit(state.picks, played.editionId, state.coach, editions);
  const numbersHere = useMemo(() => state.picks.map((p, i) => (p ? {
    bat: pickFits?.get(p.id)?.atSlot[i] ?? (p.batShown ? batInSlot(p, slotWeights(editions, played.editionId, i + 1)) : null),
    bowl: pickFits?.get(p.id)?.bowling?.final ?? null,
  } : null)), [state.picks, pickFits, editions, played.editionId]);
  // The squad rating from those same numbers, once they are in (the card rating until then).
  const ratingHere = pickFits ? squadRatingHere(numbersHere) : null;
  const all = useMemo<Fixtured[]>(() => result.stages.flatMap((s) => inPlayOrder(s.fixtures).map((f) => ({ ...f, stageLabel: s.label }))), [result]);
  const mine = useMemo(() => all.filter((f) => f.teams.includes(me)), [all, me]);
  const totals = useMemo(() => tournamentTotals(all), [all]);
  // The whole paper is written once: facts and records for every match, the side's issues with stop press and late news.
  const paper = useMemo(() => writePaper(all, mine, me, result.seed, result.editionId, edition?.environment.runsPerOver ?? 7.5, new Set(result.stages.filter((s) => !s.groups).map((s) => s.id)), records[result.editionId], result.stages[result.stages.length - 1]?.id ?? null), [all, mine, me, result, edition, records]);
  const ratingsInput = useMemo<SimulateInput>(
    () => ({ seed: state.seed, identity: state.identity!, picks: state.picks.filter(Boolean) as PoolPlayer[], coach: state.coach, captainId: state.captainId }),
    [state.seed, state.identity, state.picks, state.coach, state.captainId],
  );

  // The souvenir issue: every player against his card's expectation (loaded), and the eleven's journey (pure).
  const expectations = useExpectations(ratingsInput, editions);
  const souvenir = useMemo(() => (expectations ? souvenirLists(residuals(totals, expectations, new Set(state.picks.filter(Boolean).map((p) => totalsKey(me, p!.id))))) : null), [expectations, totals, state.picks, me]);
  const journeys = useMemo(() => journeyFor(mine, me, state.picks.filter(Boolean).map((p) => ({ id: p!.id, name: p!.name }))), [mine, me, state.picks]);

  // The paper: page 0 is the squad announcement, then one page per match, then the final edition.
  const lastPage = mine.length + 1;
  const [page, setPage] = useState(0);
  const [leaf, setLeaf] = useState<{ page: number; back: boolean } | null>(null);
  const [auto, setAuto] = useState<Auto | null>(null);
  const [watching, setWatching] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // The result text to copy by hand when the browser refuses the clipboard.
  const [manualShare, setManualShare] = useState<string | null>(null);

  const turnTo = (next: number) => {
    if (next === page || next < 0 || next > lastPage) return;
    setLeaf({ page, back: next < page });
    setPage(next);
    window.scrollTo(0, 0);
  };

  useEffect(() => { if (page === lastPage) setAuto(null); }, [page, lastPage]);
  useEffect(() => {
    if (!leaf) return;
    const t = setTimeout(() => setLeaf(null), TURN_MS);
    return () => clearTimeout(t);
  }, [leaf]);
  useEffect(() => {
    if (!auto || watching !== null || page >= lastPage) return;
    const t = setTimeout(() => turnTo(page + 1), AUTO_MS[auto]);
    return () => clearTimeout(t);
  });

  const nextMatch = page < mine.length ? mine[page] : undefined;
  // The run as a number and as a link that replays it exactly.
  const perf = useMemo(() => performance(result, mine, me), [result, mine, me]);
  const shareUrl = useMemo(() => {
    if (!state.identity) return "";
    const url = new URL(window.location.href);
    url.search = `?run=${encodeRun(runFrom(state.seed, state.identity, state.coach, state.picks.filter(Boolean) as PoolPlayer[], state.captainId, state.plans, BUDGET.lineupMoves - state.movesLeft))}`;
    return url.toString();
  }, [state.seed, state.identity, state.coach, state.picks, state.captainId, state.plans, state.movesLeft]);
  const copyResult = () => {
    const v = verdictFor(id, me, result.stages.length, exitStageOf(result.stages, mine));
    const text = `World Cup Draft: ${teamLabel(me)} at the ${result.editionId} World Cup. ${id.won}–${id.lost}, ${id.champion ? "champions" : id.exit}. Grade ${v.grade}, performance ${perf.score}. Replay it: ${shareUrl}`;
    if (!navigator.clipboard) { setManualShare(text); return; }
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setManualShare(null); }, () => setManualShare(text));
  };

  // The souvenir issue's Journey and Results sections.
  const knockouts = all.filter((f) => result.stages.some((s) => s.id === stageIdOf(f) && !s.groups));
  const ratingsView = <PlayerRatings input={ratingsInput} editions={editions} lines={totals} journeys={journeys} />;
  const resultsView = (
    <>
      <section className="gz-box">
        <h4>{teamLabel(me)}'s matches</h4>
        <p className="gz-note">Seed <code>{result.seed}</code></p>
        {mine.map((f) => <Played key={`${f.stageId}-${f.teams.join()}`} f={f} me={me} venues={venues} highlight={highlight} />)}
      </section>
      {result.stages.filter((s) => s.groups).map((s) => (
        <section className="gz-box" key={s.id}>
          <h4>{s.label}</h4>
          <div className="standings-grid">
            {Object.entries(s.groups!).map(([g, rows]) => (
              <table className="standings" key={g}>
                <caption>Group {g}</caption>
                <thead><tr><th className="pos">#</th><th className="team">Team</th><th>P</th><th>W</th><th>L</th><th>NR</th><th>Pts</th><th className="nrr">NRR</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.team} className={r.team === me ? "me" : ""}>
                      <td className="pos">{i + 1}</td>
                      <td className="team">{teamLabel(r.team)}</td>
                      <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.noResult}</td>
                      <td className="pts">{r.points}</td>
                      <td className="nrr">{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      ))}
      {knockouts.length > 0 && (
        <section className="gz-box">
          <h4>Knockouts</h4>
          {knockouts.map((f) => <Played key={`${f.stageId}-${f.teams.join()}`} f={f} me={me} venues={venues} highlight={highlight} />)}
        </section>
      )}
    </>
  );

  const renderPage = (p: number) => {
    if (p === 0) return <CoverPage state={state} result={result} edition={edition} venues={venues} mine={mine} numbersHere={numbersHere} ratingHere={ratingHere} coachName={state.coach?.coachName ?? null} matchDay={mine[0] ? paper.matchDays.get(mine[0].date ?? "") ?? null : null} />;
    if (p === lastPage) return <FinalPage result={result} all={all} mine={mine} me={me} highlight={highlight} paper={paper} souvenir={souvenir} journeys={journeys} performance={perf} date={mine[mine.length - 1]?.date ?? null} manualShare={manualShare} ratings={ratingsView} results={resultsView} />;
    return <MatchPage fixture={mine[p - 1]!} index={p - 1} mine={mine} all={all} result={result} me={me} venues={venues} highlight={highlight} issue={p + 1} paper={paper} last={p === mine.length} seed={result.seed} lever={{ picks: state.picks.filter(Boolean) as PoolPlayer[], captaincy, coach: state.coach, captainId: state.captainId, plans: state.plans, movesLeft: state.movesLeft, onReplan }} />;
  };

  if (watching !== null && mine[watching]) {
    return <MatchView fixture={mine[watching]!} onDone={() => { setWatching(null); turnTo(watching + 1); }} />;
  }

  return (
    <section className="result">
      <div className="gz-stage">
        {leaf && <div className={`gz-leaf turning ${leaf.back ? "back" : ""}`} aria-hidden="true">{renderPage(leaf.page)}</div>}
        <div className="gz-leaf" key={page}>{renderPage(page)}</div>
      </div>
      <nav className="gz-controls" aria-label="Newspaper pages">
        <button type="button" disabled={page === 0} onClick={() => { setAuto(null); turnTo(page - 1); }}>Previous issue</button>
        {nextMatch?.balls?.length ? <button type="button" onClick={() => { setAuto(null); setWatching(page); }}>Watch next match</button> : null}
        {page < lastPage && <button type="button" className="gz-go" onClick={() => { setAuto(null); turnTo(page + 1); }}>{page + 1 === lastPage ? "Souvenir issue" : "Next issue"}</button>}
        {page < lastPage && <button type="button" className={auto === "read" ? "on" : ""} onClick={() => setAuto(auto === "read" ? null : "read")}>{auto === "read" ? "Pause" : "Auto-sim"}</button>}
        {page < lastPage && <button type="button" className={auto === "fast" ? "on" : ""} onClick={() => setAuto(auto === "fast" ? null : "fast")}>Fast</button>}
        {page < lastPage && <button type="button" onClick={() => { setAuto(null); turnTo(lastPage); }}>Skip to the end</button>}
        {/* The run's two actions sit in the bar on the souvenir issue (2026-11-03: they were halfway down the paper's side column). */}
        {page === lastPage && <button type="button" onClick={copyResult}>{copied ? "Copied" : "Copy result"}</button>}
        {page === lastPage && <button type="button" className="gz-go" onClick={onAgain}>Draft again</button>}
      </nav>
    </section>
  );
}
