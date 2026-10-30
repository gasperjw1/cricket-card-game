import { useMemo, useState } from "react";
import type { EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { FixtureResult, TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import { MatchCard } from "../components/MatchCard.tsx";
import { Scorecard } from "../components/Scorecard.tsx";
import { squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";

type Tab = "matches" | "stats" | "tables" | "knockouts";

interface PlayerTotals {
  id: string;
  name: string;
  team: string;
  innings: number;
  runs: number;
  balls: number;
  outs: number;
  fours: number;
  sixes: number;
  high: number;
  highNotOut: boolean;
  bowlInnings: number;
  wickets: number;
  bowlRuns: number;
  bowlBalls: number;
  best: { w: number; r: number } | null;
  potm: number;
}

/** Every player's tournament numbers from the kept scorecards (all fixtures when `keepScorecards` was on). */
function tournamentTotals(fixtures: FixtureResult[]): Map<string, PlayerTotals> {
  const totals = new Map<string, PlayerTotals>();
  const get = (id: string, name: string, team: string) =>
    totals.get(id) ?? totals.set(id, { id, name, team, innings: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, high: 0, highNotOut: false, bowlInnings: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, best: null, potm: 0 }).get(id)!;
  for (const f of fixtures) {
    const [i1, i2] = f.innings ?? [];
    if (!i1 || !i2) continue;
    for (const inn of [i1, i2]) {
      const fielding = inn === i1 ? i2.team : i1.team;
      for (const b of inn.batting) {
        if (b.balls === 0 && !b.out) continue;
        const t = get(b.id, b.name, inn.team);
        t.innings += 1; t.runs += b.runs; t.balls += b.balls; t.outs += b.out ? 1 : 0; t.fours += b.fours; t.sixes += b.sixes;
        if (b.runs > t.high || (b.runs === t.high && !b.out)) { t.high = b.runs; t.highNotOut = !b.out; }
      }
      for (const w of inn.bowling) {
        const t = get(w.id, w.name, fielding);
        t.bowlInnings += 1; t.wickets += w.wickets; t.bowlRuns += w.runs; t.bowlBalls += w.balls;
        if (!t.best || w.wickets > t.best.w || (w.wickets === t.best.w && w.runs < t.best.r)) t.best = { w: w.wickets, r: w.runs };
      }
    }
    if (f.potm) get(f.potm.id, f.potm.name, f.potm.team).potm += 1;
  }
  return totals;
}

type Ranked = PlayerTotals & { me: boolean };

function Leaders({ title, rows, cols }: { title: string; rows: Ranked[]; cols: { label: string; value: (t: PlayerTotals) => string | number }[] }) {
  if (!rows.length) return null;
  return (
    <table className="table leaders">
      <thead><tr><th>{title}</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((t, i) => <tr key={t.id} className={t.me ? "me" : ""}><td><span className="rank">{i + 1}</span> {t.name} <span className="small">{t.team}</span></td>{cols.map((c) => <td key={c.label}>{c.value(t)}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function ResultScreen({ state, result, editions, venues, onAgain }: { state: RunState; result: TournamentResult; editions: EditionOut[]; venues: VenueOut[]; onAgain: () => void }) {
  const [tab, setTab] = useState<Tab>("matches");
  const me = state.identity!.team;
  const id = result.identity!;
  const edition = editions.find((e) => e.id === result.editionId);
  const highlight = useMemo(() => new Set(state.picks.filter(Boolean).map((p) => p!.id)), [state.picks]);
  const all = result.stages.flatMap((s) => s.fixtures.map((f) => ({ ...f, stageLabel: s.label })));
  const mine = all.filter((f) => f.teams.includes(me));
  const headline = id.unbeaten ? "Unbeaten champions." : id.champion ? "Champions." : id.exit === "Final" ? "Runners-up." : `Out in the ${id.exit}.`;
  const totals = useMemo(() => tournamentTotals(all), [result]);
  const ranked: Ranked[] = [...totals.values()].map((t) => ({ ...t, me: highlight.has(t.id) }));
  const top = (key: (t: Ranked) => number, tie: (t: Ranked) => number, filter: (t: Ranked) => boolean = () => true, n = 10) =>
    ranked.filter(filter).filter((t) => key(t) > 0).sort((a, b) => key(b) - key(a) || tie(a) - tie(b)).slice(0, n);
  const sr = (t: PlayerTotals) => (t.balls ? ((100 * t.runs) / t.balls).toFixed(1) : "–");
  const avg = (t: PlayerTotals) => (t.outs ? (t.runs / t.outs).toFixed(1) : "–");
  const econ = (t: PlayerTotals) => (t.bowlBalls ? ((6 * t.bowlRuns) / t.bowlBalls).toFixed(2) : "–");
  const overs = (t: PlayerTotals) => `${Math.floor(t.bowlBalls / 6)}${t.bowlBalls % 6 ? `.${t.bowlBalls % 6}` : ""}`;
  const best = (t: PlayerTotals) => (t.best ? `${t.best.w}/${t.best.r}` : "–");
  const squad = ranked.filter((t) => t.me);
  const tabs: [Tab, string][] = [["matches", "Your matches"], ["stats", "Stats"], ["tables", "Tables"], ["knockouts", "Knockouts"]];
  return (
    <section className="result">
      <div className="card">
        <p className="eyebrow">{me} · {result.editionId} · squad rating {squadRating(state.picks)}</p>
        <h2>{headline}</h2>
        <p>{id.won} won, {id.lost} lost{id.played - id.won - id.lost ? `, ${id.played - id.won - id.lost} without result` : ""}. {result.champion && result.champion !== me ? `${result.champion} won the ${edition?.id ?? ""} World Cup.` : ""}</p>
        <p className="small">Seed <code>{result.seed}</code> replays this run exactly.</p>
        <button type="button" className="primary" onClick={onAgain}>Draft again</button>
      </div>
      <nav className="tabs" aria-label="Result sections">
        {tabs.map(([key, label]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>
      {tab === "matches" && (
        <div className="card">
          <h3>Your matches</h3>
          {mine.map((f) => (
            <MatchCard key={`${f.stageId}-${f.teams.join()}`} fixture={f} me={me} stageLabel={f.stageLabel} venues={venues} highlight={highlight}>
              {f.innings && (
                <details className="sc-details">
                  <summary>Full scorecard</summary>
                  <div className="scorecards">
                    {f.innings.map((inn, i) => <Scorecard key={inn.index} inn={inn} fielding={f.innings![1 - i]!.team} highlight={highlight} />)}
                  </div>
                </details>
              )}
            </MatchCard>
          ))}
        </div>
      )}
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
                  <div className="scorecards">{f.innings.map((inn, i) => <Scorecard key={inn.index} inn={inn} fielding={f.innings![1 - i]!.team} highlight={highlight} />)}</div>
                </details>
              )}
            </MatchCard>
          )))}
        </div>
      )}
    </section>
  );
}
