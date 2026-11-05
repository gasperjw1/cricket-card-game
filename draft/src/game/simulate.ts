/**
 * Turns a finished draft into an engine team and runs the identity edition's tournament. Players
 * drafted from other editions carry their own edition's relative vectors (era-free by
 * construction), so a 2010 Vettori bowls in 2024 exactly as his 2010 edge says he would.
 */

import type { EngineTeam } from "../../../wcdraft/src/engine/types.ts";
import { simulateTournament, type TournamentResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { CoachOut, EditionOut } from "../../../wcdraft/src/engine/data.ts";
import { loadEditionData, loadRatings, loadShared } from "../lib/data.ts";
import { captaincyOf, playingCaptain, type Captaincy } from "./captain.ts";
import { computeFinal, editionEnv, type EditionEnv, type PlayerFinal } from "./final-ratings.ts";
import { planAt } from "./plan.ts";
import { bowls, designatedKeeper } from "./rules.ts";
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
  // must not call on him. Everyone else bowls exactly when the overs meter counted him, which is
  // when his card shows a bowling number (2026-11-03: the engine's own record-based eligibility let
  // men whose card said "he will not be given overs" bowl, ahead of drafted frontline bowlers).
  const keeper = designatedKeeper(input.picks);
  const players = input.picks.map((p) => {
    const player = data.get(p.editionId)?.players.get(`${p.team}|${p.id}`);
    if (!player) throw new Error(`no engine player for ${p.name} (${p.team} ${p.editionId})`);
    return p === keeper ? { ...player, canBowl: false, keeper: true } : { ...player, canBowl: bowls(p), keeper: false };
  });
  // The captain as the pages name him (`playingCaptain`), and his collapse habit.
  const captaincy = captaincyOf(shared.captains, shared.leaders);
  const leader = playingCaptain(input.picks, input.captainId, captaincy);
  // The drafted coach's habits beyond tempo (toss, bowling rotation, lower-order scoring) go with him (2026-11-03).
  // The drafted order is the base; on a wicket a man may go in out of it at the real rates, and after
  // a collapse the captain's own habit decides how often a finisher is held back (2026-11-05).
  return { name: input.identity.team, players, battingOrder: players.map((p) => p.id), intent: input.coach?.intent, coachPlay: input.coach?.play, captainId: leader ?? undefined, captainHold: (leader && captaincy.hold.get(leader)) || 0, floater: true };
}

/** What the user may change before one of the side's matches (the between-match lever, 2026-11-02). */
export interface MatchPlan {
  captainId?: string | null;
  /** A tempo in place of the coach's own: the same intent in every phase. */
  intent?: "coach" | "attack" | "balanced" | "hold";
  /** The batting order, player ids No. 1 to 11, after a line-up move before this match (2026-11-03). */
  order?: string[];
}

const TEMPO: Record<Exclude<MatchPlan["intent"], undefined | "coach">, number> = { attack: 1, balanced: 0, hold: -1 };

/** The eleven for one match under a plan: same players, the captain and tempo the plan asks for. */
function planned(base: EngineTeam, input: SimulateInput, plan: MatchPlan | undefined, captaincy: Captaincy): EngineTeam {
  if (!plan) return base;
  const captainId = playingCaptain(input.picks, plan.captainId === undefined ? input.captainId : plan.captainId, captaincy);
  const intent = plan.intent && plan.intent !== "coach" ? { pp: TEMPO[plan.intent], mid: TEMPO[plan.intent], death: TEMPO[plan.intent] } : input.coach?.intent;
  // A moved order bats in that order; it must hold the same eleven, or the drafted order stands.
  const order = plan.order && plan.order.length === base.battingOrder.length && plan.order.every((id) => base.battingOrder.includes(id)) ? plan.order : base.battingOrder;
  return { ...base, intent, captainId: captainId ?? base.captainId, captainHold: (captainId && captaincy.hold.get(captainId)) || 0, battingOrder: order };
}

/**
 * The whole tournament; `plans[n]` changes the side's eleven for its nth match onward. Each
 * fixture is seeded on its own, so a plan for match n reproduces every earlier match exactly.
 */
export async function runTournament(input: SimulateInput, plans: (MatchPlan | undefined)[] = []): Promise<TournamentResult> {
  const [data, xi, shared] = await Promise.all([loadEditionData(input.identity.editionId), assembleTeam(input), loadShared()]);
  // A plan holds from its match onward, and a later one changes only what it sets (2026-11-03: the
  // latest plan replaced the earlier ones whole, so a captain named before match 1 was dropped once
  // a tempo was set before match 3, while the paper showed both).
  const captaincy = captaincyOf(shared.captains, shared.leaders);
  const xiFor = (n: number) => planned(xi, input, plans.slice(0, n + 1).some(Boolean) ? planAt(plans, n) : undefined, captaincy);
  // Every fixture keeps its scorecard and ball log (2026-11-01): the gazette's facts, records and
  // late news read CPU matches the same way as yours.
  return simulateTournament(data, data.progression, { seed: input.seed, identity: { team: input.identity.team, xi, xiFor }, keepIdentityDetails: true, keepScorecards: true, keepBallLogs: true });
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
