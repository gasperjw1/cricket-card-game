/** `npm run engine:rarity -- [edition] [sims]` — unbeaten-run rarity for random drafts in random identity slots. */
import { resolve } from "node:path";
import { loadEdition } from "../engine/load.js";
import { measureRarity } from "../engine/rarity.js";
import { paths, writeJson } from "../util/io.js";

const editionId = process.argv[2] ?? "2024";
const sims = Number(process.argv[3] ?? 300);
const t0 = Date.now();
const data = loadEdition(editionId);
const s = measureRarity(data, { sims });
console.log(`${editionId}: ${s.runs} random drafts in random identity slots — unbeaten champion ${s.unbeatenPct}%, champion ${s.championPct}%, mean match win rate ${s.meanWinPct}% (spec target: unbeaten < 3% overall, < 15% for the top decile)`);
console.log("| Squad decile | Runs | Mean best-skill display | Champion % | Unbeaten % |", "\n|---|---|---|---|---|");
for (const d of s.byDecile) console.log(`| ${d.decile} | ${d.runs} | ${d.meanScore} | ${d.championPct} | ${d.unbeatenPct} |`);
console.log(`Real elevens, random identity (${s.real.runs} runs): champion ${s.real.championPct}%, unbeaten champion ${s.real.unbeatenPct}%`);
writeJson(resolve(paths.out, "engine", `rarity-${editionId}.json`), s);
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
