/**
 * Rating bands (2026-11-03, Yash: one number does not say how a man plays; Southee could be an 81
 * for six balls and then out; Cricket 26-style attributes, from domestic and international
 * limited-overs data). For each candidate attribute this measures, from men's T20Is and the 14
 * leagues since 2014 (and ODIs for the cross-format check):
 *
 *   - its reliability: split-half by alternate matches, then the per-ball reliability, so the
 *     reliability at any sample size follows (Spearman-Brown);
 *   - how many bands it supports: the separation strata H = (4G + 1) / 3, G = sqrt(R / (1 − R)),
 *     at 300, 1,000 and 3,000 balls (two bands a standard error apart can be told from each other);
 *   - its true spread across players, in index points (100 = the average ball in the same format,
 *     year, over, wickets down and innings);
 *   - whether ODIs measure the same thing: the correlation of a player's ODI and T20 values,
 *     corrected for the noise in each (1 = the same skill).
 *
 * Every attribute is observed ÷ expected over the player's balls, the expectation being the mean of
 * the same cell (source, year, over, wickets band, innings). No opposition adjustment beyond that.
 *
 *   NODE_OPTIONS=--max-old-space-size=8192 node --import tsx scripts/research/rating-bands.mts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHIVES, LEAGUE_ARCHIVES, loadIndex, readMatch, type ArchiveSpec } from "../../src/cricsheet/archive.ts";
import { normaliseMatch } from "../../src/cricsheet/match.ts";
import { bowlGroupOf } from "../../src/analysis/matchups.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const FROM = "2014-01-01";

// Bowler group (pace / spin) from the bowling-type sheet.
const groupOf = new Map<string, number>();
for (const line of readFileSync(resolve(ROOT, "data/labels/bowler-types.csv"), "utf8").split("\n").slice(1)) {
  const [id, , , code] = line.split(",");
  const g = bowlGroupOf(code);
  if (id && g) groupOf.set(id, g === "pace" ? 0 : 1);
}

// ---------- load every delivery into columns ----------
type Src = 0 | 1 | 2; // T20I, league, ODI
const col = {
  src: [] as number[], match: [] as number[], cell: [] as number[], over: [] as number[],
  bat: [] as number[], bowl: [] as number[], wide: [] as number[], runs: [] as number[], conceded: [] as number[],
  four: [] as number[], six: [] as number[], out: [] as number[], wkt: [] as number[], stump: [] as number[], extra: [] as number[],
  ballNo: [] as number[], group: [] as number[],
};
const ids: string[] = [], idOf = new Map<string, number>(), names = new Map<string, string>();
const pid = (id: string) => idOf.get(id) ?? (idOf.set(id, ids.length), ids.push(id), ids.length - 1);
const wBand = (w: number) => (w <= 1 ? 0 : w <= 3 ? 1 : w <= 5 ? 2 : w <= 7 ? 3 : 4);
let matchNo = 0;

const sources: [ArchiveSpec, Src][] = [[ARCHIVES.t20, 0], ...LEAGUE_ARCHIVES.map((a) => [a, 1] as [ArchiveSpec, Src]), [ARCHIVES.odi, 2]];
for (const [spec, src] of sources) {
  let index;
  try { index = loadIndex(spec); } catch { console.log(`skip ${spec.key}`); continue; }
  const overs = src === 2 ? 50 : 20;
  for (const e of index) {
    if (e.gender !== "male" || e.date < FROM) continue;
    const m = normaliseMatch(readMatch(e.file), e.id);
    if (m.hasMissingData || (m.scheduledOvers || overs) !== overs) continue;
    const year = +m.date.slice(0, 4);
    matchNo += 1;
    for (const [k, v] of m.names) names.set(k, v);
    for (const inn of m.innings) {
      if (inn.superOver || inn.reduced || inn.index > 1) continue;
      let down = 0;
      const faced = new Map<string, number>();
      for (const b of inn.balls) {
        col.src.push(src); col.match.push(matchNo); col.over.push(b.over);
        col.cell.push(((src * 20 + (year - 2014)) * 50 + Math.min(b.over, 49)) * 10 + wBand(down) * 2 + inn.index);
        col.bat.push(pid(b.batter)); col.bowl.push(pid(b.bowler));
        col.wide.push(b.wide ? 1 : 0); col.runs.push(b.runsBatter); col.conceded.push(b.runsConceded);
        col.four.push(b.isFour ? 1 : 0); col.six.push(b.isSix ? 1 : 0);
        col.out.push(b.wickets.some((w) => w.playerOut === b.batter) ? 1 : 0);
        col.wkt.push(b.wickets.filter((w) => w.bowlerCredited).length);
        col.stump.push(b.wickets.filter((w) => w.bowlerCredited && (w.kind === "bowled" || w.kind === "lbw")).length);
        col.extra.push(b.wide || b.noBall ? 1 : 0);
        col.ballNo.push(faced.get(b.batter) ?? 0);
        col.group.push(groupOf.get(b.bowler) ?? -1);
        if (!b.wide) faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
        down += b.wickets.length;
      }
    }
  }
  console.log(`${spec.key}: ${col.src.length.toLocaleString()} deliveries so far`);
}
const N = col.src.length;

// ---------- the attributes ----------
type Who = "bat" | "bowl";
interface Attr {
  key: string; who: Who; label: string;
  /** Which balls count (index into the columns). */
  on: (i: number) => boolean;
  /** The observed quantity on a ball. */
  value: (i: number) => number;
  /** Higher is better for the player (for the worked examples). */
  higherBetter: boolean;
}
const faced = (i: number) => col.wide[i] === 0;
const t20 = (i: number) => col.src[i] !== 2;
const death = (i: number) => (col.src[i] === 2 ? col.over[i]! >= 40 : col.over[i]! >= 15);
const pp = (i: number) => (col.src[i] === 2 ? col.over[i]! < 10 : col.over[i]! < 6);
const ATTRS: Attr[] = [
  { key: "batSR", who: "bat", label: "Strike rate", on: faced, value: (i) => col.runs[i]!, higherBetter: true },
  { key: "batSurvive", who: "bat", label: "Dismissal rate (lower survives)", on: faced, value: (i) => col.out[i]!, higherBetter: false },
  { key: "batSix", who: "bat", label: "Six hitting", on: faced, value: (i) => col.six[i]!, higherBetter: true },
  { key: "batFour", who: "bat", label: "Four hitting", on: faced, value: (i) => col.four[i]!, higherBetter: true },
  { key: "batRotate", who: "bat", label: "Rotation (1s-3s)", on: faced, value: (i) => (col.runs[i]! >= 1 && col.runs[i]! <= 3 ? 1 : 0), higherBetter: true },
  { key: "batDot", who: "bat", label: "Dot rate (lower better)", on: faced, value: (i) => (col.runs[i] === 0 && !col.out[i] ? 1 : 0), higherBetter: false },
  { key: "batStart", who: "bat", label: "Start: SR, first 10 balls", on: (i) => faced(i) && col.ballNo[i]! < 10, value: (i) => col.runs[i]!, higherBetter: true },
  { key: "batLater", who: "bat", label: "Set: SR, ball 11 on", on: (i) => faced(i) && col.ballNo[i]! >= 10, value: (i) => col.runs[i]!, higherBetter: true },
  { key: "batPace", who: "bat", label: "SR v pace", on: (i) => faced(i) && col.group[i] === 0, value: (i) => col.runs[i]!, higherBetter: true },
  { key: "batSpin", who: "bat", label: "SR v spin", on: (i) => faced(i) && col.group[i] === 1, value: (i) => col.runs[i]!, higherBetter: true },
  { key: "batPP", who: "bat", label: "SR, powerplay", on: (i) => faced(i) && pp(i), value: (i) => col.runs[i]!, higherBetter: true },
  { key: "batDeath", who: "bat", label: "SR, death", on: (i) => faced(i) && death(i), value: (i) => col.runs[i]!, higherBetter: true },
  { key: "bowlEcon", who: "bowl", label: "Economy (lower better)", on: () => true, value: (i) => col.conceded[i]!, higherBetter: false },
  { key: "bowlWkt", who: "bowl", label: "Wicket rate", on: () => true, value: (i) => col.wkt[i]!, higherBetter: true },
  { key: "bowlDot", who: "bowl", label: "Dot rate", on: faced, value: (i) => (col.conceded[i] === 0 ? 1 : 0), higherBetter: true },
  { key: "bowlBoundary", who: "bowl", label: "Boundaries conceded (lower better)", on: faced, value: (i) => col.four[i]! + col.six[i]!, higherBetter: false },
  { key: "bowlSix", who: "bowl", label: "Sixes conceded (lower better)", on: faced, value: (i) => col.six[i]!, higherBetter: false },
  { key: "bowlStump", who: "bowl", label: "Bowled + lbw rate", on: () => true, value: (i) => col.stump[i]!, higherBetter: true },
  { key: "bowlExtras", who: "bowl", label: "Wides + no-balls (lower better)", on: () => true, value: (i) => col.extra[i]!, higherBetter: false },
  { key: "bowlPP", who: "bowl", label: "Economy, powerplay", on: (i) => pp(i), value: (i) => col.conceded[i]!, higherBetter: false },
  { key: "bowlDeath", who: "bowl", label: "Economy, death", on: (i) => death(i), value: (i) => col.conceded[i]!, higherBetter: false },
];

// Expected value per cell, per attribute (over the balls the attribute counts).
function cellMeans(a: Attr): Map<number, number> {
  const sum = new Map<number, number>(), n = new Map<number, number>();
  for (let i = 0; i < N; i += 1) {
    if (!a.on(i)) continue;
    const c = col.cell[i]!;
    sum.set(c, (sum.get(c) ?? 0) + a.value(i));
    n.set(c, (n.get(c) ?? 0) + 1);
  }
  const out = new Map<number, number>();
  for (const [c, s] of sum) out.set(c, s / n.get(c)!);
  return out;
}

interface Tally { obs: number; exp: number; n: number }
const ratio = (t: Tally | undefined) => (t && t.exp > 0 ? (100 * t.obs) / t.exp : NaN);
const pearson = (xs: number[], ys: number[]) => {
  const n = xs.length, mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; syy += (ys[i]! - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
};
const sd = (xs: number[]) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); };
const relAt = (rho: number, n: number) => (n * rho) / (1 + (n - 1) * rho);
const strata = (r: number) => (4 * Math.sqrt(r / (1 - r)) + 1) / 3;

// Each player's matches in order, to split T20 careers into alternate halves.
const halfOf = new Map<string, number>();
{
  const seen = new Map<string, number>();
  let last = -1;
  const inMatch = new Set<string>();
  for (let i = 0; i < N; i += 1) {
    if (col.match[i] !== last) { inMatch.clear(); last = col.match[i]!; }
    for (const p of [col.bat[i]!, col.bowl[i]!]) {
      const k = `${p}|${col.match[i]}`;
      if (inMatch.has(k)) continue;
      inMatch.add(k);
      const fmt = col.src[i] === 2 ? 2 : 0;
      const sk = `${p}|${fmt}`;
      const n = seen.get(sk) ?? 0;
      seen.set(sk, n + 1);
      halfOf.set(k, n % 2);
    }
  }
}

const rows: string[] = [];
const results = new Map<string, { rho: number; trueSd: number; cross: number | null; full: Map<number, Tally>; mean: number }>();
const MIN_HALF = { bat: 150, bowl: 150 };
for (const a of ATTRS) {
  const means = cellMeans(a);
  // Tallies: T20 halves, T20 whole, ODI whole.
  const half: [Map<number, Tally>, Map<number, Tally>] = [new Map(), new Map()];
  const full = new Map<number, Tally>(), odi = new Map<number, Tally>(), odiHalf: [Map<number, Tally>, Map<number, Tally>] = [new Map(), new Map()];
  const add = (m: Map<number, Tally>, p: number, o: number, e: number) => { const t = m.get(p) ?? m.set(p, { obs: 0, exp: 0, n: 0 }).get(p)!; t.obs += o; t.exp += e; t.n += 1; };
  for (let i = 0; i < N; i += 1) {
    if (!a.on(i)) continue;
    const p = a.who === "bat" ? col.bat[i]! : col.bowl[i]!;
    const o = a.value(i), e = means.get(col.cell[i]!)!;
    const h = halfOf.get(`${p}|${col.match[i]}`)!;
    if (t20(i)) { add(full, p, o, e); add(half[h]!, p, o, e); } else { add(odi, p, o, e); add(odiHalf[h]!, p, o, e); }
  }
  // Split-half reliability in T20s, then per ball.
  const splitRel = (hs: [Map<number, Tally>, Map<number, Tally>], minHalf: number) => {
    const xs: number[] = [], ys: number[] = [], ns: number[] = [];
    for (const [p, t0] of hs[0]) { const t1 = hs[1].get(p); if (!t1 || t0.n < minHalf || t1.n < minHalf) continue; xs.push(ratio(t0)); ys.push(ratio(t1)); ns.push((t0.n + t1.n) / 2); }
    const r = pearson(xs, ys), m = ns.reduce((s, x) => s + x, 0) / ns.length;
    return { r, m, players: xs.length, rho: r / (m - (m - 1) * r), xs };
  };
  const minHalf = a.key === "batStart" || a.key === "batDeath" || a.key === "batPP" || a.key === "batSpin" || a.key === "batPace" || a.key === "bowlPP" || a.key === "bowlDeath" ? 80 : MIN_HALF[a.who];
  const s = splitRel(half, minHalf);
  // True spread across players: the observed SD of whole-career values, times the root of their reliability.
  const wholes = [...full.entries()].filter(([, t]) => t.n >= 2 * minHalf);
  const vals = wholes.map(([, t]) => ratio(t));
  const meanN = wholes.reduce((sum, [, t]) => sum + t.n, 0) / wholes.length;
  const trueSd = sd(vals) * Math.sqrt(relAt(s.rho, meanN));
  // ODI against T20: corrected for the noise in each.
  const o = splitRel(odiHalf, minHalf);
  const xs: number[] = [], ys: number[] = [], nT: number[] = [], nO: number[] = [];
  for (const [p, t] of odi) { const f = full.get(p); if (!f || t.n < 2 * minHalf || f.n < 2 * minHalf) continue; xs.push(ratio(f)); ys.push(ratio(t)); nT.push(f.n); nO.push(t.n); }
  const rx = xs.length > 30 ? pearson(xs, ys) : NaN;
  const avg = (v: number[]) => v.reduce((q, x) => q + x, 0) / v.length;
  const cross = xs.length > 30 && o.players > 30 ? rx / Math.sqrt(relAt(s.rho, avg(nT)) * relAt(o.rho, avg(nO))) : null;
  const mean = vals.reduce((q, x) => q + x, 0) / vals.length;
  results.set(a.key, { rho: s.rho, trueSd, cross, full, mean });
  const r300 = relAt(s.rho, 300), r1k = relAt(s.rho, 1000), r3k = relAt(s.rho, 3000);
  rows.push(`${a.label.padEnd(36)} ${String(s.players).padStart(5)} ${s.r.toFixed(2).padStart(6)} ${r300.toFixed(2).padStart(6)} ${r1k.toFixed(2).padStart(6)} ${r3k.toFixed(2).padStart(6)}  ${strata(r300).toFixed(1).padStart(4)} ${strata(r1k).toFixed(1).padStart(4)} ${strata(r3k).toFixed(1).padStart(4)}  ${trueSd.toFixed(1).padStart(6)}  ${Number.isNaN(rx) ? "    –" : rx.toFixed(2).padStart(5)} ${cross === null ? "   –" : Math.min(cross, 9.99).toFixed(2).padStart(5)} (${xs.length})`);
}
console.log(`\nT20Is and leagues since 2014: ${N.toLocaleString()} deliveries (ODIs included for the cross-format check)`);
console.log(`${"Attribute".padEnd(36)} ${"pairs".padStart(5)} ${"half r".padStart(6)} ${"R300".padStart(6)} ${"R1k".padStart(6)} ${"R3k".padStart(6)}  ${"H300".padStart(4)} ${"H1k".padStart(4)} ${"H3k".padStart(4)}  ${"trueSD".padStart(6)}  ${"ODI r".padStart(5)} ${"true".padStart(5)}`);
for (const r of rows) console.log(r);

// ---------- worked examples ----------
// Each value shrunk to the population mean by its reliability at the player's own sample, with ± one SE.
// Several people share some names (two Rashid Khans): take the one with the most T20 balls.
const nameId = (needle: string, kind: Who) => {
  const key = kind === "bat" ? "batSR" : "bowlEcon";
  let best: number | undefined, most = -1;
  for (const [id, n] of names) {
    if (n !== needle) continue;
    const p = idOf.get(id);
    const balls = p === undefined ? 0 : results.get(key)!.full.get(p)?.n ?? 0;
    if (p !== undefined && balls > most) { best = p; most = balls; }
  }
  return best;
};
const examples: [string, Who][] = [["TG Southee", "bat"], ["TG Southee", "bowl"], ["Rashid Khan", "bat"], ["Rashid Khan", "bowl"], ["V Kohli", "bat"], ["GJ Maxwell", "bat"], ["AD Russell", "bat"], ["JJ Bumrah", "bowl"], ["MA Starc", "bowl"]];
for (const [who, kind] of examples) {
  const p = nameId(who, kind);
  if (p === undefined) { console.log(`\n${who}: not found`); continue; }
  console.log(`\n${who}, ${kind === "bat" ? "batting" : "bowling"} (T20s since 2014; 100 = the average ball in the same spot):`);
  for (const a of ATTRS.filter((x) => x.who === kind)) {
    const res = results.get(a.key)!;
    const t = res.full.get(p);
    if (!t || t.n < 30) { console.log(`  ${a.label.padEnd(36)} too few balls`); continue; }
    const R = relAt(res.rho, t.n);
    const shrunk = res.mean + R * (ratio(t) - res.mean);
    const se = res.trueSd * Math.sqrt(1 - R);
    // Percentile of the shrunk value among the population's spread (normal approximation).
    const z = (shrunk - res.mean) / res.trueSd * (a.higherBetter ? 1 : -1);
    const pct = Math.round(100 * 0.5 * (1 + erf(z / Math.SQRT2)));
    console.log(`  ${a.label.padEnd(36)} raw ${ratio(t).toFixed(0).padStart(4)}  shrunk ${shrunk.toFixed(0).padStart(4)} ±${se.toFixed(0).padStart(3)}  balls ${String(t.n).padStart(5)}  R ${R.toFixed(2)}  percentile ${pct}`);
  }
}

function erf(x: number): number {
  // Abramowitz-Stegun 7.1.26.
  const s = Math.sign(x), t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
