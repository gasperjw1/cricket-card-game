/**
 * `npm run data:fetch [-- --force]` — download and extract the Cricsheet men's T20I archive,
 * plus the two small biography supplements (cricketdata player_meta snapshot, Cricsheet people
 * register). Everything lands in the gitignored `.cache/`.
 */
import { ARCHIVES, fetchArchive } from "../cricsheet/archive.js";
import { fetchSupplements } from "../cricinfo/player-meta.js";

const force = process.argv.includes("--force");
for (const archive of [ARCHIVES.t20, ARCHIVES.odi]) {
  const snapshot = await fetchArchive({ force, archive });
  console.log(`${archive.name}: ${snapshot.fileCount} match files (zip ${(snapshot.zipBytes / 1e6).toFixed(1)} MB, downloaded ${snapshot.downloadedAt.slice(0, 10)})`);
}
await fetchSupplements({ force });
console.log("Supplements ready: player_meta.rda, people.csv");
