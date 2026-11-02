/**
 * The World Cup Draft Gazette (asked 2026-10-31, reshaped 2026-11-01): the run told as a dated run
 * of newspapers. Issue 1 is the preview, then one issue per match the side plays, then the souvenir
 * issue. "Edition" is the World Cup's word and is never used for a paper. Each match issue has four
 * sections, Report, 1st innings, 2nd innings and Tables; the report carries a stop press when the
 * match earned one and the late news since the previous issue. Every number comes from the
 * scorecards, and each issue knows only what had happened by that match.
 */

import { useMemo, useState } from "react";
import type { EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { FixtureResult, StageResult, TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { RECORD_KINDS, type RecordBook, type RecordKind } from "../game/facts.ts";
import { storyFor, topBatter, topBowler, verdictFor } from "../game/gazette.ts";
import type { IssueCopy, Paper } from "../game/paper.ts";
import { exitStageOf, sideProfile, stageIdOf, tableTo, tournamentTotals, type PlayerTotals } from "../game/stats.ts";
import { squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";
import { fullName } from "../lib/names.ts";
import { marginText, rainText } from "./MatchCard.tsx";
import { MatchScorecard, oversText } from "./Scorecard.tsx";

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

/** Issue, date and the tournament's match day. No issue count: it would give away how far the run goes. */
function Masthead({ issue, date, matchDay, editionId }: { issue: string; date: string; matchDay: number | null; editionId: string }) {
  return (
    <header className="gz-mast">
      <div className="gz-mast-name">The World Cup Draft Gazette</div>
      <div className="gz-mast-line"><span>{issue}</span><span>{date}</span><span>{matchDay ? `Match day ${matchDay} of the ${editionId} World Cup` : `${editionId} World Cup`}</span></div>
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

function Standings({ stage, fixture, group, me }: { stage: StageResult; fixture: FixtureResult; group: string; me: string }) {
  const rows = tableTo(stage, { ...fixture, group });
  return (
    <section className="gz-box">
      <h4>{stage.label}, Group {group}</h4>
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

const RECORD_LABELS: Record<RecordKind, string> = {
  highestTotal: "Highest total", lowestTotal: "Lowest total", highestChase: "Highest chase", bestFigures: "Best bowling", highestScore: "Highest score",
  biggestRunsWin: "Biggest win by runs", biggestBallsWin: "Biggest win by balls", fastestFifty: "Fastest fifty",
};

function recordValue(kind: RecordKind, e: { value: number; value2: number }): string {
  switch (kind) {
    case "highestTotal": case "highestChase": return `${e.value}/${e.value2}`;
    case "lowestTotal": return `${e.value} all out`;
    case "bestFigures": return `${e.value}/${e.value2}`;
    case "highestScore": return `${e.value} (${e.value2})`;
    case "biggestRunsWin": return `${e.value} run${e.value === 1 ? "" : "s"}`;
    case "biggestBallsWin": return `${e.value} ball${e.value === 1 ? "" : "s"} to spare`;
    case "fastestFifty": return `${e.value} ball${e.value === 1 ? "" : "s"}`;
  }
}

/** The record book as it stands: holder, value and how many times the mark has moved. */
export function Records({ book, title = "Records of this World Cup" }: { book: RecordBook; title?: string }) {
  const lines = RECORD_KINDS.filter((k) => book[k]);
  if (!lines.length) return null;
  return (
    <section className="gz-box">
      <h4>{title}</h4>
      <table className="gz-table gz-leaders"><tbody>
        {lines.map((k) => {
          const line = book[k]!;
          const e = line.current;
          return <tr key={k}><td>{RECORD_LABELS[k]}<small>{e.holderId ? `${e.holder}, ${e.team}` : e.team} v {e.opp}{line.history.length ? ` · set ${line.history.length + 1} times` : ""}</small></td><td>{recordValue(k, e)}</td></tr>;
        })}
      </tbody></table>
    </section>
  );
}

function LateNews({ copy }: { copy: IssueCopy }) {
  if (!copy.lateNews.length) return null;
  const byDate = new Map<string, string[]>();
  for (const l of copy.lateNews) {
    const d = shortDate(l.date) || "Undated";
    byDate.set(d, [...(byDate.get(d) ?? []), l.line]);
  }
  return (
    <section className="gz-box gz-late">
      <h4>Since our last issue</h4>
      {[...byDate].map(([d, lines]) => (
        <div key={d} className="gz-late-day">
          <div className="gz-late-date">{d}</div>
          <ul className="gz-list">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      ))}
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

export function CoverPage({ state, result, edition, venues, mine, coachName, matchDay }: { state: RunState; result: TournamentResult; edition: EditionOut | undefined; venues: VenueOut[]; mine: Fixtured[]; coachName: string | null; matchDay: number | null }) {
  const me = state.identity!.team;
  const picks = state.picks.filter(Boolean);
  const captain = picks.find((p) => p!.id === state.captainId);
  const opening = mine.filter((f) => f.stageId === mine[0]?.stageId);
  const hosts = edition?.hosts?.join(" and ") ?? "";
  return (
    <article className="gz-page">
      <Masthead issue="Issue 1 · Preview" date={longDate(mine[0]?.date ?? null)} matchDay={matchDay} editionId={result.editionId} />
      <div className="gz-kicker">Squad announced</div>
      <h2 className="gz-headline">{me} name their eleven for the {result.editionId} World Cup</h2>
      <p className="gz-stand">{picks.length} players from across the tournament's history, with a squad rating of {squadRating(state.picks)}{coachName ? `, and ${coachName} as coach` : ""}{hosts ? `. The tournament is in ${hosts}.` : "."}{state.identity!.standIn ? ` ${me} stand in for a side that did not take part.` : ""}</p>
      <div className="gz-columns">
        <section className="gz-box gz-wide">
          <h4>The batting order</h4>
          <table className="gz-table gz-order">
            <thead><tr><th>#</th><th>Player</th><th>From</th><th>Bat</th><th>Bowl</th></tr></thead>
            <tbody>{picks.map((p, i) => <tr key={p!.id}><td>{i + 1}</td><td>{p!.name}{p!.id === state.captainId ? " (c)" : ""}</td><td>{p!.team} {p!.editionId}</td><td>{p!.batShown ? p!.bat : "–"}</td><td>{p!.bowlShown ? p!.bowl : "–"}</td></tr>)}</tbody>
          </table>
          <p className="gz-note">Card numbers from each man's own World Cup; the draft showed what they are worth in {result.editionId}.</p>
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

type Section = "report" | "inn1" | "inn2" | "tables";

export function MatchPage({ fixture, index, mine, all, result, me, venues, highlight, issue, paper, last, seed }: { fixture: Fixtured; index: number; mine: Fixtured[]; all: Fixtured[]; result: TournamentResult; me: string; venues: VenueOut[]; highlight: Set<string>; issue: number; paper: Paper; last: boolean; seed: string }) {
  const f = fixture;
  const [section, setSection] = useState<Section>("report");
  const venue = venues.find((v) => v.id === f.venueId);
  const stageId = stageIdOf(f);
  const stage = result.stages.find((s) => s.id === stageId);
  const finalStage = result.stages[result.stages.length - 1];
  const position = all.indexOf(f);
  const played = mine.slice(0, index + 1).filter((m) => stageIdOf(m) === stageId);
  const record = { won: played.filter((m) => m.winner === me).length, lost: played.filter((m) => m.winner && m.winner !== me).length };
  const story = useMemo(() => storyFor(f, { me, seed, stageLabel: f.stageLabel, city: venue?.city ?? null, last, final: finalStage?.id === stageId, knockout: !stage?.groups, record }), [f, me, seed, venue, last, finalStage, stage, stageId, record.won, record.lost]);
  const key = `${f.stageId}|${f.teams.join("|")}`;
  const copy = paper.issues.get(key);
  const records = paper.records.get(key);
  const next = mine[index + 1];
  const nextVenue = next ? venues.find((v) => v.id === next.venueId) : undefined;
  const rain = rainText(f);
  const [i1, i2] = f.innings ?? [];
  const toDate = all.slice(0, position + 1);
  // Every group table as it stood after this match day: for each group, the last of its matches played by now.
  const groupTables = result.stages.filter((s) => s.groups).flatMap((s) => Object.keys(s.groups!).flatMap((g) => {
    const lastPlayed = [...toDate].reverse().find((x) => stageIdOf(x) === s.id && x.group === g);
    return lastPlayed ? [{ stage: s, group: g, fixture: lastPlayed }] : [];
  }));
  const sections: [Section, string][] = [["report", "Report"], ["inn1", "1st innings"], ["inn2", "2nd innings"], ["tables", "Tables"]];
  return (
    <article className="gz-page">
      <Masthead issue={`Issue ${issue}`} date={longDate(f.date)} matchDay={copy?.matchDay ?? null} editionId={result.editionId} />
      <nav className="gz-sections" aria-label="Sections of this issue">
        {sections.map(([k, label]) => <button key={k} type="button" className={section === k ? "on" : ""} aria-current={section === k ? "page" : undefined} onClick={() => setSection(k)} disabled={(k === "inn1" || k === "inn2") && !(i1 && i2)}>{label}</button>)}
      </nav>
      {section === "report" && (
        <>
          <div className="gz-kicker">{story.kicker}{venue ? ` · ${venue.name}, ${venue.city}` : ""}</div>
          <h2 className="gz-headline">{story.headline}</h2>
          <p className="gz-stand">{story.standfirst}</p>
          {copy?.stopPress && <div className="gz-stop"><span className="gz-stop-label">Stop press</span><span>{copy.stopPress}</span></div>}
          <div className="gz-columns">
            <div className="gz-main">
              {i1 && i2 && <div className="gz-score"><InningsBox inn={i1} highlight={highlight} me={me} /><InningsBox inn={i2} highlight={highlight} me={me} /></div>}
              <div className="gz-report">
                {story.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                {copy && copy.sentences.length > 0 && <p>{copy.sentences.join(" ")}</p>}
              </div>
              <p className="gz-note">
                {f.tossWinner ? `${f.tossWinner} won the toss and chose to ${f.tossDecision === "bat" ? "bat" : "field"}.` : ""}{rain ? ` ${rain}.` : ""}
                {f.potm ? <> Player of the match: <b>{fullName(f.potm.id, f.potm.name)}</b>, {f.potm.summary}.</> : null}
              </p>
            </div>
            <aside className="gz-rail">
              <section className="gz-box"><h4>{me} so far</h4><RunSoFar mine={mine} upTo={index} me={me} /></section>
              {stage?.groups && f.group && <Standings stage={stage} fixture={f} group={f.group} me={me} />}
              {next && <section className="gz-box"><h4>Next for {me}</h4><p className="gz-next"><b>{next.stageLabel}, v {next.teams.find((t) => t !== me)}</b><br />{nextVenue ? `${nextVenue.name}, ${nextVenue.city}` : ""}{next.date ? `, ${shortDate(next.date)}` : ""}</p></section>}
              {copy && <LateNews copy={copy} />}
            </aside>
          </div>
        </>
      )}
      {(section === "inn1" || section === "inn2") && i1 && i2 && (
        <div className="gz-innings">
          <div className="gz-kicker">{section === "inn1" ? "First" : "Second"} innings · {(section === "inn1" ? i1 : i2).team} {(section === "inn1" ? i1 : i2).runs}/{(section === "inn1" ? i1 : i2).wickets} ({oversText((section === "inn1" ? i1 : i2).legalBalls)} ov){section === "inn2" && i2.target !== null ? ` · target ${i2.target}` : ""}</div>
          <MatchScorecard innings={[i1, i2]} highlight={highlight} me={me} only={section === "inn1" ? 1 : 2} />
        </div>
      )}
      {section === "tables" && (
        <div className="gz-tables">
          <div className="gz-kicker">As they stood after match day {copy?.matchDay ?? ""}</div>
          <div className="gz-tables-grid">
            {groupTables.map(({ stage: s, group, fixture: lf }) => <Standings key={`${s.id}-${group}`} stage={s} fixture={lf} group={group} me={me} />)}
            <Leaders fixtures={toDate} highlight={highlight} me={me} />
            {records && <Records book={records.after} />}
          </div>
        </div>
      )}
    </article>
  );
}

export function FinalPage({ result, all, mine, me, highlight, paper, date, onAgain, onShare, shared }: { result: TournamentResult; all: Fixtured[]; mine: Fixtured[]; me: string; highlight: Set<string>; paper: Paper; date: string | null; onAgain: () => void; onShare: () => void; shared: boolean }) {
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
  const lastKey = all.length ? `${all[all.length - 1]!.stageId}|${all[all.length - 1]!.teams.join("|")}` : "";
  const finalBook = paper.records.get(lastKey)?.after ?? {};
  return (
    <article className="gz-page">
      <Masthead issue="Souvenir issue" date={longDate(date)} matchDay={null} editionId={result.editionId} />
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
          <Records book={finalBook} title="Records of the tournament" />
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

export { cardScore };
