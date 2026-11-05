/**
 * How much does the captain matter in the sim? (2026-11-04, Yash: should the draft tag captains, or
 * require one?) The captain's rating only scales the noise in his bowling choices (allocation.ts:
 * noise × (1 − captainNoiseSlope × z), clipped to [0.4, 1.6]). Here one side's real eleven plays its
 * real tournament with the captain's z set to −2, −1, 0, +1 and +2 and everything else held; every
 * arm uses the same seeds, so the arms differ by the captain and by where his choices send the dice.
 *
 * Reports per arm: match win share, wins per tournament, titles, and runs conceded per over; then
 * the +2 against −2 gap per tournament (paired over seeds, with its standard error).
 *
 *   node --import tsx scripts/research/captain-ab.mts [sims=200] [edition:team ...]
 */

import { loadEdition } from "../../src/engine/load.ts";
import { teamFromDefault } from "../../src/engine/data.ts";
import { simulateTournament } from "../../src/engine/tournament.ts";

const sims = Number(process.argv[2] ?? 200);
const sides = process.argv.slice(3).length ? process.argv.slice(3) : ["2024:India", "2022:England", "2021:Australia", "2022:Scotland"];
const ZS = [-2, -1, 0, 1, 2];

interface Arm { won: number; played: number; titles: number; conceded: number; bowled: number; perSeed: { won: number; conceded: number; bowled: number }[] }

for (const side of sides) {
  const [editionId, team] = side.split(":") as [string, string];
  const data = loadEdition(editionId);
  const base = teamFromDefault(data, team);
  const arms = new Map<number, Arm>(ZS.map((z) => [z, { won: 0, played: 0, titles: 0, conceded: 0, bowled: 0, perSeed: [] }]));
  const started = Date.now();
  for (let s = 1; s <= sims; s += 1) {
    for (const z of ZS) {
      const a = arms.get(z)!;
      const r = simulateTournament(data, data.progression, { seed: `captain-${s}`, identity: { team, xi: { ...base, captainZ: z } }, keepIdentityDetails: true, keepScorecards: true });
      const id = r.identity!;
      let conceded = 0, bowled = 0;
      for (const st of r.stages) for (const f of st.fixtures) {
        if (!f.teams.includes(team)) continue;
        for (const inn of f.innings ?? []) if (inn.team !== team) { conceded += inn.runs; bowled += inn.legalBalls; }
      }
      a.won += id.won; a.played += id.played; if (id.champion) a.titles += 1;
      a.conceded += conceded; a.bowled += bowled;
      a.perSeed.push({ won: id.won, conceded, bowled });
    }
  }
  console.log(`\n${team} ${editionId} (real captain z ${base.captainZ?.toFixed(2) ?? "none"}), ${sims} tournaments an arm, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  for (const z of ZS) {
    const a = arms.get(z)!;
    console.log(`  z ${z >= 0 ? "+" : ""}${z}  win ${(100 * a.won / a.played).toFixed(1)}%  wins/tournament ${(a.won / sims).toFixed(2)}  titles ${(100 * a.titles / sims).toFixed(1)}%  conceded/over ${(6 * a.conceded / a.bowled).toFixed(3)}`);
  }
  // The paired gap, +2 against −2, seed by seed.
  const hi = arms.get(2)!.perSeed, lo = arms.get(-2)!.perSeed;
  const gap = (f: (x: { won: number; conceded: number; bowled: number }) => number) => {
    const d = hi.map((h, i) => f(h) - f(lo[i]!));
    const mean = d.reduce((x, y) => x + y, 0) / d.length;
    const sd = Math.sqrt(d.reduce((x, y) => x + (y - mean) ** 2, 0) / (d.length - 1));
    return `${mean >= 0 ? "+" : ""}${mean.toFixed(3)} ± ${(sd / Math.sqrt(d.length)).toFixed(3)}`;
  };
  console.log(`  +2 v −2 per tournament: wins ${gap((x) => x.won)}, conceded/over ${gap((x) => (x.bowled ? (6 * x.conceded) / x.bowled : 0))}`);
}
