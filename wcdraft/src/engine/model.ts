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
  /** Innings × phase (`SituationModel.inningsPhase`); 0 switches it off. */
  /**
   * 0 since 2026-11-01: switched off it improved nine-edition Brier by 0.008 and put the chase
   * win share on real (+0.4 against −1.6 with it on); its ×1.035 chase hazard in the powerplay
   * and middle was most of the chase-wicket excess. The second-innings level is `chaseUplift`
   * and the required-rate `pressure` table.
   */
  inningsPhaseExponent: 0 as number,
  /**
   * Required-rate pressure (`analysis/pressure.ts`), 2026-11-01. Measured after both players and
   * against second innings at the same over and wickets, so τ is not counted twice: the old chase
   * term was not, so it had to run at exponent 0.15, which left sixes falling as the rate climbed
   * when real ones rise 6.6 to 9.1 per 100, and chases dying too early. `gearExponent` scales how each
   * batting style answers it. Both apply up to 7 down; gears only at a required 11–18.
   */
  pressureExponent: 1 as number,
  /** 0 since 2026-11-01: gears rest on styles built from careers that include later balls, and the A/B showed no gain. */
  gearExponent: 0 as number,
  /**
   * Whether the striker has found a boundary, on top of balls faced; each band still averages 1.
   * Real chases, batter's own phase level removed, gap between found and not: about 0.50 runs an
   * over at 3–24 balls. The sim's day factors already make 0.40 with this term off, so only 0.4 of
   * the measured table is left to add (1 gave 0.80).
   */
  /** 0 since 2026-11-01: Brier 0.003 better with it off at 60 sims, which is noise, so the simpler model wins. */
  foundExponent: 0 as number,
  /** The striker's own start: his `StartShape` for his first `startBalls` balls, then the rest. */
  /** 0 since 2026-11-01: shapes use the career including later balls, and switching them off improved Brier by 0.006. */
  shapeExponent: 0 as number,
  startBalls: 10,
  /**
   * Death-bowling Squeezers in pressure chases. Pacers split in thirds on death dot % in one half
   * of matches gained, in the other half (about 12,700 pressure balls a third), +2.11 wickets per
   * 100 under pressure against +1.33 and +1.19, so one group, not a slope. That 0.85 gap is 9% of
   * the wicket rate; it was one of 20 comparisons, so it's cut to 6%, split to leave the mean alone.
   * Death dot rate is what's stable about a bowler: individuals' own pressure records are noise.
   */
  /** Neutral (1 / 1) since 2026-11-01: the 1.04 / 0.98 were set by hand from one split-half read, not measured in play. The marking stays for the card tag. */
  squeezer: { top: 1 as number, rest: 1 as number, share: 1 / 3, minDeathShare: 0.15 },
  /**
   * State terms measured 2026-10-30 over the whole men's T20I archive, no date filter (about
   * 760,000 balls; the 3,242 matches since 2016 are most of it) (`analysis/situation.ts`):
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
  /**
   * 1 = the player-adjusted setness table (`states.setness`), 0 = the raw one. 0 for now: over nine
   * editions at 60 sims × 2 seeds the adjusted table left the powerplay 0.20 an over low against
   * 0.13 raw and Brier 0.2026 against 0.2008; it narrowed the first-innings spread (+1.3 v +1.6).
   * Re-test once the powerplay bowler share is right.
   */
  adjustedSetness: 0 as number,
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
   * boundary cells by `boundaryPerSd` and the dismissal cell by `hazardPerSd`. A tenure's intent is
   * how fast his sides scored against their era, and most of that is the batters, who already
   * carry it in their ratings, so only what's left over belongs here. Measured 2026-10-31 over 129
   * tenures and 5,338 T20Is: one SD of intent is worth +1.8 ± 2.0 win points above Elo expectation.
   * The first sizing (0.15 / 0.03, read off the run-rate spread and the setness curve) made it +3.6
   * to +8 points, so the most aggressive coach was always the pick. 0.06 / 0.05 gives about +0.7
   * points an SD, inside the measured range. Replays can't separate the sizes much: over ten
   * editions at 200 sims a match, two seeds, Brier is 0.1957 at the old size, 0.1947 with no intent
   * and 0.1939 here, and seeds alone differ by 0.003. Fewer sims than that are pure noise here.
   */
  intent: { boundaryPerSd: 0.06 as number, hazardPerSd: 0.05 as number, clip: 1.5 },
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
   * Refit 2026-11-01 once wides counted in the phase figures, extras followed the phase and the
   * innings × phase term was in. 0.89 / 1.14 left run rate, each phase and balls per wicket within
   * 0.1 of real over ten editions at 60 sims; 0.90 / 1.13 and 0.88 / 1.15 sat either side.
   */
  /**
   * 1.0 since 2026-11-01. The 0.89 was covering for three structural errors, not feedback: player
   * vectors centred by matches instead of balls (the batters who face the balls sat 7–11% above
   * neutral), a streak null shuffled across the whole innings (+4–6% on every powerplay band), and
   * no non-striker run outs (the 1.04 hazard). With those fixed, every phase lands within 0.11 RPO
   * of real at 1 / 1 / 1 over nine editions (60 sims): RPO +0.01, PP −0.11, middle +0.09, death
   * +0.05, balls per wicket −0.01. Any future refit should start from 1 and explain what it covers.
   */
  scoringCalibration: 1.0 as number,
  hazardCalibration: 1.0 as number,
  /**
   * Non-striker run outs (2026-11-01, men's T20Is since 2016, 3,242 matches, 1,460 of 40,290
   * wickets). Per legal ball by innings and phase; drawn on balls the striker scored 0, 1 or 2 on
   * (96% of the real ones), so the per-ball rate is divided by that share of balls (`onOutcomes`).
   * The striker's W cell never carried these, which is why the 1.04 hazard calibration existed.
   */
  nonStrikerRunOut: { "1|pp": 0.00110, "1|mid": 0.00163, "1|death": 0.00577, "2|pp": 0.00128, "2|mid": 0.00146, "2|death": 0.00397, onOutcomes: 0.85 } as Record<string, number>,
  /** Share of all run outs that dismiss the striker (4.35% of striker dismissals against 7.79% of all wickets): scales the fingerprint's run-out cell for the striker's W. */
  strikerRunOutShare: 0.56,
  /**
   * Death-overs scoring calibration, 1.0 since 2026-11-01. The 1.14 was not restoring death
   * scoring: without any calibration death was already within 0.05 RPO of real, and 0.89 × 1.14
   * merely cancelled the scoring calibration there. Kept as a knob for the sweep.
   */
  deathCalibration: 1.0 as number,
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
     * Extra weight on the gap (runs an over) between a bowler and the side's fifth-best option. Real
     * elevens rarely have spare bowling, so the replays barely notice it; a drafted eleven with seven
     * or eight options would otherwise spread overs to its weakest by Gumbel noise alone. At 2 the
     * sub-60 bowlers' overs in such sides fall by 40% and real elevens' usage by rank stays within
     * 0.3 of an over of what real captains did.
     */
    depthPenalty: 2,
    /**
     * Death trust is sticky (measured: a new-ball bowler bowls at the death in 62–68% of innings and
     * 43% of overs 19–20 go to an opening bowler): opening bowlers get this bonus at the death and
     * are held back in the middle overs once their quota is down to two.
     */
    openerDeathBonus: 2.0,
    openerHoldPenalty: 2.0,
    /**
     * Powerplay spread (2026-11-01): real captains give their two best bowlers 30–35% of powerplay
     * balls (2024 30%, 2012 34%, 2016 35%) and keep the rest for later; the utility pick alone gave
     * them 40–45%, which made the sim's powerplay bowler 2.5–3.4% harder to hit than the real one
     * and the powerplay 0.15 runs an over low. Each powerplay over a bowler has already bowled
     * costs him this much more for the next one. Sized on the share: a flat charge on the third
     * over alone left it at 38%, 1.2 an over 38%, 3.0 an over 34.7%, 4.5 an over 32.7% (2024) and
     * 35.4% (2016, real 35.2%), with the powerplay bowler's boundary ratio back on 1.00.
     */
    powerplayHoldPenalty: 4.5,
  },
};

export type EngineOverrides = Partial<Record<"batExponent" | "bowlExponent" | "inningsPhaseExponent" | "pressureExponent" | "gearExponent" | "foundExponent" | "shapeExponent" | "streakExponent" | "setnessExponent" | "adjustedSetness" | "ballInOverExponent" | "chaseDotsExponent" | "matchupExponent" | "bowlerDaySd" | "batterDaySd" | "matchEffectSd" | "inningsEffectSd" | "venueExponent" | "scoringCalibration" | "hazardCalibration" | "deathCalibration", number>>;

/** Calibration hook: override numeric constants for a sweep (`npm run engine:calibrate`). */
export function setEngineOverrides(overrides: EngineOverrides): void {
  Object.assign(ENGINE, overrides);
}
