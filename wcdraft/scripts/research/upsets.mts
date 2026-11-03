// Upsets (an associate beats a full member, membership by edition) per edition, real against sim
// (2026-11-02). Real: every World Cup match in the squad records that both sides played (stand-ins
// excluded, so Afghanistan's withheld matches are not counted). Sim: CPU tournaments on the
// gazette corpus seeds (`corpus-<edition>-<n>`), so the shares match `draft/scripts/facts-corpus.mts`.
//   npx tsx scripts/research/upsets.mts [seeds=10]
import { loadEdition } from "../../src/engine/load.ts";
import { simulateTournament } from "../../src/engine/tournament.ts";
import { fullMembersAt } from "../../../draft/src/game/facts.ts";

const seeds = Number(process.argv[2] ?? 10);
const EDITIONS = ["2007", "2009", "2010", "2012", "2014", "2016", "2021", "2022", "2024", "2026"];
type Tally = { matches: number; cross: number; upsets: number };
const z = (): Tally => ({ matches: 0, cross: 0, upsets: 0 });
const total = { real: z(), sim: z() };
const count = (t: Tally, teams: [string, string], winner: string | null, full: Set<string>) => {
  t.matches += 1;
  if (full.has(teams[0]) === full.has(teams[1])) return;
  t.cross += 1;
  if (winner && !full.has(winner)) t.upsets += 1;
};
const add = (a: Tally, b: Tally) => { a.matches += b.matches; a.cross += b.cross; a.upsets += b.upsets; };
const pct = (x: number, n: number) => `${((100 * x) / Math.max(1, n)).toFixed(1)}%`;

console.log("edition | real: upsets / cross-tier / matches | sim a tournament: upsets / cross-tier / matches | sim share of cross-tier");
for (const ed of EDITIONS) {
  const data = loadEdition(ed);
  const full = fullMembersAt(ed);
  const real = z(), sim = z();
  const seen = new Map<string, { team: string; winner: string | null }[]>();
  for (const s of data.squads.values()) {
    if (s.standIn) continue;
    for (const m of s.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: s.team, winner: m.winner ?? null });
  }
  for (const sides of seen.values()) if (sides.length === 2) count(real, [sides[0]!.team, sides[1]!.team], sides[0]!.winner, full);
  for (let s = 1; s <= seeds; s += 1) {
    const r = simulateTournament(data, data.progression, { seed: `corpus-${ed}-${s}` });
    for (const st of r.stages) for (const f of st.fixtures) count(sim, f.teams, f.winner, full);
  }
  add(total.real, real); add(total.sim, sim);
  const per = (x: number) => (x / seeds).toFixed(1);
  console.log(`${ed} | ${real.upsets} / ${real.cross} / ${real.matches} | ${per(sim.upsets)} / ${per(sim.cross)} / ${per(sim.matches)} | ${pct(sim.upsets, sim.cross)} (real ${pct(real.upsets, real.cross)})`);
}
console.log(`\nreal: ${total.real.upsets} upsets in ${total.real.cross} cross-tier matches (${pct(total.real.upsets, total.real.cross)}), ${pct(total.real.upsets, total.real.matches)} of ${total.real.matches} matches`);
console.log(`sim:  ${pct(total.sim.upsets, total.sim.cross)} of cross-tier, ${pct(total.sim.upsets, total.sim.matches)} of matches (${seeds} tournaments an edition)`);
