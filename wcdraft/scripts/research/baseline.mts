// Does the sim beat a rankings baseline out of sample? Brier of the sim's win probability (base
import { fileURLToPath as __fu } from "node:url";
const ROOT = __fu(new URL("../../..", import.meta.url)).replace(/\/$/, "");
// rates from the form window, not the edition) against a pre-tournament Elo baseline and 0.5.
import { readFileSync } from "node:fs";
import { replayEdition } from "../../src/engine/replay.ts";

const root = `${ROOT}/wcdraft/data/out`;
const strength = JSON.parse(readFileSync(`${root}/team-strength.json`, "utf8")) as { teams: Record<string, { history: { date: string; post?: number; rating?: number; after?: number }[]; byMonth: Record<string, number> }> };
const editions = JSON.parse(readFileSync(`${root}/editions.json`, "utf8")) as { id: string; firstMatch?: string; start?: string; lastMatch?: string }[];
const sims = Number(process.argv[2] ?? 40);
const ids = (process.argv[3] ?? "2007,2010,2012,2014,2016,2021,2022,2024,2026").split(",");

function eloBefore(team: string, date: string): number {
  const t = strength.teams[team];
  if (!t) return 1400;
  let last: number | null = null;
  for (const [month, r] of Object.entries(t.byMonth).sort()) { if (month < date.slice(0, 7)) last = r; else break; }
  return last ?? 1400;
}

let n = 0, simB = 0, eloB = 0, halfB = 0, simIn = 0;
for (const id of ids) {
  const ed = editions.find((e) => e.id === id);
  const start = ed?.firstMatch ?? ed?.start ?? `${id}-01-01`;
  const out = replayEdition(id, sims, 1, { base: "window" });
  const inSample = replayEdition(id, sims, 1, { base: "edition" });
  let en = 0, es = 0, ee = 0;
  for (const [i, m] of out.matches.entries()) {
    if (!m.real.winner) continue;
    const y = m.real.winner === m.teams[0] ? 1 : 0;
    const ra = eloBefore(m.teams[0], start), rb = eloBefore(m.teams[1], start);
    const pElo = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const pIn = inSample.matches[i]?.sim.winProbA ?? m.sim.winProbA;
    en += 1; es += (m.sim.winProbA - y) ** 2; ee += (pElo - y) ** 2;
    n += 1; simB += (m.sim.winProbA - y) ** 2; eloB += (pElo - y) ** 2; halfB += 0.25; simIn += (pIn - y) ** 2;
  }
  console.log(`${id}: n ${en}  sim(window) ${(es / en).toFixed(4)}  elo ${(ee / en).toFixed(4)}`);
}
console.log(`\nALL (${n} decided): sim out-of-sample ${(simB / n).toFixed(4)}  sim in-sample ${(simIn / n).toFixed(4)}  elo ${(eloB / n).toFixed(4)}  coin ${(halfB / n).toFixed(4)}`);
