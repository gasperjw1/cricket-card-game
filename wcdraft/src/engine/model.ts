/**
 * Engine constants (design spec §7.1). Every number here is either taken from the research
 * report, measured from the archive (`data/out/situation.json`), or set by the replay harness
 * (`npm run engine:replay`, `npm run engine:calibrate`), and says which.
 */

/**
 * Which engine played a run. Shared links carry it (2026-11-05 review: links are replayed, not
 * stored, so an engine change silently replays an old link differently). Bump it with any change
 * that alters how a seeded run plays. 1 is the floater with the captain's habit by No. 6–7.
 */
export const ENGINE_VERSION = 1;

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
  /**
   * The bowler's wicket cell on its own exponent (2026-11-02). At 0.7 for every cell the best
   * bowlers' economy matched reality but their wicket-taking was compressed: card 85+ bowlers took
   * a wicket every 19.2 balls in the sim against 17.3 real, with three-fors 10% against 14%, while
   * the weakest bowlers were slightly too penetrative. See the player-level distribution test.
   */
  bowlHazardExponent: 0.7 as number,
  /**
   * Pace against spin on the ground and on the day (2026-11-02, from the conditions research:
   * ground spin-minus-pace true SD 0.16 runs an over, pitch of the day 0.42 on top of the ground).
   * `groundPriorBalls` shrinks a ground's measured lean toward the edition's; `daySdFraction` is
   * the per-match draw as a fraction of scoring off each class, half each way (0.42 runs an over
   * split between the two classes at about 7.5 an over). `pitchExponent` 0 switches both off.
   */
  pitch: { groundPriorBalls: 2000, daySdFraction: 0.028, clip: 0.12 },
  pitchExponent: 1 as number,
  /** Shrinkage (balls) of a situation cell toward its conditioning base. */
  situationPrior: 400 as number,
  /** Innings × phase (`SituationModel.inningsPhase`); 0 switches it off. */
  /**
   * 0 since 2026-11-01: switched off it improved nine-edition Brier by 0.008 and put the chase
   * win share on real (+0.4 against −1.6 with it on); its ×1.035 chase hazard in the powerplay
   * and middle was most of the chase-wicket excess. The second-innings level is `chaseUplift`
   * and the required-rate `pressure` table.
   * 1 again since 2026-11-04 (the dots research), on runs and dots only (`inningsPhaseHazard` 0):
   * with the pooled phase base both innings scored alike, so chase death overs had 3.0 points too
   * few dots and first-innings middle overs too many (its death cell is ×1.06 dots, ×0.91 sixes in
   * the chase). Real chase death dots are now within 0.7 points; the wicket cell stays off.
   */
  inningsPhaseExponent: 1 as number,
  /** Whether the innings × phase term moves the wicket cell too (1) or only the runs and dots (0); `inningsPhaseDeathOnly` 1 applies it at the death alone. */
  inningsPhaseHazard: 0 as number,
  inningsPhaseDeathOnly: 0 as number,
  /**
   * The innings × phase term's weight at the death, on top of `inningsPhaseExponent` (2026-11-04,
   * the death-overs bias, `scripts/research/ball-check.mts`). At the death the term is the
   * archive's whole raw innings gap (×1.076 first innings against second, each innings' level
   * taken out; real World Cups ×1.076 too). But the ball model already makes ×1.051 of that gap
   * itself, from the real batters and bowlers, wickets down and balls faced, so at full weight
   * most of it is counted twice. Real World Cup balls through the ball model, at full weight:
   * first-innings death +0.067 runs a ball, chase death −0.001 (off: +0.030 and +0.063); the gap
   * wants a weight of about 0.34. The replays, on matched full-length fixtures: +0.036 and −0.034
   * at 1, +0.022 and −0.007 at 0.6, +0.016 and +0.003 at 0.4 (innings gap 0.125 against 0.112
   * ±0.038 real). 0.4 since 2026-11-04. Brier 0.1865 (0.1871 at 1, 0.1860 at 0.6, all within
   * seed noise), chase wins +0.2 points (−1.3). Setness, streak and ball-in-over were each
   * switched off in the check and moved nothing.
   */
  inningsPhaseDeathExponent: 0.4 as number,
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
   * 1 = the player-adjusted setness table (`states.setness`), 0 = the raw one. First tried
   * 2026-11-01 and left off (powerplay 0.20 an over low). On since 2026-11-02 together with
   * `adjustedStates`, once the powerplay bowler share was right; see there.
   */
  adjustedSetness: 1 as number,
  /**
   * 1 = the player-adjusted streak, ball-in-over and chase-dot tables (`states`, 2026-11-02:
   * batter, bowler and setness removed; streak and chase dots against a null shuffled within
   * phase, striker, bowler, setness band and odd/even total, dismissals fixed), 0 = the raw ones.
   * The raw tables counted the players twice: a good batter's run of balls read as momentum and a
   * weak one's dots as pressure, on top of the players' own vectors and day effects, so the sim
   * clustered dots more than real (a dot after a dot 9.4 points likelier than after a scoring
   * ball, real 7.4). The null was checked on the sim with these terms off, where it must read 1
   * (`scripts/research/sequence-null-check.mts`); a looser one read 0.8–0.9 on wickets after dots.
   * Measured that way, a hot or cold run and a run of dots move the next ball 3% or less, for every
   * batting style and bowler type alike (`scripts/research/dot-response.mts`). Nine editions, 40
   * sims × 4 seeds:
   *   raw tables          Brier 0.1876, spread +2.9, PP / mid / death −0.03 / +0.07 / 0.00, bpw +0.02, lift 9.4
   *   adjusted states     Brier 0.1876, spread +3.2, −0.01 / +0.06 / 0.00, bpw +0.17, lift 8.3
   *   states + setness    Brier 0.1866, spread +2.6, −0.08 / +0.03 / −0.02, bpw +0.15, lift 7.4 (kept)
   */
  adjustedStates: 1 as number,
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
   * Associate bowling step per ball (2026-11-02, ratings `MODEL.bowlTierStep`). An associate
   * bowler's card carries the step to the edition's average opposition. On each ball the engine
   * tops that up to the measured step for this striker's side (his Elo against the batting the
   * bowler usually faced), allowing for the card's share already arriving through the bowler's
   * vector at the bowl exponents. 0 switches the top-up off; the card's own step stays.
   */
  bowlTierExponent: 1 as number,
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
  /**
   * The coach's habits beyond tempo (2026-11-03, `analysis/coaches.ts` `CoachPlay`), each a switch
   * (0 = off) on a measured size. `toss` scales his shift in the share of toss wins he fields with.
   * `rotationScale` turns his extra bowlers an innings into the allocation's charges for a sixth
   * bowler and for one below the fifth best: both × exp(−rotationScale × rotation), sized so the
   * sim's bowlers an innings move by his measured amount. `depth` scales his lower-order scoring
   * effect on strikers from No. 6 down.
   * `rotationScale` 2.5 (`scripts/research/coach-rotation-calibrate.mts`, real World Cup elevens
   * 2012–24, base 6.20 bowlers a full innings): at 2 a rotation of −0.5 gave −0.42 bowlers, at 3
   * −0.62, so 2.5 matches the measured size downward. Upward the elevens run out of bowlers (+0.22
   * at 2, +0.27 at 3 for +0.5): a rotating coach can only spread overs among the bowlers he has.
   * Re-checked 2026-11-04 with the usage charge (base 6.19): 2.5 gives −0.64 for −0.5 and +0.39 for
   * +0.5, 1.03 bowlers per unit of rotation (2: 0.90, 3: 1.07), so it stays.
   * 3 since 2026-11-04 with the usage pull (item 19), which holds each man to his phases: 2.5 then
   * gave 0.88 bowlers per unit, 3 gives 0.99 (−0.72 for −0.5, +0.27 for +0.5).
   */
  coachPlay: { toss: 1 as number, rotationScale: 3 as number, depth: 1 as number },
  /**
   * The in-match floater (2026-11-05, `scripts/research/floater-rates.mts`, men's T20Is since 2010).
   * On a wicket that brings in Nos. 3–8 with two or more waiting, the side sends someone other than
   * the man due at `rate[phase][wickets down]`. That is the share of real entries out of the usual
   * order, all T20Is by phase and wickets, scaled per phase to the World Cup level (8% of powerplay
   * entries, 12% middle, 17% death). The man sent is one of the next `reach` in the order (real
   * jumps average 1.5–2 places). With chance `hitter[phase]` he is the best death hitter among them,
   * with `leftRight` the first of the other hand to the non-striker when the man due matches him,
   * otherwise one of them, the nearer more likely. In real entries sent ahead the man sent
   * out-hits the man due in 38% of powerplay entries (31% at random), 45% middle (33%) and 51% death
   * (34%), a lift of 7, 12 and 17 points. The hitter chances give the sim the same lift over its own
   * random pick (`floater-check.mts`: random 49/38/29%, always the hitter 68/58/48%). Left-right is
   * 26–27% against 21–22% before the death and nothing after. Spin matchups showed nothing.
   * After a collapse (3 down by over 6, 4 by 8, 5 by 10) real sides rarely send a hitter
   * (`collapse-response.mts`); what they do, about 60% of the time they move at all, is hold a
   * finisher back: a man who usually bats lower goes in ahead of one who usually bats 6–7. So in a
   * collapse with a finisher among the man due and the next `reach`, the first non-finisher below
   * him goes in at `collapseHold` of the rate plus the captain's own habit (`captainHold`, his shift
   * in that share, 4.5 points of true spread) times `holdScale`; the rest of the rate moves as
   * usual, near and at random. A finisher is whoever the side's order has at No. 6 or 7, as the
   * habit was measured. `holdScale` makes the captain's shift play one for one, so the share the
   * pickers show is the share the engine plays (`floater-check.mts`, 2026-11-05 review): at 1.7 a
   * captain at −4.5 / 0 / +4.5 / +15 points held 2.3 / 7.6 / 17.4 / 34.5%, about twice his shift;
   * at 0.85, 4.5 / 7.6 / 11.4 / 21.5% (0.93 for one), so 0.92. The average, 7.6%, is the World
   * Cup level (7.5%; 9.7% across all T20Is) and the pickers' base (`HOLD_BASE` in the draft).
   * Only for a side that sets `floater` (the drafted eleven): a real eleven bats in the order it
   * really used that day, which already holds its own moves. `scale` multiplies every rate (0 = off).
   * Rates are indexed by wickets down 1–5+ (the first two rows repeat at 1 and 2 down).
   */
  floater: {
    rate: {
      pp: [0.08, 0.08, 0.09, 0.09, 0.1],
      mid: [0.14, 0.13, 0.14, 0.13, 0.1],
      death: [0.36, 0.36, 0.28, 0.23, 0.13],
    } as Record<"pp" | "mid" | "death", number[]>,
    reach: 3,
    hitter: { pp: 0.37, mid: 0.6, death: 0.88 } as Record<"pp" | "mid" | "death", number>,
    leftRight: 0.06,
    collapseHold: 0.6,
    holdScale: 0.92 as number,
    scale: 1 as number,
  },
  /**
   * Captaincy rating: allocation noise × (1 − captainNoiseSlope × z), clipped to [0.4, 1.6]. Off
   * since 2026-11-05: the rating (wins above expectation) doesn't repeat from one half of a
   * captain's matches to the other, and −2 to +2 moved nothing in the sim
   * (docs/wc-draft-captains-2026-11-04.md). The captain's measured habit plays through the floater.
   */
  captainNoiseSlope: 0 as number,
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
  /**
   * Runs a bye or leg-bye ball brings, by phase (2026-11-03, `scripts/research/byes.mts`, men's
   * T20Is since 2014, 615,000 legal balls; World Cups alone agree): about 82% one, 8% two, 1% three,
   * 10% four, so 1.46 runs a ball in the powerplay, 1.39 in the middle, 1.31 at the death. The
   * edition profile gives bye runs per ball; the engine had used that as the chance of a one-run
   * bye ball, so it made a third too many bye balls and as many fewer dots (the whole of the
   * −0.6-point dot gap). Bye balls are now drawn at runs ÷ runs-per-ball, each with runs from this
   * table, so the edition's bye runs are unchanged. `byeEvents` 0 restores the old one-run byes.
   */
  byeEvents: 1 as number,
  /**
   * A bowler in a phase he rarely bowls (2026-11-04, `scripts/research/rare-phase.mts`, men's T20Is
   * since 2012): actual ÷ expected from his level in the other two phases, by pace or spin, phase
   * and usage (his share of overs in the phase ÷ the phase's share of an innings: rare under 0.5,
   * usual to 1.25, regular above). A rating shrinks a thin phase toward the bowler's pooled vector,
   * which is his level elsewhere, so these cells apply with the prior's weight in that phase,
   * 300 ÷ (300 + his balls in it). `phaseUsagePrior` 0 switches it off.
   * Off (2026-11-04): with the new allocation it put powerplay spin dots on real (+0.7 → +0.1) and
   * spin death runs nearer (1.452 → 1.406 a ball, real 1.375), but left spin death dots 1.9 short
   * and the nine-edition Brier at 0.1877 against 0.1862 without it. Kept for a ratings-side refit.
   */
  phaseUsagePrior: 0 as number,
  phaseUsageCells: {
    pace: {
      pp: { rare: { 0: 0.92, 1: 1.17, 2: 0.92, 3: 0.92, 4: 0.94, 6: 1.35, W: 0.89 }, usual: { 0: 0.96, 1: 1.07, 2: 0.99, 3: 0.99, 4: 0.96, 6: 1.18, W: 1.05 }, regular: { 0: 1.04, 1: 0.98, 2: 1.0, 3: 1.0, 4: 0.88, 6: 0.91, W: 1.02 } },
      mid: { rare: { 0: 0.99, 1: 0.97, 2: 0.99, 3: 0.99, 4: 1.22, 6: 0.96, W: 1.06 }, usual: { 0: 0.99, 1: 0.98, 2: 0.97, 3: 0.97, 4: 1.23, 6: 0.89, W: 0.97 }, regular: { 0: 0.97, 1: 1.0, 2: 1.1, 3: 1.1, 4: 1.13, 6: 0.82, W: 0.97 } },
      death: { rare: { 0: 1.06, 1: 0.99, 2: 0.91, 3: 0.91, 4: 0.93, 6: 1.03, W: 1.12 }, usual: { 0: 0.97, 1: 1.01, 2: 1.02, 3: 1.02, 4: 1.03, 6: 1.07, W: 0.96 }, regular: { 0: 0.98, 1: 1.0, 2: 1.04, 3: 1.04, 4: 1.02, 6: 1.03, W: 1.01 } },
    },
    spin: {
      pp: { rare: { 0: 0.96, 1: 0.98, 2: 0.93, 3: 0.93, 4: 1.19, 6: 1.48, W: 1.13 }, usual: { 0: 0.99, 1: 1.02, 2: 0.99, 3: 0.99, 4: 1.08, 6: 1.17, W: 1.04 }, regular: { 0: 1.04, 1: 0.97, 2: 1.0, 3: 1.0, 4: 1.04, 6: 1.0, W: 1.02 } },
      mid: { rare: { 0: 1.01, 1: 0.99, 2: 0.95, 3: 0.95, 4: 0.88, 6: 0.91, W: 0.94 }, usual: { 0: 1.01, 1: 0.99, 2: 0.95, 3: 0.95, 4: 0.88, 6: 0.91, W: 0.94 }, regular: { 0: 0.99, 1: 1.0, 2: 1.04, 3: 1.04, 4: 0.92, 6: 0.97, W: 1.01 } },
      death: { rare: { 0: 1.06, 1: 1.05, 2: 0.89, 3: 0.89, 4: 0.82, 6: 0.95, W: 0.94 }, usual: { 0: 1.09, 1: 1.04, 2: 0.88, 3: 0.88, 4: 0.82, 6: 0.94, W: 1.06 }, regular: { 0: 1.02, 1: 1.02, 2: 1.18, 3: 1.18, 4: 0.87, 6: 0.83, W: 1.11 } },
    },
  } as Record<"pace" | "spin", Record<"pp" | "mid" | "death", Record<"rare" | "usual" | "regular", Record<string, number>>>>,
  byeRuns: {
    pp: { 1: 0.808, 2: 0.056, 3: 0.007, 4: 0.128 },
    mid: { 1: 0.804, 2: 0.094, 3: 0.007, 4: 0.095 },
    death: { 1: 0.847, 2: 0.075, 3: 0.005, 4: 0.073 },
  } as Record<"pp" | "mid" | "death", Record<number, number>>,
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
    /**
     * Bonus (runs) for a new-ball specialist in the powerplay and a death specialist at the death.
     * 0 since 2026-11-04: `usageWeight` reads the same thing from the bowler's own overs.
     */
    specialistBonus: 0 as number,
    /** Penalty (runs) for using a reserved death bowler in the middle overs when his quota is needed later. */
    reservationPenalty: 2.0,
    /** Bonus (runs) for continuing a spell (bowled two overs ago). */
    spellBonus: 0.4,
    /** Penalty after an over costing 18+ (captains pull a hit bowler about half the time). */
    hitPenalty: 1.2,
    /** Bonus (runs) per over already bowled: captains complete frontline quotas rather than spreading overs. */
    continuityBonus: 0.3,
    /**
     * Penalty (runs) for a bowler who has not bowled yet once five bowlers have been used (the sixth
     * option costs a decision). 1.2 since 2026-11-04 (was 0.8), with the usage terms below and
     * `openerDeathBonus` 0.5: 6.20 bowlers a full innings (real 6.20).
     */
    extraBowlerPenalty: 1.2 as number,
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
     * are held back in the middle overs once their quota is down to two. The bonus is 0.5 since
     * 2026-11-04 (was 2.0): the usage terms already favour a man who bowls at the death, and 0.5
     * keeps 42.9% of overs 19–20 with an opening bowler (1.0 gives 44.0%, 2.0 45.9%).
     */
    openerDeathBonus: 0.5 as number,
    openerHoldPenalty: 2.0,
    /**
     * Powerplay spread (2026-11-01): real captains give their two best bowlers 30–35% of powerplay
     * balls (2024 30%, 2012 34%, 2016 35%) and keep the rest for later; the utility pick alone gave
     * them 40–45%, which made the sim's powerplay bowler 2.5–3.4% harder to hit than the real one
     * and the powerplay 0.15 runs an over low. Each powerplay over a bowler has already bowled
     * costs him this much more for the next one. Sized on the share: a flat charge on the third
     * over alone left it at 38%, 1.2 an over 38%, 3.0 an over 34.7%, 4.5 an over 32.7% (2024) and
     * 35.4% (2016, real 35.2%), with the powerplay bowler's boundary ratio back on 1.00.
     * 3 since 2026-11-04 (the bowling-roles research): with the usage terms the spread goes to
     * the side's other new-ball men instead of its spinners, and 4.5 pushed it past them (seamers
     * who usually open had 13% of all balls in the powerplay against 20.6% real). Lower than 3 and
     * openers spend their quota early: at 1.5, even with a 2-run opener death bonus, only 31% of
     * overs 19–20 went to an opener (real 43%).
     */
    powerplayHoldPenalty: 3 as number,
    /**
     * Where his captains really bowled him (2026-11-03, the dots research): weight on the log of the
     * bowler's own share of overs in this phase (`bowlingShares`, form window and tournament) against
     * the phase's share of an innings. Without it the pick was by expected runs alone, and a spinner
     * whose powerplay record is mostly his overall one looked as good with the new ball as a seamer.
     * A charge only (`allocation.ts`). Without it spinners bowled 13.3% of all balls in the
     * powerplay (real 6.8%) and 9.1% at the death (real 5.1%), and seamers 25.7% in the middle (real
     * 18.8%). At 2: 11.8%, 6.3% and 21.8%, nine-edition Brier 0.1860 (0.1875 without it), death
     * overs +0.02 an over against +0.08. At 4 powerplay spin is 10.2% but Brier 0.1885 and death
     * +0.07, so the last few points of powerplay spin stay open.
     * 3 since 2026-11-04 with `usageBoost` 4 and `powerplayHoldPenalty` 3 (the bowling-roles
     * research, `wc-draft-bowling-roles-2026-11-04.md`): every phase × pace/spin × usage cell of
     * who bowled what in the replays within 2.1 points of real (summed error 10.6 points across 18
     * cells, against 30.6 with the charge alone); real elevens give 67% of the powerplay to men who usually
     * open (real 65%) and 43% of the death to men who usually bowl it (real 42%). Brier 0.1871
     * (0.1860 with the charge alone, seed noise 0.003); death overs +0.10 an over (+0.02), open.
     */
    usageWeight: 3 as number,
    /**
     * Weight on the same log share above the phase's own, in the powerplay and at the death only: a
     * man his captains used with the new ball or at the death is pulled toward it. Not in the middle
     * overs, where it sent part-timers on for every over (6.5 bowlers an innings). 4 since 2026-11-04.
     */
    usageBoost: 4 as number,
    /**
     * Usage read as a card tag would say it, 3 levels (rare / usual / regular) or 2 (a New ball or
     * Death tag, yes or no), instead of the share itself; 0 = the share. Tested 2026-11-04 and kept at
     * 0: summed error on who bowled what 17.1 points with 3 levels and 21.5 with yes/no, against 10.6
     * with the share; yes/no lumps an occasional new-ball man with one who never takes it.
     */
    usageTags: 0 as number,
  },
};

/**
 * The share of toss wins a side fields after, with its coach's habit. The habit is measured as a
 * difference in that share against the era, when about 52.6% fielded (team-style months), so it is
 * carried over as a change in log-odds: a +21-point habit then takes a World Cup where 84% fielded
 * to 94%, not past 100% (2026-11-03: the coach panel printed 105%).
 */
export const ERA_FIELD_SHARE = 0.526;
export function fieldShareWith(editionShare: number, bowlFirst: number): number {
  const logit = (p: number) => Math.log(p / (1 - p));
  const clamp = (p: number) => Math.max(0.02, Math.min(0.98, p));
  const shift = logit(clamp(ERA_FIELD_SHARE + bowlFirst)) - logit(ERA_FIELD_SHARE);
  return clamp(1 / (1 + Math.exp(-(logit(clamp(editionShare)) + shift))));
}

export type EngineOverrides = Partial<Record<"allocUsage" | "allocSpecialist" | "allocOpenerDeath" | "allocExtraBowler" | "allocPPHold" | "allocUsageBoost" | "allocReserve" | "allocTags" | "phaseUsagePrior" | "coachToss" | "coachRotationScale" | "coachDepth" | "floaterScale" | "byeEvents" | "batExponent" | "bowlExponent" | "bowlHazardExponent" | "pitchExponent" | "inningsPhaseExponent" | "inningsPhaseHazard" | "inningsPhaseDeathOnly" | "inningsPhaseDeathExponent" | "pressureExponent" | "gearExponent" | "foundExponent" | "shapeExponent" | "streakExponent" | "setnessExponent" | "adjustedSetness" | "adjustedStates" | "ballInOverExponent" | "chaseDotsExponent" | "matchupExponent" | "bowlTierExponent" | "bowlerDaySd" | "batterDaySd" | "matchEffectSd" | "inningsEffectSd" | "venueExponent" | "scoringCalibration" | "hazardCalibration" | "deathCalibration", number>>;

/** Calibration hook: override numeric constants for a sweep (`npm run engine:calibrate`). */
export function setEngineOverrides(overrides: EngineOverrides): void {
  const { allocUsage, allocSpecialist, allocOpenerDeath, allocExtraBowler, allocPPHold, allocUsageBoost, allocReserve, allocTags, coachToss, coachRotationScale, coachDepth, floaterScale, ...flat } = overrides;
  Object.assign(ENGINE, flat);
  if (allocUsage !== undefined) ENGINE.allocation.usageWeight = allocUsage;
  if (allocSpecialist !== undefined) ENGINE.allocation.specialistBonus = allocSpecialist;
  if (allocOpenerDeath !== undefined) ENGINE.allocation.openerDeathBonus = allocOpenerDeath;
  if (allocExtraBowler !== undefined) ENGINE.allocation.extraBowlerPenalty = allocExtraBowler;
  if (allocPPHold !== undefined) ENGINE.allocation.powerplayHoldPenalty = allocPPHold;
  if (allocReserve !== undefined) ENGINE.allocation.reservationPenalty = allocReserve;
  if (allocTags !== undefined) ENGINE.allocation.usageTags = allocTags;
  if (allocUsageBoost !== undefined) ENGINE.allocation.usageBoost = allocUsageBoost;
  if (coachToss !== undefined) ENGINE.coachPlay.toss = coachToss;
  if (coachRotationScale !== undefined) ENGINE.coachPlay.rotationScale = coachRotationScale;
  if (coachDepth !== undefined) ENGINE.coachPlay.depth = coachDepth;
  if (floaterScale !== undefined) ENGINE.floater.scale = floaterScale;
}
