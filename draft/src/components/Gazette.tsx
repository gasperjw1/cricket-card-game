/**
 * The World Cup Draft Gazette (asked 2026-10-31, reshaped 2026-11-01): the run told as a dated run
 * of newspapers. Issue 1 is the preview, then one issue per match the side plays, then the souvenir
 * issue. "Edition" is the World Cup's word and is never used for a paper. Each match issue has four
 * sections, Report, 1st innings, 2nd innings and Tables, and a fifth for the super over or bowl-out
 * when the match was tied; the report carries a stop press when the
 * match earned one and the late news since the previous issue. Every number comes from the
 * scorecards, and each issue knows only what had happened by that match.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { CoachOut, EditionOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { captainChoices, captainFor, holdShare, type Captaincy } from "../game/captain.ts";
import { planAt } from "../game/plan.ts";
import type { MatchPlan } from "../game/simulate.ts";
import type { PoolPlayer } from "../game/types.ts";
import type { FixtureResult, StageResult, TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { RECORD_KINDS, type RecordBook, type RecordKind } from "../game/facts.ts";
import { storyFor, tieBreakText, topBatter, topBowler, verdictFor } from "../game/gazette.ts";
import type { IssueCopy, LateNewsLine, Paper } from "../game/paper.ts";
import { recordChains, type Journey, type Residual, type Souvenir } from "../game/souvenir.ts";
import type { Performance } from "../game/score.ts";
import { exitStageOf, sideProfile, stageIdOf, tableTo, tournamentTotals, type PlayerTotals } from "../game/stats.ts";
import { designatedKeeper, squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";
import { fullName, labelTeams, teamLabel } from "../lib/names.ts";
import { marginText, rainText } from "./MatchCard.tsx";
import { Awards, FormGrid, SquadStats, TournamentLeaders } from "./RunStats.tsx";
import { MatchScorecard, TieBreakCard, oversText, tieBreakLabel } from "./Scorecard.tsx";
import { Digits, Rating } from "./PlayerCard.tsx";

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

/** "9.3 of 12 overs" when rain shortened the allotment; the par when rain ended a chase. */
function inningsSub(inn: InningsResult, rain: FixtureResult["rain"]): string {
  const short = inn.scheduledOvers < 20;
  const overs = `${oversText(inn.legalBalls)}${short ? ` of ${inn.scheduledOvers}` : ""} overs`;
  if (inn.index === 2 && rain?.kind === "chase-cut") return `${overs}, target ${inn.target}; rain ended it${rain.parScore !== null ? `, par ${rain.parScore}` : ""}`;
  return `${overs}${inn.target !== null ? `, target ${inn.target}` : ""}`;
}

function InningsBox({ inn, rain, highlight, me }: { inn: InningsResult; rain: FixtureResult["rain"]; highlight: Set<string>; me: string }) {
  if (inn.legalBalls === 0) return <div className="gz-inn"><div className="gz-inn-head"><span>{teamLabel(inn.team)}</span></div><div className="gz-inn-sub">Did not bat</div></div>;
  const bats = [...inn.batting].filter((b) => b.balls > 0 || b.out).sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3);
  const bowlers = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
  return (
    <div className="gz-inn">
      <div className="gz-inn-head"><span>{teamLabel(inn.team)}</span><b>{inn.runs}/{inn.wickets}</b></div>
      <div className="gz-inn-sub">{inningsSub(inn, rain)}</div>
      <table className="gz-figures"><tbody>
        {bats.map((b) => <tr key={b.id} className={inn.team === me && highlight.has(b.id) ? "mine" : ""}><td title={fullName(b.id, b.name)}>{fullName(b.id, b.name)}</td><td>{b.runs}{b.out ? "" : "*"} ({b.balls})</td></tr>)}
        {bowlers.map((w) => <tr key={w.id} className={inn.team !== me && highlight.has(w.id) ? "mine" : ""}><td title={fullName(w.id, w.name)}>{fullName(w.id, w.name)}</td><td>{w.wickets}/{w.runs} ({oversText(w.balls)})</td></tr>)}
      </tbody></table>
    </div>
  );
}

function Standings({ stage, fixture, group, me }: { stage: StageResult; fixture: FixtureResult; group: string; me: string }) {
  const rows = tableTo(stage, { ...fixture, group });
  return (
    <section className="gz-box">
      <h4>{stage.label}, Group {group}</h4>
      <table className="gz-table gz-standings">
        <thead><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>NR</th><th>Pts</th><th>NRR</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.team} className={r.team === me ? "mine" : ""}><td>{teamLabel(r.team)}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.noResult}</td><td>{r.points}</td><td className="gz-nrr">{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Leaders({ fixtures, highlight, me }: { fixtures: FixtureResult[]; highlight: Set<string>; me: string }) {
  const totals = [...tournamentTotals(fixtures).values()];
  const runs = [...totals].sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3);
  const wickets = [...totals].filter((t) => t.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.bowlRuns - b.bowlRuns).slice(0, 3);
  const row = (t: PlayerTotals, value: string) => <tr key={`${t.team}${t.id}${value}`} className={t.team === me && highlight.has(t.id) ? "mine" : ""}><td>{t.name}<small>{teamLabel(t.team)}</small></td><td>{value}</td></tr>;
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

/** One innings in a few lines: the total, its top two batters and the other side's best bowler. */
function BoxInnings({ inn, rain, highlight, me }: { inn: InningsResult; rain: FixtureResult["rain"]; highlight: Set<string>; me: string }) {
  if (inn.legalBalls === 0) return <div className="gz-box-inn"><div className="gz-inn-head"><span>{teamLabel(inn.team)}</span></div><div className="gz-inn-sub">Did not bat</div></div>;
  const bats = [...inn.batting].filter((b) => b.balls > 0 || b.out).sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 2);
  const bowler = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  return (
    <div className="gz-box-inn">
      <div className="gz-inn-head"><span>{teamLabel(inn.team)}</span><b>{inn.runs}/{inn.wickets}</b></div>
      <div className="gz-inn-sub">{inningsSub(inn, rain)}</div>
      <table className="gz-figures"><tbody>
        {bats.map((b) => <tr key={b.id} className={highlight.has(b.id) && inn.team === me ? "mine" : ""}><td title={fullName(b.id, b.name)}>{fullName(b.id, b.name)}</td><td>{b.runs}{b.out ? "" : "*"} ({b.balls})</td></tr>)}
        {bowler && <tr className="gz-fig-bowl"><td title={fullName(bowler.id, bowler.name)}>{fullName(bowler.id, bowler.name)}</td><td>{bowler.wickets}/{bowler.runs} ({oversText(bowler.balls)})</td></tr>}
      </tbody></table>
    </div>
  );
}

/**
 * Around the World Cup (2026-11-03, Yash: the other results sat down the side column and left the
 * report half empty): every other match since the last issue, as a short piece with its own
 * headline, the result and its best fact, and a box score. By date, in play order.
 */
function Around({ copy, all, venues, highlight, me, seed }: { copy: IssueCopy; all: Fixtured[]; venues: VenueOut[]; highlight: Set<string>; me: string; seed: string }) {
  const byKey = new Map(all.map((f) => [`${f.stageId}|${f.teams.join("|")}`, f]));
  const days = new Map<string, { line: LateNewsLine; f: Fixtured }[]>();
  for (const line of copy.lateNews) {
    const f = byKey.get(line.fixtureKey);
    if (!f) continue;
    const d = longDate(line.date) || "Undated";
    days.set(d, [...(days.get(d) ?? []), { line, f }]);
  }
  if (!days.size) return <p className="gz-note">No other matches were played since our last issue.</p>;
  return (
    <div className="gz-around">
      {[...days].map(([d, items]) => (
        <section key={d} className="gz-around-day">
          <div className="gz-late-date">{d}</div>
          <div className="gz-around-grid">
            {items.map(({ line, f }) => {
              const venue = venues.find((v) => v.id === f.venueId);
              const [i1, i2] = f.innings ?? [];
              // The headline from the winner's side, as a round-up writes it; nothing about any run.
              const story = storyFor(f, { me: f.winner ?? f.teams[0], seed, stageLabel: f.stageLabel, city: venue?.city ?? null, last: false, final: false, knockout: false, record: { won: 0, lost: 0 } });
              return (
                <article key={line.fixtureKey} className="gz-piece">
                  <div className="gz-kicker">{f.stageLabel}{f.group ? ` · Group ${f.group}` : ""}{venue ? ` · ${venue.city}` : ""}</div>
                  <h3 className="gz-piece-head">{story.headline}</h3>
                  <p className="gz-piece-line">{labelTeams(line.line)}</p>
                  {i1 && i2 && <div className="gz-score gz-box-score"><BoxInnings inn={i1} rain={f.rain} highlight={highlight} me={me} /><BoxInnings inn={i2} rain={f.rain} highlight={highlight} me={me} /></div>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RunSoFar({ mine, upTo, me }: { mine: Fixtured[]; upTo: number; me: string }) {
  return (
    <div className="gz-run" role="img" aria-label={`Results so far: ${mine.slice(0, upTo + 1).map((f) => (f.winner === me ? "won" : f.winner ? "lost" : "no result")).join(", ")}`}>
      {mine.slice(0, upTo + 1).map((f, i) => <span key={i} className={f.winner === me ? "w" : f.winner ? "l" : "n"} title={labelTeams(`${f.teams.find((t) => t !== me)}: ${marginText(f)}`)}>{f.winner === me ? "W" : f.winner ? "L" : "NR"}</span>)}
    </div>
  );
}

export function CoverPage({ state, result, edition, venues, mine, numbersHere, ratingHere, coachName, matchDay }: { state: RunState; result: TournamentResult; edition: EditionOut | undefined; venues: VenueOut[]; mine: Fixtured[]; numbersHere: ({ bat: number | null; bowl: number | null } | null)[]; ratingHere: number | null; coachName: string | null; matchDay: number | null }) {
  const me = state.identity!.team;
  const picks = state.picks.filter(Boolean);
  const captain = picks.find((p) => p!.id === state.captainId);
  const keeperId = designatedKeeper(state.picks)?.id ?? null;
  const opening = mine.filter((f) => f.stageId === mine[0]?.stageId);
  const hosts = edition?.hosts?.join(" and ") ?? "";
  return (
    <article className="gz-page">
      <Masthead issue="Issue 1 · Preview" date={longDate(mine[0]?.date ?? null)} matchDay={matchDay} editionId={result.editionId} />
      <div className="gz-kicker">Squad announced</div>
      <h2 className="gz-headline">{teamLabel(me)} name their eleven for the {result.editionId} World Cup</h2>
      <div className="gz-cover-rating"><Rating label="Squad rating" n={ratingHere ?? squadRating(state.picks)} size="lg" /></div>
      <p className="gz-stand">{picks.length} players from across the tournament's history{coachName ? `, with ${coachName} as coach` : ""}{hosts ? `. The tournament is in ${hosts}.` : "."}{result.editionId === "2007" ? " It is the first T20 World Cup ever played, and nobody yet knows what a good score is." : ""}{state.identity!.standIn ? ` ${teamLabel(me)} stand in for a side that did not take part.` : ""}</p>
      <div className="gz-columns">
        <section className="gz-box gz-wide">
          <h4>The batting order</h4>
          <table className="gz-table gz-order">
            <thead><tr><th>#</th><th>Player</th><th>From</th><th>Bat</th><th>Bowl</th></tr></thead>
            {/* The keeper as the team sheet shows him: the dagger, and WK where his bowling would be (he keeps and does not bowl). */}
            <tbody>{picks.map((p, i) => <tr key={p!.id}><td>{i + 1}</td><td>{p!.id === keeperId ? "†" : ""}{p!.name}{p!.id === state.captainId ? " (c)" : ""}</td><td>{p!.team} {p!.editionId}</td><td><Digits n={p!.batShown ? numbersHere[i]?.bat ?? p!.bat : null} /></td><td>{p!.id === keeperId ? <small className="sheet-wk">WK</small> : <Digits n={p!.bowlShown ? numbersHere[i]?.bowl ?? p!.bowl : null} />}</td></tr>)}</tbody>
          </table>
          <p className="gz-note">Each man's numbers in {result.editionId} at his place in the order{coachName ? ` under ${coachName}` : ""}, as the draft showed them.</p>
        </section>
        <aside className="gz-rail">
          <section className="gz-box">
            <h4>Opening fixtures</h4>
            <ul className="gz-list">{opening.map((f) => { const v = venues.find((x) => x.id === f.venueId); return <li key={f.teams.join()}><b>v {teamLabel(f.teams.find((t) => t !== me) ?? "")}</b><br />{v ? `${v.name}, ${v.city}` : ""}{f.date ? `, ${shortDate(f.date)}` : ""}</li>; })}</ul>
          </section>
          {captain && <section className="gz-box"><h4>Captain</h4><p>{captain.name}</p></section>}
        </aside>
      </div>
    </article>
  );
}

type Section = "report" | "inn1" | "inn2" | "decider" | "tables" | "around";

/** The between-match lever: what the side may change before its next match, and the hand on it. */
export interface Lever {
  picks: PoolPlayer[];
  captaincy: Captaincy;
  coach: CoachOut | null;
  captainId: string | null;
  plans: (MatchPlan | undefined)[];
  /** Line-up moves left, shared with the lineup screen. */
  movesLeft: number;
  onReplan: (index: number, plan: MatchPlan) => void;
}

const TEMPO_WORDS: Record<NonNullable<MatchPlan["intent"]>, string> = { coach: "at the coach's own tempo", attack: "attacking in every phase", balanced: "at a balanced tempo", hold: "holding back" };

function NextMatchLever({ lever, next, me, opponent }: { lever: Lever; next: number; me: string; opponent: string | null }) {
  const plan = planAt(lever.plans, next);
  // The same choice as the lineup: the eleven's captains, or anyone when none has captained.
  const choices = captainChoices(lever.picks, lever.captaincy);
  const captainId = captainFor(lever.picks, plan.captainId === undefined ? lever.captainId : plan.captainId, lever.captaincy);
  const tempo = plan.intent ?? "coach";
  // Say what changed and that the matches from here on were played again with it (2026-11-03: the
  // tournament did replay, but nothing on the page said so).
  const [saved, setSaved] = useState<string | null>(null);
  const from = opponent ? `from the match against ${teamLabel(opponent)} on` : "from the next match on";
  const change = (p: MatchPlan, what: string) => { lever.onReplan(next, p); setSaved(`${what} ${from}. Every match from there has been played again with it; the ones already played stand.`); };
  const nameOf = (id: string | null) => (id ? lever.picks.find((p) => p.id === id)?.name ?? "the captain" : null);
  // The order for the next match: the last moved order, or the lineup's own.
  const order = plan.order ?? lever.picks.map((p) => p.id);
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const swapOrder = () => {
    const o = [...order];
    [o[a], o[b]] = [o[b]!, o[a]!];
    change({ order: o }, `${nameOf(order[a]!)} and ${nameOf(order[b]!)} swap places`);
  };
  return (
    <section className="gz-box gz-lever">
      <h4>Before the next match</h4>
      <p className="gz-note">{teamLabel(me)} may name a captain, set a tempo and move the order for the next match and the ones after it.</p>
      <label className="gz-lever-row"><span>Captain</span>
        <select value={captainId ?? ""} onChange={(e) => change({ captainId: e.target.value }, `${nameOf(e.target.value)} captains`)}>
          {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {captainId && <p className="gz-note">Holds a finisher back after a collapse: <Digits n={Math.round(100 * holdShare(captainId, lever.captaincy))} size="xs" />%</p>}
      <label className="gz-lever-row"><span>Tempo</span>
        <select value={tempo} onChange={(e) => { const intent = e.target.value as NonNullable<MatchPlan["intent"]>; change({ intent }, `${teamLabel(me)} bat ${intent === "coach" && lever.coach ? `at ${lever.coach.coachName}'s own tempo` : TEMPO_WORDS[intent]}`); }}>
          <option value="coach">{lever.coach ? `${lever.coach.coachName}'s own` : "The coach's own"}</option>
          <option value="attack">Attack in every phase</option>
          <option value="balanced">Balanced</option>
          <option value="hold">Hold back</option>
        </select>
      </label>
      {/* Line-up moves (2026-11-03): one swap of two batting positions a move, from the run's budget. */}
      <label className="gz-lever-row"><span>Swap</span>
        <select value={a} onChange={(e) => setA(Number(e.target.value))} disabled={lever.movesLeft <= 0}>
          {order.map((id, i) => <option key={id} value={i}>No. {i + 1} {nameOf(id)}</option>)}
        </select>
      </label>
      <label className="gz-lever-row"><span>with</span>
        <select value={b} onChange={(e) => setB(Number(e.target.value))} disabled={lever.movesLeft <= 0}>
          {order.map((id, i) => <option key={id} value={i}>No. {i + 1} {nameOf(id)}</option>)}
        </select>
      </label>
      <div className="gz-lever-row"><span />
        <button type="button" className="gz-lever-go" disabled={lever.movesLeft <= 0 || a === b} onClick={swapOrder}>{lever.movesLeft > 0 ? `Swap them · ${lever.movesLeft} ${lever.movesLeft === 1 ? "move" : "moves"} left` : "No line-up moves left"}</button>
      </div>
      {saved && <p className="gz-note gz-saved" role="status">{saved}</p>}
    </section>
  );
}

export function MatchPage({ fixture, index, mine, all, result, me, venues, highlight, issue, paper, last, seed, lever }: { fixture: Fixtured; index: number; mine: Fixtured[]; all: Fixtured[]; result: TournamentResult; me: string; venues: VenueOut[]; highlight: Set<string>; issue: number; paper: Paper; last: boolean; seed: string; lever?: Lever }) {
  const f = fixture;
  const [section, setSection] = useState<Section>("report");
  const venue = venues.find((v) => v.id === f.venueId);
  const stageId = stageIdOf(f);
  const stage = result.stages.find((s) => s.id === stageId);
  const finalStage = result.stages[result.stages.length - 1];
  const position = all.indexOf(f);
  const played = mine.slice(0, index + 1).filter((m) => stageIdOf(m) === stageId);
  const record = { won: played.filter((m) => m.winner === me).length, lost: played.filter((m) => m.winner && m.winner !== me).length };
  // What the paper may know on the day: a group exit is only certain once the stage has no match left to
  // play, and the next fixture is only printed when it is in this stage or this stage is complete.
  const stageDone = !all.slice(position + 1).some((x) => stageIdOf(x) === stageId);
  const knownLast = last && (!stage?.groups || stageDone);
  const story = useMemo(() => storyFor(f, { me, seed, stageLabel: f.stageLabel, city: venue?.city ?? null, last: knownLast, final: finalStage?.id === stageId, knockout: !stage?.groups, record }), [f, me, seed, venue, knownLast, finalStage, stage, stageId, record.won, record.lost]);
  const key = `${f.stageId}|${f.teams.join("|")}`;
  const copy = paper.issues.get(key);
  const records = paper.records.get(key);
  const upcoming = mine[index + 1];
  const next = upcoming && (stageIdOf(upcoming) === stageId || stageDone) ? upcoming : undefined;
  const nextVenue = next ? venues.find((v) => v.id === next.venueId) : undefined;
  const rain = rainText(f);
  const [i1, i2] = f.innings ?? [];
  const toDate = all.slice(0, position + 1);
  // Every group table as it stood after this match day: for each group, the last of its matches played
  // by now. One row a stage, the stage in play first (2026-11-04: one grid for every table put a
  // finished first round beside the current stage and split the current stage's groups across rows).
  const groupTables = result.stages.filter((s) => s.groups).map((s) => ({
    stage: s,
    tables: Object.keys(s.groups!).flatMap((g) => {
      const lastPlayed = [...toDate].reverse().find((x) => stageIdOf(x) === s.id && x.group === g);
      return lastPlayed ? [{ group: g, fixture: lastPlayed }] : [];
    }),
  })).filter((s) => s.tables.length).reverse();
  const decider = f.tieBreak ? tieBreakLabel(f.tieBreak) : null;
  const others = copy?.lateNews.length ?? 0;
  const sections: [Section, string][] = [["report", "Report"], ["inn1", "1st innings"], ["inn2", "2nd innings"], ...(decider ? [["decider", decider] as [Section, string]] : []), ["tables", "Tables"], ...(others ? [["around", "Around the World Cup"] as [Section, string]] : [])];
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
              {i1 && i2 && <div className="gz-score"><InningsBox inn={i1} rain={f.rain} highlight={highlight} me={me} /><InningsBox inn={i2} rain={f.rain} highlight={highlight} me={me} /></div>}
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
              <section className="gz-box"><h4>{teamLabel(me)} so far</h4><RunSoFar mine={mine} upTo={index} me={me} /></section>
              {stage?.groups && f.group && <Standings stage={stage} fixture={f} group={f.group} me={me} />}
              {next && <section className="gz-box"><h4>Next for {teamLabel(me)}</h4><p className="gz-next"><b>{next.stageLabel}, v {teamLabel(next.teams.find((t) => t !== me) ?? "")}</b><br />{nextVenue ? `${nextVenue.name}, ${nextVenue.city}` : ""}{next.date ? `, ${shortDate(next.date)}` : ""}</p></section>}
              {next && lever && <NextMatchLever key={index} lever={lever} next={index + 1} me={me} opponent={next.teams.find((t) => t !== me) ?? null} />}
              {others > 0 && (
                <section className="gz-box">
                  <h4>Around the World Cup</h4>
                  <p className="gz-next">{others} other {others === 1 ? "result" : "results"} since our last issue.</p>
                  <button type="button" className="gz-link" onClick={() => setSection("around")}>Read them</button>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
      {(section === "inn1" || section === "inn2") && i1 && i2 && (
        <div className="gz-innings">
          <div className="gz-kicker">{section === "inn1" ? "First" : "Second"} innings · {teamLabel((section === "inn1" ? i1 : i2).team)} {(section === "inn1" ? i1 : i2).runs}/{(section === "inn1" ? i1 : i2).wickets} · {inningsSub(section === "inn1" ? i1 : i2, f.rain)}</div>
          <MatchScorecard innings={[i1, i2]} highlight={highlight} me={me} only={section === "inn1" ? 1 : 2} />
        </div>
      )}
      {section === "decider" && f.tieBreak && (
        <div className="gz-innings">
          <div className="gz-kicker">{decider} · {teamLabel(f.tieBreak.winner)} won it</div>
          <TieBreakCard tb={f.tieBreak} highlight={highlight} me={me} />
        </div>
      )}
      {section === "around" && copy && (
        <div className="gz-innings">
          <div className="gz-kicker">Around the World Cup · since our last issue</div>
          <Around copy={copy} all={all} venues={venues} highlight={highlight} me={me} seed={seed} />
        </div>
      )}
      {section === "tables" && (
        <div className="gz-tables">
          <div className="gz-kicker">As they stood after match day {copy?.matchDay ?? ""}</div>
          {groupTables.map(({ stage: s, tables }) => (
            <div className="gz-pair-grid" key={s.id}>
              {tables.map(({ group, fixture: lf }) => <Standings key={group} stage={s} fixture={lf} group={group} me={me} />)}
            </div>
          ))}
          <div className="gz-pair-grid">
            <Leaders fixtures={toDate} highlight={highlight} me={me} />
            {records && <Records book={records.after} />}
          </div>
        </div>
      )}
    </article>
  );
}

/** One line of the souvenir's performer lists: what he did, against what his card said. */
function ResidualRow({ r }: { r: Residual }) {
  const bat = r.bat && (Math.abs(r.bat.above) >= Math.abs(r.bowl?.above ?? 0) || !r.bowl);
  const num = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n))}`;
  return (
    <li className={r.mine ? "mine" : ""}>
      <b>{r.name}</b> <span className="gz-sub-team">{teamLabel(r.team)}</span>
      <br />
      {bat && r.bat
        ? <>{r.bat.runs} runs off {r.bat.balls} balls at a strike rate of {r.bat.sr.toFixed(0)}, out {r.bat.outs} time{r.bat.outs === 1 ? "" : "s"} against {r.bat.expOuts.toFixed(1)} expected; a card of <Digits n={r.bat.card} size="xs" /> in this tournament said {r.bat.expSr.toFixed(0)}. <b>{num(r.bat.above)} runs</b> against expectation.</>
        : r.bowl
          ? <>{r.bowl.wickets} wicket{r.bowl.wickets === 1 ? "" : "s"} at {r.bowl.econ.toFixed(1)} an over from {oversText(r.bowl.balls)} overs; a card of <Digits n={r.bowl.card} size="xs" /> in this tournament said {r.bowl.expEcon.toFixed(1)}. <b>{num(r.bowl.above)} runs</b> against expectation.</>
          : null}
    </li>
  );
}

const SCOPE_LABEL = { wc: "", allWc: " · a T20 World Cup record", t20i: " · a T20I record" } as const;

type FinalSection = "summary" | "players" | "records" | "journey" | "results";
const FINAL_SECTIONS: [FinalSection, string][] = [["summary", "Summary"], ["players", "Players"], ["records", "Records"], ["journey", "Journey"], ["results", "Results"]];

/**
 * The souvenir issue (sections 2026-11-03, after the match issues): Summary (the verdict, the side's
 * bests and its results), Players (the awards, the side's figures, the tournament leaders, and who
 * beat or missed his card), Records (any T20 World Cup or T20I record broken first), Journey (form
 * match by match, then each man's card against his number in this World Cup) and Results (every
 * scorecard with its super over or bowl-out, the tables and the knockouts). The ratings and results
 * views are passed in, so the paper itself only lays them out.
 */
export function FinalPage({ result, all, mine, me, highlight, paper, souvenir, journeys, performance: perf, date, manualShare, ratings, results }: { result: TournamentResult; all: Fixtured[]; mine: Fixtured[]; me: string; highlight: Set<string>; paper: Paper; souvenir: Souvenir | null; journeys: Journey[]; performance: Performance; date: string | null; manualShare: string | null; ratings: ReactNode; results: ReactNode }) {
  const [section, setSection] = useState<FinalSection>("summary");
  const ranked = useMemo(() => [...tournamentTotals(all).values()].map((t) => ({ ...t, me: t.team === me && highlight.has(t.id) })), [all, me, highlight]);
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
  const lastRecords = paper.records.get(lastKey);
  // The tournament's records with their chains, and which of them stand in all World Cups or all T20Is.
  const chains = recordChains(lastRecords?.after ?? {});
  // A mark is a record of all T20Is (or all World Cups) only when it displaced a real one, the rule the
  // match reports use (2026-11-03: in 2007 the all-World-Cups book starts empty, and every mark of the
  // first World Cup was flagged as a T20 World Cup record, the highest total and score among them).
  const scopeOf = (kind: RecordKind): keyof typeof SCOPE_LABEL => {
    const c = lastRecords?.after[kind]?.current;
    const beatReal = (scope: "t20i" | "allWc") => {
      const line = lastRecords?.scopes[scope].after[kind];
      return !!c && !!line && line.current.fixtureKey === c.fixtureKey && !c.fixtureKey.startsWith("real:") && line.history.some((h) => h.fixtureKey.startsWith("real:"));
    };
    return beatReal("t20i") ? "t20i" : beatReal("allWc") ? "allWc" : "wc";
  };
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  // Records that stand beyond this World Cup: the best in any T20 World Cup, or in any T20I.
  const broken = chains.map((c) => ({ c, scope: scopeOf(c.kind) })).filter((x) => x.scope !== "wc");
  const recordWho = (c: (typeof chains)[number]) => `${labelTeams(c.holder)}${c.holder !== c.team ? `, ${teamLabel(c.team)}` : ""} v ${teamLabel(c.opp)}`;
  return (
    <article className="gz-page">
      <Masthead issue="Souvenir issue" date={longDate(date)} matchDay={null} editionId={result.editionId} />
      <nav className="gz-sections" aria-label="Sections of the souvenir issue">
        {FINAL_SECTIONS.map(([k, label]) => <button key={k} type="button" className={section === k ? "on" : ""} aria-current={section === k ? "page" : undefined} onClick={() => setSection(k)}>{label}</button>)}
      </nav>

      {section === "summary" && (
        <>
          <div className="gz-kicker">The {result.editionId} World Cup in review</div>
          <h2 className="gz-headline">{labelTeams(verdict.title)}</h2>
          <p className="gz-stand">{labelTeams(verdict.line)}{champion && champion !== me ? ` ${teamLabel(champion)} won the World Cup.` : ""}</p>
          <div className="gz-verdict">
            <div><span>Record</span><b>{id.won}–{id.lost}</b></div>
            <div><span>Finish</span><b>{id.champion ? "Champions" : id.exit}</b></div>
            <div className="gz-grade"><span>Grade</span><b>{verdict.grade}</b></div>
            <div><span>Performance</span><b>{perf.score}</b></div>
          </div>
          <p className="gz-note gz-perf">Performance: {perf.stagePoints} for the stage reached, {perf.winPoints} for {id.won} win{id.won === 1 ? "" : "s"}, {perf.nrrPoints >= 0 ? "+" : "−"}{Math.abs(perf.nrrPoints)} for a net run rate of {perf.nrr >= 0 ? "+" : "−"}{Math.abs(perf.nrr).toFixed(2)}{perf.unbeatenPoints ? `, ${perf.unbeatenPoints} for going unbeaten` : ""}. Copy result, in the bar below, carries a link that replays this run exactly.</p>
          <div className="gz-columns">
            <div className="gz-main">
              <section className="gz-box">
                <h4>Your tournament</h4>
                <table className="gz-table gz-leaders"><tbody>
                  {runs && <tr><td>Leading run-scorer<small>{runs.name}</small></td><td>{runs.runs}</td></tr>}
                  {wickets && wickets.wickets > 0 && <tr><td>Leading wicket-taker<small>{wickets.name}</small></td><td>{wickets.wickets}</td></tr>}
                  {bestInnings?.b && <tr><td>Best innings<small>{fullName(bestInnings.b.id, bestInnings.b.name)} v {teamLabel(bestInnings.v ?? "")}</small></td><td>{bestInnings.b.runs}{bestInnings.b.out ? "" : "*"}</td></tr>}
                  {bestBowling?.w && <tr><td>Best bowling<small>{fullName(bestBowling.w.id, bestBowling.w.name)} v {teamLabel(bestBowling.v)}</small></td><td>{bestBowling.w.wickets}/{bestBowling.w.runs}</td></tr>}
                </tbody></table>
              </section>
              <section className="gz-box">
                <h4>The results</h4>
                <ul className="gz-list">{mine.map((f, i) => <li key={i}><b>{f.stageLabel}, v {teamLabel(f.teams.find((t) => t !== me) ?? "")}</b><br />{labelTeams(`${marginText(f)}${f.tieBreak ? `. ${tieBreakText(f.tieBreak)}` : ""}`)}</li>)}</ul>
              </section>
            </div>
            <aside className="gz-rail">
              <section className="gz-box"><h4>{teamLabel(me)}, match by match</h4><RunSoFar mine={mine} upTo={mine.length - 1} me={me} /></section>
              {profile.length > 0 && <section className="gz-box"><h4>The verdict on {teamLabel(me)}</h4><ul className="gz-chips">{profile.map((p) => <li key={p.label} className={p.good ? "good" : "bad"}>{p.label}</li>)}</ul></section>}
              {broken.length > 0 && <section className="gz-box"><h4>Records broken</h4><ul className="gz-list">{broken.map(({ c, scope }) => <li key={c.kind}><b>{RECORD_LABELS[c.kind]}{SCOPE_LABEL[scope]}</b><br />{recordValue(c.kind, c)}, {recordWho(c)}</li>)}</ul></section>}
              {manualShare && (
                <label className="gz-manual">
                  <span className="gz-note">This browser would not copy it; select the text and copy it yourself.</span>
                  <textarea readOnly rows={4} value={manualShare} onFocus={(e) => e.currentTarget.select()} />
                </label>
              )}
            </aside>
          </div>
        </>
      )}

      {section === "players" && (
        <div className="gz-section">
          <section className="gz-box"><h4>The awards</h4><Awards ranked={ranked} /></section>
          <section className="gz-box"><h4>{teamLabel(me)}'s figures</h4><SquadStats ranked={ranked} /></section>
          {souvenir ? (
            <div className="gz-tables-grid">
              {souvenir.standouts.length > 0 && <section className="gz-box"><h4>Furthest above their cards</h4><p className="gz-note">Any card, by the runs made or saved beyond what his numbers said, allowing for how the whole field scored.</p><ul className="gz-list gz-residuals">{souvenir.standouts.map((r) => <ResidualRow key={r.key} r={r} />)}</ul></section>}
              {souvenir.unexpected.length > 0 && <section className="gz-box"><h4>Better than their cards</h4><p className="gz-note">Modest cards, 75 and under, that did the most beyond their numbers. A tournament is a few hundred balls; some of this is luck.</p><ul className="gz-list gz-residuals">{souvenir.unexpected.map((r) => <ResidualRow key={r.key} r={r} />)}</ul></section>}
              {souvenir.disappointing.length > 0 && <section className="gz-box"><h4>Below their cards</h4><p className="gz-note">Strong cards, 85 and over, that fell furthest short of their numbers.</p><ul className="gz-list gz-residuals">{souvenir.disappointing.map((r) => <ResidualRow key={r.key} r={r} />)}</ul></section>}
            </div>
          ) : <p className="gz-note">Working out every player's expectation…</p>}
          <section className="gz-box"><h4>Tournament leaders</h4><TournamentLeaders ranked={ranked} /></section>
        </div>
      )}

      {section === "records" && (
        <div className="gz-section">
          <section className="gz-box">
            <h4>Records broken</h4>
            {broken.length > 0
              ? <ul className="gz-list">{broken.map(({ c, scope }) => <li key={c.kind}><b>{RECORD_LABELS[c.kind]}{SCOPE_LABEL[scope]}</b>: {recordValue(c.kind, c)}, {recordWho(c)}</li>)}</ul>
              : <p className="gz-note">No T20 World Cup or T20I record fell in this tournament.</p>}
          </section>
          {chains.length > 0 && (
            <section className="gz-box">
              <h4>Records of the {result.editionId} World Cup</h4>
              <table className="gz-table gz-leaders"><tbody>
                {chains.map((c) => (
                  <tr key={c.kind}>
                    <td>{RECORD_LABELS[c.kind]}{SCOPE_LABEL[scopeOf(c.kind)]}<small>{recordWho(c)}{c.chain.length ? ` · set ${c.chain.length + 1} times: ${c.chain.map((h) => `${labelTeams(h.holder)} ${recordValue(c.kind, h)} stood ${h.stoodDays <= 0 ? "less than a day" : plural(h.stoodDays, "day")}`).join("; ")}` : ""}</small></td>
                    <td>{recordValue(c.kind, c)}</td>
                  </tr>
                ))}
              </tbody></table>
            </section>
          )}
        </div>
      )}

      {section === "journey" && (
        <div className="gz-section">
          <section className="gz-box">
            <h4>Form, match by match</h4>
            <FormGrid journeys={journeys} mine={mine} me={me} />
            <p className="gz-note">Runs on top (* not out, – did not bat), wickets under them. Shaded: a fifty or three wickets, thirty or two wickets; red, a duck.</p>
          </section>
          {ratings}
        </div>
      )}

      {section === "results" && <div className="gz-section">{results}</div>}
    </article>
  );
}

export { cardScore };
