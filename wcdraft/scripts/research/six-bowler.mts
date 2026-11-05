/**
 * Should a six-bowler coach make the draft require six bowlers? (2026-11-05, Yash: the coach asks
 * for six bowlers, mandatory once he is spun; the captain uses them.)
 *
 * A. Real World Cup elevens, 2012–24: how many players who bowl each had, by the draft's rule
 *    (`bowls()` in draft/src/game/rules.ts: role bowler or all-rounder, or a bowling number shown;
 *    the designated keeper not counting) and by the engine's `canBowl`; how many bowled; and the
 *    same for sides under a "Six-bowler rotation" coach, a "Frontline trust" coach and the rest.
 * B. The sim: real fixtures, the side's coach rotation set to the six-bowler coaches' mean against
 *    none, split by how many the eleven has who can bowl. Bowlers used a full innings, runs
 *    conceded an over, and win share.
 *
 *   node --import tsx scripts/research/six-bowler.mts [sims=4]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const sims = Number(process.argv[2] ?? 4);
const EDITIONS = ["2012", "2014", "2016", "2021", "2022", "2024"];

interface Card { id: string; team: string; role: string; bowlShown: boolean; keeper: boolean; bowl: number }
interface Coach { team: string; coachName: string; worldCups: string[]; tags: string[]; play?: { rotation: number } }
const coaches = (JSON.parse(readFileSync(resolve(ROOT, "../draft/public/data/coaches.json"), "utf8")) as { coaches: Coach[] }).coaches;
const coachTag = (team: string, ed: string) => {
  const c = coaches.find((x) => x.team === team && x.worldCups.includes(ed));
  return !c ? "unknown" : c.tags.includes("Six-bowler rotation") ? "six-bowler" : c.tags.includes("Frontline trust") ? "frontline" : "neither";
};
const sixRotation = (() => { const xs = coaches.filter((c) => c.tags.includes("Six-bowler rotation") && c.play).map((c) => c.play!.rotation); return xs.reduce((a, b) => a + b, 0) / xs.length; })();

/** The draft's rule: bowls, and the keeper (one who does not bowl when there is a choice) does not count. */
const draftBowlers = (cards: Card[]) => {
  const bowls = (c: Card) => c.role === "bowler" || c.role === "all-rounder" || c.bowlShown;
  const keepers = cards.filter((c) => c.keeper);
  const keeper = keepers.find((c) => !bowls(c)) ?? keepers[0] ?? null;
  return cards.filter((c) => bowls(c) && c !== keeper).length;
};

function realMatches(data: EditionData) {
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const out: { a: string; b: string; match: SquadMatchOut; other: SquadMatchOut }[] = [];
  for (const [, sides] of seen) { if (sides.length !== 2) continue; const [x, y] = sides as [typeof sides[0], typeof sides[0]]; if (x.match.xi.length !== 11 || y.match.xi.length !== 11) continue; out.push({ a: x.team, b: y.team, match: x.match, other: y.match }); }
  return out;
}

// A. Real elevens.
type Tally = { n: number; byCount: Map<number, { n: number; used: number; sixPlus: number }> };
const tallies = new Map<string, Tally>();
const add = (group: string, count: number, used: number) => {
  const t = tallies.get(group) ?? tallies.set(group, { n: 0, byCount: new Map() }).get(group)!;
  t.n += 1;
  const c = t.byCount.get(count) ?? t.byCount.set(count, { n: 0, used: 0, sixPlus: 0 }).get(count)!;
  c.n += 1; c.used += used; if (used >= 6) c.sixPlus += 1;
};
const engineCounts: number[] = [], draftCounts: number[] = [];
const datas = EDITIONS.map((ed) => ({ ed, data: loadEdition(ed) }));
for (const { ed, data } of datas) {
  const pool = new Map((JSON.parse(readFileSync(resolve(ROOT, `../draft/public/data/pool/${ed}.json`), "utf8")) as Card[]).map((c) => [`${c.team}|${c.id}`, c]));
  for (const squad of data.squads.values()) {
    if (squad.standIn) continue;
    for (const m of squad.matches) {
      if (m.xi.length !== 11 || m.bowlerByOver.filter(Boolean).length < 19) continue;
      const cards = m.xi.map((id) => pool.get(`${squad.team}|${id}`)).filter((c): c is Card => !!c);
      if (cards.length !== 11) continue;
      const n = draftBowlers(cards);
      const used = new Set(m.bowlerByOver.filter(Boolean)).size;
      add("all", n, used);
      add(coachTag(squad.team, ed), n, used);
      draftCounts.push(n);
      const t = teamFromMatch(data, squad.team, m);
      engineCounts.push(t.players.filter((p) => p.canBowl && !p.keeper).length);
    }
  }
}
console.log("A. Real World Cup elevens, full bowling innings: players who bowl by the draft's rule, and bowlers used");
for (const [group, t] of [...tallies].sort((a, b) => b[1].n - a[1].n)) {
  const counts = [...t.byCount].sort((a, b) => a[0] - b[0]);
  const six = counts.filter(([k]) => k >= 6).reduce((s, [, c]) => s + c.n, 0);
  console.log(`  ${group.padEnd(11)} ${String(t.n).padStart(4)} elevens, ${((100 * six) / t.n).toFixed(0)}% with six or more who bowl`);
  for (const [k, c] of counts) console.log(`      ${k} who bowl: ${String(c.n).padStart(4)} elevens, ${(c.used / c.n).toFixed(2)} bowlers used, six or more used ${((100 * c.sixPlus) / c.n).toFixed(0)}%`);
}
const agree = draftCounts.filter((d, i) => (d >= 6) === (engineCounts[i]! >= 6)).length;
console.log(`  the draft's rule and the engine's canBowl agree on six-or-more for ${((100 * agree) / draftCounts.length).toFixed(0)}% of elevens`);

// B. The sim, the tag against none, by how many can bowl.
console.log(`\nB. The sim: rotation ${sixRotation.toFixed(2)} (the six-bowler coaches' mean) against 0, ${sims} sims a fixture`);
const arms = new Map<string, { inn: number; used: number; conceded: number; balls: number; won: number; played: number }>();
const arm = (k: string) => arms.get(k) ?? arms.set(k, { inn: 0, used: 0, conceded: 0, balls: 0, won: 0, played: 0 }).get(k)!;
for (const { data } of datas) for (const g of realMatches(data)) {
  const a = teamFromMatch(data, g.a, g.match), b = teamFromMatch(data, g.b, g.other);
  if (a.players.length < 11 || b.players.length < 11) continue;
  const can = a.players.filter((p) => p.canBowl && !p.keeper).length;
  const band = can <= 5 ? "5 or fewer" : can === 6 ? "6" : "7 or more";
  const env = matchEnvironment(data, g.match.venueId || null, 20);
  for (const rotation of [0, sixRotation]) {
    const x = arm(`${band}|${rotation === 0 ? "none" : "tag"}`);
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch({ ...a, coachPlay: { bowlFirst: 0, rotation, lowerOrder: 0 } }, { ...b, coachPlay: { bowlFirst: 0, rotation: 0, lowerOrder: 0 } }, env, data.situation, { seed: `six-${g.match.id}-${s}`, battingFirst: g.match.battedFirst ? g.a : g.b });
      x.played += 1; if (r.winner === g.a) x.won += 1;
      for (const inn of r.innings) if (inn.team === g.b && inn.legalBalls >= 114 && !r.rain) { x.inn += 1; x.used += inn.bowling.filter((w) => w.balls > 0).length; x.conceded += inn.runs; x.balls += inn.legalBalls; }
    }
  }
}
for (const band of ["5 or fewer", "6", "7 or more"]) {
  const n = arms.get(`${band}|none`), t = arms.get(`${band}|tag`);
  if (!n || !t || !n.inn) continue;
  console.log(`  ${band.padEnd(10)} who can bowl (${n.played / sims} fixtures): bowlers used ${(n.used / n.inn).toFixed(2)} → ${(t.used / t.inn).toFixed(2)}, conceded an over ${((6 * n.conceded) / n.balls).toFixed(3)} → ${((6 * t.conceded) / t.balls).toFixed(3)}, won ${((100 * n.won) / n.played).toFixed(1)}% → ${((100 * t.won) / t.played).toFixed(1)}%`);
}
