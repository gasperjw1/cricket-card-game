// How batters and bowlers of each type answer a run of dots (2026-11-02, Yash's question: does a
// bowler attack or hold after consecutive dots, and does an aggressive batter handle them
// differently?). Same balls and adjustment as the engine's sequence tables (`analysis/pressure.ts`:
// T20Is and leagues since 2014, players and setness removed, real over a null shuffled within
// phase, striker and bowler); split by striker style, bowler pace/spin, and bowler dot and wicket
// thirds set on the other half of the archive. Each line: the next ball after 0, 1, 2, 3+ dots in a
// row against the same type's other balls in that innings, for dots (0), fours, sixes and wickets.
//   npx tsx scripts/research/dot-response.mts [innings=1,2]
import { ARCHIVES, LEAGUE_ARCHIVES, archiveIsReady, loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch } from "../../src/cricsheet/match.ts";
import { PressureAnalysis } from "../../src/analysis/pressure.ts";
import { TempoAnalysis } from "../../src/analysis/tempo.ts";
import { bowlGroupOf } from "../../src/analysis/matchups.ts";
import { readBowlerTypes } from "../../src/pipeline/bowler-types.ts";

const inningsList = (process.argv[2] ?? "1,2").split(",");
const entries = [
  ...loadIndex(ARCHIVES.t20).filter((e) => e.gender === "male"),
  ...LEAGUE_ARCHIVES.filter(archiveIsReady).flatMap((a) => loadIndex(a).filter((e) => e.gender === "male")),
];
const tempo = new TempoAnalysis(), pressure = new PressureAnalysis();
for (const e of entries) tempo.addPopulation(normaliseMatch(readMatch(e.file), e.id));
for (const e of entries) { const m = normaliseMatch(readMatch(e.file), e.id); tempo.add(m); pressure.add(m); }
tempo.freeze();
const types = readBowlerTypes();
pressure.tables((id, year) => tempo.styleAt(id, year)?.tag ?? null);
const rows = pressure.dotResponse((id, year) => tempo.styleAt(id, year)?.tag ?? null, (id) => bowlGroupOf(types.get(id)?.bowlingType));
const byKey = new Map(rows.map((r) => [r.key, r]));

const f = (x: number) => x.toFixed(2);
const dims = [...new Set(rows.map((r) => r.key.split("|")[0]!))].sort((a, b) => (a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b)));
for (const runKind of ["team", "own"]) for (const inn of inningsList) {
  console.log(`\n== ${runKind === "own" ? "the striker's own dots in a row" : "the side's dots in a row"}, innings ${inn}. Next ball: dot / four / six / wicket`);
  for (const d of dims) {
    const cells = ["0", "1", "2", "3+"].map((band) => byKey.get(`${d}|${inn}|${runKind}|${band}`));
    if (!cells[3]) continue;
    const line = cells.map((c, i) => (c ? `${["0", "1", "2", "3+"][i]}: ${f(c.multiplier["0"])} ${f(c.multiplier["4"])} ${f(c.multiplier["6"])} ${f(c.multiplier.W)}` : "–")).join("  |  ");
    console.log(`${d.padEnd(16)} 3+ n ${String(cells[3].balls).padStart(6)}  ${line}`);
  }
}
