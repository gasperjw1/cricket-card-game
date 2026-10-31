import { useEffect, useState } from "react";
import type { EditionOut } from "../../../wcdraft/src/engine/data.ts";
import type { ClassSplitPart } from "../../../wcdraft/src/ratings/model.ts";
import type { FinalSkill, PlayerFinal, Skill } from "../game/final-ratings.ts";
import { finalRatings, type SimulateInput } from "../game/simulate.ts";
import { TierBadge } from "./PlayerCard.tsx";

/** A player's figures in this run, from the kept scorecards. */
export interface RunLine {
  innings: number;
  runs: number;
  balls: number;
  outs: number;
  wickets: number;
  bowlRuns: number;
  bowlBalls: number;
}

const PHASE_NAMES = { pp: "Powerplay", mid: "Middle", death: "Death" } as const;
const SOURCE_NAMES: Record<FinalSkill["evidence"]["source"], string> = {
  form: "recent T20Is",
  career: "career T20Is",
  domestic: "league T20s",
  odi: "ODIs",
  tournament: "the tournament itself, with no earlier record",
  population: "the average for the batting position, with no record",
};

const signed = (n: number) => (n > 0 ? `+${n}` : n === 0 ? "0" : `−${Math.abs(n)}`);
const deltaClass = (n: number, flip = false) => (n === 0 ? "" : (n > 0) !== flip ? "num-good" : "num-bad");
const balls = (n: number) => n.toLocaleString("en-US");
const rate = (x: number, skill: Skill) => (skill === "bat" ? x.toFixed(0) : x.toFixed(2));

function Rating({ skill, label }: { skill: FinalSkill | null; label: string }) {
  if (!skill) return <span className="fr-num muted">keeps</span>;
  if (!skill.shown) return <span className="fr-num muted">{label}</span>;
  const moved = skill.final - skill.card;
  const low = skill.lowSample ? "*" : "";
  return <span className="fr-num">{skill.card}{low} <span className="muted">to</span> <b className={deltaClass(moved)}>{skill.final}{low}</b></span>;
}

function SkillDetail({ title, skill, kind, then, here, run }: { title: string; skill: FinalSkill; kind: Skill; then: string; here: string; run: string | null }) {
  const unit = kind === "bat" ? "Strike rate" : "Economy";
  const riskUnit = kind === "bat" ? "Balls per dismissal" : "Balls per wicket";
  const e = skill.evidence;
  return (
    <div className="fr-skill">
      <h4>{title}</h4>
      {skill.shown ? (
        <table className="table fr-steps">
          <tbody>
            <tr><td>Card rating ({then})</td><td>{skill.card}{skill.lowSample ? "*" : ""}</td></tr>
            {skill.steps.map((s) => <tr key={s.key}><td>{s.label}</td><td className={deltaClass(s.delta)}>{signed(s.delta)}</td></tr>)}
            <tr className="fr-total"><td>Final rating ({here})</td><td>{skill.final}{skill.lowSample ? "*" : ""}</td></tr>
          </tbody>
        </table>
      ) : <p className="small">No rating shown: the record is too thin. The rates below are an estimate from the player's position in the order.</p>}
      <table className="table fr-rates">
        <thead><tr><th>Against average opposition</th><th>{unit} {then}</th><th>{unit} {here}</th><th>{riskUnit} {here}</th></tr></thead>
        <tbody>
          {skill.phases.map((p) => <tr key={p.phase}><td>{PHASE_NAMES[p.phase]}</td><td>{rate(p.then.rate, kind)}</td><td>{rate(p.here.rate, kind)}</td><td>{p.here.ballsPerOut.toFixed(0)}</td></tr>)}
          <tr className="fr-total"><td>Overall</td><td>{rate(skill.then.rate, kind)}</td><td>{rate(skill.here.rate, kind)}</td><td>{skill.here.ballsPerOut.toFixed(0)}</td></tr>
        </tbody>
      </table>
      <p className="small">
        Rated mainly from {SOURCE_NAMES[e.source]}: {balls(e.formBalls)} balls in the two years before, {balls(e.careerBalls)} in all T20Is, {balls(e.domesticBalls)} in leagues, {balls(e.odiBalls)} in ODIs.
        {" "}{Math.round(100 * e.transfer)}% of the edge carries against the strongest sides.
      </p>
      {run && <p className="small">In this run: {run}.</p>}
    </div>
  );
}

function batLine(r: RunLine | undefined): string | null {
  if (!r?.innings) return null;
  return `${r.runs} runs off ${r.balls} balls in ${r.innings} innings, strike rate ${r.balls ? ((100 * r.runs) / r.balls).toFixed(0) : "–"}`;
}

function bowlLine(r: RunLine | undefined): string | null {
  if (!r?.bowlBalls) return null;
  const overs = `${Math.floor(r.bowlBalls / 6)}${r.bowlBalls % 6 ? `.${r.bowlBalls % 6}` : ""}`;
  return `${r.wickets} ${r.wickets === 1 ? "wicket" : "wickets"} in ${overs} overs, economy ${((6 * r.bowlRuns) / r.bowlBalls).toFixed(2)}`;
}

function vsClassLine(f: PlayerFinal): string | null {
  if (!f.batting.shown || !f.vsClass) return null;
  const part = (label: string, c: ClassSplitPart) => `${label} ${c.display}${c.estimated ? "*" : ""} (${c.balls} balls${c.fromOdi ? ", with ODIs" : ""})`;
  return `${part("v pace", f.vsClass.pace)} · ${part("v spin", f.vsClass.spin)}`;
}

export function PlayerRatings({ input, editions, lines }: { input: SimulateInput; editions: EditionOut[]; lines: Map<string, RunLine> }) {
  const [finals, setFinals] = useState<PlayerFinal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const here = input.identity.editionId;

  useEffect(() => {
    let live = true;
    finalRatings(input, editions).then((f) => { if (live) setFinals(f); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [input, editions]);

  if (error) return <div className="card"><p className="error">Could not work out the ratings: {error}</p></div>;
  if (!finals) return <div className="card"><p className="small">Working out your ratings…</p></div>;

  return (
    <div className="card">
      <h3>Player ratings</h3>
      <p className="small">
        A card rating belongs to the player's own World Cup. The final rating is the same player in {here}: the numbers the simulation used, measured against this tournament's field and
        changed by the era, the batting slot, the pace and spin mix and the coach. Rates are against average opposition, before match situation. * means a thin record.
      </p>
      <div className="fr-list">
        {finals.map((f) => {
          const p = f.player;
          const run = lines.get(p.id);
          const split = vsClassLine(f);
          return (
            <details className="fr-player" key={p.id}>
              <summary>
                <span className="fr-pos">{f.position}</span>
                <span className="fr-who"><span className="fr-name">{p.name}</span><span className="small">{p.team} {p.editionId}</span></span>
                <span className="fr-ratings">
                  <span className="fr-pair"><span className="k">Bat</span> <Rating skill={f.batting} label="rarely bats" /></span>
                  <span className="fr-pair"><span className="k">Bowl</span> <Rating skill={f.bowling} label="rarely bowls" /></span>
                </span>
              </summary>
              <div className="fr-body">
                <p className="fr-tags"><TierBadge tier={p.tier} /> <span className="small">{p.role}{p.keeper ? " · keeper" : ""}{p.squadPlayer ? " · squad player" : ""}</span></p>
                {split && <p className="small">{split}</p>}
                <SkillDetail title="Batting" skill={f.batting} kind="bat" then={p.editionId} here={here} run={batLine(run)} />
                {f.bowling
                  ? <SkillDetail title="Bowling" skill={f.bowling} kind="bowl" then={p.editionId} here={here} run={bowlLine(run)} />
                  : <p className="small">The designated keeper keeps and does not bowl.</p>}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
