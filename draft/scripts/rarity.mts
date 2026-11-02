/**
 * Rarity on the real draft (2026-11-02): how often a run finishes unbeaten or as champion, by how
 * the eleven was drafted and by its card rating. Follows the game's own rules, identity spin
 * uniform over the universe, eleven squad spins from any edition, one pick a spin into a slot he
 * fits, the keeper and five-bowler guard, no rerolls, with three bots:
 *   random  — a random eligible player into a random slot he fits
 *   greedy  — the best card on the spin (by tier score) into his best slot
 *   smart   — greedy, but holding spins for bowlers and a keeper when the side needs them
 * Design target (spec §8): under 3% of all runs unbeaten, under 15% of top-decile squads.
 *
 *   node --import tsx draft/scripts/rarity.mts [runs=300] [bots=random,greedy,smart]
 */

import { readFileSync } from "node:fs";
import { Rng } from "../../wcdraft/src/engine/rng.ts";
import { engineReady, loadEdition } from "../../wcdraft/src/engine/load.ts";
import { simulateTournament } from "../../wcdraft/src/engine/tournament.ts";
import type { EngineTeam } from "../../wcdraft/src/engine/types.ts";
import type { SquadOut } from "../../wcdraft/src/engine/data.ts";
import { designatedKeeper, drawSquad, eligible, slotsFor, spinPlayers, squadRating, squadUniverse } from "../src/game/rules.ts";
import { SLOTS, type PoolPlayer } from "../src/game/types.ts";

if (!engineReady()) { console.error("engine data not built"); process.exit(1); }
const root = new URL("../public/data/", import.meta.url);
const read = <T>(p: string) => JSON.parse(readFileSync(new URL(p, root), "utf8")) as T;
const index = read<{ editions: string[]; blankSquads: { editionId: string; team: string }[] }>("index.json");
const squads = new Map(index.editions.map((ed) => [ed, read<SquadOut[]>(`squads/${ed}.json`)]));
const pools = new Map(index.editions.map((ed) => [ed, read<PoolPlayer[]>(`pool/${ed}.json`)]));
const universe = squadUniverse(squads, index.blankSquads);
const captaincy = read<{ captains: { personId: string; matches: number; z: number }[] }>("captaincy.json").captains;
const editions = new Map<string, ReturnType<typeof loadEdition>>();
const edition = (id: string) => editions.get(id) ?? editions.set(id, loadEdition(id)).get(id)!;

type Bot = "random" | "greedy" | "smart";
const runs = Number(process.argv[2] ?? 300);
const bots = (process.argv[3] ?? "random,greedy,smart").split(",") as Bot[];

function draft(bot: Bot, rng: Rng): { identity: { team: string; editionId: string }; picks: PoolPlayer[] } {
  const identity = drawSquad(universe, rng);
  const picks: (PoolPlayer | null)[] = Array.from({ length: 11 }, () => null);
  const taken = new Set<string>();
  for (let spin = 0; spin < 11; spin += 1) {
    let chosen: PoolPlayer | null = null;
    for (let attempt = 0; attempt < 40 && !chosen; attempt += 1) {
      const squad = drawSquad(universe, rng);
      const players = spinPlayers(pools.get(squad.editionId)!, squad.team, taken).filter((p) => eligible(p, picks));
      if (!players.length) continue;
      if (bot === "random") chosen = players[Math.floor(rng.next() * players.length)]!;
      else if (bot === "greedy") chosen = players[0]!;
      else {
        // Smart: from the sixth pick on, prefer whoever covers a need the side still has.
        const bowlersSoFar = picks.filter((p) => p && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder")).length;
        const keeperSoFar = picks.some((p) => p?.keeper);
        const need = (p: PoolPlayer) => (bowlersSoFar < 5 && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder") ? 1 : 0) + (!keeperSoFar && p.keeper ? 1 : 0);
        chosen = spin >= 5 ? [...players].sort((a, b) => need(b) - need(a) || b.tierScore - a.tierScore)[0]! : players[0]!;
      }
    }
    if (!chosen) throw new Error("no eligible player in 40 spins");
    const open = slotsFor(chosen, picks).slots;
    const slot = bot === "random" ? open[Math.floor(rng.next() * open.length)]! : open[0]!;
    picks[slot.index] = chosen;
    taken.add(chosen.id);
  }
  return { identity, picks: picks as PoolPlayer[] };
}

function assemble(identity: { team: string }, picks: PoolPlayer[]): EngineTeam {
  const keeper = designatedKeeper(picks);
  const players = picks.map((p) => {
    const player = edition(p.editionId).players.get(`${p.team}|${p.id}`);
    if (!player) throw new Error(`no engine player for ${p.name}`);
    return p === keeper ? { ...player, canBowl: false, keeper: true } : { ...player, keeper: false };
  });
  const rated = picks.map((p) => ({ p, c: captaincy.filter((c) => c.personId === p.id).sort((a, b) => b.matches - a.matches)[0] })).filter((x) => x.c).sort((a, b) => b.c!.z - a.c!.z)[0];
  const captain = rated?.p ?? [...picks].sort((a, b) => Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl))[0]!;
  return { name: identity.team, players, battingOrder: players.map((p) => p.id), captainZ: rated?.c?.z, captainId: captain.id };
}

for (const bot of bots) {
  const rows: { rating: number; unbeaten: boolean; champion: boolean; won: number; played: number; exitFinalOrBetter: boolean }[] = [];
  for (let i = 0; i < runs; i += 1) {
    const rng = new Rng(`rarity-${bot}-${i}`);
    const { identity, picks } = draft(bot, rng);
    const data = edition(identity.editionId);
    const xi = assemble(identity, picks);
    const r = simulateTournament(data, data.progression, { seed: `rarity-${bot}-${i}`, identity: { team: identity.team, xi } });
    const id = r.identity!;
    rows.push({ rating: squadRating(picks) ?? 0, unbeaten: id.unbeaten && id.played > 0, champion: id.champion, won: id.won, played: id.played, exitFinalOrBetter: id.champion || id.exit === "Final" });
  }
  const pct = (f: (r: typeof rows[number]) => boolean, arr = rows) => (100 * arr.filter(f).length / Math.max(1, arr.length)).toFixed(1);
  const sorted = [...rows].sort((a, b) => b.rating - a.rating);
  const top = sorted.slice(0, Math.max(1, Math.floor(rows.length / 10)));
  const ratings = rows.map((r) => r.rating).sort((a, b) => a - b);
  const q = (p: number) => ratings[Math.floor(p * (ratings.length - 1))]!.toFixed(1);
  console.log(`${bot.padEnd(7)} ${runs} runs | rating p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)} | unbeaten ${pct((r) => r.unbeaten)}%  champion ${pct((r) => r.champion)}%  final+ ${pct((r) => r.exitFinalOrBetter)}%  win ${(100 * rows.reduce((a, r) => a + r.won, 0) / rows.reduce((a, r) => a + r.played, 0)).toFixed(1)}% | top decile (rating ≥ ${top[top.length - 1]!.rating.toFixed(1)}): unbeaten ${pct((r) => r.unbeaten, top)}%  champion ${pct((r) => r.champion, top)}%`);
}
