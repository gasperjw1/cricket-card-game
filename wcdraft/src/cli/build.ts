/** `npm run data:build` — run the Phase 0 pipeline and (re)write data/out/ from scratch. */
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { runBuild } from "../pipeline/build.js";
import { renderCoverage } from "../pipeline/report.js";
import { paths, writeJson, writeText } from "../util/io.js";

const result = runBuild((msg) => console.log(msg));

// data/out is fully generated; clear it so renamed or removed outputs never linger.
rmSync(paths.out, { recursive: true, force: true });

// Human-readable tables stay pretty-printed; the bulky per-player tables are written compact
// and split per edition so diffs stay reviewable.
const pretty: Record<string, unknown> = {
  "meta.json": result.meta,
  "editions.json": result.editions,
  "venues.json": result.venues,
  "people.json": result.people,
  "bowling-usage.json": result.bowlingUsage,
  "lineup-deviation.json": result.lineupDeviation,
  "partnerships.json": result.partnerships,
  "coverage.json": result.coverage,
  "window-population.json": result.windowPopulation,
  "odi-population.json": result.odiPopulationByYear,
  "situation.json": result.situation,
  "matchups.json": result.matchups,
  "captaincy.json": result.captaincy,
  "coaches.json": result.coaches,
};
for (const [name, value] of Object.entries(pretty)) writeJson(resolve(paths.out, name), value);

const editionIds = [...new Set(result.playerEditions.map((r) => r.editionId))].sort();
for (const id of editionIds) {
  writeJson(resolve(paths.out, "player-editions", `${id}.json`), result.playerEditions.filter((r) => r.editionId === id), { compact: true });
  writeJson(resolve(paths.out, "squads", `${id}.json`), result.squads.filter((s) => s.editionId === id), { compact: true });
}
writeJson(resolve(paths.out, "team-style.json"), result.teamStyle, { compact: true });
writeJson(resolve(paths.out, "team-strength.json"), result.teamStrength, { compact: true });
writeJson(resolve(paths.out, "team-strength-odi.json"), result.odiTeamStrength, { compact: true });
writeText(resolve(paths.out, "COVERAGE.md"), renderCoverage(result));
console.log(`Wrote ${Object.keys(pretty).length + 1} files plus ${editionIds.length} per-edition player-edition and squad files to ${paths.out}`);
