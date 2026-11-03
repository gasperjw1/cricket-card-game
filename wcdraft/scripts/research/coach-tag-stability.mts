// Are the coach tags traits of the coach? (2026-11-03, before the engine plays them.) Each index
// in `analysis/coaches.ts` is a tenure mean of the team's month-by-month deviation from its era.
// Split every tenure's months into alternate halves, compute the index on each half, and correlate
// the halves across coaches (innings-weighted). A trait that belongs to the coach (or at least to
// the side under him) repeats; one that is noise in a few dozen innings doesn't. Coaches with
// at least `min` innings in each half.
//   npx tsx scripts/research/coach-tag-stability.mts [min=15]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { paths } from "../../src/util/io.ts";
import { readCsv } from "../../src/util/csv.ts";
import type { StyleMonth } from "../../src/analysis/coaches.ts";

const min = Number(process.argv[2] ?? 15);
const style = JSON.parse(readFileSync(resolve(paths.out, "team-style.json"), "utf8")) as { months: Record<string, StyleMonth>; teams: Record<string, Record<string, StyleMonth>> };
const rows = readCsv(readFileSync(resolve(paths.config, "coaches.csv"), "utf8"));
const KEYS = ["ppIntent", "ppPreservation", "deathIntent", "lowerOrderShare", "wicketsAt15", "bowlersUsed", "bowlFirst"] as const;
type Key = (typeof KEYS)[number];

function months(from: string, to: string): string[] {
  const start = from.length >= 7 ? from.slice(0, 7) : `${from.slice(0, 4)}-01`;
  const endRaw = to.trim() ? to : "2026-12";
  const end = endRaw.length >= 7 ? endRaw.slice(0, 7) : `${endRaw.slice(0, 4)}-12`;
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number) as [number, number];
  const [ey, em] = end.split("-").map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
}

const dev = (s: StyleMonth, era: StyleMonth): Record<Key, number> => ({
  ppIntent: s.ppRpo / era.ppRpo - 1,
  ppPreservation: -(era.ppWicketsPerOver > 0 ? s.ppWicketsPerOver / era.ppWicketsPerOver - 1 : 0),
  deathIntent: s.deathRpo > 0 && era.deathRpo > 0 ? s.deathRpo / era.deathRpo - 1 : 0,
  lowerOrderShare: s.lowerOrderRunShare - era.lowerOrderRunShare,
  wicketsAt15: era.wicketsAt15 > 0 ? s.wicketsAt15 / era.wicketsAt15 - 1 : 0,
  bowlersUsed: s.bowlersUsed - era.bowlersUsed,
  bowlFirst: ((s.bowlFirstPct ?? era.bowlFirstPct ?? 0) - (era.bowlFirstPct ?? 0)) / 100,
});

const halves: { w: number; a: Record<Key, number>; b: Record<Key, number> }[] = [];
for (const r of rows) {
  const tm = style.teams[r.team ?? ""] ?? {};
  const acc = [{ w: 0, x: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number> }, { w: 0, x: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number> }];
  let n = 0;
  for (const month of months(r.fromDate ?? "", r.toDate ?? "")) {
    const s = tm[month], era = style.months[month];
    if (!s || !era || s.innings <= 0 || era.ppRpo <= 0) continue;
    const h = acc[n % 2]!; n += 1;
    const d = dev(s, era);
    h.w += s.innings;
    for (const k of KEYS) h.x[k] += s.innings * d[k];
  }
  if (acc[0]!.w < min || acc[1]!.w < min) continue;
  const mean = (h: (typeof acc)[0]) => Object.fromEntries(KEYS.map((k) => [k, h.x[k] / h.w])) as Record<Key, number>;
  halves.push({ w: Math.min(acc[0]!.w, acc[1]!.w), a: mean(acc[0]!), b: mean(acc[1]!) });
}

const corr = (k: Key) => {
  const W = halves.reduce((s, h) => s + h.w, 0);
  const ma = halves.reduce((s, h) => s + h.w * h.a[k], 0) / W, mb = halves.reduce((s, h) => s + h.w * h.b[k], 0) / W;
  let sab = 0, saa = 0, sbb = 0;
  for (const h of halves) { sab += h.w * (h.a[k] - ma) * (h.b[k] - mb); saa += h.w * (h.a[k] - ma) ** 2; sbb += h.w * (h.b[k] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
};
console.log(`${halves.length} coaches with ${min}+ innings in each half. Split-half correlation of each index (1 = fully repeatable, 0 = noise):`);
for (const k of KEYS) console.log(`  ${k.padEnd(16)} ${corr(k).toFixed(2)}`);
