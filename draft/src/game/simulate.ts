/**
 * Turns a finished draft into an engine team and runs the identity edition's tournament. Players
 * drafted from other editions carry their own edition's relative vectors (era-free by
 * construction), so a 2010 Vettori bowls in 2024 exactly as his 2010 edge says he would.
 */

import type { EngineTeam } from "../../../wcdraft/src/engine/types.ts";
import { simulateTournament, type TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import { loadEditionData, loadShared } from "../lib/data.ts";
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
  const players = input.picks.map((p) => {
    const player = data.get(p.editionId)?.players.get(`${p.team}|${p.id}`);
    if (!player) throw new Error(`no engine player for ${p.name} (${p.team} ${p.editionId})`);
    return player;
  });
  const captain = input.captainId ? shared.captains.filter((c) => c.personId === input.captainId).sort((a, b) => b.matches - a.matches)[0] : undefined;
  return { name: input.identity.team, players, battingOrder: players.map((p) => p.id), intent: input.coach?.intent, captainZ: captain?.z };
}

export async function runTournament(input: SimulateInput): Promise<TournamentResult> {
  const [data, xi] = await Promise.all([loadEditionData(input.identity.editionId), assembleTeam(input)]);
  return simulateTournament(data, data.progression, { seed: input.seed, identity: { team: input.identity.team, xi }, keepIdentityDetails: true, keepScorecards: true });
}
