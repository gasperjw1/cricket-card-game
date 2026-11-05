/**
 * What do sides do with the batting order after an early collapse, does it pay, and is it the
 * captain's? (2026-11-05, Yash: after an early collapse, does a captain hold the finishers back and
 * send in a bowler who can bat to steady it?) Men's T20Is since 2010, full innings only.
 *
 * Each entry at Nos. 3–8 is read against the side-year's usual positions (each man's mean batting
 * position for that side that year; 11 if he never batted). The entry is
 *   - in order: the incoming man's usual position is within one of the earliest still to bat;
 *   - a batter sent ahead: someone usually lower came in over a man usually higher;
 *   - a bowler sent ahead: as above, and the incoming man usually bats 8 or lower;
 *   and it "holds a finisher" when a man who usually bats 6–7 is passed over.
 * A collapse is 3 down by the end of over 6, 4 down by over 8, or 5 down by over 10. Other entries
 * at the same number of wickets down are the comparison.
 *
 * Does it pay: first innings only, the runs from the entry to the end less the mean for entries
 * at the same wickets down and over (all sides), raw and within the side-year (team strength out).
 * Is it the captain's: the same split-half captain/coach fit as `captain-effects.mts`.
 *
 *   node --import tsx scripts/research/collapse-response.mts [minRows=20]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch } from "../../src/cricsheet/match.ts";
import { readCsv } from "../../src/util/csv.ts";
import { UsualPositions, isCollapse, isFinisherPosition } from "../../src/analysis/batting-order.ts";
import { tenureOf } from "../../src/analysis/captaincy.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const MIN = Number(process.argv[2] ?? 20);
const LAMBDA = 10;

// Captains (`tenureOf`) and coaches, as in `captain-effects.mts`.
const tenures = JSON.parse(readFileSync(resolve(ROOT, "data/out/captaincy.json"), "utf8")).captains as { personId: string; captainName: string; team: string; firstYear: number; lastYear: number; matches: number }[];
const captainOf = (team: string, date: string, xi: string[]) => { const t = tenureOf(tenures, team, date.slice(0, 4), xi); return t ? `${team} | ${t.captainName}` : null; };
const coachRows = readCsv(readFileSync(resolve(ROOT, "data/config/coaches.csv"), "utf8"));
const pad = (d: string, end: boolean) => (!d ? (end ? "2099-12-31" : "1900-01-01") : d.length === 4 ? `${d}${end ? "-12-31" : "-01-01"}` : d.length === 7 ? `${d}${end ? "-31" : "-01"}` : d);
const coachOf = (team: string, date: string) => {
  const hits = coachRows.filter((r) => r.team === team && pad(r.fromDate ?? "", false) <= date && date <= pad(r.toDate ?? "", true)).sort((a, b) => pad(b.fromDate ?? "", false).localeCompare(pad(a.fromDate ?? "", false)));
  return hits.length ? `${team} | ${hits[0]!.coachName}` : null;
};

const index = loadIndex().filter((e) => e.gender === "male" && e.date >= "2010-01-01").sort((a, b) => a.date.localeCompare(b.date));
const matches = [];
// Each side-year's usual positions.
const usual = new UsualPositions();
for (const e of index) {
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  matches.push(m);
  for (const inn of mainInnings(m)) if (!inn.reduced && !inn.superOver) usual.add(inn.team, m.date.slice(0, 4), inn.battingOrder);
}
const usualOf = (team: string, year: string, id: string) => usual.of(team, year, id);

type Kind = "inOrder" | "batterAhead" | "bowlerAhead";
interface Entry { collapse: boolean; down: number; over: number; kind: Kind; heldFinisher: boolean; finisherDue: boolean; firstInnings: boolean; rest: number | null; side: string; year: string; cap: string | null; coach: string | null; wc: boolean }
const entries: Entry[] = [];

for (const m of matches) {
  const year = m.date.slice(0, 4);
  for (const inn of mainInnings(m)) {
    if (inn.reduced || inn.superOver || inn.scheduledOvers !== 20) continue;
    const xi = m.xis[inn.team] ?? [];
    if (xi.length !== 11) continue;
    const cap = captainOf(inn.team, m.date, xi), coach = coachOf(inn.team, m.date);
    // The ball index at which each batter first appears, for the runs before his entry.
    const firstSeen = new Map<string, number>();
    inn.balls.forEach((b, i) => { for (const id of [b.batter, b.nonStriker]) if (!firstSeen.has(id)) firstSeen.set(id, i); });
    for (let p = 3; p <= 8 && p <= inn.battingOrder.length; p += 1) {
      const id = inn.battingOrder[p - 1]!;
      const over = inn.batters.get(id)?.arrivedOver ?? 0;
      const down = p - 2;
      const collapse = isCollapse(down, over);
      const batted = new Set(inn.battingOrder.slice(0, p - 1));
      const waiting = xi.filter((x) => !batted.has(x) && x !== id).map((x) => ({ x, u: usualOf(inn.team, year, x) }));
      const mine = usualOf(inn.team, year, id);
      const earliest = Math.min(mine, ...waiting.map((w) => w.u));
      const ahead = mine > earliest + 1;
      const kind: Kind = !ahead ? "inOrder" : mine >= 7.5 ? "bowlerAhead" : "batterAhead";
      const heldFinisher = waiting.some((w) => isFinisherPosition(w.u) && w.u < mine - 0.5);
      const at = firstSeen.get(id);
      const before = at === undefined ? null : inn.balls.slice(0, at).reduce((s, b) => s + b.runsTotal, 0);
      const finisherDue = isFinisherPosition(earliest);
      entries.push({ collapse, down, over, kind, heldFinisher, finisherDue, firstInnings: inn.index === 0, rest: before === null ? null : inn.total - before, side: inn.team, year, cap, coach, wc: /world cup|world twenty20/i.test(m.eventName ?? "") && !/qualifier|sub regional|regional final/i.test(m.eventName ?? "") });
    }
  }
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const share = (es: Entry[]) => {
  const n = es.length;
  const c = (k: Kind) => es.filter((e) => e.kind === k).length;
  return `${String(n).padStart(6)} entries: in order ${pct(c("inOrder"), n)}, batter sent ahead ${pct(c("batterAhead"), n)}, bowler sent ahead ${pct(c("bowlerAhead"), n)}, finisher held ${pct(es.filter((e) => e.heldFinisher).length, n)}`;
};

console.log("What sides do (entries at 3–7 down; a collapse against other entries at the same wickets down)");
for (const wc of [false, true]) {
  const pool = entries.filter((e) => e.down >= 3 && e.down <= 5 && (!wc || e.wc));
  console.log(wc ? "  World Cups only:" : "  All men's T20Is since 2010:");
  console.log(`    collapse   ${share(pool.filter((e) => e.collapse))}`);
  console.log(`    otherwise  ${share(pool.filter((e) => !e.collapse))}`);
}

// Does it pay? Runs from the entry to the end, first innings, against entries at the same state.
const fi = entries.filter((e) => e.firstInnings && e.rest !== null);
const bucket = new Map<string, { s: number; n: number }>();
for (const e of fi) { const k = `${e.down}|${e.over}`; const b = bucket.get(k) ?? bucket.set(k, { s: 0, n: 0 }).get(k)!; b.s += e.rest!; b.n += 1; }
const resid = (e: Entry) => { const b = bucket.get(`${e.down}|${e.over}`)!; return e.rest! - b.s / b.n; };
const col = fi.filter((e) => e.collapse);
const sideYear = new Map<string, { s: number; n: number }>();
for (const e of col) { const k = `${e.side}|${e.year}`; const b = sideYear.get(k) ?? sideYear.set(k, { s: 0, n: 0 }).get(k)!; b.s += resid(e); b.n += 1; }
const within = (e: Entry) => { const b = sideYear.get(`${e.side}|${e.year}`)!; return b.n >= 2 ? resid(e) - b.s / b.n : null; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const se = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1) / xs.length); };
console.log("\nDoes it pay (first innings after a collapse: runs from the entry to the end, against the same wickets down and over)");
const groups: [string, (e: Entry) => boolean][] = [
  ["in order          ", (e) => e.kind === "inOrder"],
  ["batter sent ahead ", (e) => e.kind === "batterAhead"],
  ["bowler sent ahead ", (e) => e.kind === "bowlerAhead"],
  ["finisher held     ", (e) => e.heldFinisher],
  ["finisher not held ", (e) => !e.heldFinisher],
];
for (const [name, f] of groups) {
  const es = col.filter(f);
  const raw = es.map(resid), w = es.map(within).filter((x): x is number => x !== null);
  console.log(`  ${name} ${String(es.length).padStart(5)}  raw ${mean(raw) >= 0 ? "+" : ""}${mean(raw).toFixed(1)} ± ${se(raw).toFixed(1)}  within side-year ${w.length ? `${mean(w) >= 0 ? "+" : ""}${mean(w).toFixed(1)} ± ${se(w).toFixed(1)} (${w.length})` : "—"}`);
}

// Is it the captain's? Split-half captain/coach fit on collapse entries.
interface Row { cap: string; coach: string; year: string; side: string; value: number }
function fit(rs: Row[]) {
  const cap = new Map<string, number>(), coach = new Map<string, number>();
  const nCap = new Map<string, number>(), nCoach = new Map<string, number>();
  for (const r of rs) { nCap.set(r.cap, (nCap.get(r.cap) ?? 0) + 1); nCoach.set(r.coach, (nCoach.get(r.coach) ?? 0) + 1); }
  for (let it = 0; it < 40; it += 1) {
    const sc = new Map<string, number>();
    for (const r of rs) sc.set(r.cap, (sc.get(r.cap) ?? 0) + r.value - (coach.get(r.coach) ?? 0));
    for (const [k, s] of sc) cap.set(k, s / (nCap.get(k)! + LAMBDA));
    const sk = new Map<string, number>();
    for (const r of rs) sk.set(r.coach, (sk.get(r.coach) ?? 0) + r.value - (cap.get(r.cap) ?? 0));
    for (const [k, s] of sk) coach.set(k, s / (nCoach.get(k)! + LAMBDA));
  }
  return { cap, coach, nCap, nCoach };
}
const corr = (xs: number[], ys: number[]) => {
  const mx = mean(xs), my = mean(ys);
  let c = 0, vx = 0, vy = 0; xs.forEach((x, i) => { c += (x - mx) * (ys[i]! - my); vx += (x - mx) ** 2; vy += (ys[i]! - my) ** 2; });
  return c / Math.sqrt(vx * vy);
};
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); };
const trait = (label: string, value: (e: Entry) => number, scope: (e: Entry) => boolean) => {
  const rs0: Row[] = entries.filter((e) => scope(e) && e.cap && e.coach).map((e) => ({ cap: e.cap!, coach: e.coach!, year: e.year, side: e.side, value: value(e) }));
  const ym = new Map<string, { s: number; n: number }>();
  for (const r of rs0) { const x = ym.get(r.year) ?? ym.set(r.year, { s: 0, n: 0 }).get(r.year)!; x.s += r.value; x.n += 1; }
  const rs = rs0.map((r) => ({ ...r, value: r.value - ym.get(r.year)!.s / ym.get(r.year)!.n }));
  const seen = new Map<string, number>();
  const halves: [Row[], Row[]] = [[], []];
  for (const r of rs) { const i = seen.get(r.side) ?? 0; seen.set(r.side, i + 1); halves[i % 2]!.push(r); }
  const [f0, f1] = halves.map(fit) as [ReturnType<typeof fit>, ReturnType<typeof fit>];
  const half = MIN / 2;
  const report = (name: string, a: Map<string, number>, b: Map<string, number>, na: Map<string, number>, nb: Map<string, number>) => {
    const ks = [...a.keys()].filter((k) => (na.get(k) ?? 0) >= half && (nb.get(k) ?? 0) >= half && b.has(k));
    if (ks.length < 8) return `${name}: too few (${ks.length})`;
    const xs = ks.map((k) => a.get(k)!), ys = ks.map((k) => b.get(k)!);
    const r = corr(xs, ys);
    const spread = Math.sqrt(Math.max(0, r)) * Math.sqrt((sd(xs) ** 2 + sd(ys) ** 2) / 2);
    return `${name}: ${ks.length} with ${half}+ rows a half, split-half r ${r.toFixed(2)}, true spread ${(spread * 100).toFixed(1)} points`;
  };
  // Captain alone: each half's shrunk mean, no coach term (what the pipeline can carry).
  const alone = (hs: Row[]) => { const s = new Map<string, { s: number; n: number }>(); for (const r of hs) { const x = s.get(r.cap) ?? s.set(r.cap, { s: 0, n: 0 }).get(r.cap)!; x.s += r.value; x.n += 1; } return { m: new Map([...s].map(([k, x]) => [k, x.s / (x.n + LAMBDA)])), n: new Map([...s].map(([k, x]) => [k, x.n])) }; };
  const [a0, a1] = halves.map(alone) as [ReturnType<typeof alone>, ReturnType<typeof alone>];
  console.log(`\n${label} (${rs.length} rows; base rate ${(100 * mean(rs0.map((r) => r.value))).toFixed(1)}%)`);
  console.log(`  ${report("captain alone      ", a0.m, a1.m, a0.n, a1.n)}`);
  console.log(`  ${report("captain, coach held", f0.cap, f1.cap, f0.nCap, f1.nCap)}`);
  console.log(`  ${report("coach, captain held", f0.coach, f1.coach, f0.nCoach, f1.nCoach)}`);
};
const atCollapse = (e: Entry) => e.collapse;
const atThreeToFive = (e: Entry) => e.down >= 3 && e.down <= 5;
trait("After a collapse: someone sent ahead of the usual order", (e) => (e.kind !== "inOrder" ? 1 : 0), atCollapse);
trait("After a collapse: a finisher held back", (e) => (e.heldFinisher ? 1 : 0), atCollapse);
trait("Any entry at 3–5 down: someone sent ahead of the usual order", (e) => (e.kind !== "inOrder" ? 1 : 0), atThreeToFive);
// What the engine plays: after a collapse with a finisher due (the earliest still waiting usually
// bats 6–7), does someone else go in?
trait("After a collapse with a finisher due: someone else sent in", (e) => (e.kind !== "inOrder" ? 1 : 0), (e) => e.collapse && e.finisherDue);
