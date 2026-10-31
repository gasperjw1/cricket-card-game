/** `npm run data:bowlers` — (re)generate data/labels/bowler-types.csv for everyone in the archives. */
import { writeBowlerTypes } from "../pipeline/bowler-types.js";

const r = writeBowlerTypes();
const pct = (n: number) => `${((100 * n) / Math.max(1, r.balls)).toFixed(1)}%`;
console.log(`bowler-types.csv: ${r.people} people, ${r.bowlers} bowlers, ${pct(r.labelledBalls)} of balls bowled have a pace or spin label`);
for (const [source, s] of Object.entries(r.bySource).sort((a, b) => b[1].balls - a[1].balls)) console.log(`  ${source}: ${s.bowlers} bowlers, ${pct(s.balls)}`);
const worth = r.unlabelled.filter((u) => u.balls >= 120);
console.log(`${r.unlabelled.length} bowlers unlabelled, ${worth.length} with 120+ balls`);
