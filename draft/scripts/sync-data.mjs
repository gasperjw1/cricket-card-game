#!/usr/bin/env node
/**
 * Copies the files the client fetches from the wcdraft outputs into public/data/, and writes slim
 * per-edition draft pools (what a spin card shows) so the heavy rating vectors are only fetched
 * when a run is simulated. Run by `npm run dev` / `npm run build` (pre-scripts) or directly.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const wcdraft = resolve(here, "../../wcdraft/data");
const out = resolve(here, "../public/data");
const outDir = resolve(wcdraft, "out");

const required = ["editions.json", "venues.json", "situation.json", "ratings/populations.json"];
for (const f of required) if (!existsSync(resolve(outDir, f))) {
  console.error(`sync-data: missing ${f}. Run \`npm run data:build && npm run ratings:build --workspace wcdraft\` first.`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
for (const d of ["", "ratings", "squads", "pool", "config"]) mkdirSync(resolve(out, d), { recursive: true });

const copy = (from, to) => copyFileSync(resolve(from), resolve(out, to));
for (const f of ["editions.json", "venues.json", "situation.json", "matchups.json", "coaches.json", "captaincy.json", "people.json"]) if (existsSync(resolve(outDir, f))) copy(resolve(outDir, f), f);
copy(resolve(outDir, "ratings/populations.json"), "ratings/populations.json");
for (const f of ["formats.json", "afghanistan-fixtures.json", "tiers.json"]) copy(resolve(wcdraft, "config", f), `config/${f}`);
copy(resolve(wcdraft, "labels/players.csv"), "players.csv");

// Labels (keeper eligibility, hand, bowling type) for the pool cards.
function parseCsvLine(line) {
  const cells = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { cells.push(cur); cur = ""; } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
const labelLines = readFileSync(resolve(wcdraft, "labels/players.csv"), "utf8").split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(labelLines[0]);
const labels = new Map();
for (const line of labelLines.slice(1)) {
  const cells = parseCsvLine(line);
  const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  labels.set(row.personId, row);
}
const keeperEligible = (row) => !!row && (row.keeper === "Y" || row.keeperCareer === "Y" || Number(row.keeperAnyT20I) > 0);

const editions = readdirSync(resolve(outDir, "ratings")).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => f.slice(0, 4)).sort();
const blankSquads = [];
for (const ed of editions) {
  copy(resolve(outDir, "ratings", `${ed}.json`), `ratings/${ed}.json`);
  copy(resolve(outDir, "squads", `${ed}.json`), `squads/${ed}.json`);
  const ratings = JSON.parse(readFileSync(resolve(outDir, "ratings", `${ed}.json`), "utf8"));
  const pool = ratings.map((r) => ({
    id: r.personId, name: r.name, team: r.team, editionId: r.editionId, standIn: r.standIn,
    tier: r.tier, tierScore: r.tierScore, role: r.role, archetype: r.archetype,
    bat: r.batting.display, bowl: r.bowling.display, batPhases: r.batting.displayByPhase, bowlPhases: r.bowling.displayByPhase,
    batLow: r.batting.lowSample, bowlLow: r.bowling.lowSample, batShown: r.batting.shown !== false, bowlShown: r.bowling.shown !== false, squadPlayer: r.usage.squadPlayer,
    domesticBalls: { bat: r.batting.evidence.domesticBalls ?? 0, bowl: r.bowling.evidence.domesticBalls ?? 0 },
    batWeights: r.batting.evidence.phaseWeights,
    vsPace: r.batting.byBowlClass?.pace.display ?? null, vsSpin: r.batting.byBowlClass?.spin.display ?? null,
    position: r.position.median, positionless: r.position.positionless,
    hand: labels.get(r.personId)?.handedness || null, bowlingType: labels.get(r.personId)?.bowlingType || null,
    keeper: keeperEligible(labels.get(r.personId)),
  }));
  writeFileSync(resolve(out, "pool", `${ed}.json`), JSON.stringify(pool));
  // Squads whose cards are mostly blank (a stand-in side with no record in that era, e.g. Namibia
  // standing in for Afghanistan 2012) stay in the tournament but are not spun in the draft.
  const byTeam = new Map();
  for (const p of pool) {
    const t = byTeam.get(p.team) ?? { n: 0, shown: 0 };
    t.n += 1; if (p.batShown || p.bowlShown) t.shown += 1;
    byTeam.set(p.team, t);
  }
  for (const [team, t] of byTeam) if (t.shown < t.n / 2) blankSquads.push({ editionId: ed, team });
}
writeFileSync(resolve(out, "index.json"), JSON.stringify({ editions, blankSquads, generatedAt: new Date().toISOString() }, null, 2));
if (blankSquads.length) console.log(`sync-data: not spun (mostly blank cards): ${blankSquads.map((s) => `${s.team} ${s.editionId}`).join(", ")}`);
console.log(`sync-data: ${editions.length} editions → ${out}`);
