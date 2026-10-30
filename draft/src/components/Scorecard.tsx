/**
 * Full scorecard in the modern layout (decided 2026-10-30, after the Cricket Chairman review):
 * batter with how he went under the name, R B 4s 6s SR, extras and total, fall of wickets and
 * partnerships, then O M R W Econ. Your own players are highlighted.
 */

import type { Dismissal, InningsResult } from "../../../wcdraft/src/engine/types.ts";

export function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
}

/** "c Dhoni b Bumrah", "lbw b Rashid", "run out (Jadeja)", "not out". */
export function dismissalText(d: Dismissal | null, out: boolean): string {
  if (!out || !d) return "not out";
  const b = d.bowler?.name ?? "";
  const f = d.fielder?.name ?? "";
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

export function Scorecard({ inn, fielding, highlight }: { inn: InningsResult; fielding: string; highlight: Set<string> }) {
  const names = new Map(inn.batting.map((b) => [b.id, b.name]));
  const batted = inn.batting.filter((b) => b.balls > 0 || b.out);
  const runRate = inn.legalBalls ? ((6 * inn.runs) / inn.legalBalls).toFixed(2) : "–";
  const ex = inn.extrasDetail;
  const stands = inn.partnerships.filter((p) => p.runs >= 20 || p.wicket === null).slice(0, 4);
  return (
    <div className="sc">
      <table className="sc-table sc-bat">
        <thead><tr><th><span className="mc-innings">{inn.index === 1 ? "1st" : "2nd"} innings</span> {inn.team} batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
        <tbody>
          {batted.map((b) => {
            const sr = b.balls ? (100 * b.runs) / b.balls : 0;
            return (
              <tr key={b.id} className={highlight.has(b.id) ? "hl" : ""}>
                <td><div className="sc-name">{b.name}</div><div className="sc-how">{dismissalText(b.dismissal, b.out)}</div></td>
                <td><b>{b.runs}</b></td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td>
                <td className={srClass(sr, b.balls)}>{b.balls ? sr.toFixed(1) : "–"}</td>
              </tr>
            );
          })}
          <tr className="sc-extras"><td>Extras</td><td colSpan={5}>{inn.extras} (w {ex.wides}, nb {ex.noBalls}, b {ex.byes})</td></tr>
          <tr className="sc-total"><td>Total</td><td colSpan={5}><b>{inn.runs}/{inn.wickets}</b> ({oversText(inn.legalBalls)} ov, {runRate} an over{inn.scheduledOvers < 20 ? `, ${inn.scheduledOvers}-over innings` : ""})</td></tr>
        </tbody>
      </table>
      {inn.fallOfWickets.length > 0 && (
        <p className="sc-fow"><span className="k">Fall of wickets</span> {inn.fallOfWickets.map((w, i) => `${w.runs}-${i + 1} (${names.get(w.batter) ?? w.batter}, ${w.over}.${w.ball})`).join(" · ")}</p>
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
              <tr key={w.id} className={highlight.has(w.id) ? "hl" : ""}>
                <td><div className="sc-name">{w.name}</div>{w.wides + w.noBalls > 0 && <div className="sc-how">{w.wides ? `${w.wides} wd` : ""}{w.wides && w.noBalls ? ", " : ""}{w.noBalls ? `${w.noBalls} nb` : ""}</div>}</td>
                <td>{w.overs.length}</td><td>{w.maidens}</td><td>{w.runs}</td><td><b>{w.wickets}</b></td>
                <td className={econClass(econ, w.balls)}>{econ.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
