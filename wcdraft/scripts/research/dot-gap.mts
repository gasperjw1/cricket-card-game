/**
 * Where the sim's missing dots are (2026-11-03, Yash: find out whether it is the players, the
 * engine, the situation or the phase). Real World Cup balls against simulated ones on the same
 * fixtures with the same elevens, split every way the engine conditions on, with dots, singles and
 * runs per ball side by side so it shows what the missing dots became.
 *
 *   NODE_OPTIONS=--max-old-space-size=8192 node --import tsx scripts/research/dot-gap.mts [editions] [sims] [overridesJson]
 *
 * A dot is a legal ball with no runs at all (wickets included, byes not), as the replay counts it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch, phaseOf } from "../../src/cricsheet/match.ts";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { setEngineOverrides } from "../../src/engine/model.ts";
import { bowlGroupOf } from "../../src/analysis/matchups.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const ids = (process.argv[2] ?? "2007,2010,2012,2014,2016,2021,2022,2024,2026").split(",");
const sims = Number(process.argv[3] ?? 10);
if (process.argv[4]) setEngineOverrides(JSON.parse(process.argv[4]));
const config = loadConfig();
const index = loadIndex();
const wcEditionOf = (e: { eventName: string | null; season: string }) => (e.eventName && config.worldCupEventNames.has(e.eventName) ? (config.editionBySeason.get(e.season)?.id ?? null) : null);

const groupOf = new Map<string, string>();
for (const line of readFileSync(resolve(ROOT, "data/labels/bowler-types.csv"), "utf8").split("\n").slice(1)) {
  const [id, , , code] = line.split(",");
  const g = bowlGroupOf(code);
  if (id && g) groupOf.set(id, g);
}

/** One legal ball, reduced to what the splits need. */
interface Ball {
  phase: string; inn: number; wk: number; setBalls: number; pos: number; group: string; streakDots: number; rrr: number | null;
  runs: number; batRuns: number; dot: boolean; single: boolean; four: boolean; six: boolean; out: boolean; batter: string; bowler: string;
}

type Tally = { n: number; dot: number; one: number; runs: number; four: number; six: number; out: number };
const tally = (): Tally => ({ n: 0, dot: 0, one: 0, runs: 0, four: 0, six: 0, out: 0 });
const add = (t: Tally, b: Ball) => { t.n += 1; t.dot += b.dot ? 1 : 0; t.one += b.single ? 1 : 0; t.runs += b.runs; t.four += b.four ? 1 : 0; t.six += b.six ? 1 : 0; t.out += b.out ? 1 : 0; };

const setBand = (n: number) => (n <= 2 ? "0-2" : n <= 5 ? "3-5" : n <= 11 ? "6-11" : n <= 24 ? "12-24" : "25+");
const wkBand = (w: number) => (w <= 1 ? "0-1" : w <= 3 ? "2-3" : w <= 5 ? "4-5" : "6+");
const posBand = (p: number) => (p <= 2 ? "1-2" : p <= 4 ? "3-4" : p <= 7 ? "5-7" : "8-11");
const rrrBand = (r: number | null) => (r === null ? "first innings" : r < 6 ? "chase <6" : r < 8 ? "chase 6-8" : r < 10 ? "chase 8-10" : r < 12 ? "chase 10-12" : r < 16 ? "chase 12-16" : "chase 16+");
const dotsBandOf = (n: number) => (n >= 3 ? "3+" : String(n));

// SUMMARY=1 prints only the splits that carry the gap, for quick experiments.
const SUMMARY = !!process.env.SUMMARY;
const SPLITS_ALL: [string, (b: Ball) => string][] = [
  ["phase", (b) => b.phase],
  ["innings × phase", (b) => `${b.inn} ${b.phase}`],
  ["wickets down", (b) => wkBand(b.wk)],
  ["striker's balls faced", (b) => setBand(b.setBalls)],
  ["batting position", (b) => posBand(b.pos)],
  ["bowler", (b) => b.group],
  ["dots in a row before", (b) => dotsBandOf(b.streakDots)],
  ["required rate", (b) => rrrBand(b.rrr)],
  ["phase × position", (b) => `${b.phase} ${posBand(b.pos)}`],
  ["bowler × phase", (b) => `${b.group} ${b.phase}`],
  ["chase death × required rate", (b) => (b.inn === 2 && b.phase === "death" ? rrrBand(b.rrr) : "–")],
  ["chase death × wickets", (b) => (b.inn === 2 && b.phase === "death" ? wkBand(b.wk) : "–")],
  ["first-innings powerplay × wickets", (b) => (b.inn === 1 && b.phase === "pp" ? wkBand(b.wk) : "–")],
  ["first-innings powerplay × balls faced", (b) => (b.inn === 1 && b.phase === "pp" ? setBand(b.setBalls) : "–")],
];
const SPLITS = SUMMARY ? SPLITS_ALL.filter(([n]) => (process.env.SPLITS ?? "innings × phase,bowler,bowler × phase,striker's balls faced").split(",").includes(n)) : SPLITS_ALL;

const real: Ball[] = [], sim: Ball[] = [];

// Real balls: every World Cup match of the editions, both innings, 20-over innings only.
for (const id of ids) {
  for (const e of index) {
    if (wcEditionOf(e) !== id) continue;
    const m = normaliseMatch(readMatch(e.file), e.id);
    const inns = mainInnings(m);
    let target: number | null = null;
    inns.forEach((inn, k) => {
      if (inn.reduced) { if (k === 0) target = null; return; }
      const order = inn.battingOrder;
      const faced = new Map<string, number>();
      let runs = 0, wk = 0, dotsRow = 0, legal = 0;
      const chase = k === 1 && target !== null ? target : null;
      for (const b of inn.balls) {
        if (b.legal) {
          const left = 120 - legal;
          const rrr = chase !== null ? Math.max(0, chase - runs) * 6 / Math.max(1, left) : null;
          const out = b.wickets.some((w) => w.playerOut === b.batter);
          real.push({
            phase: phaseOf(b.over), inn: k + 1, wk, setBalls: faced.get(b.batter) ?? 0, pos: order.indexOf(b.batter) + 1 || 11, group: groupOf.get(b.bowler) ?? "?", streakDots: dotsRow, rrr,
            runs: b.runsTotal, batRuns: b.runsBatter, dot: b.runsTotal === 0, single: b.runsBatter === 1 && b.runsExtras === 0, four: b.isFour, six: b.isSix, out, batter: b.batter, bowler: b.bowler,
          });
          legal += 1;
          dotsRow = b.runsTotal === 0 ? dotsRow + 1 : 0;
        }
        if (!b.wide) faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
        runs += b.runsTotal; wk += b.wickets.length;
      }
      if (k === 0) target = inn.total + 1;
    });
  }
}

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

// Simulated balls: the same fixtures, the real elevens and toss, no rain, `sims` times each.
for (const id of ids) {
  const data = loadEdition(id);
  for (const g of realMatches(data)) {
    const teamA = teamFromMatch(data, g.a, g.match), teamB = teamFromMatch(data, g.b, g.other);
    if (teamA.players.length < 11 || teamB.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    const first = g.match.battedFirst ? teamA : teamB;
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(teamA, teamB, env, data.situation, { seed: `gap-${id}-${g.match.id}-${s}`, battingFirst: first.name, keepBallLog: true, rainProbability: 0 });
      for (const innIndex of [1, 2] as const) {
        const batting = r.innings[innIndex - 1]!.team === teamA.name ? teamA : teamB;
        const faced = new Map<string, number>();
        let runs = 0, wk = 0, dotsRow = 0, legal = 0;
        const target = innIndex === 2 ? r.innings[0].runs + 1 : null;
        for (const b of r.balls.filter((x) => x.innings === innIndex)) {
          if (b.legal) {
            const rrr = target !== null ? Math.max(0, target - runs) * 6 / Math.max(1, 120 - legal) : null;
            const total = b.runsBatter + b.extras;
            sim.push({
              phase: phaseOf(b.over), inn: innIndex, wk, setBalls: faced.get(b.striker) ?? 0, pos: batting.battingOrder.indexOf(b.striker) + 1 || 11, group: groupOf.get(b.bowler) ?? "?", streakDots: dotsRow, rrr,
              runs: total, batRuns: b.runsBatter, dot: total === 0, single: b.runsBatter === 1 && b.extras === 0, four: b.outcome === "4", six: b.outcome === "6", out: b.wicket && b.dismissal?.nonStriker !== true, batter: b.striker, bowler: b.bowler,
            });
            legal += 1;
            dotsRow = total === 0 ? dotsRow + 1 : 0;
          }
          if (b.extraKind !== "wide") faced.set(b.striker, (faced.get(b.striker) ?? 0) + 1);
          runs = b.runsAfter; wk = b.wicketsAfter;
        }
      }
    }
  }
}

const pct = (a: number, n: number) => (n ? (100 * a) / n : 0);
const row = (label: string, r: Tally, s: Tally) =>
  `  ${label.padEnd(18)} real n ${String(r.n).padStart(6)}  dot ${pct(r.dot, r.n).toFixed(1).padStart(5)} sim ${pct(s.dot, s.n).toFixed(1).padStart(5)} gap ${(pct(s.dot, s.n) - pct(r.dot, r.n)).toFixed(1).padStart(5)} | ones ${pct(r.one, r.n).toFixed(1).padStart(5)} v ${pct(s.one, s.n).toFixed(1).padStart(5)} | runs/ball ${(r.runs / Math.max(1, r.n)).toFixed(3)} v ${(s.runs / Math.max(1, s.n)).toFixed(3)} | out ${pct(r.out, r.n).toFixed(1)} v ${pct(s.out, s.n).toFixed(1)} | share of balls ${pct(r.n, real.length).toFixed(1)} v ${pct(s.n, sim.length).toFixed(1)}`;

const totalR = tally(), totalS = tally();
for (const b of real) add(totalR, b);
for (const b of sim) add(totalS, b);
console.log(`Editions ${ids.join(",")}; ${real.length.toLocaleString()} real balls, ${sim.length.toLocaleString()} sim balls (${sims} a fixture).`);
console.log(row("all", totalR, totalS));
for (const [name, key] of SPLITS) {
  const R = new Map<string, Tally>(), S = new Map<string, Tally>();
  for (const b of real) add(R.get(key(b)) ?? R.set(key(b), tally()).get(key(b))!, b);
  for (const b of sim) add(S.get(key(b)) ?? S.set(key(b), tally()).get(key(b))!, b);
  console.log(`\n${name}`);
  for (const k of [...new Set([...R.keys(), ...S.keys()])].sort()) console.log(row(k, R.get(k) ?? tally(), S.get(k) ?? tally()));
}

// Every outcome of a legal ball, real against sim: where the missing dots went.
{
  const share = (bs: Ball[], f: (b: Ball) => boolean) => (100 * bs.filter(f).length) / bs.length;
  const kinds: [string, (b: Ball) => boolean][] = [
    ["dot (no runs at all)", (b) => b.dot],
    ["bye or leg-bye only", (b) => !b.dot && b.batRuns === 0 && !b.out],
    ["single", (b) => b.single],
    ["two", (b) => b.batRuns === 2],
    ["three", (b) => b.batRuns === 3],
    ["four", (b) => b.four],
    ["six", (b) => b.six],
    ["striker out", (b) => b.out],
    ["batter runs + extras on the same ball", (b) => b.batRuns > 0 && b.runs > b.batRuns],
  ];
  console.log("\nEvery legal ball by outcome (% of balls), real v sim:");
  for (const [k, f] of kinds) console.log(`  ${k.padEnd(40)} ${share(real, f).toFixed(2).padStart(6)} ${share(sim, f).toFixed(2).padStart(6)}  gap ${(share(sim, f) - share(real, f)).toFixed(2)}`);
}

// Gap contribution: how much of the overall gap each phase × position cell explains, at real ball shares.
if (!SUMMARY) console.log("\nContribution to the overall dot gap (real ball share × the cell's gap), largest first:");
const R2 = new Map<string, Tally>(), S2 = new Map<string, Tally>();
const k2 = (b: Ball) => `${b.phase} ${posBand(b.pos)}`;
for (const b of real) add(R2.get(k2(b)) ?? R2.set(k2(b), tally()).get(k2(b))!, b);
for (const b of sim) add(S2.get(k2(b)) ?? S2.set(k2(b), tally()).get(k2(b))!, b);
const contrib = [...R2.entries()].map(([k, r]) => { const s = S2.get(k) ?? tally(); return { k, c: (r.n / real.length) * (pct(s.dot, s.n) - pct(r.dot, r.n)) }; }).sort((a, b) => a.c - b.c);
if (!SUMMARY) for (const { k, c } of contrib) console.log(`  ${k.padEnd(16)} ${c.toFixed(2)}`);

// Players: real against sim dot % per player, and the spread of players' dot rates with the
// binomial noise of each side's own sample taken out (a real bowler's 100 balls carry about 5
// points of noise on their own, the sim's ten times as many about 1.5).
function players(key: "batter" | "bowler", label: string) {
  const by = (bs: Ball[]) => { const m = new Map<string, Tally>(); for (const b of bs) add(m.get(b[key]) ?? m.set(b[key], tally()).get(b[key])!, b); return m; };
  const R = by(real), S = by(sim);
  const ps = [...R.entries()].filter(([id, t]) => t.n >= 60 && (S.get(id)?.n ?? 0) >= 60 * sims * 0.5).map(([id, t]) => {
    const s = S.get(id)!;
    const pr = t.dot / t.n, psim = s.dot / s.n;
    return { r: 100 * pr, s: 100 * psim, n: t.n, nr: (100 * 100 * pr * (1 - pr)) / t.n, ns: (100 * 100 * psim * (1 - psim)) / s.n };
  });
  const w = ps.reduce((a, p) => a + p.n, 0);
  const gap = ps.reduce((a, p) => a + (p.s - p.r) * p.n, 0) / Math.max(1, w);
  const mr = ps.reduce((a, p) => a + p.r, 0) / ps.length, ms = ps.reduce((a, p) => a + p.s, 0) / ps.length;
  let cov = 0, vr = 0, vs = 0, nr = 0, ns = 0;
  for (const p of ps) { cov += (p.r - mr) * (p.s - ms); vr += (p.r - mr) ** 2; vs += (p.s - ms) ** 2; nr += p.nr; ns += p.ns; }
  const k = ps.length;
  const trueR = Math.sqrt(Math.max(0, vr / k - nr / k)), trueS = Math.sqrt(Math.max(0, vs / k - ns / k));
  console.log(`${label} with 60+ real balls (${k}): ball-weighted gap ${gap.toFixed(1)}; correlation real v sim ${(cov / Math.sqrt(vr * vs)).toFixed(2)}; spread of dot % with noise removed: real ${trueR.toFixed(1)}, sim ${trueS.toFixed(1)}`);
}
console.log("");
players("batter", "Batters");
players("bowler", "Bowlers");
