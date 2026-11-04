/**
 * Does a batter do what his level elsewhere says in a phase he rarely bats in (2026-11-04, the
 * death-overs bias: in the World Cup replays set top-order batters score 1.9 runs a ball in
 * first-innings death overs against 1.72 real, and are out less)? The batting twin of
 * `rare-phase.mts`. Men's T20Is since 2012. For every batter's balls in one phase of one innings:
 *   - his usage of that phase: his share of balls faced in it over all his other matches, against
 *     the phase's share of an innings (pp 6/20, mid 9/20, death 5/20), so 1.0 is neutral;
 *   - what he was expected to do: the rate that year for the phase, innings and his balls-faced
 *     band (so being set is not read as skill) × his level against the same rates in the other two
 *     phases, over his other matches (shrunk toward 1 by 120 balls).
 * The engine's phase vector for a rare phase is mostly his overall vector, so a band off 1.0 is a
 * bias in it.
 *
 *   NODE_OPTIONS=--max-old-space-size=8192 node --import tsx scripts/research/batting-phase.mts [from=2012-01-01] [wcOnly=0]
 */

import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch, phaseOf } from "../../src/cricsheet/match.ts";

const FROM = process.argv[2] ?? "2012-01-01";
const WC_ONLY = process.argv[3] === "1";
const PHASES = ["pp", "mid", "death"] as const;
type Phase = (typeof PHASES)[number];
const SHARE: Record<Phase, number> = { pp: 6 / 20, mid: 9 / 20, death: 5 / 20 };
const PRIOR = 120;
const MIN_OTHER = 200;

const config = loadConfig();
// Finer at the top than the engine's bands: an opener at the death has often faced 40–60 balls, and
// scoring keeps rising past 25, so one 25+ band would set his expectation too low.
const setBand = (n: number) => (n <= 2 ? "0-2" : n <= 5 ? "3-5" : n <= 11 ? "6-11" : n <= 24 ? "12-24" : n <= 39 ? "25-39" : n <= 54 ? "40-54" : "55+");
const posBand = (p: number) => (p <= 2 ? "1-2" : p <= 4 ? "3-4" : p <= 7 ? "5-7" : "8-11");

/** Balls faced (wides excluded), the striker's runs, dots (no runs off the bat), fours, sixes and his dismissals. */
const KEYS = ["runs", "dot", "four", "six", "out"] as const;
type Key = (typeof KEYS)[number];
type Cell = { n: number } & Record<Key, number>;
const cell = (): Cell => ({ n: 0, runs: 0, dot: 0, four: 0, six: 0, out: 0 });
const addTo = (a: Cell, b: Cell, f = 1) => { a.n += f * b.n; for (const k of KEYS) a[k] += f * b[k]; };

/** One batter's balls in one innings: actual and year-expected per phase, plus the innings and his position. */
interface Knock { batter: string; date: string; wc: boolean; inn: number; pos: number; act: Record<Phase, Cell>; ctx: Record<Phase, string[]> }
const knocks: Knock[] = [];
const base = new Map<string, Cell>(); // `${year}|${inn}|${phase}|${setBand}`

for (const e of loadIndex()) {
  if (e.gender !== "male" || e.date < FROM) continue;
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  const year = e.date.slice(0, 4);
  const wc = !!e.eventName && config.worldCupEventNames.has(e.eventName);
  mainInnings(m).forEach((inn, k) => {
    if (inn.reduced) return;
    const mine = new Map<string, Knock>();
    const faced = new Map<string, number>();
    for (const b of inn.balls) {
      if (b.wide) continue;
      const ph = phaseOf(b.over) as Phase;
      const s = mine.get(b.batter) ?? mine.set(b.batter, { batter: b.batter, date: e.date, wc, inn: k + 1, pos: inn.battingOrder.indexOf(b.batter) + 1 || 11, act: { pp: cell(), mid: cell(), death: cell() }, ctx: { pp: [], mid: [], death: [] } }).get(b.batter)!;
      const key = `${year}|${k + 1}|${ph}|${setBand(faced.get(b.batter) ?? 0)}`;
      faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
      const ball = cell();
      ball.n = 1;
      ball.runs = b.runsBatter;
      ball.dot = b.runsBatter === 0 ? 1 : 0;
      ball.four = b.isFour ? 1 : 0;
      ball.six = b.isSix ? 1 : 0;
      ball.out = b.wickets.some((w) => w.playerOut === b.batter) ? 1 : 0;
      addTo(s.act[ph], ball);
      s.ctx[ph].push(key);
      addTo(base.get(key) ?? base.set(key, cell()).get(key)!, ball);
    }
    knocks.push(...mine.values());
  });
}

// Expected from the year × innings × phase × balls-faced rates, per knock and phase.
const expOf = (keys: string[]): Cell => {
  const out = cell();
  for (const key of keys) { const b = base.get(key)!; out.n += 1; for (const k of KEYS) out[k] += b[k] / b.n; }
  return out;
};
const kExp = knocks.map((s) => ({ pp: expOf(s.ctx.pp), mid: expOf(s.ctx.mid), death: expOf(s.ctx.death) }));
type Tot = { act: Record<Phase, Cell>; exp: Record<Phase, Cell> };
const tot = new Map<string, Tot>();
knocks.forEach((s, i) => {
  const t = tot.get(s.batter) ?? tot.set(s.batter, { act: { pp: cell(), mid: cell(), death: cell() }, exp: { pp: cell(), mid: cell(), death: cell() } }).get(s.batter)!;
  for (const p of PHASES) { addTo(t.act[p], s.act[p]); addTo(t.exp[p], kExp[i]![p]); }
});

const bandOf = (r: number) => (r < 0.25 ? "under 0.25" : r < 0.5 ? "0.25-0.5" : r < 0.8 ? "0.5-0.8" : r < 1.25 ? "0.8-1.25" : r < 1.75 ? "1.25-1.75" : "1.75+");
const BANDS = ["under 0.25", "0.25-0.5", "0.5-0.8", "0.8-1.25", "1.25-1.75", "1.75+"];
type Acc = { a: Cell; e: Cell; rows: { a: Cell; e: Cell }[] };
const accs = new Map<string, Acc>();
const accOf = (k: string) => accs.get(k) ?? accs.set(k, { a: cell(), e: cell(), rows: [] }).get(k)!;

knocks.forEach((s, i) => {
  if (WC_ONLY && !s.wc) return;
  const t = tot.get(s.batter)!;
  const otherN = (p: Phase) => t.act[p].n - s.act[p].n;
  const allOther = PHASES.reduce((x, p) => x + otherN(p), 0);
  if (allOther < MIN_OTHER) return;
  for (const p of PHASES) {
    const here = s.act[p];
    if (!here.n) continue;
    if (allOther - otherN(p) < 60) continue;
    const usage = otherN(p) / allOther / SHARE[p];
    const ctxExp = kExp[i]![p];
    const exp = cell();
    exp.n = here.n;
    for (const k of KEYS) {
      let a = 0, x = 0;
      for (const q of PHASES) if (q !== p) { a += t.act[q][k] - s.act[q][k]; x += t.exp[q][k] - kExp[i]![q][k]; }
      const prior = PRIOR * (x / Math.max(1, allOther - otherN(p)));
      exp[k] = ctxExp[k] * ((a + prior) / (x + prior));
    }
    for (const key of [`${p} | ${bandOf(usage)}`, `${p} inn ${s.inn} | ${bandOf(usage)}`, `${p} inn ${s.inn} pos | ${posBand(s.pos)}`]) {
      const acc = accOf(key);
      addTo(acc.a, here); addTo(acc.e, exp); acc.rows.push({ a: here, e: exp });
    }
  }
});

const ratioOf = (acc: Acc, k: Key) => {
  const r = acc.a[k] / acc.e[k];
  const se = Math.sqrt(acc.rows.reduce((s, x) => s + (x.a[k] - r * x.e[k]) ** 2, 0)) / acc.e[k];
  return `${r.toFixed(3)} ±${se.toFixed(3)}`;
};
console.log(`Men's T20Is from ${FROM}${WC_ONLY ? ", World Cup knocks only" : ""}; knocks ${knocks.length}. Usage = share of his other balls faced in the phase ÷ the phase's share of an innings.`);
console.log(`Actual ÷ expected from his level in the other two phases, against year × innings × phase × balls-faced rates (±1 SE, clustered by knock).`);
const line = (label: string, acc: Acc | undefined) => {
  if (!acc || acc.a.n < 300) return;
  console.log(`  ${label.padEnd(16)} balls ${String(acc.a.n).padStart(6)}  runs ${ratioOf(acc, "runs")}  dots ${ratioOf(acc, "dot")}  4s ${ratioOf(acc, "four")}  6s ${ratioOf(acc, "six")}  out ${ratioOf(acc, "out")}`);
};
for (const p of PHASES) {
  console.log(`\n${p}`);
  for (const band of BANDS) line(`usage ${band}`, accs.get(`${p} | ${band}`));
  for (const inn of [1, 2]) {
    console.log(`  innings ${inn}`);
    for (const band of BANDS) line(`usage ${band}`, accs.get(`${p} inn ${inn} | ${band}`));
    for (const pos of ["1-2", "3-4", "5-7", "8-11"]) line(`position ${pos}`, accs.get(`${p} inn ${inn} pos | ${pos}`));
  }
}
