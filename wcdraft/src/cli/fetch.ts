/**
 * `npm run data:fetch [-- --force] [-- --no-leagues]` — download and extract the Cricsheet men's
 * T20I and ODI archives, the domestic T20 league archives (optional, skipped on failure), plus the
 * two small biography supplements (cricketdata player_meta snapshot, Cricsheet people register).
 * Everything lands in the gitignored `.cache/`.
 */
import { ARCHIVES, LEAGUE_ARCHIVES, fetchArchive } from "../cricsheet/archive.js";
import { fetchSupplements } from "../cricinfo/player-meta.js";

const force = process.argv.includes("--force");
const leagues = !process.argv.includes("--no-leagues");
for (const archive of [ARCHIVES.t20, ARCHIVES.odi, ...(leagues ? LEAGUE_ARCHIVES : [])]) {
  try {
    const snapshot = await fetchArchive({ force, archive });
    console.log(`${archive.name}: ${snapshot.fileCount} match files (zip ${(snapshot.zipBytes / 1e6).toFixed(1)} MB, downloaded ${snapshot.downloadedAt.slice(0, 10)})`);
  } catch (e) {
    if (!archive.optional) throw e;
    console.log(`${archive.name}: skipped (${(e as Error).message})`);
  }
}
await fetchSupplements({ force });
console.log("Supplements ready: player_meta.rda, people.csv");
