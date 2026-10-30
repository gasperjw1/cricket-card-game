/**
 * Match summary (decided 2026-10-30): the two sides with score and overs, the leading batters and
 * bowlers under each, the result line, toss and ground, player of the match. The full scorecard
 * opens underneath.
 */

import type { ReactNode } from "react";
import type { VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { oversText } from "./Scorecard.tsx";

export function marginText(f: FixtureResult): string {
  if (!f.winner) return "No result";
  if (f.tieBreak) return `${f.winner} won the ${f.tieBreak.method === "super-over" ? "super over" : f.tieBreak.method}`;
  if (!f.margin) return `${f.winner} won`;
  if ("dls" in f.margin) return `${f.winner} won by ${f.margin.runs} run${f.margin.runs === 1 ? "" : "s"} (DLS)`;
  if ("wickets" in f.margin) return `${f.winner} won by ${f.margin.wickets} wicket${f.margin.wickets === 1 ? "" : "s"} with ${f.margin.ballsLeft} ball${f.margin.ballsLeft === 1 ? "" : "s"} left`;
  return `${f.winner} won by ${f.margin.runs} run${f.margin.runs === 1 ? "" : "s"}`;
}

export function rainText(f: FixtureResult): string | null {
  if (!f.rain) return null;
  if (f.rain.kind === "reduced") return `Rain: ${f.rain.oversPerSide} overs a side`;
  if (f.rain.kind === "chase-cut") return `Rain ended the chase${f.rain.parScore !== null ? `; par ${f.rain.parScore}` : ""}`;
  return "Rain: no result";
}

function Side({ inn, highlight }: { inn: InningsResult; highlight: Set<string> }) {
  const bats = [...inn.batting].filter((b) => b.balls > 0 || b.out).sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 2);
  return (
    <div className="mc-side">
      <div className="mc-team">{inn.team}</div>
      <div className="mc-score">{inn.runs}<span className="mc-wk">/{inn.wickets}</span></div>
      <div className="small">{oversText(inn.legalBalls)} ov{inn.target !== null ? ` · target ${inn.target}` : ""}</div>
      <div className="mc-lines">
        {bats.map((b) => <div key={b.id} className={highlight.has(b.id) ? "hl" : ""}><span>{b.name}</span><b>{b.runs}{b.out ? "" : "*"} ({b.balls})</b></div>)}
      </div>
    </div>
  );
}

function Bowlers({ inn, highlight }: { inn: InningsResult; highlight: Set<string> }) {
  const best = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
  return (
    <div className="mc-lines">
      {best.map((w) => <div key={w.id} className={highlight.has(w.id) ? "hl" : ""}><span>{w.name}</span><b>{w.wickets}/{w.runs}</b> <small>({oversText(w.balls)})</small></div>)}
    </div>
  );
}

export function MatchCard({ fixture, me, stageLabel, venues, highlight, children }: { fixture: FixtureResult; me: string; stageLabel: string; venues: VenueOut[]; highlight: Set<string>; children?: ReactNode }) {
  const f = fixture;
  const venue = f.venueId ? venues.find((v) => v.id === f.venueId) : undefined;
  const won = f.winner === me ? "won" : f.winner ? "lost" : "";
  const [i1, i2] = f.innings ?? [];
  const rain = rainText(f);
  return (
    <article className={`mc ${won}`}>
      <div className="mc-head">
        <span className="eyebrow">{stageLabel}{f.group ? ` · Group ${f.group}` : ""}{venue ? ` · ${venue.name}, ${venue.city}` : ""}{f.date ? ` · ${f.date}` : ""}</span>
        <b className={`mc-result ${won}`}>{marginText(f)}</b>
      </div>
      {i1 && i2 ? (
        <>
          <div className="mc-teams">
            <Side inn={i1} highlight={highlight} />
            <Side inn={i2} highlight={highlight} />
          </div>
          <div className="mc-teams mc-bowl">
            <Bowlers inn={i2} highlight={highlight} />
            <Bowlers inn={i1} highlight={highlight} />
          </div>
        </>
      ) : (
        <p><b>{f.teams[0]} {f.scores[0]}</b> v <b>{f.teams[1]} {f.scores[1]}</b></p>
      )}
      <p className="small mc-foot">
        {f.tossWinner ? `${f.tossWinner} won the toss and chose to ${f.tossDecision === "bat" ? "bat" : "field"}` : ""}
        {rain ? ` · ${rain}` : ""}
        {f.potm ? <> · <span className="potm">Player of the match</span> <b className={highlight.has(f.potm.id) ? "hl" : ""}>{f.potm.name}</b> {f.potm.summary}</> : null}
      </p>
      {children}
    </article>
  );
}
