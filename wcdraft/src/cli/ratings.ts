/** `npm run ratings:build` — rate every player-edition and write data/out/ratings/ + RATINGS.md. */
import { resolve } from "node:path";
import { runBuild } from "../pipeline/build.js";
import { auditCards, timelessCandidates, transferGaps, validate } from "../ratings/analysis.js";
import { rateAll } from "../ratings/rate.js";
import { renderRatings } from "../ratings/report.js";
import { paths, writeJson, writeText } from "../util/io.js";

const t0 = Date.now();
const result = runBuild((msg) => console.log(msg));
const ratings = rateAll(result);
console.log(`Rated ${ratings.length} player-editions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const validation = validate(result);
const timeless = timelessCandidates(ratings, new Map(result.editions.map((e) => [e.id, e.year])));
const audit = auditCards(ratings);
const transfer = [...transferGaps(result, 120), ...transferGaps(result, 60)];

const editionIds = [...new Set(ratings.map((x) => x.editionId))].sort();
for (const id of editionIds) writeJson(resolve(paths.out, "ratings", `${id}.json`), ratings.filter((x) => x.editionId === id), { compact: true });
writeJson(resolve(paths.out, "ratings-summary.json"), { validation, transfer, timeless, audit: { byTier: audit.byTier, spearman: audit.spearman, matched: audit.rows.length } });
writeText(resolve(paths.out, "RATINGS.md"), renderRatings(result, ratings, validation, timeless, audit, transfer));
console.log(`Wrote ratings for ${editionIds.length} editions, RATINGS.md and ratings-summary.json in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
