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
  /** The fielding coach's extra bowlers an innings against the era ("Six-bowler rotation" / "Frontline trust"). */
  rotation?: number;
}

/** Each phase's share of a 20-over innings: the neutral line for a bowler's own usage. */
const PHASE_SHARE = { pp: 6 / 20, mid: 9 / 20, death: 5 / 20 } as const;

/** The bowler for this over. */
export function chooseBowler(input: AllocationInput, rng: Rng): BowlerState {
  const { over, eqOver, oversInInnings, maxOvers, bowlers, previousBowler } = input;
  const phase = phaseOf(eqOver);
  const deathStart = Math.max(0, oversInInnings - Math.ceil(oversInInnings / 4));
  // The keeper has the gloves on, so even a side out of bowlers finds overs elsewhere.
  const available = bowlers.filter((b) => !b.player.keeper);
  let eligible = available.filter((b) => b.overs.length < maxOvers && b.player.id !== previousBowler && b.player.canBowl);
  if (!eligible.length) eligible = available.filter((b) => b.overs.length < maxOvers && b.player.id !== previousBowler);
  if (!eligible.length) eligible = available.filter((b) => b.overs.length < maxOvers);
  if (!eligible.length) eligible = available;

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
  // A rotating coach charges less for a sixth bowler and for one below the fifth best; a coach who
  // trusts his frontline charges more.
  const rotate = Math.exp(-ENGINE.coachPlay.rotationScale * (input.rotation ?? 0));
  const used = bowlers.filter((b) => b.overs.length > 0).length;
  const worth = (b: BowlerState) => {
    const dist = (striker: EnginePlayer) => outcomeDistribution(striker, b.player, input.env, input.situation, input.ctx);
    const d0 = dist(input.batters[0]), d1 = dist(input.batters[1]);
    return -3 * (expectedRunsOf(d0) + expectedRunsOf(d1)) + 3 * A.wicketValue * (d0.W + d1.W);
  };
  // A side with spare bowling keeps it spare: the fifth-best option right now, quota or not, is the
  // line, and anyone below it pays for the gap again, so a weak sixth or seventh comes on when he is
  // needed and not by chance. With five bowlers or fewer nobody is below it.
  const worths = new Map(bowlers.filter((b) => b.player.canBowl || eligible.includes(b)).map((b) => [b, worth(b)]));
  const frontline = worths.size > 5 ? [...worths.values()].sort((x, y) => y - x)[4]! : -Infinity;
  const scores = eligible.map((b) => {
    const base = worths.get(b)!;
    let score = base - A.depthPenalty * rotate * Math.max(0, frontline - base);
    const arch = b.player.archetype.bowling;
    // Usage: his share of overs in this phase against the phase's share of an innings, as a charge
    // only: it keeps a man out of a phase his captains rarely bowl him in, and never pulls one in
    // (the shares say when a man bowls, not how much, so a boost sent part-timers on for every
    // middle over: 6.5 bowlers an innings against 6.2 real).
    const shares = b.player.bowlingShares;
    if (shares && (A.usageWeight || A.usageBoost)) {
      // `usageTags` (experiment): the usage snapped to what a card tag would say, three levels
      // (rare / usual / regular) or yes/no (a New ball or Death tag; the middle overs untagged).
      const use = shares[phase] / PHASE_SHARE[phase];
      const snapped = A.usageTags === 3 ? (use < 0.5 ? 0.3 : use < 1.25 ? 0.9 : 1.6)
        : A.usageTags === 2 && phase !== "mid" ? (use >= 1.25 ? 1.6 : 0.6)
        : use;
      const lean = Math.log((snapped * PHASE_SHARE[phase] + 0.05) / (PHASE_SHARE[phase] + 0.05));
      score += A.usageWeight * Math.min(0, lean) + (phase === "mid" ? 0 : A.usageBoost * Math.max(0, lean));
    }
    if (phase === "pp" && arch === "new ball") score += A.specialistBonus;
    if (phase === "death" && arch === "death") score += A.specialistBonus;
    // Death trust: whoever opened the bowling is trusted at the death and held back for it.
    const opened = b.overs.includes(0) || b.overs.includes(1);
    if (opened && phase === "death") score += A.openerDeathBonus;
    // Powerplay spread: every further powerplay over from the same bowler costs a little more, so the
    // new ball is shared the way captains share it (a third is rare, a second is not automatic).
    if (phase === "pp") score -= A.powerplayHoldPenalty * b.overs.filter((o) => o < 6).length;
    if (opened && phase === "mid" && maxOvers - b.overs.length <= 2 && deathOversLeft >= 2) score -= A.openerHoldPenalty;
    if (over < deathStart && deathRank.includes(b.player.id) && maxOvers - b.overs.length <= Math.min(2, deathOversLeft)) score -= A.reservationPenalty;
    const last = b.overs[b.overs.length - 1];
    if (last !== undefined && last === over - 2) score += A.spellBonus;
    const lastCost = b.runsByOver[b.runsByOver.length - 1];
    if (lastCost !== undefined && lastCost >= 18 && last === over - 2) score -= A.hitPenalty;
    // A bowler who has barely bowled in the window is a last resort.
    if (b.player.bowlLowSample) score -= 2.5;
    score += A.continuityBonus * b.overs.length;
    if (b.overs.length === 0 && used >= 5) score -= A.extraBowlerPenalty * rotate;
    // The captaincy rating once scaled this noise; it was removed on 2026-11-05 (it doesn't repeat in
    // real data and moved nothing in the sim; docs/wc-draft-captains-2026-11-04.md).
    return score + A.noise * rng.gumbel();
  });
  let best = 0;
  for (let i = 1; i < scores.length; i += 1) if (scores[i]! > scores[best]!) best = i;
  return eligible[best]!;
}
