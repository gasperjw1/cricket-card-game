// Dot clustering: P(dot | previous legal ball a dot) against P(dot | previous ball scored), real
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// World Cup balls against the sim's on the same fixtures, by phase. If the real dependency is
// larger than the sim's, the engine is missing a within-over mechanism.
import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch, mainInnings, phaseOf } from "../../src/cricsheet/match.ts";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";

const ids = (process.argv[2] ?? "2012,2014,2016,2021,2022,2024").split(",");
const sims = Number(process.argv[3] ?? 10);
const config = loadConfig();
const index = loadIndex();
const wcEditionOf = (e: { eventName: string | null; season: string }) => (e.eventName && config.worldCupEventNames.has(e.eventName) ? (config.editionBySeason.get(e.season)?.id ?? null) : null);

type Tally = Record<string, { afterDot: [number, number]; afterRun: [number, number]; sameOverAfterDot: [number, number]; newOverAfterDot: [number, number] }>;
const tally = (): Tally => Object.fromEntries(["pp", "mid", "death", "all"].map((p) => [p, { afterDot: [0, 0], afterRun: [0, 0], sameOverAfterDot: [0, 0], newOverAfterDot: [0, 0] }]));
const real = tally(), sim = tally();

/** Feed one innings' legal balls in order: (isDot, over, phase). */
function feed(t: Tally, balls: { dot: boolean; over: number; phase: string }[]) {
  for (let i = 1; i < balls.length; i += 1) {
    const prev = balls[i - 1]!, cur = balls[i]!;
    for (const p of [cur.phase, "all"]) {
      const row = t[p]!;
      const key = prev.dot ? "afterDot" : "afterRun";
      row[key][0] += cur.dot ? 1 : 0; row[key][1] += 1;
      if (prev.dot) { const k2 = prev.over === cur.over ? "sameOverAfterDot" : "newOverAfterDot"; row[k2][0] += cur.dot ? 1 : 0; row[k2][1] += 1; }
    }
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
    for (const inn of mainInnings(m)) feed(real, inn.balls.filter((b) => b.legal).map((b) => ({ dot: b.runsTotal === 0, over: b.over, phase: phaseOf(b.over) })));
  }
  const data = loadEdition(id);
  for (const g of realMatches(data)) {
    const teamA = teamFromMatch(data, g.a, g.match), teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(teamA, teamB, env, data.situation, { seed: `dots-${id}-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b, keepBallLog: true });
      for (const innIndex of [1, 2] as const) feed(sim, r.balls.filter((b) => b.innings === innIndex && b.legal).map((b) => ({ dot: b.runsBatter + b.extras === 0, over: b.over, phase: phaseOf(b.over) })));
    }
  }
}

const pct = ([a, n]: [number, number]) => (n ? (100 * a / n).toFixed(1) : "–");
console.log(`Editions ${ids.join(",")}, ${sims} sims a fixture. Dot % after a dot v after a scoring ball; after a dot in the same over v the first ball of a new over.`);
for (const p of ["pp", "mid", "death", "all"]) for (const [label, t] of [["real", real], ["sim ", sim]] as const) {
  const r = t[p]!;
  console.log(`${p.padEnd(6)} ${label}  after dot ${pct(r.afterDot).padStart(5)}%  after run ${pct(r.afterRun).padStart(5)}%  lift ${(Number(pct(r.afterDot)) - Number(pct(r.afterRun))).toFixed(1).padStart(5)}  | same over ${pct(r.sameOverAfterDot)}%  new over ${pct(r.newOverAfterDot)}%  (n ${r.afterDot[1] + r.afterRun[1]})`);
}
