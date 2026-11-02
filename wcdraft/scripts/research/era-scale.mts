// Why do bowling cards move ±13 between editions? Compare each bowler's rates then and here with his era step,
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// and print the two editions' bowling field scales (what value maps to 45 / 70 / 99).
import { readFileSync } from "node:fs";
import { loadEdition } from "../../src/engine/load.ts";
import { computeFinal, editionEnv, valueIn } from "../../../draft/src/game/final-ratings.ts";
import { slotWeights } from "../../../draft/src/game/slots.ts";

const root = ROOT;
const [from, to] = [process.argv[2] ?? "2012", process.argv[3] ?? "2016"];
const ratings = (id: string) => JSON.parse(readFileSync(`${root}/wcdraft/data/out/ratings/${id}.json`, "utf8"));
const pool = (id: string) => JSON.parse(readFileSync(`${root}/draft/public/data/pool/${id}.json`, "utf8"));
const editions = JSON.parse(readFileSync(`${root}/wcdraft/data/out/editions.json`, "utf8"));
const home = loadEdition(from), here = loadEdition(to);
const rHome = ratings(from), rHere = ratings(to);
const envHome = editionEnv(home, rHome), envHere = editionEnv(here, rHere);

// The field scale: which bowling value sits at 45, 70 and 99 in each edition.
const fieldValues = (data: typeof home, rs: any[], env: typeof envHome) => rs.flatMap((r) => { const p = data.players.get(`${r.team}|${r.personId}`); return p && r.bowling.shown && !r.bowling.lowSample ? [valueIn(p, "bowl", env.base, r.bowling.evidence.phaseWeights)] : []; }).sort((a, b) => a - b);
for (const [id, data, rs, env] of [[from, home, rHome, envHome], [to, here, rHere, envHere]] as const) {
  const v = fieldValues(data, rs, env);
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]!;
  console.log(`${id} bowling field: n ${v.length}, p5 ${q(0.05).toFixed(1)}, median ${q(0.5).toFixed(1)}, p99 ${q(0.99).toFixed(1)} (value units: % of base runs saved per ball + wickets)`);
}

console.log(`\n${from} bowlers in ${to}: card, era step, economy then→here, balls per wicket then→here`);
const rows: string[] = [];
let sumStep = 0, n = 0, sumEconShift = 0;
for (const p of pool(from).filter((p: any) => p.bowlShown)) {
  const engine = home.players.get(`${p.team}|${p.id}`);
  const rating = rHome.find((x: any) => x.personId === p.id && x.team === p.team);
  if (!engine || !rating) continue;
  const f = computeFinal({ player: p, rating, engine, home: envHome, here: envHere, position: p.position ?? 9, slot: slotWeights(editions, to, p.position ?? 9), classMix: { pace: 0.6, spin: 0.4 }, keeps: false });
  const b = f.bowling!;
  const step = b.steps.find((s) => s.key === "era")!.delta;
  sumStep += step; n += 1; sumEconShift += b.here.rate - b.then.rate;
  rows.push(`${p.name.padEnd(22)} card ${String(p.bowl).padStart(3)} era ${String(step).padStart(4)} | econ ${b.then.rate.toFixed(2)}→${b.here.rate.toFixed(2)} | bpw ${b.then.ballsPerOut.toFixed(1)}→${b.here.ballsPerOut.toFixed(1)}${p.bowlLow ? " (thin)" : ""}`);
}
console.log(rows.slice(0, 40).join("\n"));
console.log(`\nmean era step ${(sumStep / n).toFixed(1)} over ${n} bowlers; mean economy shift ${(sumEconShift / n).toFixed(2)} runs an over`);
