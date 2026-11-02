import { useEffect, useMemo, useState } from "react";
import type { EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import { CoverPage, FinalPage, MatchPage, type Fixtured } from "../components/Gazette.tsx";
import { MatchCard } from "../components/MatchCard.tsx";
import { MatchView } from "../components/MatchView.tsx";
import { PlayerRatings } from "../components/PlayerRatings.tsx";
import { MatchScorecard } from "../components/Scorecard.tsx";
import { writePaper } from "../game/paper.ts";
import { verdictFor } from "../game/gazette.ts";
import type { SimulateInput } from "../game/simulate.ts";
import { datedStages, exitStageOf, inPlayOrder, tournamentTotals, type PlayerTotals } from "../game/stats.ts";
import type { PoolPlayer, RunState } from "../game/types.ts";

type Tab = "matches" | "ratings" | "stats" | "tables" | "knockouts";
type Auto = "read" | "fast";

const AUTO_MS: Record<Auto, number> = { read: 6500, fast: 2400 };
const TURN_MS = 700;

type Ranked = PlayerTotals & { me: boolean };

function Leaders({ title, rows, cols }: { title: string; rows: Ranked[]; cols: { label: string; value: (t: PlayerTotals) => string | number }[] }) {
  if (!rows.length) return null;
  return (
    <table className="table leaders">
      <thead><tr><th>{title}</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((t, i) => <tr key={`${t.team}${t.id}`} className={t.me ? "me" : ""}><td><span className="rank">{i + 1}</span> {t.name} <span className="small">{t.team}</span></td>{cols.map((c) => <td key={c.label}>{c.value(t)}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function ResultScreen({ state, result: played, editions, venues, onAgain }: { state: RunState; result: TournamentResult; editions: EditionOut[]; venues: VenueOut[]; onAgain: () => void }) {
  const [tab, setTab] = useState<Tab>("matches");
  const me = state.identity!.team;
  const edition = editions.find((e) => e.id === played.editionId);
  const result = useMemo(() => ({ ...played, stages: datedStages(played.stages, edition?.lastMatch ?? null) }), [played, edition]);
  const id = result.identity!;
  const highlight = useMemo(() => new Set(state.picks.filter(Boolean).map((p) => p!.id)), [state.picks]);
  const all = useMemo<Fixtured[]>(() => result.stages.flatMap((s) => inPlayOrder(s.fixtures).map((f) => ({ ...f, stageLabel: s.label }))), [result]);
  const mine = useMemo(() => all.filter((f) => f.teams.includes(me)), [all, me]);
  const totals = useMemo(() => tournamentTotals(all), [all]);
  // The whole paper is written once: facts and records for every match, the side's issues with stop press and late news.
  const paper = useMemo(() => writePaper(all, mine, me, result.seed, result.editionId, edition?.environment.runsPerOver ?? 7.5, new Set(result.stages.filter((s) => !s.groups).map((s) => s.id))), [all, mine, me, result, edition]);
  const ranked: Ranked[] = [...totals.values()].map((t) => ({ ...t, me: t.team === me && highlight.has(t.id) }));
  const top = (key: (t: Ranked) => number, tie: (t: Ranked) => number, filter: (t: Ranked) => boolean = () => true, n = 10) =>
    ranked.filter(filter).filter((t) => key(t) > 0).sort((a, b) => key(b) - key(a) || tie(a) - tie(b)).slice(0, n);
  const sr = (t: PlayerTotals) => (t.balls ? ((100 * t.runs) / t.balls).toFixed(1) : "–");
  const avg = (t: PlayerTotals) => (t.outs ? (t.runs / t.outs).toFixed(1) : "–");
  const econ = (t: PlayerTotals) => (t.bowlBalls ? ((6 * t.bowlRuns) / t.bowlBalls).toFixed(2) : "–");
  const overs = (t: PlayerTotals) => `${Math.floor(t.bowlBalls / 6)}${t.bowlBalls % 6 ? `.${t.bowlBalls % 6}` : ""}`;
  const best = (t: PlayerTotals) => (t.best ? `${t.best.w}/${t.best.r}` : "–");
  const squad = ranked.filter((t) => t.me);
  const tabs: [Tab, string][] = [["matches", "Your matches"], ["ratings", "Player ratings"], ["stats", "Stats"], ["tables", "Tables"], ["knockouts", "Knockouts"]];
  const ratingsInput = useMemo<SimulateInput>(
    () => ({ seed: state.seed, identity: state.identity!, picks: state.picks.filter(Boolean) as PoolPlayer[], coach: state.coach, captainId: state.captainId }),
    [state.seed, state.identity, state.picks, state.coach, state.captainId],
  );

  // The paper: page 0 is the squad announcement, then one page per match, then the final edition.
  const lastPage = mine.length + 1;
  const [page, setPage] = useState(0);
  const [leaf, setLeaf] = useState<{ page: number; back: boolean } | null>(null);
  const [auto, setAuto] = useState<Auto | null>(null);
  const [watching, setWatching] = useState<number | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [copied, setCopied] = useState(false);

  const turnTo = (next: number) => {
    if (next === page || next < 0 || next > lastPage) return;
    setLeaf({ page, back: next < page });
    setPage(next);
    window.scrollTo(0, 0);
  };

  useEffect(() => { if (page === lastPage) { setReachedEnd(true); setAuto(null); } }, [page, lastPage]);
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
  const copyResult = () => {
    const v = verdictFor(id, me, result.stages.length, exitStageOf(result.stages, mine));
    void navigator.clipboard?.writeText(`World Cup Draft: ${me} at the ${result.editionId} World Cup. ${id.won}–${id.lost}, ${id.champion ? "champions" : id.exit}. Grade ${v.grade}.`).then(() => setCopied(true));
  };

  const renderPage = (p: number) => {
    if (p === 0) return <CoverPage state={state} result={result} edition={edition} venues={venues} mine={mine} coachName={state.coach?.coachName ?? null} matchDay={mine[0] ? paper.matchDays.get(mine[0].date ?? "") ?? null : null} />;
    if (p === lastPage) return <FinalPage result={result} all={all} mine={mine} me={me} highlight={highlight} paper={paper} date={mine[mine.length - 1]?.date ?? null} onAgain={onAgain} onShare={copyResult} shared={copied} />;
    return <MatchPage fixture={mine[p - 1]!} index={p - 1} mine={mine} all={all} result={result} me={me} venues={venues} highlight={highlight} issue={p + 1} paper={paper} last={p === mine.length} seed={result.seed} />;
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
      </nav>
      {reachedEnd && (
        <>
          <nav className="tabs" aria-label="Result sections">
            {tabs.map(([key, label]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
          </nav>
          {tab === "matches" && (
            <div className="card">
              <h3>Your matches</h3>
              <p className="small">Seed <code>{result.seed}</code></p>
              {mine.map((f) => (
                <MatchCard key={`${f.stageId}-${f.teams.join()}`} fixture={f} me={me} stageLabel={f.stageLabel} venues={venues} highlight={highlight}>
                  {f.innings && (
                    <details className="sc-details">
                      <summary>Full scorecard</summary>
                      <MatchScorecard innings={f.innings} highlight={highlight} me={me} />
                    </details>
                  )}
                </MatchCard>
              ))}
            </div>
          )}
          {tab === "ratings" && <PlayerRatings input={ratingsInput} editions={editions} lines={totals} />}
          {tab === "stats" && (
            <>
              <div className="card">
                <h3>Your squad</h3>
                <div className="leaders-grid">
                  <Leaders title="Batting" rows={squad.filter((t) => t.innings > 0).sort((a, b) => b.runs - a.runs)} cols={[{ label: "Inns", value: (t) => t.innings }, { label: "Runs", value: (t) => t.runs }, { label: "HS", value: (t) => `${t.high}${t.highNotOut ? "*" : ""}` }, { label: "Avg", value: avg }, { label: "SR", value: sr }, { label: "4s/6s", value: (t) => `${t.fours}/${t.sixes}` }]} />
                  <Leaders title="Bowling" rows={squad.filter((t) => t.bowlInnings > 0).sort((a, b) => b.wickets - a.wickets || a.bowlRuns - b.bowlRuns)} cols={[{ label: "Inns", value: (t) => t.bowlInnings }, { label: "Overs", value: overs }, { label: "Wkts", value: (t) => t.wickets }, { label: "Best", value: best }, { label: "Econ", value: econ }]} />
                </div>
                {squad.some((t) => t.potm) && <p className="small">Player of the match: {squad.filter((t) => t.potm).sort((a, b) => b.potm - a.potm).map((t) => `${t.name}${t.potm > 1 ? ` ×${t.potm}` : ""}`).join(", ")}.</p>}
              </div>
              <div className="card">
                <h3>Tournament leaders</h3>
                <p className="small">Every match in the {result.editionId} tournament, your eleven included. Your players are highlighted.</p>
                <div className="leaders-grid">
                  <Leaders title="Most runs" rows={top((t) => t.runs, (t) => t.balls)} cols={[{ label: "Inns", value: (t) => t.innings }, { label: "Runs", value: (t) => t.runs }, { label: "HS", value: (t) => `${t.high}${t.highNotOut ? "*" : ""}` }, { label: "SR", value: sr }]} />
                  <Leaders title="Most wickets" rows={top((t) => t.wickets, (t) => t.bowlRuns)} cols={[{ label: "Inns", value: (t) => t.bowlInnings }, { label: "Wkts", value: (t) => t.wickets }, { label: "Best", value: best }, { label: "Econ", value: econ }]} />
                  <Leaders title="Most sixes" rows={top((t) => t.sixes, (t) => t.balls)} cols={[{ label: "6s", value: (t) => t.sixes }, { label: "4s", value: (t) => t.fours }, { label: "Runs", value: (t) => t.runs }]} />
                  <Leaders title="Most boundaries" rows={top((t) => t.fours + t.sixes, (t) => t.balls)} cols={[{ label: "4s", value: (t) => t.fours }, { label: "6s", value: (t) => t.sixes }, { label: "Runs", value: (t) => t.runs }]} />
                  <Leaders title="Best strike rate (60+ balls)" rows={top((t) => (t.balls >= 60 ? (100 * t.runs) / t.balls : 0), (t) => -t.runs)} cols={[{ label: "Runs", value: (t) => t.runs }, { label: "Balls", value: (t) => t.balls }, { label: "SR", value: sr }]} />
                  <Leaders title="Best economy (12+ overs)" rows={ranked.filter((t) => t.bowlBalls >= 72).sort((a, b) => a.bowlRuns / a.bowlBalls - b.bowlRuns / b.bowlBalls).slice(0, 10)} cols={[{ label: "Overs", value: overs }, { label: "Wkts", value: (t) => t.wickets }, { label: "Econ", value: econ }]} />
                  <Leaders title="Player of the match awards" rows={top((t) => t.potm, (t) => -t.runs - 20 * t.wickets, () => true, 10)} cols={[{ label: "Awards", value: (t) => t.potm }, { label: "Runs", value: (t) => t.runs }, { label: "Wkts", value: (t) => t.wickets }]} />
                </div>
              </div>
            </>
          )}
          {tab === "tables" && result.stages.filter((s) => s.groups).map((s) => (
            <div className="card" key={s.id}>
              <h3>{s.label}</h3>
              <div className="standings-grid">
                {Object.entries(s.groups!).map(([g, rows]) => (
                  <table className="standings" key={g}>
                    <caption>Group {g}</caption>
                    <thead><tr><th className="pos">#</th><th className="team">Team</th><th>P</th><th>W</th><th>L</th><th>NR</th><th>Pts</th><th className="nrr">NRR</th></tr></thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.team} className={r.team === me ? "me" : ""}>
                          <td className="pos">{i + 1}</td>
                          <td className="team">{r.team}</td>
                          <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.noResult}</td>
                          <td className="pts">{r.points}</td>
                          <td className="nrr">{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            </div>
          ))}
          {tab === "knockouts" && (
            <div className="card">
              <h3>Knockouts</h3>
              {result.stages.filter((s) => !s.groups).flatMap((s) => s.fixtures.map((f) => (
                <MatchCard key={`${s.id}-${f.teams.join()}`} fixture={f} me={me} stageLabel={s.label} venues={venues} highlight={highlight}>
                  {f.innings && (
                    <details className="sc-details">
                      <summary>Full scorecard</summary>
                      <MatchScorecard innings={f.innings} highlight={highlight} me={me} />
                    </details>
                  )}
                </MatchCard>
              )))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
