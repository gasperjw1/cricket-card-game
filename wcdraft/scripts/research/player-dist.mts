// Player-level distribution test: the same real World Cup fixtures replayed N times, per-player
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// batting and bowling lines pooled by card band and compared with what really happened.
import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch, mainInnings } from "../../src/cricsheet/match.ts";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { readFileSync } from "node:fs";

import { setEngineOverrides } from "../../src/engine/model.ts";
const ids = (process.argv[2] ?? "2012,2014,2016,2021,2022,2024").split(",");
const sims = Number(process.argv[3] ?? 20);
if (process.argv[4]) { setEngineOverrides(JSON.parse(process.argv[4])); console.log("overrides", process.argv[4]); }
const config = loadConfig();
const index = loadIndex();
const wcEditionOf = (e: { eventName: string | null; season: string }) => (e.eventName && config.worldCupEventNames.has(e.eventName) ? (config.editionBySeason.get(e.season)?.id ?? null) : null);

interface Agg { inns: number; runs: number; balls: number; outs: number; fifties: number; thirties: number; ducks: number; bowlInns: number; bowlBalls: number; bowlRuns: number; wickets: number; threeFors: number }
const agg = (): Agg => ({ inns: 0, runs: 0, balls: 0, outs: 0, fifties: 0, thirties: 0, ducks: 0, bowlInns: 0, bowlBalls: 0, bowlRuns: 0, wickets: 0, threeFors: 0 });
const addBat = (a: Agg, runs: number, balls: number, out: boolean) => { if (balls === 0 && !out) return; a.inns += 1; a.runs += runs; a.balls += balls; if (out) a.outs += 1; if (runs >= 50) a.fifties += 1; if (runs >= 30) a.thirties += 1; if (out && runs === 0) a.ducks += 1; };
const addBowl = (a: Agg, balls: number, runs: number, w: number) => { if (balls === 0) return; a.bowlInns += 1; a.bowlBalls += balls; a.bowlRuns += runs; a.wickets += w; if (w >= 3) a.threeFors += 1; };

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

const BAT_BANDS: [string, (n: number) => boolean][] = [["bat 90+", (n) => n >= 90], ["bat 80-89", (n) => n >= 80 && n < 90], ["bat 70-79", (n) => n >= 70 && n < 80], ["bat <70", (n) => n < 70]];
const BOWL_BANDS: [string, (n: number) => boolean][] = [["bowl 85+", (n) => n >= 85], ["bowl 75-84", (n) => n >= 75 && n < 85], ["bowl <75", (n) => n < 75]];
const real = new Map<string, Agg>(), sim = new Map<string, Agg>();
const byPlayerReal = new Map<string, Agg>(), byPlayerSim = new Map<string, Agg>();
const cardOf = new Map<string, { bat: number; bowl: number; batShown: boolean; bowlShown: boolean; name: string }>();
const bucket = (m: Map<string, Agg>, k: string) => m.get(k) ?? m.set(k, agg()).get(k)!;

for (const id of ids) {
  const data = loadEdition(id);
  const pool = JSON.parse(readFileSync(`${ROOT}/draft/public/data/pool/${id}.json`, "utf8")) as { id: string; team: string; bat: number; bowl: number; batShown: boolean; bowlShown: boolean; name: string }[];
  for (const p of pool) cardOf.set(`${id}|${p.team}|${p.id}`, p);
  // Real lines from the archive.
  for (const e of index) {
    if (wcEditionOf(e) !== id) continue;
    const m = normaliseMatch(readMatch(e.file), e.id);
    for (const inn of mainInnings(m)) {
      for (const [pid, b] of inn.batters) { const c = cardOf.get(`${id}|${inn.team}|${pid}`); if (!c || !c.batShown) continue; for (const [band, f] of BAT_BANDS) if (f(c.bat)) addBat(bucket(real, band), b.runs, b.balls, b.out); addBat(bucket(byPlayerReal, `${id}|${inn.team}|${pid}`), b.runs, b.balls, b.out); }
      for (const [pid, w] of inn.bowlers) { const c = cardOf.get(`${id}|${inn.bowlingTeam}|${pid}`); if (!c || !c.bowlShown) continue; for (const [band, f] of BOWL_BANDS) if (f(c.bowl)) addBowl(bucket(real, band), w.balls, w.runs, w.wickets); addBowl(bucket(byPlayerReal, `${id}|${inn.bowlingTeam}|${pid}`), w.balls, w.runs, w.wickets); }
    }
  }
  // Simulated lines on the same fixtures.
  for (const g of realMatches(data)) {
    const teamA = teamFromMatch(data, g.a, g.match), teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    const battingFirst = g.match.battedFirst ? g.a : g.b;
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(teamA, teamB, env, data.situation, { seed: `pd-${id}-${g.match.id}-${s}`, battingFirst });
      for (const inn of r.innings) {
        const fielding = inn.team === g.a ? g.b : g.a;
        for (const b of inn.batting) { const c = cardOf.get(`${id}|${inn.team}|${b.id}`); if (!c || !c.batShown) continue; for (const [band, f] of BAT_BANDS) if (f(c.bat)) addBat(bucket(sim, band), b.runs, b.balls, b.out); addBat(bucket(byPlayerSim, `${id}|${inn.team}|${b.id}`), b.runs, b.balls, b.out); }
        for (const w of inn.bowling) { const c = cardOf.get(`${id}|${fielding}|${w.id}`); if (!c || !c.bowlShown) continue; for (const [band, f] of BOWL_BANDS) if (f(c.bowl)) addBowl(bucket(sim, band), w.balls, w.runs, w.wickets); addBowl(bucket(byPlayerSim, `${id}|${fielding}|${w.id}`), w.balls, w.runs, w.wickets); }
      }
    }
  }
}

const f1 = (n: number) => n.toFixed(1), f2 = (n: number) => n.toFixed(2);
console.log(`Editions ${ids.join(",")}, ${sims} sims a fixture. Batting by card band: innings, strike rate, balls per dismissal, 50+ %, 30+ %, duck %`);
for (const [band] of BAT_BANDS) for (const [label, m] of [["real", real], ["sim ", sim]] as const) { const a = m.get(band); if (!a) continue; console.log(`${band.padEnd(10)} ${label} inns ${String(a.inns).padStart(5)}  SR ${f1(100 * a.runs / a.balls)}  bpd ${f1(a.balls / Math.max(1, a.outs))}  50+ ${f1(100 * a.fifties / a.inns)}%  30+ ${f1(100 * a.thirties / a.inns)}%  ducks ${f1(100 * a.ducks / a.inns)}%`); }
console.log(`\nBowling by card band: innings, economy, balls per wicket, 3+ wickets %`);
for (const [band] of BOWL_BANDS) for (const [label, m] of [["real", real], ["sim ", sim]] as const) { const a = m.get(band); if (!a) continue; console.log(`${band.padEnd(10)} ${label} inns ${String(a.bowlInns).padStart(5)}  econ ${f2(6 * a.bowlRuns / a.bowlBalls)}  bpw ${f1(a.bowlBalls / Math.max(1, a.wickets))}  3+ ${f1(100 * a.threeFors / a.bowlInns)}%`); }

console.log(`\nLargest strike-rate gaps, players with 120+ real balls:`);
const gaps: { name: string; realSr: number; simSr: number; realBpd: number; simBpd: number; balls: number }[] = [];
for (const [k, r] of byPlayerReal) { const s = byPlayerSim.get(k); if (!s || r.balls < 120 || s.balls < 100) continue; gaps.push({ name: `${cardOf.get(k)!.name} (${k.slice(0, 4)}, bat ${cardOf.get(k)!.bat})`, realSr: 100 * r.runs / r.balls, simSr: 100 * s.runs / s.balls, realBpd: r.balls / Math.max(1, r.outs), simBpd: s.balls / Math.max(1, s.outs), balls: r.balls }); }
gaps.sort((a, b) => Math.abs(b.simSr - b.realSr) - Math.abs(a.simSr - a.realSr));
for (const g of gaps.slice(0, 12)) console.log(`${g.name.padEnd(40)} SR real ${f1(g.realSr)} sim ${f1(g.simSr)} | bpd real ${f1(g.realBpd)} sim ${f1(g.simBpd)} | ${g.balls} balls`);
const mean = gaps.reduce((a, g) => a + (g.simSr - g.realSr), 0) / gaps.length;
const mad = gaps.reduce((a, g) => a + Math.abs(g.simSr - g.realSr), 0) / gaps.length;
console.log(`\n${gaps.length} players with 120+ balls: mean SR gap (sim − real) ${f1(mean)}, mean absolute gap ${f1(mad)}`);
