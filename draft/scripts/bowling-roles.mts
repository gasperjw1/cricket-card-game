/**
 * Drafted elevens short of new-ball or death bowlers (2026-11-04, Yash: if a side has one new-ball
 * bowler or one death specialist, the captain has to arrange the rest of his best bowlers to fill
 * the overs). Greedy drafts as in `rarity.mts`, each played against real default elevens of its
 * edition; bowlers are counted as new-ball or death men by their usage of the phase (share of his
 * overs there ÷ the phase's share of an innings, 1.25 or more, as `rare-phase.mts` bands it). For
 * each count, who bowled the powerplay and the death and what those overs cost, against the real
 * elevens they played as the reference.
 *
 *   node --import tsx draft/scripts/bowling-roles.mts [drafts=300] [matches=4] [overridesJson]
 */

import { readFileSync } from "node:fs";
import { Rng } from "../../wcdraft/src/engine/rng.ts";
import { engineReady, loadEdition, matchEnvironment, teamFromDefault } from "../../wcdraft/src/engine/load.ts";
import { simulateMatch } from "../../wcdraft/src/engine/match.ts";
import { setEngineOverrides } from "../../wcdraft/src/engine/model.ts";
import type { EnginePlayer, EngineTeam } from "../../wcdraft/src/engine/types.ts";
import type { SquadOut } from "../../wcdraft/src/engine/data.ts";
import { designatedKeeper, drawSquad, eligible, slotsFor, spinPlayers, squadUniverse } from "../src/game/rules.ts";
import type { PoolPlayer } from "../src/game/types.ts";

if (!engineReady()) { console.error("engine data not built"); process.exit(1); }
const drafts = Number(process.argv[2] ?? 300);
const matches = Number(process.argv[3] ?? 4);
if (process.argv[4]) setEngineOverrides(JSON.parse(process.argv[4]));
const root = new URL("../public/data/", import.meta.url);
const read = <T>(p: string) => JSON.parse(readFileSync(new URL(p, root), "utf8")) as T;
const index = read<{ editions: string[]; blankSquads: { editionId: string; team: string }[] }>("index.json");
const squads = new Map(index.editions.map((ed) => [ed, read<SquadOut[]>(`squads/${ed}.json`)]));
const pools = new Map(index.editions.map((ed) => [ed, read<PoolPlayer[]>(`pool/${ed}.json`)]));
const universe = squadUniverse(squads, index.blankSquads);
const editions = new Map<string, ReturnType<typeof loadEdition>>();
const edition = (id: string) => editions.get(id) ?? editions.set(id, loadEdition(id)).get(id)!;

function greedyDraft(rng: Rng) {
  const identity = drawSquad(universe, rng);
  const picks: (PoolPlayer | null)[] = Array.from({ length: 11 }, () => null);
  const taken = new Set<string>();
  for (let spin = 0; spin < 11; spin += 1) {
    let chosen: PoolPlayer | null = null;
    for (let attempt = 0; attempt < 40 && !chosen; attempt += 1) {
      const squad = drawSquad(universe, rng);
      const players = spinPlayers(pools.get(squad.editionId)!, squad.team, taken).filter((p) => eligible(p, picks));
      if (players.length) chosen = players[0]!;
    }
    if (!chosen) throw new Error("no eligible player in 40 spins");
    picks[slotsFor(chosen, picks).slots[0]!.index] = chosen;
    taken.add(chosen.id);
  }
  return { identity, picks: picks as PoolPlayer[] };
}

function assemble(name: string, picks: PoolPlayer[]): EngineTeam {
  const keeper = designatedKeeper(picks);
  const players = picks.map((p) => {
    const player = edition(p.editionId).players.get(`${p.team}|${p.id}`)!;
    return p === keeper ? { ...player, canBowl: false, keeper: true } : { ...player, keeper: false };
  });
  return { name, players, battingOrder: players.map((p) => p.id), captainId: players[0]!.id };
}

const SHARE = { pp: 6 / 20, mid: 9 / 20, death: 5 / 20 } as const;
const isMan = (p: EnginePlayer, phase: "pp" | "death") => p.canBowl && !p.keeper && !!p.bowlingShares && p.bowlingShares[phase] / SHARE[phase] >= 1.25;
const isSpin = (p: EnginePlayer) => !!p.bowlClass && !p.bowlClass.startsWith("pace");

type Tally = { innings: number; ppBalls: number; ppByMen: number; ppBySpinOther: number; ppRuns: number; deathBalls: number; deathByMen: number; deathRuns: number; bowlers: number; won: number; played: number };
const tally = (): Tally => ({ innings: 0, ppBalls: 0, ppByMen: 0, ppBySpinOther: 0, ppRuns: 0, deathBalls: 0, deathByMen: 0, deathRuns: 0, bowlers: 0, won: 0, played: 0 });
const byPp = new Map<string, Tally>(), byDeath = new Map<string, Tally>();
const real = tally();
const bandOf = (n: number) => (n >= 3 ? "3+" : String(n));

for (let i = 0; i < drafts; i += 1) {
  const rng = new Rng(`roles-${i}`);
  const { identity, picks } = greedyDraft(rng);
  const data = edition(identity.editionId);
  const xi = assemble(identity.team, picks);
  const ppMen = xi.players.filter((p) => isMan(p, "pp")).length, deathMen = xi.players.filter((p) => isMan(p, "death")).length;
  const opponents = [...data.squads.values()].filter((s) => !s.standIn && s.team !== identity.team && s.defaultXI.length === 11).map((s) => s.team);
  for (let m = 0; m < matches; m += 1) {
    const opp = teamFromDefault(data, opponents[Math.floor(rng.next() * opponents.length)]!);
    if (opp.players.length < 11) continue;
    const r = simulateMatch(xi, opp, matchEnvironment(data, null, 20), data.situation, { seed: `roles-${i}-${m}`, keepBallLog: true, rainProbability: 0 });
    for (const inn of [1, 2] as const) {
      const bowlingSide = r.innings[inn - 1]!.team === xi.name ? opp : xi;
      const tabs = bowlingSide === xi ? [byPp.get(bandOf(ppMen)) ?? byPp.set(bandOf(ppMen), tally()).get(bandOf(ppMen))!, byDeath.get(bandOf(deathMen)) ?? byDeath.set(bandOf(deathMen), tally()).get(bandOf(deathMen))!] : [real];
      const who = new Map(bowlingSide.players.map((p) => [p.id, p]));
      const used = new Set<string>();
      let pp = 0, ppMenBalls = 0, ppSpin = 0, ppRuns = 0, de = 0, deMen = 0, deRuns = 0;
      for (const b of r.balls) {
        if (b.innings !== inn) continue;
        const p = who.get(b.bowler)!;
        used.add(b.bowler);
        const runs = b.runsBatter + b.extras;
        if (b.over < 6) { ppRuns += runs; if (b.legal) { pp += 1; if (isMan(p, "pp")) ppMenBalls += 1; else if (isSpin(p)) ppSpin += 1; } }
        if (b.over >= 15) { deRuns += runs; if (b.legal) { de += 1; if (isMan(p, "death")) deMen += 1; } }
      }
      for (const t of tabs) { t.innings += 1; t.ppBalls += pp; t.ppByMen += ppMenBalls; t.ppBySpinOther += ppSpin; t.ppRuns += ppRuns; t.deathBalls += de; t.deathByMen += deMen; t.deathRuns += deRuns; t.bowlers += used.size; }
    }
    const won = r.winner === xi.name ? 1 : 0;
    for (const t of [byPp.get(bandOf(ppMen))!, byDeath.get(bandOf(deathMen))!]) { t.won += won; t.played += 1; }
  }
}

const pct = (a: number, n: number) => ((100 * a) / Math.max(1, n)).toFixed(1);
const rpo = (runs: number, balls: number) => ((6 * runs) / Math.max(1, balls)).toFixed(2);
console.log(`${drafts} greedy drafts × ${matches} matches against real default elevens${process.argv[4] ? `, overrides ${process.argv[4]}` : ""}`);
console.log(`Real elevens bowling: pp by new-ball men ${pct(real.ppByMen, real.ppBalls)}%, by other spinners ${pct(real.ppBySpinOther, real.ppBalls)}%, pp ${rpo(real.ppRuns, real.ppBalls)} an over; death by death men ${pct(real.deathByMen, real.deathBalls)}%, death ${rpo(real.deathRuns, real.deathBalls)} an over; bowlers ${(real.bowlers / real.innings).toFixed(2)}`);
console.log("\nDrafted eleven by its new-ball men:");
for (const [k, t] of [...byPp.entries()].sort()) console.log(`  ${k} new-ball men  innings ${String(t.innings).padStart(4)}  pp by them ${pct(t.ppByMen, t.ppBalls).padStart(5)}%  by other spinners ${pct(t.ppBySpinOther, t.ppBalls).padStart(5)}%  pp ${rpo(t.ppRuns, t.ppBalls)} an over  bowlers ${(t.bowlers / t.innings).toFixed(2)}  won ${pct(t.won, t.played)}%`);
console.log("\nDrafted eleven by its death men:");
for (const [k, t] of [...byDeath.entries()].sort()) console.log(`  ${k} death men     innings ${String(t.innings).padStart(4)}  death by them ${pct(t.deathByMen, t.deathBalls).padStart(5)}%  death ${rpo(t.deathRuns, t.deathBalls)} an over  bowlers ${(t.bowlers / t.innings).toFixed(2)}  won ${pct(t.won, t.played)}%`);
