/**
 * Turns a finished draft into an engine team and runs the identity edition's tournament. Players
 * drafted from other editions carry their own edition's relative vectors (era-free by
 * construction), so a 2010 Vettori bowls in 2024 exactly as his 2010 edge says he would.
 */

import type { EngineTeam } from "../../../wcdraft/src/engine/types.ts";
import { simulateTournament, type TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { CoachOut, EditionOut } from "../../../wcdraft/src/engine/data.ts";
import { loadEditionData, loadRatings, loadShared } from "../lib/data.ts";
import { computeFinal, editionEnv, type EditionEnv, type PlayerFinal } from "./final-ratings.ts";
import { designatedKeeper } from "./rules.ts";
import { slotWeights } from "./slots.ts";
import type { Identity, PoolPlayer } from "./types.ts";

export interface SimulateInput {
  seed: string;
  identity: Identity;
  picks: PoolPlayer[];
  coach: CoachOut | null;
  captainId: string | null;
}

export async function assembleTeam(input: SimulateInput): Promise<EngineTeam> {
  const shared = await loadShared();
  const editions = [...new Set(input.picks.map((p) => p.editionId))];
  const data = new Map(await Promise.all(editions.map(async (ed) => [ed, await loadEditionData(ed)] as const)));
  // The designated keeper keeps and does not bowl (decided 2026-10-30), so the engine's allocation
  // must not call on him; everyone else keeps his own bowling eligibility.
  const keeper = designatedKeeper(input.picks);
  const players = input.picks.map((p) => {
    const player = data.get(p.editionId)?.players.get(`${p.team}|${p.id}`);
    if (!player) throw new Error(`no engine player for ${p.name} (${p.team} ${p.editionId})`);
    return p === keeper ? { ...player, canBowl: false, keeper: true } : { ...player, keeper: false };
  });
  const captain = input.captainId ? shared.captains.filter((c) => c.personId === input.captainId).sort((a, b) => b.matches - a.matches)[0] : undefined;
  // Nobody rated in the eleven still leaves somebody tossing the coin: the side's best player.
  const leader = input.captainId ?? [...input.picks].sort((a, b) => Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl))[0]?.id;
  return { name: input.identity.team, players, battingOrder: players.map((p) => p.id), intent: input.coach?.intent, captainZ: captain?.z, captainId: leader };
}

export async function runTournament(input: SimulateInput): Promise<TournamentResult> {
  const [data, xi] = await Promise.all([loadEditionData(input.identity.editionId), assembleTeam(input)]);
  return simulateTournament(data, data.progression, { seed: input.seed, identity: { team: input.identity.team, xi }, keepIdentityDetails: true, keepScorecards: true });
}

/** Every drafted player's final rating in the identity edition; picks are in batting order. */
export async function finalRatings(input: SimulateInput, editions: EditionOut[]): Promise<PlayerFinal[]> {
  const here = input.identity.editionId;
  const ids = [...new Set([here, ...input.picks.map((p) => p.editionId)])];
  const loaded = new Map(await Promise.all(ids.map(async (id) => {
    const [data, ratings] = await Promise.all([loadEditionData(id), loadRatings(id)]);
    return [id, { data, ratings, env: editionEnv(data, ratings) as EditionEnv }] as const;
  })));
  const hereEnv = loaded.get(here)!.env;
  const paceSpin = editions.find((e) => e.id === here)?.environment.paceSpin;
  const spin = paceSpin ? paceSpin.spin.sharePct / Math.max(1, paceSpin.spin.sharePct + paceSpin.pace.sharePct) : 0.35;
  const keeper = designatedKeeper(input.picks);
  return input.picks.map((player, i) => {
    const home = loaded.get(player.editionId)!;
    const engine = home.data.players.get(`${player.team}|${player.id}`);
    const rating = home.ratings.find((r) => r.team === player.team && r.personId === player.id);
    if (!engine || !rating) throw new Error(`no rating for ${player.name} (${player.team} ${player.editionId})`);
    return computeFinal({
      player, rating, engine, home: home.env, here: hereEnv, position: i + 1,
      slot: slotWeights(editions, here, i + 1),
      classMix: { pace: 1 - spin, spin },
      intent: input.coach?.intent, coachName: input.coach?.coachName, keeps: player === keeper,
    });
  });
}
