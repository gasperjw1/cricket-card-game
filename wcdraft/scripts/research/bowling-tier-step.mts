// The cross-tier step for bowlers, measured directly (2026-11-02). Every men's T20I ball from 2014 is
// set against an average bowler's outcome for the same year, phase and batting side's Elo bin, which
// is how the ratings' context-expected evidence works. Bowlers are then split by their own side's
// membership at the time, and each group's runs and wickets ratios (observed ÷ expected) are read
// against weak batting (Elo below 1500) and strong batting (1700 and up). A bowler group whose ratio
// worsens from weak to strong batting more than the other group's does carries a level the norm
// cannot see: the norm for weak batting is set by whoever bowls to it.
// noWc=1 leaves World Cup matches out of the bowler cells (they still set the norm), so the step
// is not read off the fixtures it would be tested on; noWc=<year> leaves out only World Cups from
// that year on (2024: fit on every World Cup before the 2024–26 hold-out, since these match-ups
// barely happen outside World Cups).
//   npx tsx scripts/research/bowling-tier-step.mts [fromYear=2014] [minBalls=60] [boots=500] [noWc=0|1|year]
import { fileURLToPath as __fu } from "node:url";
import { ARCHIVES, loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch, phaseOf } from "../../src/cricsheet/match.ts";
import { loadConfig } from "../../src/config.ts";
import { TeamStrengthAnalysis } from "../../src/analysis/team-strength.ts";
void __fu;

const fromYear = Number(process.argv[2] ?? 2014), minBalls = Number(process.argv[3] ?? 60), boots = Number(process.argv[4] ?? 500);
const wcArg = process.argv[5] ?? "0";
const wcCut = wcArg === "1" ? 0 : wcArg === "0" ? Infinity : Number(wcArg);
const noWc = wcCut !== Infinity;
/** A World Cup ball left out of the bowler cells under this run's rule. */
const leftOut = (b: { wc: boolean; year: number }) => b.wc && b.year >= wcCut;
const config = loadConfig();
const index = loadIndex(ARCHIVES.t20).filter((e) => e.gender === "male").sort((a, b) => a.date.localeCompare(b.date));
const strength = new TeamStrengthAnalysis(config.isFullMember);

type Ball = { bowler: string; group: "A" | "FM"; opp: "weak" | "mid" | "strong"; year: number; phase: string; bin: string; runs: number; wkt: number; wc: boolean; batElo: number };
const balls: Ball[] = [];
const norm = new Map<string, { n: number; runs: number; wkt: number }>();
const binOf = (r: number) => (r < 1400 ? "<1400" : r < 1500 ? "1400" : r < 1600 ? "1500" : r < 1700 ? "1600" : r < 1800 ? "1700" : "1800+");
for (const e of index) {
  const m = normaliseMatch(readMatch(e.file), e.id);
  const year = +m.date.slice(0, 4);
  const elo = Object.fromEntries(m.teams.map((t) => [t, strength.ratingOf(t, m.date)]));
  if (year >= fromYear && (m.scheduledOvers || 20) === 20) {
    for (const inn of mainInnings(m)) {
      if (inn.reduced || inn.superOver) continue;
      const batElo = elo[inn.team] ?? 1500;
      const opp = batElo < 1500 ? "weak" : batElo >= 1700 ? "strong" : "mid";
      const group = config.isFullMember(inn.bowlingTeam, year) ? "FM" : "A";
      for (const b of inn.balls) {
        if (!b.legal || b.over >= 20) continue;
        const wkt = b.wickets.some((w) => w.playerOut === b.batter) ? 1 : 0;
        const ball: Ball = { bowler: b.bowler, group, opp, year, phase: phaseOf(b.over), bin: binOf(batElo), runs: b.runsBatter, wkt, wc: !!e.eventName && config.worldCupEventNames.has(e.eventName), batElo };
        balls.push(ball);
        const k = `${year}|${ball.phase}|${ball.bin}`;
        const c = norm.get(k) ?? norm.set(k, { n: 0, runs: 0, wkt: 0 }).get(k)!;
        c.n += 1; c.runs += ball.runs; c.wkt += wkt;
      }
    }
  }
  strength.add(m);
}

// Per bowler and opposition: observed and expected runs and wickets.
type Cell = { balls: number; runs: number; xRuns: number; wkt: number; xWkt: number };
const cells = new Map<string, Map<string, Cell>>();
// Mean batting Elo faced, per bowler group and band, and overall (the gap a step would scale with).
for (const g of ["A", "FM"] as const) {
  const mean = (xs: Ball[]) => (xs.reduce((a, b) => a + b.batElo, 0) / Math.max(1, xs.length)).toFixed(0);
  const mine = balls.filter((b) => b.group === g && !leftOut(b));
  console.log(`mean batting Elo faced by ${g} bowlers: all ${mean(mine)} | weak ${mean(mine.filter((b) => b.opp === "weak"))} mid ${mean(mine.filter((b) => b.opp === "mid"))} strong ${mean(mine.filter((b) => b.opp === "strong"))}`);
}
const wcStrong = balls.filter((b) => b.group === "A" && b.opp === "strong" && b.wc).length;
const wcStrongOut = balls.filter((b) => b.group === "A" && b.opp === "strong" && leftOut(b)).length;
console.log(`associate balls to strong batting in World Cups: ${wcStrong} of ${balls.filter((b) => b.group === "A" && b.opp === "strong").length}${noWc ? `; ${wcStrongOut} left out below (World Cups from ${wcCut === 0 ? "the start" : wcCut})` : ""}`);
for (const b of balls) {
  if (leftOut(b)) continue;
  const c0 = norm.get(`${b.year}|${b.phase}|${b.bin}`)!;
  const key = `${b.group}|${b.bowler}`;
  const per = cells.get(key) ?? cells.set(key, new Map()).get(key)!;
  const c = per.get(b.opp) ?? per.set(b.opp, { balls: 0, runs: 0, xRuns: 0, wkt: 0, xWkt: 0 }).get(b.opp)!;
  c.balls += 1; c.runs += b.runs; c.xRuns += c0.runs / c0.n; c.wkt += b.wkt; c.xWkt += c0.wkt / c0.n;
}

const sum = (list: Cell[]) => list.reduce((a, c) => ({ balls: a.balls + c.balls, runs: a.runs + c.runs, xRuns: a.xRuns + c.xRuns, wkt: a.wkt + c.wkt, xWkt: a.xWkt + c.xWkt }), { balls: 0, runs: 0, xRuns: 0, wkt: 0, xWkt: 0 });
const ratios = (c: Cell) => ({ runs: c.runs / c.xRuns, wkt: c.wkt / c.xWkt });
const fmt = (x: number) => x.toFixed(3);

console.log(`men's T20Is from ${fromYear}, 20-over innings; ratios are observed ÷ expected for the same year, phase and batting Elo bin`);
console.log("\nA. every ball, by bowler group and batting strength (composition differs between columns)");
for (const g of ["A", "FM"] as const) {
  const row: string[] = [];
  for (const opp of ["weak", "mid", "strong"]) {
    const c = sum([...cells.entries()].filter(([k]) => k.startsWith(`${g}|`)).map(([, m]) => m.get(opp)).filter((x): x is Cell => !!x));
    const r = ratios(c);
    row.push(`${opp} ${String(c.balls).padStart(7)} balls runs ${fmt(r.runs)} wkts ${fmt(r.wkt)}`);
  }
  console.log(`  ${g.padEnd(2)} bowlers | ${row.join(" | ")}`);
}

// Rates per 100 Elo of stronger batting, from the weak band to each stronger band, for the step's
// exp(rate × gap / 100) form. A steeper weak→strong rate than weak→mid means the curve bends.
console.log("\nA2. rate per 100 Elo from the weak band (runs, wickets), with the wickets behind each band");
for (const g of ["A", "FM"] as const) {
  const band = (opp: string) => {
    const c = sum([...cells.entries()].filter(([k]) => k.startsWith(`${g}|`)).map(([, m]) => m.get(opp)).filter((x): x is Cell => !!x));
    const mine = balls.filter((b) => b.group === g && b.opp === opp && !leftOut(b));
    return { r: ratios(c), wkt: c.wkt, elo: mine.reduce((a, b) => a + b.batElo, 0) / Math.max(1, mine.length) };
  };
  const w = band("weak"), parts: string[] = [];
  for (const opp of ["mid", "strong"]) {
    const s = band(opp), gap = (s.elo - w.elo) / 100;
    // Wicket ratio's rough 95% band from the count alone (Poisson), carried into the rate.
    const lo = Math.log((s.r.wkt * (1 - 1.96 / Math.sqrt(Math.max(1, s.wkt)))) / w.r.wkt) / gap, hi = Math.log((s.r.wkt * (1 + 1.96 / Math.sqrt(Math.max(1, s.wkt)))) / w.r.wkt) / gap;
    parts.push(`weak→${opp} (+${(100 * gap).toFixed(0)} Elo, ${s.wkt} wkts): runs ${(Math.log(s.r.runs / w.r.runs) / gap).toFixed(4)} wkts ${(Math.log(s.r.wkt / w.r.wkt) / gap).toFixed(4)} (${lo.toFixed(3)} to ${hi.toFixed(3)}); per gap² runs ${(Math.log(s.r.runs / w.r.runs) / gap ** 2).toFixed(4)} wkts ${(Math.log(s.r.wkt / w.r.wkt) / gap ** 2).toFixed(4)}`);
  }
  console.log(`  ${g.padEnd(2)} ${parts.join(" | ")}`);
}

// The same rates in the units the ratings use: Elo bin centres (the lowest bin reads 1350), the gap
// being the batting side's bin centre less the bowler's own mean bin centre faced.
const CENTRE: Record<string, number> = { "<1400": 1350, "1400": 1450, "1500": 1550, "1600": 1650, "1700": 1750, "1800+": 1850 };
const facedBy = new Map<string, { n: number; s: number }>();
for (const b of balls) { if (leftOut(b)) continue; const f = facedBy.get(b.bowler) ?? facedBy.set(b.bowler, { n: 0, s: 0 }).get(b.bowler)!; f.n += 1; f.s += CENTRE[b.bin]!; }
console.log("\nA3. in bin-centre units (as the ratings read the gap): mean gap per band, and the rates");
for (const g of ["A", "FM"] as const) {
  const band = (opp: string) => {
    const c = sum([...cells.entries()].filter(([k]) => k.startsWith(`${g}|`)).map(([, m]) => m.get(opp)).filter((x): x is Cell => !!x));
    const mine = balls.filter((b) => b.group === g && b.opp === opp && !leftOut(b));
    const gap = mine.reduce((a, b) => { const f = facedBy.get(b.bowler)!; return a + CENTRE[b.bin]! - f.s / f.n; }, 0) / Math.max(1, mine.length);
    return { r: ratios(c), wkt: c.wkt, gap };
  };
  const w = band("weak"), parts: string[] = [`weak gap ${w.gap.toFixed(0)}`];
  for (const opp of ["mid", "strong"]) {
    const s = band(opp), gap = (s.gap - w.gap) / 100;
    parts.push(`→${opp} (+${(100 * gap).toFixed(0)}, ${s.wkt} wkts): runs ×${(s.r.runs / w.r.runs).toFixed(3)} wkts ×${(s.r.wkt / w.r.wkt).toFixed(3)}; per 100 ${(Math.log(s.r.runs / w.r.runs) / gap).toFixed(4)} / ${(Math.log(s.r.wkt / w.r.wkt) / gap).toFixed(4)}; per gap² ${(Math.log(s.r.runs / w.r.runs) / gap ** 2).toFixed(4)} / ${(Math.log(s.r.wkt / w.r.wkt) / gap ** 2).toFixed(4)}`);
  }
  console.log(`  ${g.padEnd(2)} ${parts.join(" | ")}`);
}

console.log(`\nB. the same bowlers on both sides: ${minBalls}+ legal balls against weak and against strong batting`);
const both = new Map<"A" | "FM", { weak: Cell; strong: Cell }[]>([["A", []], ["FM", []]]);
for (const [k, m] of cells) {
  const w = m.get("weak"), s = m.get("strong");
  if (w && s && w.balls >= minBalls && s.balls >= minBalls) both.get(k.split("|")[0] as "A" | "FM")!.push({ weak: w, strong: s });
}
// Step = strong ratio ÷ weak ratio, pooled over the group's bowlers; bootstrap over bowlers.
const step = (list: { weak: Cell; strong: Cell }[]) => {
  const w = ratios(sum(list.map((x) => x.weak))), s = ratios(sum(list.map((x) => x.strong)));
  return { w, s, runs: s.runs / w.runs, wkt: s.wkt / w.wkt };
};
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const ci = (list: { weak: Cell; strong: Cell }[], pick: (x: ReturnType<typeof step>) => number) => {
  const xs: number[] = [];
  for (let i = 0; i < boots; i += 1) xs.push(pick(step(list.map(() => list[Math.floor(rand() * list.length)]!))));
  xs.sort((a, b) => a - b);
  return `${fmt(xs[Math.floor(0.025 * boots)]!)}–${fmt(xs[Math.floor(0.975 * boots)]!)}`;
};
for (const g of ["A", "FM"] as const) {
  const list = both.get(g)!;
  if (list.length < 3) { console.log(`  ${g}: ${list.length} bowlers, too few`); continue; }
  const s = step(list);
  const bw = list.reduce((a, x) => a + x.weak.balls, 0), bs = list.reduce((a, x) => a + x.strong.balls, 0);
  console.log(`  ${g.padEnd(2)} ${String(list.length).padStart(4)} bowlers (${bw} balls v weak, ${bs} v strong) | v weak runs ${fmt(s.w.runs)} wkts ${fmt(s.w.wkt)} | v strong runs ${fmt(s.s.runs)} wkts ${fmt(s.s.wkt)}`);
  console.log(`     step weak → strong: runs ×${fmt(s.runs)} (95% ${ci(list, (x) => x.runs)}), wickets ×${fmt(s.wkt)} (95% ${ci(list, (x) => x.wkt)})`);
}
const a = both.get("A")!, f = both.get("FM")!;
if (a.length >= 3 && f.length >= 3) {
  const sa = step(a), sf = step(f);
  console.log(`\nC. associate step relative to the full members' step: runs ×${fmt(sa.runs / sf.runs)}, wickets ×${fmt(sa.wkt / sf.wkt)}`);
  console.log("   (above 1 on runs and below 1 on wickets = associate bowlers lose more against strong batting than the norm already allows)");
}
