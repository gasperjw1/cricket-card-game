import { useEffect, useState } from "react";
import type { StyleResults as Results, StyleRow } from "../../../wcdraft/src/ratings/model.ts";
import { loadStyleResults } from "../lib/data.ts";
import { fullName } from "../lib/names.ts";
import { STYLE_NOTES } from "./PlayerCard.tsx";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
const numClass = (n: number) => (n >= 1 ? "num-good" : n <= -1 ? "num-bad" : "");

function Row({ row, all }: { row: StyleRow; all: StyleRow | undefined }) {
  return (
    <tr>
      <td>{row.style ?? "Too few balls"}{row.style && <small className="style-note">{STYLE_NOTES[row.style]}</small>}</td>
      <td>{row.ballsPct.toFixed(0)}%</td>
      <td className={numClass(row.addedPer100)}><b>{signed(row.addedPer100)}</b></td>
      <td className="muted">{all ? signed(all.addedPer100) : "–"}</td>
      <td className="style-best">{row.style && row.best ? fullName(row.best.id, row.best.name) : "–"}</td>
    </tr>
  );
}

/** What each batting style added at the real World Cup, and how the champions' top six batted. */
export function StyleResults({ editionId }: { editionId: string }) {
  const [data, setData] = useState<Results | null>(null);
  useEffect(() => { void loadStyleResults().then(setData); }, []);
  const edition = data?.editions.find((e) => e.editionId === editionId);
  if (!data || !edition) return null;
  const champion = edition.champion;
  return (
    <div className="style-results">
      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>Style</th><th>Balls</th><th title="Runs added per 100 balls against this World Cup's average ball">{editionId}</th><th title="The same, across all ten World Cups">All</th><th>Most runs added</th></tr></thead>
          <tbody>{edition.rows.map((r) => <Row key={r.style ?? "none"} row={r} all={data.overall.find((o) => o.style === r.style)} />)}</tbody>
        </table>
      </div>
      {champion && <p className="small"><b>{champion.team}</b>, champions. Top six: {champion.topSix.map((p) => `${fullName(p.id, p.name)} (${p.style ?? "too few balls"})`).join(", ")}.</p>}
      <p className="small">Runs added per 100 balls against the average ball of that World Cup. A wicket costs what it was worth at that point of the innings. Styles include each batter's later career, so treat this as a guide.</p>
    </div>
  );
}
