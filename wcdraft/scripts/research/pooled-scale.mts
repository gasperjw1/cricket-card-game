// Pooled card scale: the batting and bowling values (relative to each edition's own base) at the
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// 5th, 50th and 99th percentiles, per edition and over all editions together.
import { readFileSync } from "node:fs";
import { loadEdition } from "../../src/engine/load.ts";
import { valueIn } from "../../../draft/src/game/final-ratings.ts";

const root = ROOT;
const ids = ["2007", "2009", "2010", "2012", "2014", "2016", "2021", "2022", "2024", "2026"];
const q = (v: number[], p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))] ?? 0;
const pooled: Record<"bat" | "bowl", number[]> = { bat: [], bowl: [] };
for (const id of ids) {
  const data = loadEdition(id);
  const rs = JSON.parse(readFileSync(`${root}/wcdraft/data/out/ratings/${id}.json`, "utf8"));
  const base = data.populations.editionPop;
  for (const skill of ["bat", "bowl"] as const) {
    const v = rs.flatMap((r: any) => { const s = skill === "bat" ? r.batting : r.bowling; const p = data.players.get(`${r.team}|${r.personId}`); return p && s.shown && !s.lowSample ? [valueIn(p, skill, base, s.evidence.phaseWeights)] : []; }).sort((a: number, b: number) => a - b);
    pooled[skill].push(...v);
    console.log(`${id} ${skill.padEnd(4)} n ${String(v.length).padStart(3)}  p5 ${q(v, 0.05).toFixed(1).padStart(6)}  median ${q(v, 0.5).toFixed(1).padStart(6)}  p99 ${q(v, 0.99).toFixed(1).padStart(6)}`);
  }
}
for (const skill of ["bat", "bowl"] as const) {
  const v = pooled[skill].sort((a, b) => a - b);
  console.log(`POOLED ${skill} n ${v.length}  p5 ${q(v, 0.05).toFixed(2)}  median ${q(v, 0.5).toFixed(2)}  p99 ${q(v, 0.99).toFixed(2)}`);
}
