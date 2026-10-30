import type { EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import { MatchCard, marginText } from "../components/MatchCard.tsx";
import { Scorecard } from "../components/Scorecard.tsx";
import { squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";

export function ResultScreen({ state, result, editions, venues, onAgain }: { state: RunState; result: TournamentResult; editions: EditionOut[]; venues: VenueOut[]; onAgain: () => void }) {
  const me = state.identity!.team;
  const id = result.identity!;
  const edition = editions.find((e) => e.id === result.editionId);
  const highlight = new Set(state.picks.filter(Boolean).map((p) => p!.id));
  const mine = result.stages.flatMap((s) => s.fixtures.filter((f) => f.teams.includes(me)).map((f) => ({ ...f, stageLabel: s.label })));
  const headline = id.unbeaten ? "Unbeaten champions." : id.champion ? "Champions." : id.exit === "Final" ? "Runners-up." : `Out in the ${id.exit}.`;
  // Your squad's tournament numbers, from the kept scorecards.
  const totals = new Map<string, { name: string; runs: number; balls: number; outs: number; wickets: number; bowlRuns: number; bowlBalls: number; potm: number }>();
  for (const f of mine) {
    for (const inn of f.innings ?? []) {
      if (inn.team === me) for (const b of inn.batting) { const t = totals.get(b.id) ?? totals.set(b.id, { name: b.name, runs: 0, balls: 0, outs: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, potm: 0 }).get(b.id)!; t.runs += b.runs; t.balls += b.balls; t.outs += b.out ? 1 : 0; }
      else for (const w of inn.bowling) { const t = totals.get(w.id) ?? totals.set(w.id, { name: w.name, runs: 0, balls: 0, outs: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, potm: 0 }).get(w.id)!; t.wickets += w.wickets; t.bowlRuns += w.runs; t.bowlBalls += w.balls; }
    }
    if (f.potm && highlight.has(f.potm.id)) { const t = totals.get(f.potm.id); if (t) t.potm += 1; }
  }
  const batters = [...totals.values()].filter((t) => t.balls > 0).sort((a, b) => b.runs - a.runs).slice(0, 5);
  const bowlers = [...totals.values()].filter((t) => t.bowlBalls > 0).sort((a, b) => b.wickets - a.wickets || a.bowlRuns - b.bowlRuns).slice(0, 5);
  return (
    <section className="result">
      <div className="card">
        <p className="eyebrow">{me} · {result.editionId} · squad rating {squadRating(state.picks)}</p>
        <h2>{headline}</h2>
        <p>{id.won} won, {id.lost} lost{id.played - id.won - id.lost ? `, ${id.played - id.won - id.lost} without result` : ""}. {result.champion && result.champion !== me ? `${result.champion} won the ${edition?.id ?? ""} World Cup.` : ""}</p>
        <p className="small">Seed <code>{result.seed}</code> replays this run exactly.</p>
        <button type="button" className="primary" onClick={onAgain}>Draft again</button>
      </div>
      <div className="card">
        <h3>Your matches</h3>
        {mine.map((f) => (
          <MatchCard key={`${f.stageId}-${f.teams.join()}`} fixture={f} me={me} stageLabel={f.stageLabel} venues={venues} highlight={highlight}>
            {f.innings && (
              <details className="sc-details">
                <summary>Full scorecard</summary>
                <div className="scorecards">{f.innings.map((inn) => <Scorecard key={inn.index} inn={inn} highlight={highlight} />)}</div>
              </details>
            )}
          </MatchCard>
        ))}
      </div>
      {(batters.length > 0 || bowlers.length > 0) && (
        <div className="card">
          <h3>Your squad in the tournament</h3>
          <div className="scorecards">
            <table className="table"><thead><tr><th>Batting</th><th>Runs</th><th>Balls</th><th>SR</th><th>Avg</th></tr></thead>
              <tbody>{batters.map((t) => <tr key={t.name}><td>{t.name}{t.potm ? ` ★${t.potm > 1 ? t.potm : ""}` : ""}</td><td>{t.runs}</td><td>{t.balls}</td><td>{(100 * t.runs / t.balls).toFixed(0)}</td><td>{t.outs ? (t.runs / t.outs).toFixed(1) : "–"}</td></tr>)}</tbody></table>
            <table className="table"><thead><tr><th>Bowling</th><th>Wkts</th><th>Overs</th><th>Econ</th><th>Avg</th></tr></thead>
              <tbody>{bowlers.map((t) => <tr key={t.name}><td>{t.name}{t.potm ? ` ★${t.potm > 1 ? t.potm : ""}` : ""}</td><td>{t.wickets}</td><td>{Math.floor(t.bowlBalls / 6)}</td><td>{(6 * t.bowlRuns / t.bowlBalls).toFixed(2)}</td><td>{t.wickets ? (t.bowlRuns / t.wickets).toFixed(1) : "–"}</td></tr>)}</tbody></table>
          </div>
          <p className="small">★ player of the match.</p>
        </div>
      )}
      {result.stages.filter((s) => s.groups).map((s) => (
        <div className="card" key={s.id}>
          <h3>{s.label}</h3>
          {Object.entries(s.groups!).map(([g, rows]) => (
            <table className="table" key={g}>
              <thead><tr><th>Group {g}</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.team} className={r.team === me ? "me" : ""}><td>{r.team}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.points}</td><td>{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(2)}</td></tr>)}</tbody>
            </table>
          ))}
        </div>
      ))}
      <div className="card">
        <h3>Knockouts</h3>
        {result.stages.filter((s) => !s.groups).flatMap((s) => s.fixtures.map((f) => <p key={`${s.id}-${f.teams.join()}`}><span className="player-meta">{s.label}</span> {f.teams[0]} {f.scores[0]} v {f.teams[1]} {f.scores[1]} — {marginText(f)}</p>))}
      </div>
    </section>
  );
}
