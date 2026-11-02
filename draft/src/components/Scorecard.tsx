/**
 * Full scorecard in the modern layout (decided 2026-10-30, after the Cricket Chairman review):
 * batter with how he went under the name, R B 4s 6s SR, extras and total, fall of wickets and
 * partnerships, then O M R W Econ. Your own players are highlighted.
 */

import { useState } from "react";
import type { Dismissal, InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { familiar, fullName } from "../lib/names.ts";

export function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
}

/** A total's overs and run rate on one line: "20 ov, RR 12.70"; a rain-shortened side bowled out early shows its allotment, "9.3/12 ov". */
export function inningsLine(inn: InningsResult): string {
  const rate = inn.legalBalls ? ((6 * inn.runs) / inn.legalBalls).toFixed(2) : "–";
  const short = inn.scheduledOvers < 20 && inn.legalBalls < inn.scheduledOvers * 6;
  return `${oversText(inn.legalBalls)}${short ? `/${inn.scheduledOvers}` : ""} ov, RR ${rate}`;
}

/** "c †Dhoni b Bumrah", "c & b Bumrah", "lbw b Rashid", "run out (Jadeja)", "not out"; † marks the keeper. */
export function dismissalText(d: Dismissal | null, out: boolean): string {
  if (!out || !d) return "not out";
  const b = d.bowler ? familiar(d.bowler.id, d.bowler.name) : "";
  const f = d.fielder ? `${d.byKeeper ? "†" : ""}${familiar(d.fielder.id, d.fielder.name)}` : "";
  switch (d.kind) {
    case "caught": return `c ${f} b ${b}`;
    case "caught and bowled": return `c & b ${b}`;
    case "bowled": return `b ${b}`;
    case "lbw": return `lbw b ${b}`;
    case "stumped": return `st ${f} b ${b}`;
    case "hit wicket": return `hit wicket b ${b}`;
    case "run out": return `run out (${f})`;
  }
}

const srClass = (sr: number, balls: number) => (balls < 6 ? "" : sr >= 150 ? "num-good" : sr < 100 ? "num-bad" : "");
const econClass = (econ: number, balls: number) => (balls < 12 ? "" : econ <= 6.5 ? "num-good" : econ >= 9.5 ? "num-bad" : "");

/**
 * One innings as a card (decided 2026-11-01): batting on the left, bowling on the right with the
 * fall of wickets and the stands under it, "Did not bat" under the batting. One innings per view
 * keeps the two columns close in height; `MatchScorecard` puts the two innings behind tabs.
 */
export function InningsCard({ inn, fielding, highlight, me }: { inn: InningsResult; fielding: string; highlight: Set<string>; me: string }) {
  const names = new Map(inn.batting.map((b) => [b.id, familiar(b.id, b.name)]));
  const batted = inn.batting.filter((b) => b.balls > 0 || b.out);
  const didNotBat = inn.batting.filter((b) => !(b.balls > 0 || b.out));
  const ex = inn.extrasDetail;
  const mark = (id: string, name: string) => `${id === inn.keeperId ? "†" : ""}${name}${id === inn.captainId ? " (c)" : ""}`;
  const stands = inn.partnerships.filter((p) => p.runs >= 20 || p.wicket === null).slice(0, 5);
  return (
    <div className="inn-card">
      <div className="inn-col inn-bat">
        <table className="sc-table sc-bat">
          <thead><tr><th>{inn.team} batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
          <tbody>
            {batted.map((b) => {
              const sr = b.balls ? (100 * b.runs) / b.balls : 0;
              return (
                <tr key={b.id} className={inn.team === me && highlight.has(b.id) ? "hl" : ""}>
                  <td><div className="sc-name">{mark(b.id, fullName(b.id, b.name))}</div><div className="sc-how">{dismissalText(b.dismissal, b.out)}</div></td>
                  <td><b>{b.runs}</b></td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td>
                  <td className={srClass(sr, b.balls)}>{b.balls ? sr.toFixed(1) : "–"}</td>
                </tr>
              );
            })}
            <tr className="sc-extras"><td>Extras</td><td colSpan={5}>{inn.extras} <span className="muted">(b {ex.byes}, w {ex.wides}, nb {ex.noBalls})</span></td></tr>
            <tr className="sc-total"><td>Total</td><td colSpan={5}><b>{inn.runs}/{inn.wickets}</b> ({inningsLine(inn)})</td></tr>
          </tbody>
        </table>
        {didNotBat.length > 0 && <p className="sc-fow"><span className="k">Did not bat</span> {didNotBat.map((b) => mark(b.id, names.get(b.id) ?? b.name)).join(", ")}</p>}
      </div>
      <div className="inn-col inn-bowl">
        <table className="sc-table">
          <thead><tr><th>{fielding} bowling</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
          <tbody>
            {inn.bowling.map((w) => {
              const econ = w.balls ? (6 * w.runs) / w.balls : 0;
              return (
                <tr key={w.id} className={fielding === me && highlight.has(w.id) ? "hl" : ""}>
                  <td><div className="sc-name">{fullName(w.id, w.name)}</div>{w.wides + w.noBalls > 0 && <div className="sc-how">{w.wides ? `${w.wides} wd` : ""}{w.wides && w.noBalls ? ", " : ""}{w.noBalls ? `${w.noBalls} nb` : ""}</div>}</td>
                  <td>{oversText(w.balls)}</td><td>{w.maidens}</td><td>{w.runs}</td><td><b>{w.wickets}</b></td>
                  <td className={econClass(econ, w.balls)}>{econ.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {inn.fallOfWickets.length > 0 && (
          <p className="sc-fow"><span className="k">Fall of wickets</span> {inn.fallOfWickets.map((w, i) => `${i + 1}-${w.runs} (${names.get(w.batter) ?? w.batter}, ${w.over}.${w.ball} ov)`).join(", ")}</p>
        )}
        {stands.length > 0 && (
          <p className="sc-fow"><span className="k">Stands</span> {stands.map((p) => `${p.runs} (${p.balls}) ${names.get(p.batters[0]) ?? ""}–${names.get(p.batters[1]) ?? ""}${p.wicket === null ? "*" : ""}`).join(" · ")}</p>
        )}
      </div>
    </div>
  );
}

/** Both innings of a match behind "1st innings · 2nd innings" tabs; `only` pins one innings with no tabs. */
export function MatchScorecard({ innings, highlight, me, only }: { innings: InningsResult[]; highlight: Set<string>; me: string; only?: 1 | 2 }) {
  const [shown, setShown] = useState<number>(only ?? 1);
  const inn = innings.find((i) => i.index === shown) ?? innings[0];
  if (!inn) return null;
  const fielding = innings.find((i) => i !== inn)?.team ?? "";
  return (
    <div className="sc">
      {!only && innings.length > 1 && (
        <div className="inn-tabs" role="tablist">
          {innings.map((i) => <button key={i.index} type="button" role="tab" aria-selected={i.index === shown} className={i.index === shown ? "on" : ""} onClick={() => setShown(i.index)}>{i.index === 1 ? "1st" : "2nd"} innings <span className="muted">{i.team} {i.runs}/{i.wickets}</span></button>)}
        </div>
      )}
      <InningsCard inn={inn} fielding={fielding} highlight={highlight} me={me} />
    </div>
  );
}

export function Scorecard({ inn, fielding, highlight, me }: { inn: InningsResult; fielding: string; highlight: Set<string>; me: string }) {
  const names = new Map(inn.batting.map((b) => [b.id, familiar(b.id, b.name)]));
  const batted = inn.batting.filter((b) => b.balls > 0 || b.out);
  const ex = inn.extrasDetail;
  // The scorecard's own marks: the dagger before the keeper, (c) after the captain.
  const mark = (id: string, name: string) => `${id === inn.keeperId ? "†" : ""}${name}${id === inn.captainId ? " (c)" : ""}`;
  const didNotBat = inn.batting.filter((b) => !(b.balls > 0 || b.out));
  const stands = inn.partnerships.filter((p) => p.runs >= 20 || p.wicket === null).slice(0, 4);
  return (
    <div className="sc">
      <table className="sc-table sc-bat">
        <thead><tr><th><span className="mc-innings">{inn.index === 1 ? "1st" : "2nd"} innings</span> {inn.team} batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
        <tbody>
          {batted.map((b) => {
            const sr = b.balls ? (100 * b.runs) / b.balls : 0;
            return (
              <tr key={b.id} className={inn.team === me && highlight.has(b.id) ? "hl" : ""}>
                <td><div className="sc-name">{mark(b.id, fullName(b.id, b.name))}</div><div className="sc-how">{dismissalText(b.dismissal, b.out)}</div></td>
                <td><b>{b.runs}</b></td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td>
                <td className={srClass(sr, b.balls)}>{b.balls ? sr.toFixed(1) : "–"}</td>
              </tr>
            );
          })}
          <tr className="sc-extras"><td>Extras</td><td colSpan={5}>{inn.extras} <span className="muted">(b {ex.byes}, w {ex.wides}, nb {ex.noBalls})</span></td></tr>
          <tr className="sc-total"><td>Total</td><td colSpan={5}><b>{inn.runs}/{inn.wickets}</b> ({inningsLine(inn)})</td></tr>
        </tbody>
      </table>
      {didNotBat.length > 0 && (
        <p className="sc-fow"><span className="k">Did not bat</span> {didNotBat.map((b) => mark(b.id, names.get(b.id) ?? b.name)).join(", ")}</p>
      )}
      {inn.fallOfWickets.length > 0 && (
        <p className="sc-fow"><span className="k">Fall of wickets</span> {inn.fallOfWickets.map((w, i) => `${i + 1}-${w.runs} (${names.get(w.batter) ?? w.batter}, ${w.over}.${w.ball} ov)`).join(", ")}</p>
      )}
      {stands.length > 0 && (
        <p className="sc-fow"><span className="k">Stands</span> {stands.map((p) => `${p.runs} (${p.balls}) ${names.get(p.batters[0]) ?? ""}–${names.get(p.batters[1]) ?? ""}${p.wicket === null ? "*" : ""}`).join(" · ")}</p>
      )}
      <table className="sc-table">
        <thead><tr><th>{fielding} bowling</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
        <tbody>
          {inn.bowling.map((w) => {
            const econ = w.balls ? (6 * w.runs) / w.balls : 0;
            return (
              <tr key={w.id} className={fielding === me && highlight.has(w.id) ? "hl" : ""}>
                <td><div className="sc-name">{fullName(w.id, w.name)}</div>{w.wides + w.noBalls > 0 && <div className="sc-how">{w.wides ? `${w.wides} wd` : ""}{w.wides && w.noBalls ? ", " : ""}{w.noBalls ? `${w.noBalls} nb` : ""}</div>}</td>
                <td>{oversText(w.balls)}</td><td>{w.maidens}</td><td>{w.runs}</td><td><b>{w.wickets}</b></td>
                <td className={econClass(econ, w.balls)}>{econ.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
