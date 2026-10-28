/** `npm run data:labels` — (re)generate data/labels/players.csv, preserving hand-entered values. */
import { runBuild } from "../pipeline/build.js";
import { writeLabels } from "../pipeline/labels.js";

const result = runBuild((msg) => console.log(msg));
const r = writeLabels(result);
console.log(`players.csv: ${r.rows} rows — ${r.preservedHand} hand-entered, ${r.fromSnapshot} from the Cricinfo snapshot, ${r.unmatched} unmatched (hand-entry list)`);
console.log(`filled: handedness ${r.filled.handedness}, bowlingType ${r.filled.bowlingType}, keeper ${r.filled.keeper} (editions ${r.filled.keeperEditions}, career ${r.filled.keeperCareer}, anyT20I ${r.filled.keeperAnyT20I}), dob ${r.filled.dob}`);
const unmapped = Object.entries(r.unmappedBowlingStyles).sort((a, b) => b[1] - a[1]);
if (unmapped.length) console.log(`bowling styles with no code (add to normaliseBowlingStyle): ${unmapped.map(([s, n]) => `${s} ×${n}`).join("; ")}`);
