/**
 * Engine constants (design spec §7.1). Every number here is either taken from the research
 * report or set by the replay harness (`npm run engine:replay`), and says which.
 */

export const ENGINE = {
  /**
   * How the batter's and bowler's relative vectors combine with the base distribution:
   *   p ∝ base × batRel^batExponent × bowlRel^bowlExponent × τ[over][wickets] × chase
   * The two relative vectors each already measure the player against average opponents, so
   * multiplying both in full double counts the quality gap; the exponents are set by the replay
   * harness so that real elevens reproduce their editions' run rates and wicket rates.
   */
  batExponent: 0.7 as number,
  bowlExponent: 0.7 as number,
  /** Shrinkage (balls) of a situation cell toward its innings-and-phase distribution. */
  situationPrior: 400 as number,
  /** Exponent on the chase-pressure multiplier (the τ table for second innings already carries typical chase states). */
  chaseExponent: 0.5 as number,
  /**
   * Eye-in (Stevenson–Brewer form): a new batter's dismissal hazard is multiplied by
   * 1 + eyeInHazard × exp(−ballsFaced / eyeInLength). Literature: batters start at 25–50% of set
   * ability with L ≈ 2–6 runs; expressed here in balls.
   */
  eyeInHazard: 0.8 as number,
  eyeInLength: 8 as number,
  /** Population mean balls faced per innings, used to centre the eye-in multiplier at 1. */
  eyeInMeanBalls: 16 as number,
  /** Log-normal scoring factors for the pitch/day (shared by both innings) and for each innings (Mishra 2026 under-dispersion warning). */
  matchEffectSd: 0.07 as number,
  inningsEffectSd: 0.04 as number,
  /** Share of the venue's scoring factor applied (1 = full). */
  venueExponent: 1 as number,
  /** Runs a wicket is worth to the bowling side when choosing a bowler (design spec §5, wicket cost). */
  allocation: {
    wicketValue: 2.6,
    /** Gumbel noise scale on the per-over bowler choice, in runs; the captain rating will scale it later. */
    noise: 1.0,
    /** Bonus (runs) for a new-ball specialist in the powerplay and a death specialist at the death. */
    specialistBonus: 1.5,
    /** Penalty (runs) for using a reserved death bowler in the middle overs when his quota is needed later. */
    reservationPenalty: 2.0,
    /** Bonus (runs) for continuing a spell (bowled two overs ago). */
    spellBonus: 0.4,
    /** Penalty after an over costing 18+ (captains pull a hit bowler about half the time). */
    hitPenalty: 1.2,
    /** Bonus (runs) per over already bowled: captains complete frontline quotas rather than spreading overs. */
    continuityBonus: 0.3,
    /** Penalty (runs) for a bowler who has not bowled yet once five bowlers have been used (the sixth option costs a decision). */
    extraBowlerPenalty: 0.8,
  },
};

/** Calibration hook: override numeric constants for a sweep (`npm run engine:calibrate`). */
export function setEngineOverrides(overrides: Partial<Record<"batExponent" | "bowlExponent" | "chaseExponent" | "eyeInHazard" | "matchEffectSd" | "inningsEffectSd" | "venueExponent", number>>): void {
  Object.assign(ENGINE, overrides);
}
