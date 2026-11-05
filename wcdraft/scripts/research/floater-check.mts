/**
 * The engine's floater against the real rates (2026-11-05, `ENGINE.floater`). Real World Cup fixtures
 * 2012–24: one side bats its eleven in its usual order (by median position) with the floater on or
 * off, the other its real order that day. Reports, for the floater side, the share of entries at
 * Nos. 3–8 out of the base order by phase, the share of those where the man sent out-hits the man due
 * at the death, places jumped, and the side's win share and runs an innings with the floater off
 * and on (common seeds).
 *
 * Real targets (`floater-rates.mts`, World Cups): 8% powerplay, 12% middle, 17% death; the man sent
 * out-hits the man due 38/45/51% (random 31/33/34%); 1.5–2 places.
 *
 *   node --import tsx scripts/research/floater-check.mts [sims=4] [hitter=pp,mid,death]
 */

import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { expectedRunsOf } from "../../src/engine/ball.ts";
import { phaseOf } from "../../src/cricsheet/match.ts";
import { ENGINE, setEngineOverrides } from "../../src/engine/model.ts";

const sims = Number(process.argv[2] ?? 4);
// A trial hitter chance per phase, for sizing it.
if (process.argv[3]) { const [pp, mid, death] = process.argv[3].split(",").map(Number); ENGINE.floater.hitter = { pp: pp!, mid: mid!, death: death! }; }
const EDITIONS = ["2012", "2014", "2016", "2021", "2022", "2024"];

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

const datas = EDITIONS.map(loadEdition);
type Arm = { won: number; played: number; runs: number; inns: number; entries: Record<string, number>; ahead: Record<string, number>; hitter: Record<string, number>; jump: number; collapse: number; held: number };
const run = (scale: number, captainHold = 0): Arm => {
  setEngineOverrides({ floaterScale: scale });
  const arm: Arm = { won: 0, played: 0, runs: 0, inns: 0, entries: { pp: 0, mid: 0, death: 0 }, ahead: { pp: 0, mid: 0, death: 0 }, hitter: { pp: 0, mid: 0, death: 0 }, jump: 0, collapse: 0, held: 0 };
  for (const data of datas) for (const g of realMatches(data)) {
    const real = teamFromMatch(data, g.a, g.match), b = teamFromMatch(data, g.b, g.other);
    if (real.players.length < 11 || b.players.length < 11) continue;
    // The usual order: by median position, the base the floater works around.
    const base = [...real.players].sort((x, y) => (x.positionMedian ?? 11) - (y.positionMedian ?? 11)).map((p) => p.id);
    const a = { ...real, battingOrder: base, floater: true, captainHold };
    const byId = new Map(real.players.map((p) => [p.id, p]));
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(a, b, env, data.situation, { seed: `float-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b });
      if (r.rain) continue;
      arm.played += 1; if (r.winner === g.a) arm.won += 1;
      const inn = r.innings.find((x) => x.team === g.a);
      if (!inn) continue;
      arm.runs += inn.runs; arm.inns += 1;
      // Entries at Nos. 3–8: the man in against the earliest of the base order still waiting.
      const order = [...inn.batting].sort((x, y) => x.position - y.position);
      order.forEach((line, i) => {
        if (i < 2 || i > 7) return;
        const fall = inn.fallOfWickets[i - 2];
        if (!fall) return;
        const ph = phaseOf(fall.over);
        const waiting = base.filter((id) => !order.slice(0, i).some((l) => l.id === id));
        if (waiting.length < 2) return;
        // After a collapse: is a finisher passed over (a man from below him in the order going in)?
        const down = i - 2 + 1, ov = fall.over;
        if ((down >= 3 && ov <= 5) || (down >= 4 && ov <= 7) || (down >= 5 && ov <= 9)) {
          arm.collapse += 1;
          const at = base.indexOf(line.id);
          if (waiting.some((id) => id !== line.id && base.indexOf(id) < at && byId.get(id)!.archetype.batting === "finisher")) arm.held += 1;
        }
        arm.entries[ph]! += 1;
        if (line.id === waiting[0]) return;
        arm.ahead[ph]! += 1;
        arm.jump += waiting.indexOf(line.id);
        const hit = (id: string) => expectedRunsOf(byId.get(id)!.batting.death);
        if (hit(line.id) > hit(waiting[0]!)) arm.hitter[ph]! += 1;
      });
    }
  }
  return arm;
};

const off = run(0), on = run(1);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const aheads = Object.values(on.ahead).reduce((a, b) => a + b, 0);
for (const ph of ["pp", "mid", "death"]) console.log(`${ph.padEnd(5)} ${on.entries[ph]} entries: ahead ${pct(on.ahead[ph]!, on.entries[ph]!)} (off ${pct(off.ahead[ph]!, off.entries[ph]!)}), man sent out-hits the man due ${pct(on.hitter[ph]!, on.ahead[ph]!)}`);
console.log(`jump ${(on.jump / aheads).toFixed(2)} places`);
console.log(`floater side: won ${pct(off.won, off.played)} off, ${pct(on.won, on.played)} on; runs an innings ${(off.runs / off.inns).toFixed(1)} off, ${(on.runs / on.inns).toFixed(1)} on (${on.played} matches)`);
// The captain's habit: the held share after a collapse at an average captain and at one a true
// spread either side (real: about 5%, ±4.5 points).
const hi = run(1, 0.045), lo = run(1, -0.045);
console.log(`after a collapse (${on.collapse} entries): finisher held ${pct(on.held, on.collapse)} average captain, ${pct(hi.held, hi.collapse)} at +4.5 points, ${pct(lo.held, lo.collapse)} at −4.5; won ${pct(lo.won, lo.played)} / ${pct(on.won, on.played)} / ${pct(hi.won, hi.played)}`);
