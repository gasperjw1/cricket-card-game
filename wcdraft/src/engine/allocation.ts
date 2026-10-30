/**
 * Bowling allocation policy (design spec §7.5): per over, choose among eligible bowlers by a
 * utility that the replay harness checks against the measured usage norms (six bowlers in 62%
 * of innings, death trust sticky, sixth bowler introduced in the middle overs).
 */

import { phaseOf } from "../cricsheet/match.js";
import type { Rng } from "./rng.js";
import { expectedRunsOf, outcomeDistribution, type BallContext, type SituationModel } from "./ball.js";
import { ENGINE } from "./model.js";
import type { EnginePlayer, MatchEnvironment } from "./types.js";

export interface BowlerState {
  player: EnginePlayer;
  overs: number[];
  runsByOver: number[];
}

export interface AllocationInput {
  /** Real over index, and its equivalent in a 20-over innings (the same unless rain reduced the match). */
  over: number;
  eqOver: number;
  oversInInnings: number;
  maxOvers: number;
  bowlers: BowlerState[];
  previousBowler: string | null;
  batters: [EnginePlayer, EnginePlayer];
  env: MatchEnvironment;
  situation: SituationModel;
  ctx: BallContext;
}

/** The bowler for this over. */
export function chooseBowler(input: AllocationInput, rng: Rng): BowlerState {
  const { over, eqOver, oversInInnings, maxOvers, bowlers, previousBowler } = input;
  const phase = phaseOf(eqOver);
  const deathStart = Math.max(0, oversInInnings - Math.ceil(oversInInnings / 4));
  let eligible = bowlers.filter((b) => b.overs.length < maxOvers && b.player.id !== previousBowler && b.player.canBowl);
  if (!eligible.length) eligible = bowlers.filter((b) => b.overs.length < maxOvers && b.player.id !== previousBowler);
  if (!eligible.length) eligible = bowlers.filter((b) => b.overs.length < maxOvers);
  if (!eligible.length) eligible = bowlers;

  // Death reservation: the two best death options (by expected runs at the death) keep enough
  // quota for the last overs.
  const deathOversLeft = Math.max(0, oversInInnings - Math.max(over, deathStart));
  const deathRank = [...bowlers]
    .filter((b) => b.player.canBowl)
    .map((b) => ({ id: b.player.id, cost: expectedRunsOf(b.player.bowlingRel.death) * (b.player.bowlingShares?.death ?? 0.2) }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 2)
    .map((x) => x.id);

  const A = ENGINE.allocation;
  const used = bowlers.filter((b) => b.overs.length > 0).length;
  const scores = eligible.map((b) => {
    const dist = (striker: EnginePlayer) => outcomeDistribution(striker, b.player, input.env, input.situation, input.ctx);
    const d0 = dist(input.batters[0]), d1 = dist(input.batters[1]);
    const expRuns = 3 * (expectedRunsOf(d0) + expectedRunsOf(d1));
    const expWickets = 3 * (d0.W + d1.W);
    let score = -expRuns + A.wicketValue * expWickets;
    const arch = b.player.archetype.bowling;
    if (phase === "pp" && arch === "new ball") score += A.specialistBonus;
    if (phase === "death" && arch === "death") score += A.specialistBonus;
    if (over < deathStart && deathRank.includes(b.player.id) && maxOvers - b.overs.length <= Math.min(2, deathOversLeft)) score -= A.reservationPenalty;
    const last = b.overs[b.overs.length - 1];
    if (last !== undefined && last === over - 2) score += A.spellBonus;
    const lastCost = b.runsByOver[b.runsByOver.length - 1];
    if (lastCost !== undefined && lastCost >= 18 && last === over - 2) score -= A.hitPenalty;
    // A bowler who has barely bowled in the window is a last resort.
    if (b.player.bowlLowSample) score -= 2.5;
    score += A.continuityBonus * b.overs.length;
    if (b.overs.length === 0 && used >= 5) score -= A.extraBowlerPenalty;
    return score + A.noise * rng.gumbel();
  });
  let best = 0;
  for (let i = 1; i < scores.length; i += 1) if (scores[i]! > scores[best]!) best = i;
  return eligible[best]!;
}
