import type { EditionOut } from "../../../wcdraft/src/engine/data.ts";
import type { FixtureResult, TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";

function marginText(f: FixtureResult): string {
  if (!f.winner) return "no result";
  if (f.tieBreak) return `${f.winner} won the ${f.tieBreak.method}`;
  if (!f.margin) return `${f.winner} won`;
  if ("dls" in f.margin) return `${f.winner} won by ${f.margin.runs} runs (DLS)`;
  if ("wickets" in f.margin) return `${f.winner} won by ${f.margin.wickets} wickets (${f.margin.ballsLeft} balls left)`;
  return `${f.winner} won by ${f.margin.runs} runs`;
}

function Scorecard({ inn }: { inn: InningsResult }) {
  return (
    <div className="scorecard">
      <b>{inn.team} {inn.runs}/{inn.wickets} ({Math.floor(inn.legalBalls / 6)}.{inn.legalBalls % 6} ov)</b>
      <table>
        <tbody>
          {inn.batting.filter((b) => b.balls > 0 || b.out).map((b) => <tr key={b.id}><td>{b.name}{b.out ? "" : "*"}</td><td>{b.runs} ({b.balls})</td></tr>)}
        </tbody>
      </table>
      <table>
        <tbody>
          {inn.bowling.map((b) => <tr key={b.id}><td>{b.name}</td><td>{b.overs.length}–{b.runs}–{b.wickets}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function ResultScreen({ state, result, editions, onAgain }: { state: RunState; result: TournamentResult; editions: EditionOut[]; onAgain: () => void }) {
  const me = state.identity!.team;
  const id = result.identity!;
  const edition = editions.find((e) => e.id === result.editionId);
  const mine = result.stages.flatMap((s) => s.fixtures.filter((f) => f.teams.includes(me)).map((f) => ({ ...f, stageLabel: s.label })));
  const headline = id.unbeaten ? "Unbeaten champions." : id.champion ? "Champions." : id.exit === "Final" ? "Runners-up." : `Out in the ${id.exit}.`;
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
          <details key={`${f.stageId}-${f.teams.join()}`} className={`fixture ${f.winner === me ? "won" : f.winner ? "lost" : ""}`}>
            <summary>
              <span className="player-meta">{f.stageLabel}{f.group ? ` · Group ${f.group}` : ""}{f.venueId ? ` · ${f.venueId}` : ""}</span>
              <b>{f.teams[0]} {f.scores[0]} v {f.teams[1]} {f.scores[1]}</b>
              <span>{marginText(f)}{f.rain ? ` · rain: ${f.rain.kind}${f.rain.kind === "reduced" ? ` to ${f.rain.oversPerSide} overs` : ""}` : ""}</span>
            </summary>
            {f.innings && <div className="scorecards">{f.innings.map((inn) => <Scorecard key={inn.index} inn={inn} />)}</div>}
          </details>
        ))}
      </div>
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
