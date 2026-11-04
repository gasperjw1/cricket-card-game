/**
 * Does a bowler do worse in a phase he rarely bowls (2026-11-04, Yash: should a bowler used outside
 * his phases carry a ratings penalty, or should the cards show an overall rating with new-ball and
 * death tags)? Men's T20Is since 2012. For every bowler's spell in one phase of one match:
 *   - his usage of that phase: his share of balls in it over all his other matches, against the
 *     phase's share of an innings (pp 6/20, mid 9/20, death 5/20), so 1.0 is neutral;
 *   - what he was expected to do: the phase's rate that year × his own level relative to the year's
 *     rates in the other two phases, over his other matches (shrunk toward 1 by 120 balls), so the
 *     prediction uses nothing from this phase.
 * Actual ÷ expected by usage band says whether a man out of his phases does worse than his level
 * elsewhere (an out-of-phase penalty), the same, or better (captains pick the day). The engine's
 * phase vectors for a rare phase are mostly his overall vector, so a band off 1.0 is a bias in it.
 *
 *   NODE_OPTIONS=--max-old-space-size=8192 node --import tsx scripts/research/rare-phase.mts [from=2012-01-01] [wcOnly=0]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch, phaseOf } from "../../src/cricsheet/match.ts";
import { bowlGroupOf } from "../../src/analysis/matchups.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const FROM = process.argv[2] ?? "2012-01-01";
const WC_ONLY = process.argv[3] === "1";
/** Spells from this date only (levels and usage still from the whole window), for a stability split. */
const SPELLS_FROM = process.argv[4] ?? FROM;
const SPELLS_TO = process.argv[5] ?? "9999";
const PHASES = ["pp", "mid", "death"] as const;
type Phase = (typeof PHASES)[number];
const SHARE: Record<Phase, number> = { pp: 6 / 20, mid: 9 / 20, death: 5 / 20 };
const PRIOR = 120;
const MIN_OTHER = 300;

const config = loadConfig();
const groupOf = new Map<string, string>();
for (const line of readFileSync(resolve(ROOT, "data/labels/bowler-types.csv"), "utf8").split("\n").slice(1)) {
  const [id, , , code] = line.split(",");
  const g = bowlGroupOf(code);
  if (id && g) groupOf.set(id, g);
}

/**
 * Legal balls, bowler's runs (with wides and no-balls), dots (no runs at all), the striker's ones,
 * twos and threes, fours and sixes, and bowler's wickets.
 */
const KEYS = ["runs", "dot", "one", "two", "four", "six", "w"] as const;
type Key = (typeof KEYS)[number];
type Cell = { n: number } & Record<Key, number>;
const cell = (): Cell => ({ n: 0, runs: 0, dot: 0, one: 0, two: 0, four: 0, six: 0, w: 0 });
const addTo = (a: Cell, b: Cell) => { a.n += b.n; for (const k of KEYS) a[k] += b[k]; };

/** One bowler's work in one match: a cell per phase, the year and whether it was a World Cup. */
interface Spell { bowler: string; year: string; date: string; wc: boolean; by: Record<Phase, Cell> }
const spells: Spell[] = [];
const base = new Map<string, Cell>(); // `${year}|${phase}`

for (const e of loadIndex()) {
  if (e.gender !== "male" || e.date < FROM) continue;
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  const year = e.date.slice(0, 4);
  const wc = !!e.eventName && config.worldCupEventNames.has(e.eventName);
  for (const inn of mainInnings(m)) {
    if (inn.reduced) continue;
    const mine = new Map<string, Spell>();
    for (const b of inn.balls) {
      const ph = phaseOf(b.over) as Phase;
      const s = mine.get(b.bowler) ?? mine.set(b.bowler, { bowler: b.bowler, year, date: e.date, wc, by: { pp: cell(), mid: cell(), death: cell() } }).get(b.bowler)!;
      const c = s.by[ph];
      c.runs += b.runsConceded;
      if (!b.legal) continue;
      c.n += 1;
      if (b.runsTotal === 0) c.dot += 1;
      if (b.isSix) c.six += 1;
      else if (b.isFour) c.four += 1;
      else if (b.runsBatter === 1) c.one += 1;
      else if (b.runsBatter === 2 || b.runsBatter === 3) c.two += 1;
      c.w += b.wickets.filter((w) => w.bowlerCredited).length;
    }
    for (const s of mine.values()) {
      spells.push(s);
      for (const p of PHASES) addTo(base.get(`${year}|${p}`) ?? base.set(`${year}|${p}`, cell()).get(`${year}|${p}`)!, s.by[p]);
    }
  }
}

// Each bowler's totals, actual and year-expected, by phase, so one match can be left out cheaply.
type Tot = { act: Record<Phase, Cell>; exp: Record<Phase, Cell> };
const tot = new Map<string, Tot>();
const expectedOf = (year: string, p: Phase, n: number): Cell => {
  const b = base.get(`${year}|${p}`)!;
  const out = cell();
  out.n = n;
  for (const k of KEYS) out[k] = (n * b[k]) / b.n;
  return out;
};
for (const s of spells) {
  const t = tot.get(s.bowler) ?? tot.set(s.bowler, { act: { pp: cell(), mid: cell(), death: cell() }, exp: { pp: cell(), mid: cell(), death: cell() } }).get(s.bowler)!;
  for (const p of PHASES) { addTo(t.act[p], s.by[p]); addTo(t.exp[p], expectedOf(s.year, p, s.by[p].n)); }
}

// BANDS3=1: the engine's three bands (rare, usual, regular) instead of six.
const BANDS3 = !!process.env.BANDS3;
const bandOf = (r: number) => BANDS3
  ? (r < 0.5 ? "rare" : r < 1.25 ? "usual" : "regular")
  : (r < 0.25 ? "under 0.25" : r < 0.5 ? "0.25-0.5" : r < 0.8 ? "0.5-0.8" : r < 1.25 ? "0.8-1.25" : r < 1.75 ? "1.25-1.75" : "1.75+");
const BANDS = BANDS3 ? ["rare", "usual", "regular"] : ["under 0.25", "0.25-0.5", "0.5-0.8", "0.8-1.25", "1.25-1.75", "1.75+"];
/** Actual and expected sums per key, plus the cluster sums for a ratio standard error. */
type Acc = { a: Cell; e: Cell; rows: { a: Cell; e: Cell }[] };
const accs = new Map<string, Acc>();
const accOf = (k: string) => accs.get(k) ?? accs.set(k, { a: cell(), e: cell(), rows: [] }).get(k)!;

for (const s of spells) {
  if ((WC_ONLY && !s.wc) || s.date < SPELLS_FROM || s.date >= SPELLS_TO) continue;
  const t = tot.get(s.bowler)!;
  const group = groupOf.get(s.bowler) ?? "?";
  const otherN = (p: Phase) => t.act[p].n - s.by[p].n;
  const allOther = PHASES.reduce((x, p) => x + otherN(p), 0);
  if (allOther < MIN_OTHER) continue;
  for (const p of PHASES) {
    const here = s.by[p];
    if (!here.n) continue;
    // A man who bowls nothing outside this phase has no level elsewhere to compare against.
    if (allOther - otherN(p) < 60) continue;
    const usage = otherN(p) / allOther / SHARE[p];
    // His level in the other two phases, this match left out.
    const yr = expectedOf(s.year, p, here.n);
    const exp = cell();
    exp.n = here.n;
    for (const k of KEYS) {
      let a = 0, x = 0;
      for (const q of PHASES) if (q !== p) { a += t.act[q][k] - s.by[q][k]; x += t.exp[q][k] - expectedOf(s.year, q, s.by[q].n)[k]; }
      const prior = PRIOR * (x / Math.max(1, allOther - otherN(p)));
      exp[k] = yr[k] * ((a + prior) / (x + prior));
    }
    for (const key of [`${p} | ${bandOf(usage)}`, `${p} ${group} | ${bandOf(usage)}`]) {
      const acc = accOf(key);
      addTo(acc.a, here); addTo(acc.e, exp); acc.rows.push({ a: here, e: exp });
    }
  }
}

const ratioOf = (acc: Acc, k: Key) => {
  const r = acc.a[k] / acc.e[k];
  const se = Math.sqrt(acc.rows.reduce((s, x) => s + (x.a[k] - r * x.e[k]) ** 2, 0)) / acc.e[k];
  return { r, se };
};
const ratio = (acc: Acc, k: Key) => { const { r, se } = ratioOf(acc, k); return `${r.toFixed(3)} ±${se.toFixed(3)}`; };
console.log(`Men's T20Is from ${FROM}${WC_ONLY ? ", World Cup spells only" : ""}; spells ${spells.length}. Usage = share of his other balls in the phase ÷ the phase's share of an innings.`);
console.log(`Actual ÷ expected from his level in the other two phases (±1 standard error, clustered by spell).`);
// CELLS=1: every outcome's ratio by phase, pace or spin, and usage band, as the engine would apply them.
const CELLS = !!process.env.CELLS;
for (const groupKey of CELLS ? [" pace", " spin"] : ["", " pace", " spin"]) {
  for (const p of PHASES) {
    console.log(`\n${p}${groupKey}`);
    for (const band of BANDS) {
      const acc = accs.get(`${p}${groupKey} | ${band}`);
      if (!acc || acc.a.n < 300) continue;
      if (CELLS) console.log(`  usage ${band.padEnd(10)} balls ${String(acc.a.n).padStart(6)}  ${KEYS.map((k) => `${k} ${ratioOf(acc, k).r.toFixed(2)}±${ratioOf(acc, k).se.toFixed(2)}`).join("  ")}`);
      else console.log(`  usage ${band.padEnd(10)} balls ${String(acc.a.n).padStart(6)}  economy ${ratio(acc, "runs")}  dots ${ratio(acc, "dot")}  wickets ${ratio(acc, "w")}`);
    }
  }
}
