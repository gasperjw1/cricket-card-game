/**
 * The souvenir issue's numbers (2026-11-03, when the results moved into the paper's sections): the
 * tournament's awards, the side's own batting and bowling, the tournament leaders, and each of the
 * eleven's form match by match. Every figure is a sum over the kept scorecards.
 */

import { useEffect, useRef, useState } from "react";
import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { Journey, JourneyMatch } from "../game/souvenir.ts";
import type { PlayerTotals } from "../game/stats.ts";
import { teamCode, teamLabel } from "../lib/names.ts";

type Ranked = PlayerTotals & { me: boolean };

export const strikeRate = (t: PlayerTotals) => (t.balls ? ((100 * t.runs) / t.balls).toFixed(1) : "–");
export const average = (t: PlayerTotals) => (t.outs ? (t.runs / t.outs).toFixed(1) : "–");
export const economy = (t: PlayerTotals) => (t.bowlBalls ? ((6 * t.bowlRuns) / t.bowlBalls).toFixed(2) : "–");
export const oversOf = (t: PlayerTotals) => `${Math.floor(t.bowlBalls / 6)}${t.bowlBalls % 6 ? `.${t.bowlBalls % 6}` : ""}`;
const bestFigures = (t: PlayerTotals) => (t.best ? `${t.best.w}/${t.best.r}` : "–");
const highScore = (t: PlayerTotals) => `${t.high}${t.highNotOut ? "*" : ""}`;

function Leaders({ title, rows, cols }: { title: string; rows: Ranked[]; cols: { label: string; value: (t: PlayerTotals) => string | number }[] }) {
  if (!rows.length) return null;
  return (
    <table className="table leaders">
      <thead><tr><th>{title}</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((t, i) => <tr key={`${t.team}${t.id}`} className={t.me ? "me" : ""}><td><span className="rank">{i + 1}</span> {t.name} <span className="small">{teamLabel(t.team)}</span></td>{cols.map((c) => <td key={c.label}>{c.value(t)}</td>)}</tr>)}</tbody>
    </table>
  );
}

const rank = (rows: Ranked[], key: (t: Ranked) => number, tie: (t: Ranked) => number, n = 10) =>
  rows.filter((t) => key(t) > 0).sort((a, b) => key(b) - key(a) || tie(a) - tie(b)).slice(0, n);

/** "412 runs, strike rate 151.3 · 9 wickets, economy 7.10": a player's tournament on one line. */
function line(t: PlayerTotals): string {
  const parts: string[] = [];
  if (t.innings) parts.push(`${t.runs} runs, strike rate ${strikeRate(t)}`);
  if (t.wickets) parts.push(`${t.wickets} wicket${t.wickets === 1 ? "" : "s"}, economy ${economy(t)}`);
  return parts.join(" · ") || "–";
}

/**
 * Player of the tournament, best batter and best bowler. The player of the tournament is the most
 * player-of-the-match points over the tournament, the rule each match's award uses; the best batter
 * the most runs and the best bowler the most wickets, ties to the quicker scorer and the cheaper bowler.
 */
export function Awards({ ranked }: { ranked: Ranked[] }) {
  const pott = rank(ranked, (t) => t.points, (t) => -t.runs, 5);
  const bat = rank(ranked, (t) => t.runs, (t) => t.balls, 1)[0];
  const bowl = rank(ranked, (t) => t.wickets, (t) => t.bowlRuns, 1)[0];
  const award = (label: string, t: Ranked | undefined, value: (t: Ranked) => string) => t && (
    <div className={`award ${t.me ? "me" : ""}`}>
      <span className="award-k">{label}</span>
      <b>{t.name}</b>
      <span className="small">{teamLabel(t.team)} · {value(t)}</span>
    </div>
  );
  return (
    <>
      <div className="awards">
        {award("Player of the tournament", pott[0], line)}
        {award("Best batter", bat, (t) => `${t.runs} runs, average ${average(t)}, strike rate ${strikeRate(t)}, best ${highScore(t)}`)}
        {award("Best bowler", bowl, (t) => `${t.wickets} wickets, economy ${economy(t)}, best ${bestFigures(t)}`)}
      </div>
      {pott.length > 1 && (
        <Leaders title="Player of the tournament, the running order" rows={pott} cols={[{ label: "Points", value: (t) => t.points.toFixed(0) }, { label: "Runs", value: (t) => t.runs }, { label: "Wkts", value: (t) => t.wickets }, { label: "PoM", value: (t) => t.potm }]} />
      )}
    </>
  );
}

/** The side's own batting and bowling, every man who batted or bowled. */
export function SquadStats({ ranked }: { ranked: Ranked[] }) {
  const squad = ranked.filter((t) => t.me);
  const awarded = squad.filter((t) => t.potm).sort((a, b) => b.potm - a.potm);
  return (
    <>
      <div className="leaders-grid">
        <Leaders title="Batting" rows={squad.filter((t) => t.innings > 0).sort((a, b) => b.runs - a.runs)} cols={[{ label: "Inns", value: (t) => t.innings }, { label: "Runs", value: (t) => t.runs }, { label: "HS", value: highScore }, { label: "Avg", value: average }, { label: "SR", value: strikeRate }, { label: "4s/6s", value: (t) => `${t.fours}/${t.sixes}` }]} />
        <Leaders title="Bowling" rows={squad.filter((t) => t.bowlInnings > 0).sort((a, b) => b.wickets - a.wickets || a.bowlRuns - b.bowlRuns)} cols={[{ label: "Inns", value: (t) => t.bowlInnings }, { label: "Overs", value: oversOf }, { label: "Wkts", value: (t) => t.wickets }, { label: "Best", value: bestFigures }, { label: "Econ", value: economy }]} />
      </div>
      {awarded.length > 0 && <p className="small">Player of the match: {awarded.map((t) => `${t.name}${t.potm > 1 ? ` ×${t.potm}` : ""}`).join(", ")}.</p>}
    </>
  );
}

/** Every match of the tournament, the side included. */
export function TournamentLeaders({ ranked }: { ranked: Ranked[] }) {
  return (
    <div className="leaders-grid">
      <Leaders title="Most runs" rows={rank(ranked, (t) => t.runs, (t) => t.balls)} cols={[{ label: "Inns", value: (t) => t.innings }, { label: "Runs", value: (t) => t.runs }, { label: "HS", value: highScore }, { label: "SR", value: strikeRate }]} />
      <Leaders title="Most wickets" rows={rank(ranked, (t) => t.wickets, (t) => t.bowlRuns)} cols={[{ label: "Inns", value: (t) => t.bowlInnings }, { label: "Wkts", value: (t) => t.wickets }, { label: "Best", value: bestFigures }, { label: "Econ", value: economy }]} />
      <Leaders title="Most sixes" rows={rank(ranked, (t) => t.sixes, (t) => t.balls)} cols={[{ label: "6s", value: (t) => t.sixes }, { label: "4s", value: (t) => t.fours }, { label: "Runs", value: (t) => t.runs }]} />
      <Leaders title="Most boundaries" rows={rank(ranked, (t) => t.fours + t.sixes, (t) => t.balls)} cols={[{ label: "4s", value: (t) => t.fours }, { label: "6s", value: (t) => t.sixes }, { label: "Runs", value: (t) => t.runs }]} />
      <Leaders title="Best strike rate (60+ balls)" rows={rank(ranked, (t) => (t.balls >= 60 ? (100 * t.runs) / t.balls : 0), (t) => -t.runs)} cols={[{ label: "Runs", value: (t) => t.runs }, { label: "Balls", value: (t) => t.balls }, { label: "SR", value: strikeRate }]} />
      <Leaders title="Best economy (12+ overs)" rows={ranked.filter((t) => t.bowlBalls >= 72).sort((a, b) => a.bowlRuns / a.bowlBalls - b.bowlRuns / b.bowlBalls).slice(0, 10)} cols={[{ label: "Overs", value: oversOf }, { label: "Wkts", value: (t) => t.wickets }, { label: "Econ", value: economy }]} />
      <Leaders title="Player of the match awards" rows={rank(ranked, (t) => t.potm, (t) => -t.points)} cols={[{ label: "Awards", value: (t) => t.potm }, { label: "Runs", value: (t) => t.runs }, { label: "Wkts", value: (t) => t.wickets }]} />
    </div>
  );
}

/** A cell's shade: a fifty or three wickets is a big day, thirty or two a good one, a duck a bad one. */
function formClass(m: JourneyMatch): string {
  if ((m.runs ?? 0) >= 50 || (m.wickets ?? 0) >= 3) return "f-big";
  if ((m.runs ?? 0) >= 30 || (m.wickets ?? 0) >= 2) return "f-good";
  if (m.runs === 0 && m.out && !(m.wickets ?? 0)) return "f-bad";
  return "";
}

/**
 * Form, match by match: a row for each of the eleven, a column for each match in the order played.
 * Runs on top (* not out, – did not bat), wickets under them when he bowled.
 */
export function FormGrid({ journeys, mine, me }: { journeys: Journey[]; mine: FixtureResult[]; me: string }) {
  // Wider than the screen (a phone, a long run): say so, and shade the edge, only when it is.
  const wrap = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const check = () => setWide(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [journeys, mine]);
  return (
    <>
    {wide && <p className="small muted form-hint">Swipe sideways for every match; the names stay put.</p>}
    <div ref={wrap} className={`form-wrap ${wide ? "more" : ""}`}>
      <table className="form-grid">
        <thead>
          <tr>
            <th className="f-name">Player</th>
            {mine.map((f, i) => {
              const opp = f.teams.find((t) => t !== me) ?? "";
              const res = f.winner === me ? "W" : f.winner ? "L" : "NR";
              return <th key={i} title={`v ${teamLabel(opp)}: ${res === "W" ? "won" : res === "L" ? "lost" : "no result"}`}>{teamCode(opp)}<span className={`f-res ${res.toLowerCase()}`}>{res}</span></th>;
            })}
          </tr>
        </thead>
        <tbody>
          {journeys.map((j) => (
            <tr key={j.id}>
              <td className="f-name">{j.name}</td>
              {j.matches.map((m, i) => (
                <td key={i} className={formClass(m)} title={`${m.runs === null ? "did not bat" : `${m.runs}${m.out ? "" : "*"} off ${m.balls}`}${m.wickets === null ? "" : `; ${m.wickets}/${m.bowlRuns}`}`}>
                  <span className="f-runs">{m.runs === null ? "–" : `${m.runs}${m.out ? "" : "*"}`}</span>
                  {m.wickets !== null && <span className="f-wkts">{m.wickets}w</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
