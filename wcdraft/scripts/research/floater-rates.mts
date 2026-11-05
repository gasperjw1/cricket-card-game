/**
 * When real sides send a man in out of the usual order, and whom (2026-11-05, for the engine's
 * in-match floater). Men's T20Is since 2010, full 20-over innings, entries at Nos. 3–8 with at least
 * two of the eleven still waiting. "Usual" is the side-year's mean batting position, as in
 * `collapse-response.mts`; an entry is "ahead" when the man in usually bats more than one place
 * below the earliest man still waiting (the one "due").
 *
 * Reports:
 *   - the share sent ahead by phase of arrival (powerplay, middle, death) and wickets down;
 *   - for entries sent ahead, which of three reasons fit, against what picking at random among
 *     the waiting men would give:
 *       hitter: the man in has a higher career death strike rate (before the match) than the due man;
 *       left-right: the man in bats with the other hand to the non-striker, and the due man doesn't;
 *       spin: the man in is left-handed when the bowling side has a spinner in this over (or a
 *             right-hander against left-arm spin), the due man not;
 *   - how far ahead (places jumped), and the World Cup subset.
 *
 *   node --import tsx scripts/research/floater-rates.mts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch } from "../../src/cricsheet/match.ts";
import { readCsv } from "../../src/util/csv.ts";
import { bowlClassOf, handOf, type BowlClass } from "../../src/analysis/matchups.ts";
import { UsualPositions } from "../../src/analysis/batting-order.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const labels = new Map<string, { hand: "R" | "L" | null; cls: BowlClass | null }>();
for (const file of ["data/labels/players.csv", "data/labels/bowler-types.csv"]) {
  for (const r of readCsv(readFileSync(resolve(ROOT, file), "utf8"))) {
    const was = labels.get(r.personId ?? "");
    labels.set(r.personId ?? "", { hand: was?.hand ?? handOf(r.handedness), cls: was?.cls ?? bowlClassOf(r.bowlingType) });
  }
}

const index = loadIndex().filter((e) => e.gender === "male" && e.date >= "2010-01-01").sort((a, b) => a.date.localeCompare(b.date));
const matches = [];
const usual = new UsualPositions();
for (const e of index) {
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  matches.push(m);
  for (const inn of mainInnings(m)) if (!inn.reduced && !inn.superOver) usual.add(inn.team, m.date.slice(0, 4), inn.battingOrder);
}
const usualOf = (team: string, year: string, id: string) => usual.of(team, year, id);

// Career death strike rate before the match (balls in overs 16–20), shrunk to 135 with 30 balls.
const death = new Map<string, { r: number; b: number }>();
const deathSR = (id: string) => { const d = death.get(id) ?? { r: 0, b: 0 }; return (100 * (d.r + 30 * 1.35)) / (d.b + 30); };

type Phase = "pp" | "mid" | "death";
interface Tally { n: number; ahead: number; jump: number; hitter: [number, number]; lr: [number, number]; spin: [number, number]; lrAvail: number; spinAvail: number }
const blank = (): Tally => ({ n: 0, ahead: 0, jump: 0, hitter: [0, 0], lr: [0, 0], spin: [0, 0], lrAvail: 0, spinAvail: 0 });
const byKey = new Map<string, Tally>();
const tally = (k: string) => byKey.get(k) ?? byKey.set(k, blank()).get(k)!;

for (const m of matches) {
  const year = m.date.slice(0, 4);
  const wc = /world cup|world twenty20/i.test(m.eventName ?? "") && !/qualifier|regional/i.test(m.eventName ?? "");
  for (const inn of mainInnings(m)) {
    if (inn.reduced || inn.superOver || inn.scheduledOvers !== 20) continue;
    const xi = m.xis[inn.team] ?? [];
    if (xi.length !== 11) continue;
    // Who was at the other end, and who bowled, when each batter first appeared.
    const arrival = new Map<string, { partner: string; bowler: string }>();
    for (const b of inn.balls) {
      if (!arrival.has(b.batter)) arrival.set(b.batter, { partner: b.nonStriker, bowler: b.bowler });
      if (!arrival.has(b.nonStriker)) arrival.set(b.nonStriker, { partner: b.batter, bowler: b.bowler });
    }
    for (let p = 3; p <= 8 && p <= inn.battingOrder.length; p += 1) {
      const id = inn.battingOrder[p - 1]!;
      const over = inn.batters.get(id)?.arrivedOver ?? 0;
      const phase: Phase = over < 6 ? "pp" : over < 15 ? "mid" : "death";
      const batted = new Set(inn.battingOrder.slice(0, p - 1));
      const waiting = xi.filter((x) => !batted.has(x)).map((x) => ({ x, u: usualOf(inn.team, year, x) })).sort((a, b) => a.u - b.u);
      if (waiting.length < 2) continue;
      const due = waiting[0]!;
      const mine = usualOf(inn.team, year, id);
      const ahead = mine > due.u + 1;
      for (const k of [`all|${phase}`, `all|${phase}|${Math.min(p - 2, 5)}`, ...(wc ? [`wc|${phase}`] : [])]) {
        const t = tally(k);
        t.n += 1;
        if (!ahead) continue;
        t.ahead += 1;
        t.jump += waiting.findIndex((w) => w.x === id);
        // Reasons, for the man in and for a man drawn at random from the rest waiting (the baseline).
        const arr = arrival.get(id);
        const partnerHand = arr ? labels.get(arr.partner)?.hand : null;
        const cls = arr ? labels.get(arr.bowler)?.cls : null;
        const others = waiting.filter((w) => w.x !== due.x);
        const share = (f: (x: string) => boolean) => others.filter((w) => f(w.x)).length / others.length;
        const hitter = (x: string) => deathSR(x) > deathSR(due.x);
        t.hitter[0] += hitter(id) ? 1 : 0; t.hitter[1] += share(hitter);
        const dueHand = labels.get(due.x)?.hand;
        if (partnerHand && dueHand === partnerHand) {
          const lr = (x: string) => { const h = labels.get(x)?.hand; return !!h && h !== partnerHand; };
          t.lrAvail += 1; t.lr[0] += lr(id) ? 1 : 0; t.lr[1] += share(lr);
        }
        const suits = (x: string) => { const h = labels.get(x)?.hand; return (cls === "off-spin" || cls === "leg-spin") ? h === "L" : cls === "left-arm-spin" ? h === "R" : false; };
        if (cls && !suits(due.x) && (cls.endsWith("spin"))) { t.spinAvail += 1; t.spin[0] += suits(id) ? 1 : 0; t.spin[1] += share(suits); }
      }
    }
  }
  for (const inn of mainInnings(m)) for (const b of inn.balls) if (b.legal && b.over >= 15) { const d = death.get(b.batter) ?? death.set(b.batter, { r: 0, b: 0 }).get(b.batter)!; d.r += b.runsBatter; d.b += 1; }
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : "—");
const line = (label: string, t: Tally) => `${label} ${String(t.n).padStart(6)} entries, ahead ${pct(t.ahead, t.n).padStart(4)}` + (t.ahead ? `, jump ${(t.jump / t.ahead).toFixed(2)} places; hitter ${pct(t.hitter[0], t.ahead)} (random ${pct(t.hitter[1], t.ahead)}), left-right ${pct(t.lr[0], t.lrAvail)} (random ${pct(t.lr[1], t.lrAvail)}, ${t.lrAvail} could), spin ${pct(t.spin[0], t.spinAvail)} (random ${pct(t.spin[1], t.spinAvail)}, ${t.spinAvail} could)` : "");
for (const scope of ["all", "wc"]) {
  console.log(scope === "all" ? "All men's T20Is since 2010" : "\nWorld Cups");
  for (const ph of ["pp", "mid", "death"]) { const t = byKey.get(`${scope}|${ph}`); if (t) console.log(line(`  ${ph.padEnd(5)}`, t)); }
}
console.log("\nBy phase and wickets down (all)");
for (const ph of ["pp", "mid", "death"]) for (let w = 1; w <= 5; w += 1) { const t = byKey.get(`all|${ph}|${w}`); if (t && t.n >= 100) console.log(`  ${ph.padEnd(5)} ${w}${w === 5 ? "+" : " "} down ${String(t.n).padStart(6)} entries, ahead ${pct(t.ahead, t.n)}`); }
