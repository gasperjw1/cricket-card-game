// Do coaches change how their sides bat, beyond the players? (2026-11-03, before the engine plays
// the coach tags.) Every ball of T20Is and leagues since 2014, expected shares with the batter, the
// bowler and setness removed (`analysis/pressure.ts`); for each national coach's tenure, runs and
// wickets observed over expected by phase and for No. 6 down. Two tests per tag: does the residual
// repeat across the two halves of the archive (a coach effect has to), and does it line up with
// the tag's own index in `coaches.json` (the team's raw style, players included)?
//   npx tsx scripts/research/coach-residuals.mts [minBallsPerHalf=600]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHIVES, LEAGUE_ARCHIVES, archiveIsReady, loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch } from "../../src/cricsheet/match.ts";
import { PressureAnalysis, type CoachResidual } from "../../src/analysis/pressure.ts";
import { readCsv } from "../../src/util/csv.ts";
import { paths } from "../../src/util/io.ts";

const minBalls = Number(process.argv[2] ?? 600);
const rows = readCsv(readFileSync(resolve(paths.config, "coaches.csv"), "utf8")).filter((r) => r.role !== "interim");
const span = (from: string, to: string) => [from.length >= 7 ? from.slice(0, 7) : `${from.slice(0, 4)}-01`, to.trim() ? (to.length >= 7 ? to.slice(0, 7) : `${to.slice(0, 4)}-12`) : "2026-12"] as const;
const tenures = rows.map((r) => ({ key: `${r.team}|${r.coachName}|${r.fromDate}`, team: r.team!, range: span(r.fromDate ?? "", r.toDate ?? "") }));
const tenureOf = (team: string, month: string) => tenures.find((t) => t.team === team && t.range[0] <= month && month <= t.range[1])?.key ?? null;

const entries = [...loadIndex(ARCHIVES.t20).filter((e) => e.gender === "male"), ...LEAGUE_ARCHIVES.filter(archiveIsReady).flatMap((a) => loadIndex(a).filter((e) => e.gender === "male"))];
const pressure = new PressureAnalysis();
for (const e of entries) pressure.add(normaliseMatch(readMatch(e.file), e.id));
pressure.tables(() => null);
const res = pressure.coachResiduals(tenureOf);

const coaches = JSON.parse(readFileSync(resolve(paths.out, "coaches.json"), "utf8")).coaches as { team: string; coachName: string; from: string; z: Record<string, number>; tags: string[] }[];
const zOf = new Map(coaches.map((c) => [`${c.team}|${c.coachName}|${c.from}`, c.z]));

type Cell = "pp" | "mid" | "death" | "lower";
const ratio = (h: CoachResidual, cell: Cell, kind: "runs" | "wickets") => h[cell][kind][0] / Math.max(1e-9, h[cell][kind][1]);
const sum = (a: CoachResidual, b: CoachResidual): CoachResidual => ({ balls: a.balls + b.balls, ...Object.fromEntries((["pp", "mid", "death", "lower"] as Cell[]).map((c) => [c, { runs: [a[c].runs[0] + b[c].runs[0], a[c].runs[1] + b[c].runs[1]], wickets: [a[c].wickets[0] + b[c].wickets[0], a[c].wickets[1] + b[c].wickets[1]] }])) }) as CoachResidual;
const kept = [...res].filter(([, [a, b]]) => a!.balls >= minBalls && b!.balls >= minBalls);
const corr = (xs: number[], ys: number[], ws: number[]) => {
  const W = ws.reduce((s, w) => s + w, 0), mx = xs.reduce((s, x, i) => s + ws[i]! * x, 0) / W, my = ys.reduce((s, y, i) => s + ws[i]! * y, 0) / W;
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += ws[i]! * (x - mx) * (ys[i]! - my); sxx += ws[i]! * (x - mx) ** 2; syy += ws[i]! * (ys[i]! - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
};
const sd = (xs: number[], ws: number[]) => { const W = ws.reduce((s, w) => s + w, 0), m = xs.reduce((s, x, i) => s + ws[i]! * x, 0) / W; return Math.sqrt(xs.reduce((s, x, i) => s + ws[i]! * (x - m) ** 2, 0) / W); };

console.log(`${kept.length} coach tenures with ${minBalls}+ balls batted in each half. Residual = observed over expected with players removed.`);
const TESTS: [string, Cell, "runs" | "wickets", string, number][] = [
  ["Powerplay aggressor/anchor", "pp", "runs", "ppIntent", 1],
  ["Wicket preserver/Risk taker", "pp", "wickets", "ppPreservation", -1],
  ["Middle-overs tempo (wickets at 15)", "mid", "wickets", "wicketsAt15", 1],
  ["Death hitter/conservative", "death", "runs", "deathIntent", 1],
  ["Deep batting/Top-heavy", "lower", "runs", "lowerOrderShare", 1],
];
for (const [label, cell, kind, index, sign] of TESTS) {
  const ws = kept.map(([, [a, b]]) => Math.min(a![cell][kind][1], b![cell][kind][1]));
  const h0 = kept.map(([, [a]]) => ratio(a!, cell, kind)), h1 = kept.map(([, [, b]]) => ratio(b!, cell, kind));
  const full = kept.map(([, [a, b]]) => ratio(sum(a!, b!), cell, kind));
  const withZ = kept.map(([k], i) => [zOf.get(k)?.[index], full[i]!, ws[i]!] as const).filter(([z]) => z !== undefined) as [number, number, number][];
  console.log(`${label.padEnd(36)} ${cell} ${kind}: split-half r ${corr(h0, h1, ws).toFixed(2)}; spread of the residual across coaches (SD) ${(100 * sd(full, ws)).toFixed(1)}%; r with the tag index ${(sign * corr(withZ.map((x) => x[0]), withZ.map((x) => x[1]), withZ.map((x) => x[2]))).toFixed(2)} (${withZ.length} coaches)`);
}
