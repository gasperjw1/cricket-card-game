// Associates against full members: the sim's win share on the real fixtures against what happened,
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// plus the sides' average card numbers, per edition.
import { readFileSync } from "node:fs";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { fullMembersAt } from "../../../draft/src/game/facts.ts";

const ids = (process.argv[2] ?? "2014,2016,2021,2022,2024,2026").split(",");
const sims = Number(process.argv[3] ?? 30);

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

let allN = 0, allReal = 0, allSim = 0;
const zero = () => ({ runs: 0, balls: 0, wkts: 0 });
const rb = { assocBat: { real: zero(), sim: zero() }, assocBowl: { real: zero(), sim: zero() } };
for (const id of ids) {
  const data = loadEdition(id);
  const full = fullMembersAt(id);
  const pool = JSON.parse(readFileSync(`${ROOT}/draft/public/data/pool/${id}.json`, "utf8")) as { team: string; bat: number; bowl: number; batShown: boolean; bowlShown: boolean }[];
  const cards = (t: string, k: "bat" | "bowl") => { const xs = pool.filter((p) => p.team === t && (k === "bat" ? p.batShown : p.bowlShown)).map((p) => p[k]); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; };
  let n = 0, realWins = 0, simWins = 0;
  const assocBat: number[] = [], assocBowl: number[] = [], fullBat: number[] = [], fullBowl: number[] = [];
  for (const t of new Set([...data.squads.keys()])) { if (data.squads.get(t)!.standIn) continue; (full.has(t) ? fullBat : assocBat).push(cards(t, "bat")); (full.has(t) ? fullBowl : assocBowl).push(cards(t, "bowl")); }
  for (const g of realMatches(data)) {
    const aFull = full.has(g.a), bFull = full.has(g.b);
    if (aFull === bFull || !g.match.winner) continue;
    const assoc = aFull ? g.b : g.a;
    const teamA = teamFromMatch(data, g.a, g.match), teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    let w = 0;
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(teamA, teamB, env, data.situation, { seed: `assoc-${id}-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b });
      if (r.winner === assoc) w += 1;
      for (const inn of r.innings) { const k = inn.team === assoc ? "assocBat" : "assocBowl"; rb[k].sim.runs += inn.runs; rb[k].sim.balls += inn.legalBalls; rb[k].sim.wkts += inn.wickets; }
    }
    // Real innings runs and balls from the squad match records (totals and overs faced).
    for (const [team, m, bowledBy] of [[g.a, g.match, g.other], [g.b, g.other, g.match]] as const) { const k = team === assoc ? "assocBat" : "assocBowl"; const balls = bowledBy.bowlerByOver.length * 6; if (m.total !== null && balls > 0) { rb[k].real.runs += m.total; rb[k].real.balls += balls; rb[k].real.wkts += m.wickets ?? 0; } }
    n += 1; simWins += w / sims; if (g.match.winner === assoc) realWins += 1;
  }
  const mean = (xs: number[]) => (xs.filter((x) => !Number.isNaN(x)).reduce((a, b) => a + b, 0) / Math.max(1, xs.filter((x) => !Number.isNaN(x)).length)).toFixed(1);
  console.log(`${id}: ${n} associate-v-full matches | associate wins real ${(100 * realWins / Math.max(1, n)).toFixed(1)}%  sim ${(100 * simWins / Math.max(1, n)).toFixed(1)}% | mean cards: associates bat ${mean(assocBat)} bowl ${mean(assocBowl)}; full members bat ${mean(fullBat)} bowl ${mean(fullBowl)}`);
  allN += n; allReal += realWins; allSim += simWins;
}
console.log(`\nALL: ${allN} matches, associate wins real ${(100 * allReal / allN).toFixed(1)}%  sim ${(100 * allSim / allN).toFixed(1)}%`);
const line = (k: "assocBat" | "assocBowl") => { const r = rb[k].real, s = rb[k].sim; return `${k === "assocBat" ? "associates batting v full members" : "full members batting v associates "}  rpo real ${(6 * r.runs / r.balls).toFixed(2)}  sim ${(6 * s.runs / s.balls).toFixed(2)} | balls per wicket real ${(r.balls / Math.max(1, r.wkts)).toFixed(1)}  sim ${(s.balls / Math.max(1, s.wkts)).toFixed(1)}`; };
console.log(line("assocBat"));
console.log(line("assocBowl"));
