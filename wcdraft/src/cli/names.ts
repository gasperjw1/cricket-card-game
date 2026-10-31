/** `npm run data:names` — (re)generate data/labels/display-names.csv from the snapshot's legal names and the overrides. */
import { writeDisplayNames } from "../pipeline/display-names.js";

const r = writeDisplayNames();
console.log(`display-names.csv: ${r.rows} people; ${r.derived} derived, ${r.overridden} overridden, ${r.kept} kept as Cricsheet has them`);
