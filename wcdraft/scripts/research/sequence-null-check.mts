// Does the sequence measurement find effects that aren't there? (2026-11-02.) The adjusted streak
// and dot tables (`analysis/pressure.ts`) read the sim's own balls: World Cup fixtures with real
// elevens, many sims each, turned into archive-shaped matches and measured exactly as the archive
// is. With `off` the engine plays no streak, ball-in-over or chase-dot term, so a sound method
// reads about 1 everywhere; whatever it reads instead is the method's own bias. With `on` (the
// engine as it plays), it should give back roughly the tables the engine was given.
//   npx tsx scripts/research/sequence-null-check.mts [off|on] [sims=40] [editions=2014,2016,2021,2022,2024,2026]
import type { Match } from "../../src/cricsheet/match.ts";
import { PressureAnalysis } from "../../src/analysis/pressure.ts";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { setEngineOverrides } from "../../src/engine/model.ts";
import type { MatchResult } from "../../src/engine/types.ts";
import { readFileSync } from "node:fs";

const mode = process.argv[2] ?? "off";
const sims = Number(process.argv[3] ?? 40);
const ids = (process.argv[4] ?? "2014,2016,2021,2022,2024,2026").split(",");
if (mode === "off") setEngineOverrides({ streakExponent: 0, ballInOverExponent: 0, chaseDotsExponent: 0 });
// `bare`: pressure off as well, the one remaining term that ties a chase ball to the dots before it (they raise the rate).
if (mode === "bare") setEngineOverrides({ streakExponent: 0, ballInOverExponent: 0, chaseDotsExponent: 0, pressureExponent: 0 });

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

/** The fields `PressureAnalysis.add` reads, from one simulated match. */
function asMatch(r: MatchResult, id: string, year: string): Match {
  const innings = [1, 2].map((n) => {
    const balls = r.balls.filter((b) => b.innings === n).map((b) => ({
      over: b.over, batter: b.striker, nonStriker: b.nonStriker, bowler: b.bowler, runsBatter: b.runsBatter, runsTotal: b.runsBatter + b.extras,
      legal: b.legal, isFour: b.runsBatter === 4, isSix: b.runsBatter >= 6,
      wickets: b.wicket ? [{ playerOut: b.dismissal?.nonStriker ? b.nonStriker : b.striker }] : [],
    }));
    const total = balls.reduce((a, b) => a + b.runsTotal, 0);
    const battingOrder = [...new Set(balls.flatMap((b) => [b.batter, b.nonStriker]))];
    return { index: n - 1, team: r.innings[n - 1]?.team ?? "", superOver: false, reduced: false, balls, total, battingOrder };
  });
  return { id, date: `${year}-06-01`, scheduledOvers: 20, innings: [{ ...innings[0]!, target: null }, { ...innings[1]!, target: innings[0]!.total + 1 }] } as unknown as Match;
}

const pressure = new PressureAnalysis();
let matches = 0;
for (const id of ids) {
  const data = loadEdition(id);
  for (const g of realMatches(data)) {
    const teamA = teamFromMatch(data, g.a, g.match), teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(teamA, teamB, env, data.situation, { seed: `nullcheck-${id}-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b, keepBallLog: true });
      if (r.rain || r.tieBreak) continue;
      pressure.add(asMatch(r, `${g.match.id}-${s}`, id < "2014" ? "2014" : id));
      matches += 1;
    }
  }
}
const t = pressure.tables(() => null);
const given = JSON.parse(readFileSync(new URL("../../data/out/situation.json", import.meta.url), "utf8")).states;
const f = (x: number | undefined) => (x === undefined ? "  –  " : x.toFixed(2));
console.log(`${mode}: ${matches} simulated matches. Measured on the sim (engine given) for dot / four / six / wicket.`);
const show = (label: string, measured: Record<string, Record<string, number>> | undefined, input: Record<string, Record<string, number>> | undefined, keys: string[]) => {
  console.log(`\n== ${label}`);
  for (const k of keys) {
    const m = measured?.[k], g = input?.[k];
    console.log(`${k.padEnd(20)} ${["0", "4", "6", "W"].map((o) => `${o} ${f(m?.[o])} (${f(g?.[o])})`).join("  ")}`);
  }
};
const streakKeys = ["1|mid|w0-2", "1|death|w3-5", "2|mid|w0-2", "2|mid|w3-5"].flatMap((c) => ["0-3", "4-7", "8-12", "13+"].map((b) => `${c}|${b}`));
const dotKeys = ["pp|w0-2", "mid|w0-2", "mid|w3-5", "death|w3-5"].flatMap((c) => ["0", "1", "2", "3+"].map((b) => `${c}|${b}`));
show("streak", t.streak, given.streak, streakKeys);
show("chase dots", t.chaseDots, given.chaseDots, dotKeys);
