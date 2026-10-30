/**
 * `npm run engine:tournament -- [edition] [team] [sims]` — simulate an edition in full many times,
 * with `team` fielding its default eleven as the identity side, and print stage-reach rates, the
 * unbeaten share and the champion distribution.
 */
import { loadEdition, teamFromDefault } from "../engine/load.js";
import { simulateTournament } from "../engine/tournament.js";

const editionId = process.argv[2] ?? "2024";
const team = process.argv[3] ?? "India";
const sims = Number(process.argv[4] ?? 200);
const t0 = Date.now();
const data = loadEdition(editionId);
console.log(`${editionId}: ${data.progression.teams.length} teams; stages ${data.progression.stages.map((s) => s.label).join(" → ")}; stand-in ${data.progression.standIn ?? "none"}`);
for (const s of data.progression.stages) if (s.type === "groups") console.log(`  ${s.label}: ${Object.entries(s.groups).map(([g, t]) => `${g} [${t.join(", ")}]`).join("; ")}`);

const xi = teamFromDefault(data, team);
const exits = new Map<string, number>();
const champions = new Map<string, number>();
let unbeaten = 0, won = 0, played = 0;
for (let i = 0; i < sims; i += 1) {
  const r = simulateTournament(data, data.progression, { seed: `${editionId}:${team}:${i}`, identity: { team, xi } });
  exits.set(r.identity!.exit, (exits.get(r.identity!.exit) ?? 0) + 1);
  if (r.champion) champions.set(r.champion, (champions.get(r.champion) ?? 0) + 1);
  if (r.identity!.unbeaten) unbeaten += 1;
  won += r.identity!.won; played += r.identity!.played;
  if (i === 0) {
    for (const st of r.stages) {
      console.log(`\n${st.label}`);
      if (st.groups) for (const [g, rows] of Object.entries(st.groups)) console.log(`  Group ${g}: ${rows.map((x) => `${x.team} ${x.points}pts (${x.won}-${x.lost}, NRR ${x.nrr > 0 ? "+" : ""}${x.nrr})`).join(" | ")}`);
      for (const f of st.fixtures) console.log(`  ${f.teams[0]} ${f.scores[0]} v ${f.teams[1]} ${f.scores[1]} → ${f.winner ?? "no result"}${f.tieBreak ? ` (${f.tieBreak.method})` : ""}${f.rain ? ` [rain: ${f.rain.kind}${f.rain.kind === "reduced" ? ` ${f.rain.oversPerSide} ov` : f.rain.parScore !== null ? ` par ${f.rain.parScore}` : ""}]` : ""}${f.venueId ? ` @ ${f.venueId}` : ""}`);
    }
  }
}
console.log(`\n${team} over ${sims} tournaments: win rate ${((100 * won) / played).toFixed(1)}%, exits ${JSON.stringify(Object.fromEntries([...exits].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +((100 * v) / sims).toFixed(1)])))}, unbeaten champion ${((100 * unbeaten) / sims).toFixed(1)}%`);
console.log(`Champions: ${[...champions].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${((100 * v) / sims).toFixed(0)}%`).join(", ")}`);
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
