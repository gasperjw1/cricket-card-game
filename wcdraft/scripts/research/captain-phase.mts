/**
 * Captains' phase habits (2026-11-04, Yash: figure out captaincy tendencies). Men's T20Is since
 * 2010, each bowling innings given to its captain (tenures from `data/out/captaincy.json`, see
 * `captainOf`). Three habits, each as a residual against the year's mean for the same options:
 *   - spin in the powerplay: share of powerplay balls by spinners, against innings in that year
 *     with as many spinners bowling (only innings whose bowlers all have a known type);
 *   - death trust: share of overs 16–20 by whoever bowled over 1 or 2, against that year;
 *   - rotation: bowlers used, against that year.
 * A habit is real only if it holds from one half of a captain's innings to the other: the split-half
 * correlation (odd against even innings) across captains with enough innings, and the spread of
 * captains' means against what noise alone gives.
 *
 *   node --import tsx scripts/research/captain-phase.mts [minInnings=30]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch } from "../../src/cricsheet/match.ts";
import { bowlGroupOf } from "../../src/analysis/matchups.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const MIN = Number(process.argv[2] ?? 30);

const groupOf = new Map<string, string>();
for (const line of readFileSync(resolve(ROOT, "data/labels/bowler-types.csv"), "utf8").split("\n").slice(1)) {
  const [id, , , code] = line.split(",");
  const g = bowlGroupOf(code);
  if (id && g) groupOf.set(id, g);
}
// Tenures are whole years and overlap (stand-ins; Kohli and Rohit 2017–21), so a match goes to the
// tenure covering its year whose captain is in the eleven, and among several in it to the one who
// led more matches a year (the regular captain plays; a stand-in leads when he is rested).
const tenures = JSON.parse(readFileSync(resolve(ROOT, "data/out/captaincy.json"), "utf8")).captains as { personId: string; captainName: string; team: string; firstYear: number; lastYear: number; matches: number }[];
const captainOf = (team: string, date: string, xi: string[]) => {
  const year = Number(date.slice(0, 4));
  const hits = tenures.filter((t) => t.team === team && year >= t.firstYear && year <= t.lastYear && xi.includes(t.personId))
    .sort((a, b) => b.matches / (b.lastYear - b.firstYear + 1) - a.matches / (a.lastYear - a.firstYear + 1));
  return hits.length ? `${team} | ${hits[0]!.captainName}` : null;
};

/** One bowling innings: its captain, year, and each habit's value (null when it cannot be read). */
interface Row { captain: string; year: string; spinPp: number | null; spinUsed: number; deathTrust: number | null; bowlers: number; byBowler: Map<string, { pp: number; mid: number; death: number }> }
const rows: Row[] = [];
for (const e of loadIndex()) {
  if (e.gender !== "male" || e.date < "2010-01-01") continue;
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  for (const inn of mainInnings(m)) {
    if (inn.reduced || inn.legalBalls < 114) continue;
    const captain = captainOf(inn.bowlingTeam, e.date, m.xis[inn.bowlingTeam] ?? []);
    if (!captain) continue;
    const bowlers = new Set(inn.balls.map((b) => b.bowler));
    const known = [...bowlers].every((b) => groupOf.has(b));
    const spinners = [...bowlers].filter((b) => groupOf.get(b) === "spin").length;
    const pp = inn.balls.filter((b) => b.legal && b.over < 6);
    const openers = new Set(inn.balls.filter((b) => b.over <= 1).map((b) => b.bowler));
    const death = inn.balls.filter((b) => b.legal && b.over >= 15);
    rows.push({
      captain, year: e.date.slice(0, 4),
      spinPp: known && pp.length ? pp.filter((b) => groupOf.get(b.bowler) === "spin").length / pp.length : null,
      spinUsed: spinners,
      deathTrust: death.length ? death.filter((b) => openers.has(b.bowler)).length / death.length : null,
      bowlers: bowlers.size,
      byBowler: inn.balls.filter((b) => b.legal).reduce((acc, b) => {
        const x = acc.get(b.bowler) ?? acc.set(b.bowler, { pp: 0, mid: 0, death: 0 }).get(b.bowler)!;
        x[b.over < 6 ? "pp" : b.over < 15 ? "mid" : "death"] += 1;
        return acc;
      }, new Map<string, { pp: number; mid: number; death: number }>()),
    });
  }
}

type Habit = "spinPp" | "deathTrust" | "bowlers";
const habits: [Habit, string, (r: Row) => string][] = [
  ["spinPp", "spin in the powerplay (share of balls)", (r) => `${r.year}|${r.spinUsed}`],
  ["deathTrust", "death overs by an opening bowler (share)", (r) => r.year],
  ["bowlers", "bowlers used an innings", (r) => r.year],
];
for (const [h, label, keyOf] of habits) {
  const valid = rows.filter((r) => r[h] !== null);
  const mean = new Map<string, { s: number; n: number }>();
  for (const r of valid) { const k = keyOf(r); const x = mean.get(k) ?? mean.set(k, { s: 0, n: 0 }).get(k)!; x.s += r[h]!; x.n += 1; }
  const resid = (r: Row) => r[h]! - mean.get(keyOf(r))!.s / mean.get(keyOf(r))!.n;
  const by = new Map<string, number[]>();
  for (const r of valid) (by.get(r.captain) ?? by.set(r.captain, []).get(r.captain)!).push(resid(r));
  const caps = [...by.entries()].filter(([, xs]) => xs.length >= MIN);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const halves = caps.map(([, xs]) => [avg(xs.filter((_, i) => i % 2 === 0)), avg(xs.filter((_, i) => i % 2 === 1))] as const);
  const ma = avg(halves.map((x) => x[0])), mb = avg(halves.map((x) => x[1]));
  let cov = 0, va = 0, vb = 0;
  for (const [a, b] of halves) { cov += (a - ma) * (b - mb); va += (a - ma) ** 2; vb += (b - mb) ** 2; }
  const r = cov / Math.sqrt(va * vb);
  // Spread of captains' means against the noise in each: true SD = sqrt(var(means) − mean(var/n)).
  const means = caps.map(([, xs]) => avg(xs));
  const noise = avg(caps.map(([, xs]) => { const m = avg(xs); return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) / xs.length; }));
  const vm = means.reduce((a, x) => a + (x - avg(means)) ** 2, 0) / Math.max(1, means.length - 1);
  const scale = h === "bowlers" ? 1 : 100;
  console.log(`\n${label}: ${caps.length} captains with ${MIN}+ innings, split-half correlation ${r.toFixed(2)} (Spearman-Brown for the whole ${(2 * r / (1 + r)).toFixed(2)}); spread of captains' means ${(Math.sqrt(vm) * scale).toFixed(2)}, of which true ${(Math.sqrt(Math.max(0, vm - noise)) * scale).toFixed(2)}${h === "bowlers" ? "" : " points"}`);
  const ranked = caps.map(([c, xs]) => ({ c, n: xs.length, m: avg(xs) })).sort((a, b) => b.m - a.m);
  for (const x of [...ranked.slice(0, 5), ...ranked.slice(-5)]) console.log(`  ${x.c.padEnd(36)} innings ${String(x.n).padStart(3)}  ${(x.m * scale >= 0 ? "+" : "") + (x.m * scale).toFixed(2)}`);
}

// The same bowlers under different captains: the residuals above still carry who the captain had
// (Badree opening for Sammy), which the engine already reads from each bowler's own shares. Here a
// captain's habit is how the bowlers who also played under another captain were used differently
// under him: each bowler's share of his balls in the phase under this captain, less his mean over
// his captains, ball-weighted. Halves are odd and even innings of each captain.
{
  const MIN_CELL = 60, MIN_CAPTAIN = 300;
  const seen = new Map<string, number>();
  const half = rows.map((r) => { const i = seen.get(r.captain) ?? 0; seen.set(r.captain, i + 1); return i % 2; });
  const effects = (h: number, group: string, phase: "pp" | "death") => {
    const cells = new Map<string, Map<string, { n: number; p: number }>>(); // bowler → captain → balls
    rows.forEach((r, i) => {
      if (half[i] !== h) return;
      for (const [b, x] of r.byBowler) {
        if (groupOf.get(b) !== group) continue;
        const byCap = cells.get(b) ?? cells.set(b, new Map()).get(b)!;
        const c = byCap.get(r.captain) ?? byCap.set(r.captain, { n: 0, p: 0 }).get(r.captain)!;
        c.n += x.pp + x.mid + x.death; c.p += x[phase];
      }
    });
    const acc = new Map<string, { w: number; s: number }>();
    for (const byCap of cells.values()) {
      const ok = [...byCap.entries()].filter(([, c]) => c.n >= MIN_CELL);
      if (ok.length < 2) continue;
      const n = ok.reduce((a, [, c]) => a + c.n, 0), mean = ok.reduce((a, [, c]) => a + c.p, 0) / n;
      for (const [cap, c] of ok) { const x = acc.get(cap) ?? acc.set(cap, { w: 0, s: 0 }).get(cap)!; x.w += c.n; x.s += c.p - mean * c.n; }
    }
    return acc;
  };
  for (const [group, phase, label] of [["spin", "pp", "spinners' share of their balls in the powerplay"], ["pace", "pp", "seamers' share in the powerplay"], ["pace", "death", "seamers' share at the death"], ["spin", "death", "spinners' share at the death"]] as const) {
    const a = effects(0, group, phase), b = effects(1, group, phase);
    const caps = [...a.keys()].filter((c) => (a.get(c)!.w >= MIN_CAPTAIN) && (b.get(c)?.w ?? 0) >= MIN_CAPTAIN);
    const xs = caps.map((c) => a.get(c)!.s / a.get(c)!.w), ys = caps.map((c) => b.get(c)!.s / b.get(c)!.w);
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
    let cov = 0, vx = 0, vy = 0;
    xs.forEach((x, i) => { cov += (x - mx) * (ys[i]! - my); vx += (x - mx) ** 2; vy += (ys[i]! - my) ** 2; });
    const r = cov / Math.sqrt(vx * vy);
    const sd = Math.sqrt(xs.concat(ys).reduce((s, x) => s + x * x, 0) / (2 * xs.length));
    console.log(`\nSame bowlers, other captains — ${label}: ${caps.length} captains, split-half correlation ${r.toFixed(2)}, spread ${(100 * sd).toFixed(1)} points`);
    const both = caps.map((c) => ({ c, m: (a.get(c)!.s + b.get(c)!.s) / (a.get(c)!.w + b.get(c)!.w) })).sort((p, q) => q.m - p.m);
    for (const x of [...both.slice(0, 4), ...both.slice(-4)]) console.log(`  ${x.c.padEnd(36)} ${(x.m >= 0 ? "+" : "") + (100 * x.m).toFixed(1)}`);
  }
}
