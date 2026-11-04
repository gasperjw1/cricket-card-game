/**
 * The ball model on real balls (2026-11-04, the death-overs bias). Every legal ball of the World
 * Cups with both elevens rated is fed to `outcomeDistribution` in its real situation (over, wickets,
 * the striker's balls faced and boundary found, required rate, last six balls, ball in the over,
 * dots in a row, the coach's intent and depth) with the real batter and bowler. Expected against
 * actual by cell then says whether the ball model is off, apart from who bowls when and how a
 * simulated innings unfolds. Match, innings and day effects are left at 1, so the whole sim's
 * level is not exactly the mean here; read the cells against each other.
 *
 *   NODE_OPTIONS=--max-old-space-size=8192 node --import tsx scripts/research/ball-check.mts [editions] [overridesJson]
 *
 * Runs are the striker's (byes and extras out); out is the striker out.
 */

import { loadConfig } from "../../src/config.ts";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch, phaseOf } from "../../src/cricsheet/match.ts";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { outcomeDistribution, type BallContext } from "../../src/engine/ball.ts";
import { ENGINE, setEngineOverrides } from "../../src/engine/model.ts";
import { streakBand } from "../../src/analysis/situation.ts";

const ids = (process.argv[2] ?? "2007,2010,2012,2014,2016,2021,2022,2024,2026").split(",");
if (process.argv[3]) setEngineOverrides(JSON.parse(process.argv[3]));
const config = loadConfig();
const index = loadIndex();
const wcEditionOf = (e: { eventName: string | null; season: string }) => (e.eventName && config.worldCupEventNames.has(e.eventName) ? (config.editionBySeason.get(e.season)?.id ?? null) : null);

const setBand = (n: number) => (n <= 2 ? "0-2" : n <= 5 ? "3-5" : n <= 11 ? "6-11" : n <= 24 ? "12-24" : "25+");
const wkBand = (w: number) => (w <= 1 ? "0-1" : w <= 3 ? "2-3" : w <= 5 ? "4-5" : "6+");
const posBand = (p: number) => (p <= 2 ? "1-2" : p <= 4 ? "3-4" : p <= 7 ? "5-7" : "8-11");
const RUNS: Record<string, number> = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "6": 6, W: 0 };

type Acc = { n: number; aRuns: number; eRuns: number; a4: number; e4: number; a6: number; e6: number; aW: number; eW: number; a0: number; e0: number };
const acc = (): Acc => ({ n: 0, aRuns: 0, eRuns: 0, a4: 0, e4: 0, a6: 0, e6: 0, aW: 0, eW: 0, a0: 0, e0: 0 });
const cells = new Map<string, Acc>();
const SPLITS: [string, (k: Key) => string][] = [
  ["innings × phase", (k) => `${k.inn} ${k.phase}`],
  ["phase × balls faced", (k) => `${k.phase} ${k.set}`],
  ["death × innings × position", (k) => (k.phase === "death" ? `${k.inn} ${k.pos}` : "")],
  ["death × innings × balls faced", (k) => (k.phase === "death" ? `${k.inn} ${k.set}` : "")],
  ["death × innings × wickets", (k) => (k.phase === "death" ? `${k.inn} ${k.wk}` : "")],
  ["death × innings × over", (k) => (k.phase === "death" ? `${k.inn} over ${k.over}` : "")],
  ["first-innings death × position × balls faced", (k) => (k.phase === "death" && k.inn === 1 ? `${k.pos} ${k.set}` : "")],
];
type Key = { inn: number; phase: string; set: string; pos: string; wk: string; over: number };

let used = 0, skipped = 0;
for (const id of ids) {
  const data: EditionData = loadEdition(id);
  const byMatch = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (byMatch.get(m.id) ?? byMatch.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  for (const e of index) {
    if (wcEditionOf(e) !== id) continue;
    const sides = byMatch.get(e.id);
    if (!sides || sides.length !== 2 || sides.some((s) => s.match.xi.length !== 11)) { skipped += 1; continue; }
    const teams = new Map(sides.map((s) => [s.team, teamFromMatch(data, s.team, s.match)] as const));
    if ([...teams.values()].some((t) => t.players.length < 11)) { skipped += 1; continue; }
    const env = matchEnvironment(data, sides[0]!.match.venueId || null, 20);
    const m = normaliseMatch(readMatch(e.file), e.id);
    let target: number | null = null;
    mainInnings(m).forEach((inn, k) => {
      if (inn.reduced) return;
      const batting = teams.get(inn.team), bowling = teams.get(inn.bowlingTeam);
      if (!batting || !bowling) return;
      const pl = (team: typeof batting, pid: string) => team.players.find((p) => p.id === pid);
      const chaseScale = k === 1 ? 1 + env.chaseUplift / 2 : 1 - env.chaseUplift / 2;
      const faced = new Map<string, number>();
      const found = new Set<string>();
      const recent: number[] = [];
      let runs = 0, wk = 0, legal = 0, dots = 0, inOver = 0, lastOver = -1, freeHit = false;
      const chase = k === 1 ? target : null;
      for (const b of inn.balls) {
        if (b.over !== lastOver) { inOver = 0; lastOver = b.over; }
        const striker = pl(batting, b.batter), bowler = pl(bowling, b.bowler);
        const ph = phaseOf(b.over);
        if (b.legal && striker && bowler) {
          const pos = inn.battingOrder.indexOf(b.batter) + 1 || 11;
          const ctx: BallContext = {
            innings: (k + 1) as 1 | 2, over: b.over, wickets: wk, strikerBalls: faced.get(b.batter) ?? 0, strikerFound: found.has(b.batter),
            requiredRpo: chase !== null ? ((chase - runs) * 6) / Math.max(1, 120 - legal) : null, scoringFactor: chaseScale, playerFactor: 1,
            streak: streakBand(recent.length, recent.slice(-6).reduce((a, x) => a + x, 0)), ballInOver: inOver + 1, consecutiveDots: dots, freeHit,
            intent: batting.intent?.[ph] ?? 0, depthFactor: pos >= 6 ? 1 + ENGINE.coachPlay.depth * (batting.coachPlay?.lowerOrder ?? 0) : 1,
          };
          const d = outcomeDistribution(striker, bowler, env, data.situation, ctx);
          const out = b.wickets.some((w) => w.playerOut === b.batter);
          const key: Key = { inn: k + 1, phase: ph, set: setBand(ctx.strikerBalls), pos: posBand(pos), wk: wkBand(wk), over: b.over + 1 };
          for (const [split, f] of [["all", () => "all"] as [string, (k: Key) => string], ...SPLITS]) {
            const label = f(key);
            if (!label) continue;
            const c = cells.get(`${split}|${label}`) ?? cells.set(`${split}|${label}`, acc()).get(`${split}|${label}`)!;
            c.n += 1;
            c.aRuns += out ? 0 : b.runsBatter; c.eRuns += Object.entries(d).reduce((a, [o, p]) => a + RUNS[o]! * p, 0);
            c.a4 += b.isFour ? 1 : 0; c.e4 += d["4"]; c.a6 += b.isSix ? 1 : 0; c.e6 += d["6"];
            c.aW += out ? 1 : 0; c.eW += d.W; c.a0 += !out && b.runsBatter === 0 ? 1 : 0; c.e0 += d["0"];
          }
          used += 1;
        }
        if (!b.wide) faced.set(b.batter, (faced.get(b.batter) ?? 0) + 1);
        if (b.isFour || b.isSix) found.add(b.batter);
        if (b.legal || b.wickets.length) recent.push(b.runsBatter);
        if (b.legal) { legal += 1; inOver += 1; dots = b.runsTotal === 0 && !b.wickets.length ? dots + 1 : 0; }
        freeHit = b.noBall;
        runs += b.runsTotal; wk += b.wickets.length;
      }
      if (k === 0) target = inn.total + 1;
    });
  }
}

console.log(`Editions ${ids.join(",")}; ${used.toLocaleString()} real legal balls through the ball model (${skipped} matches without two rated elevens).`);
console.log("Actual v expected: striker's runs a ball, dot % (no runs off the bat, not out), fours %, sixes %, striker out %.");
const f = (a: number, e: number, n: number, d = 1, s = 100) => `${((s * a) / n).toFixed(d)} v ${((s * e) / n).toFixed(d)}`;
for (const [split] of [["all"], ...SPLITS]) {
  console.log(`\n${split}`);
  for (const [k, c] of [...cells.entries()].filter(([k]) => k.startsWith(`${split}|`)).sort()) {
    if (c.n < 150) continue;
    console.log(`  ${k.slice(split.length + 1).padEnd(14)} n ${String(c.n).padStart(6)}  runs ${f(c.aRuns, c.eRuns, c.n, 3, 1)} (${(c.eRuns - c.aRuns >= 0 ? "+" : "")}${((c.eRuns - c.aRuns) / c.n).toFixed(3)})  dot ${f(c.a0, c.e0, c.n)}  4s ${f(c.a4, c.e4, c.n)}  6s ${f(c.a6, c.e6, c.n)}  out ${f(c.aW, c.eW, c.n)}`);
  }
}
