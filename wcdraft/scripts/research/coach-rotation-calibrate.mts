// Sizing the engine's response to a coach's rotation (2026-11-03). The coach index says his sides
// used `rotation` more bowlers an innings than the average coach's. Real World Cup fixtures with
// real elevens, both sides given an artificial rotation; bowlers used an innings in the sim at each
// `rotationScale`. The scale that moves the sim by about one bowler per unit of rotation, near
// the coaches' range (about −0.5 to +0.5), is the one the index means.
//   npx tsx scripts/research/coach-rotation-calibrate.mts [sims=4] [scales=0.5,1,2,3]
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { setEngineOverrides } from "../../src/engine/model.ts";

const sims = Number(process.argv[2] ?? 4);
const scales = (process.argv[3] ?? "0.5,1,2,3").split(",").map(Number);
const EDITIONS = ["2012", "2014", "2016", "2021", "2022", "2024"];

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

const datas = EDITIONS.map(loadEdition);
const bowlersUsed = (rotation: number) => {
  let innings = 0, used = 0;
  for (const data of datas) for (const g of realMatches(data)) {
    const a = teamFromMatch(data, g.a, g.match), b = teamFromMatch(data, g.b, g.other);
    if (a.players.length < 11 || b.players.length < 11) continue;
    const env = matchEnvironment(data, g.match.venueId || null, 20);
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch({ ...a, coachPlay: { bowlFirst: 0, rotation, lowerOrder: 0 } }, { ...b, coachPlay: { bowlFirst: 0, rotation, lowerOrder: 0 } }, env, data.situation, { seed: `rot-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b });
      for (const inn of r.innings) if (inn.legalBalls >= 114 && !r.rain) { innings += 1; used += inn.bowling.filter((w) => w.balls > 0).length; }
    }
  }
  return used / innings;
};
setEngineOverrides({ coachRotationScale: 1 });
const base = bowlersUsed(0);
console.log(`bowlers an innings with no rotation: ${base.toFixed(3)} (full innings only)`);
for (const s of scales) {
  setEngineOverrides({ coachRotationScale: s });
  const lo = bowlersUsed(-0.5), hi = bowlersUsed(0.5);
  console.log(`scale ${s}: rotation −0.5 → ${lo.toFixed(3)} (${(lo - base).toFixed(3)}), +0.5 → ${hi.toFixed(3)} (+${(hi - base).toFixed(3)}); bowlers per unit of rotation ${(hi - lo).toFixed(2)}`);
}
