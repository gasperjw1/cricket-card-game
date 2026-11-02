// Does an attacking coach win more in the sim, or only score more? India 2024's real eleven with a
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// fixed intent profile over N tournaments each: win share, title share, run rate, wickets lost.
import { loadEdition } from "../../src/engine/load.ts";
import { teamFromDefault } from "../../src/engine/data.ts";
import { simulateTournament } from "../../src/engine/tournament.ts";

const editionId = process.argv[2] ?? "2024";
const team = process.argv[3] ?? "India";
const sims = Number(process.argv[4] ?? 60);
const data = loadEdition(editionId);
const base = teamFromDefault(data, team);
const profiles: Record<string, { pp: number; mid: number; death: number } | undefined> = {
  "hold -1": { pp: -1, mid: -1, death: -1 }, "hold -0.5": { pp: -0.5, mid: -0.5, death: -0.5 }, "neutral 0": { pp: 0, mid: 0, death: 0 },
  "attack +0.5": { pp: 0.5, mid: 0.5, death: 0.5 }, "attack +1": { pp: 1, mid: 1, death: 1 }, "attack +1.5": { pp: 1.5, mid: 1.5, death: 1.5 },
  "real coach": base.intent as { pp: number; mid: number; death: number } | undefined,
};
console.log(`${team} ${editionId}, ${sims} tournaments per profile; real coach intent ${JSON.stringify(base.intent)}`);
for (const [label, intent] of Object.entries(profiles)) {
  let won = 0, played = 0, titles = 0, runs = 0, balls = 0, wkts = 0, inns = 0;
  for (let s = 1; s <= sims; s += 1) {
    const xi = { ...base, intent };
    const r = simulateTournament(data, data.progression, { seed: `intent-${label}-${s}`, identity: { team, xi }, keepIdentityDetails: true });
    const id = r.identity!;
    won += id.won; played += id.played; if (id.champion) titles += 1;
    for (const st of r.stages) for (const f of st.fixtures) for (const inn of f.innings ?? []) if (inn.team === team) { runs += inn.runs; balls += inn.legalBalls; wkts += inn.wickets; inns += 1; }
  }
  console.log(`${label.padEnd(12)} win ${(100 * won / played).toFixed(1)}%  titles ${(100 * titles / sims).toFixed(0)}%  rpo ${(6 * runs / balls).toFixed(2)}  wkts/inn ${(wkts / inns).toFixed(2)}`);
}
