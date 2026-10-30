/**
 * Engine constants (design spec §7.1). Every number here is either taken from the research
 * report, measured from the archive (`data/out/situation.json`), or set by the replay harness
 * (`npm run engine:replay`, `npm run engine:calibrate`), and says which.
 */

export const ENGINE = {
  /**
   * How the batter's and bowler's relative vectors combine with the base distribution:
   *   p ∝ base × batRel^batExponent × bowlRel^bowlExponent × τ[over][wickets] × …
   * The two relative vectors each already measure the player against average opponents, so
   * multiplying both in full double counts the quality gap; the exponents were set by the replay
   * sweep (0.5–1.0 moved run-rate bias between +1.5% and +3.4%; 0.7 kept the first-innings spread
   * closest to real).
   */
  batExponent: 0.7 as number,
  bowlExponent: 0.7 as number,
  /** Shrinkage (balls) of a situation cell toward its conditioning base. */
  situationPrior: 400 as number,
  /**
   * Exponent on the required-rate multiplier. The second-innings τ table already carries typical
   * chase states, so the sweep found 0 best calibrated (chase-win bias +1.9 points, Brier 0.200)
   * and 0.5 worst (+4.6, 0.211); 0.15 keeps a steep chase visibly different from an easy one.
   */
  chaseExponent: 0.15 as number,
  /**
   * State terms measured 2026-10-30 over 3,242 men's T20Is since 2016 (`analysis/situation.ts`):
   *   streak     — runs off the previous six balls; the real multiplier divided by the shuffled-innings
   *                null leaves ×1.07 scoring / ×1.10 boundaries after 13+ and ×0.96 / ×0.93 after 0–3
   *   setness    — striker's balls faced: ×0.74 scoring and ×0.88 hazard on balls 0–2, rising to
   *                ×1.16 and ×1.06 past 24 (replaces the Test-cricket eye-in hazard curve, which
   *                runs the wrong way for T20: hazard rises with intent as the batter gets set)
   *   ballInOver — ±2–3% by position; ball 1 hazard ×0.93, balls 3–4 ×1.04
   *   chaseDots  — consecutive dots in a chase: three or more cut scoring ×0.88 and raise hazard ×1.04
   * Exponents are 1 (as measured); 0 switches a term off.
   */
  streakExponent: 1 as number,
  setnessExponent: 1 as number,
  ballInOverExponent: 1 as number,
  chaseDotsExponent: 1 as number,
  /**
   * Matchups (Phase 2b, `analysis/matchups.ts`): batting hand × bowler class, measured as observed ÷
   * expected beyond both players' own averages. Left-handers score ×0.93 against off-spin and
   * ×1.07 against left-arm orthodox; right-handers lose boundaries to leg-spin (×0.91) and left-arm
   * spin (×0.90); pace shows no handedness effect. Phase cells shrink toward the pooled cell with
   * `matchupPrior` balls. The allocation policy inherits the term through the ball model, which is
   * the spec's λ_match.
   */
  matchupExponent: 1 as number,
  matchupPrior: 2000 as number,
  /**
   * Coach intent (Phase 2b, `analysis/coaches.ts`): one SD of coach-tenure intent moves the
   * boundary cells by `boundaryPerSd` and the dismissal cell by `hazardPerSd`. Size: the coach-level
   * SD of era-relative powerplay run rate is 7.3% (`coaches.json` → indexSd) and boundaries carry
   * about 60% of runs, so z = +1 lifts boundary cells ×1.12. Risk cost: neither the team-month data
   * (confounded by team quality: better sides score more and lose fewer) nor the chase table
   * (confounded by pressure and opposition: hazard ×1.46 for ×1.05 boundaries) gives a clean
   * chosen-intent frontier; the setness curve does, since the same batter accelerates by choice as
   * he gets set (balls 25+: runs ×1.16, hazard ×1.06, i.e. ≈0.35 hazard per unit of scoring), which
   * puts one SD of intent at ≈ +2.6% hazard.
   */
  intent: { boundaryPerSd: 0.15 as number, hazardPerSd: 0.03 as number, clip: 1.5 },
  /** Captaincy: allocation noise × (1 − captainNoiseSlope × z), clipped to [0.4, 1.6] (z from `captaincy.json`). */
  captainNoiseSlope: 0.3 as number,
  /**
   * Dispersion. The variance decomposition in `situation.json` gives per-innings scoring effects of
   * SD 0.21 (bowler) and 0.19 (batter) against each player's career mean, which also absorb
   * opponent, venue and era for that player; the engine already conditions on those, so the day
   * effects used are smaller and the global match and innings effects shrink to make room. Set by
   * the dispersion sweep against the editions' first-innings standard deviations.
   */
  bowlerDaySd: 0.1 as number,
  batterDaySd: 0.08 as number,
  matchEffectSd: 0.05 as number,
  inningsEffectSd: 0.03 as number,
  /** Share of the venue's scoring factor applied (1 = full). */
  venueExponent: 1 as number,
  /**
   * Rain (Phase 2b). An affected match is a no-result, a reduction before the start to the same
   * overs per side (drawn from the archive's distribution of reduced first innings), or a chase cut
   * short between `chaseCut` fractions of its balls and decided on the data-derived resource table
   * (`situation.json` → resources: mean first-innings runs still to come by balls left × wickets
   * down, as a share of a full innings — the same construction as DLS Standard Edition, fitted to
   * T20I data rather than the proprietary professional edition). A chase needs at least `minOvers`
   * overs for a result. The share of affected matches that are no-results comes from the edition.
   */
  rain: { minOvers: 5, chaseCut: [0.35, 0.9] as [number, number], chaseCutShare: 0.4, venuePriorMatches: 10 },
  /**
   * Global calibration on the scoring cells and the dismissal cell, fitted by the replay sweep so
   * that real elevens reproduce their editions' run rate and balls per wicket on average. The
   * state terms are conditional means measured on real state frequencies; a dynamic simulation
   * regenerates those frequencies with feedback (a hot streak breeds hot streaks, fewer wickets mean
   * longer set periods), which lifts the mean by a few per cent. These two numbers absorb that.
   */
  scoringCalibration: 0.94 as number,
  hazardCalibration: 1.04 as number,
  /**
   * Death-overs scoring calibration. Once opening bowlers are trusted at the death (as captains
   * really do), the engine's death overs came out 8–10% cheaper than every edition's, because its
   * best bowlers bowl them while the situation table was measured over the archive's average death
   * bowler. Real batters attack those bowlers anyway; this restores the measured phase shape.
   */
  deathCalibration: 1.15 as number,
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
    /**
     * Death trust is sticky (measured: a new-ball bowler bowls at the death in 62–68% of innings and
     * 43% of overs 19–20 go to an opening bowler): opening bowlers get this bonus at the death and
     * are held back in the middle overs once their quota is down to two.
     */
    openerDeathBonus: 2.0,
    openerHoldPenalty: 2.0,
  },
};

export type EngineOverrides = Partial<Record<"batExponent" | "bowlExponent" | "chaseExponent" | "streakExponent" | "setnessExponent" | "ballInOverExponent" | "chaseDotsExponent" | "matchupExponent" | "bowlerDaySd" | "batterDaySd" | "matchEffectSd" | "inningsEffectSd" | "venueExponent" | "scoringCalibration" | "hazardCalibration" | "deathCalibration", number>>;

/** Calibration hook: override numeric constants for a sweep (`npm run engine:calibrate`). */
export function setEngineOverrides(overrides: EngineOverrides): void {
  Object.assign(ENGINE, overrides);
}
