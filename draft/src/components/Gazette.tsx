/**
 * The World Cup Draft Gazette (asked 2026-10-31): the run told as a newspaper. A squad-announcement
 * front page, one edition per match, and a final edition with the grade. Every number comes from
 * the scorecards, and each edition knows only what had happened by that match.
 */

import { useMemo } from "react";
import type { EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { FixtureResult, StageResult, TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { storyFor, topBatter, topBowler, verdictFor } from "../game/gazette.ts";
import { exitStageOf, sideProfile, stageIdOf, tableTo, tournamentTotals, type PlayerTotals } from "../game/stats.ts";
import { squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";
import { fullName } from "../lib/names.ts";
import { marginText, rainText } from "./MatchCard.tsx";
import { oversText, Scorecard } from "./Scorecard.tsx";

export type Fixtured = FixtureResult & { stageLabel: string };

function longDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/** "66/10 (18.5)" reads "66 all out (18.5)". */
const cardScore = (score: string) => score.replace(/\/10 \(/, " all out (");

/** No "of N": the page count would give away how far the run goes. */
function Masthead({ edition, date, page }: { edition: string; date: string; page: number }) {
  return (
    <header className="gz-mast">
      <div className="gz-mast-name">The World Cup Draft Gazette</div>
      <div className="gz-mast-line"><span>{edition}</span><span>{date}</span><span>Page {page}</span></div>
    </header>
  );
}

function InningsBox({ inn, highlight, me }: { inn: InningsResult; highlight: Set<string>; me: string }) {
  if (inn.legalBalls === 0) return <div className="gz-inn"><div className="gz-inn-head"><span>{inn.team}</span></div><div className="gz-inn-sub">Did not bat</div></div>;
  const bats = [...inn.batting].filter((b) => b.balls > 0 || b.out).sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3);
  const bowlers = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
  return (
    <div className="gz-inn">
      <div className="gz-inn-head"><span>{inn.team}</span><b>{inn.runs}/{inn.wickets}</b></div>
      <div className="gz-inn-sub">{oversText(inn.legalBalls)} overs{inn.target !== null ? `, target ${inn.target}` : ""}</div>
      <table className="gz-figures"><tbody>
        {bats.map((b) => <tr key={b.id} className={inn.team === me && highlight.has(b.id) ? "mine" : ""}><td>{fullName(b.id, b.name)}</td><td>{b.runs}{b.out ? "" : "*"} ({b.balls})</td></tr>)}
        {bowlers.map((w) => <tr key={w.id} className={inn.team !== me && highlight.has(w.id) ? "mine" : ""}><td>{fullName(w.id, w.name)}</td><td>{w.wickets}/{w.runs} ({oversText(w.balls)})</td></tr>)}
      </tbody></table>
    </div>
  );
}

function Standings({ stage, fixture, me }: { stage: StageResult; fixture: FixtureResult; me: string }) {
  const rows = tableTo(stage, fixture);
  return (
    <section className="gz-box">
      <h4>{stage.label}{fixture.group ? `, Group ${fixture.group}` : ""}</h4>
      <table className="gz-table">
        <thead><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>NR</th><th>Pts</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.team} className={r.team === me ? "mine" : ""}><td>{r.team}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.noResult}</td><td>{r.points}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Leaders({ fixtures, highlight, me }: { fixtures: FixtureResult[]; highlight: Set<string>; me: string }) {
  const totals = [...tournamentTotals(fixtures).values()];
  const runs = [...totals].sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3);
  const wickets = [...totals].filter((t) => t.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.bowlRuns - b.bowlRuns).slice(0, 3);
  const row = (t: PlayerTotals, value: string) => <tr key={`${t.team}${t.id}${value}`} className={t.team === me && highlight.has(t.id) ? "mine" : ""}><td>{t.name}<small>{t.team}</small></td><td>{value}</td></tr>;
  return (
    <section className="gz-box">
      <h4>Tournament leaders</h4>
      <table className="gz-table gz-leaders"><tbody>
        <tr className="gz-sub"><td colSpan={2}>Runs</td></tr>
        {runs.map((t) => row(t, String(t.runs)))}
        <tr className="gz-sub"><td colSpan={2}>Wickets</td></tr>
        {wickets.map((t) => row(t, String(t.wickets)))}
      </tbody></table>
    </section>
  );
}

function Elsewhere({ fixtures }: { fixtures: FixtureResult[] }) {
  if (!fixtures.length) return null;
  return (
    <section className="gz-box">
      <h4>Around the grounds</h4>
      <ul className="gz-list">{fixtures.map((f) => <li key={`${f.stageId}-${f.teams.join()}`}><b>{f.teams[0]} {cardScore(f.scores[0])}, {f.teams[1]} {cardScore(f.scores[1])}</b><br />{marginText(f)}</li>)}</ul>
    </section>
  );
}

function RunSoFar({ mine, upTo, me }: { mine: Fixtured[]; upTo: number; me: string }) {
  return (
    <div className="gz-run" role="img" aria-label={`Results so far: ${mine.slice(0, upTo + 1).map((f) => (f.winner === me ? "won" : f.winner ? "lost" : "no result")).join(", ")}`}>
      {mine.slice(0, upTo + 1).map((f, i) => <span key={i} className={f.winner === me ? "w" : f.winner ? "l" : "n"} title={`${f.teams.find((t) => t !== me)}: ${marginText(f)}`}>{f.winner === me ? "W" : f.winner ? "L" : "NR"}</span>)}
    </div>
  );
}

export function CoverPage({ state, result, edition, venues, mine, coachName }: { state: RunState; result: TournamentResult; edition: EditionOut | undefined; venues: VenueOut[]; mine: Fixtured[]; coachName: string | null }) {
  const me = state.identity!.team;
  const picks = state.picks.filter(Boolean);
  const captain = picks.find((p) => p!.id === state.captainId);
  const opening = mine.filter((f) => f.stageId === mine[0]?.stageId);
  const hosts = edition?.hosts?.join(" and ") ?? "";
  return (
    <article className="gz-page">
      <Masthead edition={`${result.editionId} World Cup`} date={longDate(mine[0]?.date ?? null)} page={1} />
      <div className="gz-kicker">Squad announced</div>
      <h2 className="gz-headline">{me} name their eleven for the {result.editionId} World Cup</h2>
      <p className="gz-stand">{picks.length} players from across the tournament's history, with a squad rating of {squadRating(state.picks)}{coachName ? `, and ${coachName} as coach` : ""}{hosts ? `. The tournament is in ${hosts}.` : "."}{state.identity!.standIn ? ` ${me} take Afghanistan's place, as Afghanistan's matches are not in the data.` : ""}</p>
      <div className="gz-columns">
        <section className="gz-box gz-wide">
          <h4>The batting order</h4>
          <table className="gz-table gz-order">
            <thead><tr><th>#</th><th>Player</th><th>From</th><th>Bat</th><th>Bowl</th></tr></thead>
            <tbody>{picks.map((p, i) => <tr key={p!.id}><td>{i + 1}</td><td>{p!.name}{p!.id === state.captainId ? " (c)" : ""}</td><td>{p!.team} {p!.editionId}</td><td>{p!.batShown ? p!.bat : "–"}</td><td>{p!.bowlShown ? p!.bowl : "–"}</td></tr>)}</tbody>
          </table>
        </section>
        <aside className="gz-rail">
          <section className="gz-box">
            <h4>Opening fixtures</h4>
            <ul className="gz-list">{opening.map((f) => { const v = venues.find((x) => x.id === f.venueId); return <li key={f.teams.join()}><b>v {f.teams.find((t) => t !== me)}</b><br />{v ? `${v.name}, ${v.city}` : ""}{f.date ? `, ${shortDate(f.date)}` : ""}</li>; })}</ul>
          </section>
          {captain && <section className="gz-box"><h4>Captain</h4><p>{captain.name}</p></section>}
        </aside>
      </div>
    </article>
  );
}

export function MatchPage({ fixture, index, mine, all, result, me, venues, highlight, page, last, seed }: { fixture: Fixtured; index: number; mine: Fixtured[]; all: Fixtured[]; result: TournamentResult; me: string; venues: VenueOut[]; highlight: Set<string>; page: number; last: boolean; seed: string }) {
  const f = fixture;
  const venue = venues.find((v) => v.id === f.venueId);
  const stageId = stageIdOf(f);
  const stage = result.stages.find((s) => s.id === stageId);
  const finalStage = result.stages[result.stages.length - 1];
  const position = all.indexOf(f);
  const played = mine.slice(0, index + 1).filter((m) => stageIdOf(m) === stageId);
  const record = { won: played.filter((m) => m.winner === me).length, lost: played.filter((m) => m.winner && m.winner !== me).length };
  const story = useMemo(() => storyFor(f, { me, seed, stageLabel: f.stageLabel, city: venue?.city ?? null, last, final: finalStage?.id === stageId, knockout: !stage?.groups, record }), [f, me, seed, venue, last, finalStage, stage, stageId, record.won, record.lost]);
  const next = mine[index + 1];
  const nextVenue = next ? venues.find((v) => v.id === next.venueId) : undefined;
  const previous = index > 0 ? all.indexOf(mine[index - 1]!) : -1;
  const elsewhere = all.slice(previous + 1, position).slice(-4);
  const rain = rainText(f);
  const [i1, i2] = f.innings ?? [];
  const toDate = all.slice(0, position + 1);
  return (
    <article className="gz-page">
      <Masthead edition={`${result.editionId} World Cup`} date={longDate(f.date)} page={page} />
      <div className="gz-kicker">{story.kicker}{venue ? ` · ${venue.name}, ${venue.city}` : ""}</div>
      <h2 className="gz-headline">{story.headline}</h2>
      <p className="gz-stand">{story.standfirst}</p>
      <div className="gz-columns">
        <div className="gz-main">
          {i1 && i2 && <div className="gz-score"><InningsBox inn={i1} highlight={highlight} me={me} /><InningsBox inn={i2} highlight={highlight} me={me} /></div>}
          <div className="gz-report">{story.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
          <p className="gz-note">
            {f.tossWinner ? `${f.tossWinner} won the toss and chose to ${f.tossDecision === "bat" ? "bat" : "field"}.` : ""}{rain ? ` ${rain}.` : ""}
            {f.potm ? <> Player of the match: <b>{fullName(f.potm.id, f.potm.name)}</b>, {f.potm.summary}.</> : null}
          </p>
          {i1 && i2 && (
            <details className="gz-details">
              <summary>Full scorecard</summary>
              <div className="scorecards">{[i1, i2].map((inn, i) => <Scorecard key={inn.index} inn={inn} fielding={f.innings![1 - i]!.team} highlight={highlight} me={me} />)}</div>
            </details>
          )}
        </div>
        <aside className="gz-rail">
          <section className="gz-box"><h4>{me} so far</h4><RunSoFar mine={mine} upTo={index} me={me} /></section>
          {stage?.groups && f.group && <Standings stage={stage} fixture={f} me={me} />}
          {next && <section className="gz-box"><h4>Next for {me}</h4><p className="gz-next"><b>{next.stageLabel}, v {next.teams.find((t) => t !== me)}</b><br />{nextVenue ? `${nextVenue.name}, ${nextVenue.city}` : ""}{next.date ? `, ${shortDate(next.date)}` : ""}</p></section>}
          <Leaders fixtures={toDate} highlight={highlight} me={me} />
          <Elsewhere fixtures={elsewhere} />
        </aside>
      </div>
    </article>
  );
}

export function FinalPage({ result, all, mine, me, highlight, page, date, onAgain, onShare, shared }: { result: TournamentResult; all: Fixtured[]; mine: Fixtured[]; me: string; highlight: Set<string>; page: number; date: string | null; onAgain: () => void; onShare: () => void; shared: boolean }) {
  const id = result.identity!;
  const exitStage = exitStageOf(result.stages, mine);
  const verdict = verdictFor(id, me, result.stages.length, exitStage);
  const totals = [...tournamentTotals(mine).values()].filter((t) => t.team === me);
  const runs = [...totals].sort((a, b) => b.runs - a.runs)[0];
  const wickets = [...totals].sort((a, b) => b.wickets - a.wickets)[0];
  const bestInnings = mine.flatMap((f) => (f.innings ?? []).filter((i) => i.team === me).map((i) => ({ b: topBatter(i), v: f.teams.find((t) => t !== me) }))).sort((a, b) => (b.b?.runs ?? 0) - (a.b?.runs ?? 0))[0];
  const bestBowling = mine.flatMap((f) => (f.innings ?? []).filter((i) => i.team !== me).map((i) => ({ w: topBowler(i), v: i.team }))).sort((a, b) => (b.w?.wickets ?? 0) - (a.w?.wickets ?? 0) || (a.w?.runs ?? 0) - (b.w?.runs ?? 0))[0];
  const profile = sideProfile(all, me);
  const champion = result.champion;
  return (
    <article className="gz-page">
      <Masthead edition="Final edition" date={longDate(date)} page={page} />
      <div className="gz-kicker">The {result.editionId} World Cup in review</div>
      <h2 className="gz-headline">{verdict.title}</h2>
      <p className="gz-stand">{verdict.line}{champion && champion !== me ? ` ${champion} won the World Cup.` : ""}</p>
      <div className="gz-verdict">
        <div><span>Record</span><b>{id.won}–{id.lost}</b></div>
        <div><span>Finish</span><b>{id.champion ? "Champions" : id.exit}</b></div>
        <div className="gz-grade"><span>Grade</span><b>{verdict.grade}</b></div>
      </div>
      <div className="gz-columns">
        <div className="gz-main">
          <section className="gz-box">
            <h4>Your tournament</h4>
            <table className="gz-table gz-leaders"><tbody>
              {runs && <tr><td>Leading run-scorer<small>{runs.name}</small></td><td>{runs.runs}</td></tr>}
              {wickets && wickets.wickets > 0 && <tr><td>Leading wicket-taker<small>{wickets.name}</small></td><td>{wickets.wickets}</td></tr>}
              {bestInnings?.b && <tr><td>Best innings<small>{fullName(bestInnings.b.id, bestInnings.b.name)} v {bestInnings.v}</small></td><td>{bestInnings.b.runs}{bestInnings.b.out ? "" : "*"}</td></tr>}
              {bestBowling?.w && <tr><td>Best bowling<small>{fullName(bestBowling.w.id, bestBowling.w.name)} v {bestBowling.v}</small></td><td>{bestBowling.w.wickets}/{bestBowling.w.runs}</td></tr>}
            </tbody></table>
          </section>
          <section className="gz-box">
            <h4>The results</h4>
            <ul className="gz-list">{mine.map((f, i) => <li key={i}><b>{f.stageLabel}, v {f.teams.find((t) => t !== me)}</b><br />{marginText(f)}</li>)}</ul>
          </section>
        </div>
        <aside className="gz-rail">
          {profile.length > 0 && <section className="gz-box"><h4>The verdict on {me}</h4><ul className="gz-chips">{profile.map((p) => <li key={p.label} className={p.good ? "good" : "bad"}>{p.label}</li>)}</ul></section>}
          <Leaders fixtures={all} highlight={highlight} me={me} />
          <div className="gz-actions">
            <button type="button" onClick={onShare}>{shared ? "Copied" : "Copy result"}</button>
            <button type="button" className="gz-go" onClick={onAgain}>Draft again</button>
          </div>
        </aside>
      </div>
    </article>
  );
}
