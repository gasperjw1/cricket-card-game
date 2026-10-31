/**
 * Watching a match on the scoreboard (asked 2026-10-31): the engine's ball log replayed one
 * delivery at a time. The match is already decided when this opens; this only reveals it.
 */

import { useEffect, useMemo, useState } from "react";
import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { BallRecord } from "../../../wcdraft/src/engine/types.ts";
import { familiar, fullName } from "../lib/names.ts";
import { dismissalText, oversText } from "./Scorecard.tsx";
import { marginText } from "./MatchCard.tsx";

const SPEEDS = { steady: 900, quick: 250 } as const;

interface Line {
  runs: number;
  balls: number;
}

function ballLabel(b: BallRecord): string {
  if (b.wicket) return "W";
  if (b.extraKind === "wide") return "wd";
  if (b.extraKind === "no-ball") return b.runsBatter ? `${b.runsBatter}+nb` : "nb";
  if (b.extraKind === "bye") return `${b.extras}b`;
  return b.runsBatter === 0 ? "•" : String(b.runsBatter);
}

const ballClass = (b: BallRecord) => (b.wicket ? "wk" : b.runsBatter === 6 ? "six" : b.runsBatter === 4 ? "four" : "");

function commentary(b: BallRecord, name: (id: string) => string): string {
  const striker = familiar(b.striker, name(b.striker));
  const bowler = familiar(b.bowler, name(b.bowler));
  if (b.wicket) return `Out. ${striker} ${dismissalText(b.dismissal, true)}.`;
  if (b.extraKind === "wide") return `Wide from ${bowler}.`;
  if (b.extraKind === "no-ball") return `No-ball from ${bowler}${b.runsBatter ? `, and ${striker} takes ${b.runsBatter} off it` : ""}. Free hit next.`;
  if (b.runsBatter === 6) return `Six. ${striker} clears the rope off ${bowler}.`;
  if (b.runsBatter === 4) return `Four to ${striker}, off ${bowler}.`;
  if (b.extraKind === "bye") return `${b.extras} ${b.extras === 1 ? "bye" : "byes"}.`;
  if (b.runsBatter === 0) return `${bowler} to ${striker}, no run.`;
  return `${b.runsBatter} to ${striker}, off ${bowler}.`;
}

export function MatchView({ fixture, onDone }: { fixture: FixtureResult; onDone: () => void }) {
  const f = fixture;
  const balls = f.balls ?? [];
  const [i1, i2] = f.innings ?? [];
  // -1 is the moment before the first ball.
  const [at, setAt] = useState(-1);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS | null>(null);
  const finished = at >= balls.length - 1;

  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const inn of f.innings ?? []) {
      for (const b of inn.batting) m.set(b.id, b.name);
      for (const w of inn.bowling) m.set(w.id, w.name);
    }
    return m;
  }, [f]);
  const short = (id: string) => names.get(id) ?? id;
  const display = (id: string) => fullName(id, short(id));

  useEffect(() => {
    if (!speed || finished) return;
    const t = setTimeout(() => setAt((x) => x + 1), SPEEDS[speed]);
    return () => clearTimeout(t);
  }, [speed, at, finished]);

  const started = at >= 0;
  const ball = balls[Math.max(0, at)];
  const state = useMemo(() => {
    const bat = new Map<string, Line>(), bowl = new Map<string, Line & { wickets: number }>();
    let legal = 0;
    for (const b of balls.slice(0, at + 1)) {
      if (b.innings !== ball?.innings) continue;
      if (b.legal) legal += 1;
      const s = bat.get(b.striker) ?? { runs: 0, balls: 0 };
      if (b.extraKind !== "wide") s.balls += 1;
      s.runs += b.runsBatter;
      bat.set(b.striker, s);
      if (!bat.has(b.nonStriker)) bat.set(b.nonStriker, { runs: 0, balls: 0 });
      const w = bowl.get(b.bowler) ?? { runs: 0, balls: 0, wickets: 0 };
      if (b.legal) w.balls += 1;
      if (b.extraKind !== "bye") w.runs += b.runsBatter + b.extras;
      if (b.wicket && b.dismissal?.bowler) w.wickets += 1;
      bowl.set(b.bowler, w);
    }
    return { bat, bowl, legal };
  }, [balls, at, ball?.innings]);

  if (!ball || !i1 || !i2) return <div className="board"><p>No ball-by-ball record for this match.</p><button type="button" onClick={onDone}>Back to the paper</button></div>;

  const inn = ball.innings === 1 ? i1 : i2;
  const opposition = ball.innings === 1 ? i2.team : i1.team;
  const over = balls.slice(0, at + 1).filter((b) => b.innings === ball.innings && b.over === ball.over);
  const chasing = ball.innings === 2;
  const runs = started ? ball.runsAfter : 0;
  const wickets = started ? ball.wicketsAfter : 0;
  const target = inn.target ?? i1.runs + 1;
  const need = target - runs;
  const left = inn.scheduledOvers * 6 - state.legal;
  const toss = f.tossWinner ? `${f.tossWinner} won the toss and chose to ${f.tossDecision === "bat" ? "bat" : "field"}.` : "The players are out in the middle.";
  const superOver = f.tieBreak?.innings?.length === 2 ? ` ${f.tieBreak.innings[0]!.team} ${f.tieBreak.innings[0]!.runs}/${f.tieBreak.innings[0]!.wickets}, ${f.tieBreak.innings[1]!.team} ${f.tieBreak.innings[1]!.runs}/${f.tieBreak.innings[1]!.wickets} in the super over.` : "";
  const w = state.bowl.get(ball.bowler);
  const nextOver = () => {
    const next = balls.findIndex((b, i) => i > at && (b.over !== ball.over || b.innings !== ball.innings));
    setAt(next < 0 ? balls.length - 1 : next);
  };

  return (
    <section className="board" aria-label="Match scoreboard">
      <p className="board-kicker">{f.stageLabel} · {f.teams[0]} v {f.teams[1]}</p>
      <div className="board-main">
        <div className="board-score">
          <div className="board-team">{inn.team}</div>
          <div className="board-runs">{runs}<span>/{wickets}</span></div>
          <div className="board-overs">{oversText(state.legal)} {state.legal === 6 ? "over" : "overs"}{chasing ? ` · target ${target}` : ""}</div>
          {chasing && <div className="board-overs">{i1.team} {i1.runs}/{i1.wickets}</div>}
          {chasing && need > 0 && left > 0 && wickets < 10 && <div className="board-need">Need {need} off {left}</div>}
        </div>
        <div className="board-side">
          {[ball.striker, ball.nonStriker].map((id) => {
            const l = state.bat.get(id);
            return <div className={`board-row ${id === ball.striker ? "on" : ""}`} key={id}><span>{display(id)}{id === ball.striker ? " *" : ""}</span><b>{l?.runs ?? 0} ({l?.balls ?? 0})</b></div>;
          })}
          <div className="board-row dim"><span>{display(ball.bowler)} ({opposition})</span><b>{oversText(w?.balls ?? 0)}–{w?.runs ?? 0}–{w?.wickets ?? 0}</b></div>
        </div>
      </div>
      <p className="board-label">This over</p>
      <div className="board-over">{over.map((b, i) => <span key={i} className={`board-ball ${ballClass(b)}`}>{ballLabel(b)}</span>)}</div>
      <p className="board-line" aria-live="polite">{finished ? `${marginText(f)}.${superOver}` : started ? commentary(ball, short) : toss}</p>
      <div className="board-controls">
        {finished ? <button type="button" className="board-go" autoFocus onClick={onDone}>Read the report</button> : (
          <>
            <button type="button" onClick={() => { setSpeed(null); setAt((x) => x + 1); }}>Next ball</button>
            <button type="button" onClick={() => { setSpeed(null); nextOver(); }}>Next over</button>
            <button type="button" className={speed === "steady" ? "on" : ""} onClick={() => setSpeed(speed === "steady" ? null : "steady")}>{speed === "steady" ? "Pause" : "Auto"}</button>
            <button type="button" className={speed === "quick" ? "on" : ""} onClick={() => setSpeed(speed === "quick" ? null : "quick")}>Fast</button>
            <button type="button" onClick={onDone}>Skip to report</button>
          </>
        )}
      </div>
    </section>
  );
}
