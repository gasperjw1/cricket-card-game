// Chases by required rate, real World Cup balls against the sim on the same fixtures (2026-11-02):
// six, dot and wicket rates per 100 legal balls in each required-rate band, split live (up to 7
// down, the pressure table's range) and late (8 or more down). Covers the two items the refit left
// unmeasured: sixes at a required 14–16, and dots in chases that are already gone (18+).
// Full 20-over matches only; rain-affected sims are skipped.
//   npx tsx scripts/research/chase-pressure.mts [editions=2012,2014,2016,2021,2022,2024] [sims=10] [overridesJson]
import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch, mainInnings } from "../../src/cricsheet/match.ts";
import { pressureBand, PRESSURE_BANDS } from "../../src/analysis/situation.ts";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { setEngineOverrides } from "../../src/engine/model.ts";

const ids = (process.argv[2] ?? "2012,2014,2016,2021,2022,2024").split(",");
const sims = Number(process.argv[3] ?? 10);
if (process.argv[4]) setEngineOverrides(JSON.parse(process.argv[4]));
const config = loadConfig();
const index = loadIndex();
const wcEditionOf = (e: { eventName: string | null; season: string }) => (e.eventName && config.worldCupEventNames.has(e.eventName) ? (config.editionBySeason.get(e.season)?.id ?? null) : null);

type Cell = { n: number; six: number; dot: number; w: number };
type Tally = Map<string, Cell>;
const real: Tally = new Map(), sim: Tally = new Map();
type Ball = { legal: boolean; runs: number; total: number; out: boolean };

/** One chase in order, against its target. */
function feed(t: Tally, target: number, balls: Ball[]) {
  let runs = 0, wickets = 0, legal = 0;
  for (const b of balls) {
    if (b.legal && runs < target && legal < 120) {
      const rpo = ((target - runs) * 6) / (120 - legal);
      const key = `${wickets <= 7 ? "live" : "late"}|${pressureBand(rpo)}`;
      const c = t.get(key) ?? t.set(key, { n: 0, six: 0, dot: 0, w: 0 }).get(key)!;
      c.n += 1;
      if (b.runs >= 6) c.six += 1;
      if (b.total === 0 && !b.out) c.dot += 1;
      if (b.out) c.w += 1;
      legal += 1;
    }
    runs += b.total;
    if (b.out) wickets += 1;
  }
}

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

for (const id of ids) {
  for (const e of index) {
    if (wcEditionOf(e) !== id) continue;
    const m = normaliseMatch(readMatch(e.file), e.id);
    if ((m.scheduledOvers || 20) !== 20) continue;
    const [first, second] = mainInnings(m);
    if (!first || !second || first.reduced || second.reduced || second.superOver) continue;
    feed(real, second.target ?? first.total + 1, second.balls.map((b) => ({ legal: b.legal, runs: b.runsBatter, total: b.runsTotal, out: b.wickets.length > 0 })));
  }
  const data = loadEdition(id);
  for (const g of realMatches(data)) {
    const teamA = teamFromMatch(data, g.a, g.match), teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(teamA, teamB, env, data.situation, { seed: `chase-${id}-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b, keepBallLog: true });
      if (r.rain) continue;
      const firstBalls = r.balls.filter((b) => b.innings === 1);
      const target = (firstBalls[firstBalls.length - 1]?.runsAfter ?? 0) + 1;
      feed(sim, target, r.balls.filter((b) => b.innings === 2).map((b) => ({ legal: b.legal, runs: b.runsBatter, total: b.runsBatter + b.extras, out: b.wicket })));
    }
  }
}

const per100 = (x: number, n: number) => (n ? ((100 * x) / n).toFixed(1) : "–").padStart(5);
console.log(`Chases, editions ${ids.join(",")}, ${sims} sims a fixture. Per 100 legal balls: sixes, dots, wickets (real / sim).`);
for (const state of ["live", "late"]) for (const band of PRESSURE_BANDS) {
  const r = real.get(`${state}|${band}`), s = sim.get(`${state}|${band}`);
  if (!r && !s) continue;
  const z = { n: 0, six: 0, dot: 0, w: 0 };
  const a = r ?? z, b = s ?? z;
  console.log(`${state} ${band.padEnd(6)} | balls ${String(a.n).padStart(5)} / ${String(Math.round(b.n / sims)).padStart(5)} a run | six ${per100(a.six, a.n)} / ${per100(b.six, b.n)} | dot ${per100(a.dot, a.n)} / ${per100(b.dot, b.n)} | W ${per100(a.w, a.n)} / ${per100(b.w, b.n)}`);
}
