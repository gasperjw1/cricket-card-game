# World Cup Draft — engine refit, 2026-11-01

What was changed after the two audits of the same day
(`wc-draft-engine-calibration-audit-2026-11-01.md`, `wc-draft-second-audit-2026-11-01.md`), how
each step was measured, and where the engine stands. Branch `wcdraft/gazette`.

Every measurement below is the replay harness over the nine editions with real elevens
(2007–2026 less 2009, which has no replay set), 60 simulations a match, seeds as stated. "Bias" is
simulated minus real on the same matches. The scratch scripts (`eval.mts`, `pp-diag.mts`,
`players-matter.mts`, `runouts.mts`, `engine-checks.mts`) lived in the session scratchpad; the
harness logic is the committed `engine/replay.ts` plus engine overrides.

## Where it started

The build the other agent left (projection on, five new state terms, calibrations 0.89 / 1.04 /
1.14), nine editions, 60 sims × 2 seeds: Brier 0.1958, run rate +0.01, powerplay +0.09, middle −0.03,
death 0.00, balls per wicket −0.02, first-innings SD +3.2, dot share −0.71, chase win share −1.1.
Good means reached with three compensating constants and ratings that had seen the matches being
replayed.

## The steps, each measured

1. **Projection off by default** (`rate.ts` `DEFAULT_OPTIONS`). The later-balls window started at the
   edition itself and ran 60 months, so thin cards carried the tournament into replays and
   calibration, and an edition-locked card borrowed the five years after it. It stays available as
   `projection: true`; the ratings test covers both paths.
2. **Centring by balls** (`engine/data.ts` `centreOnCohort`, `analysis/players.ts` `exposure`). Each
   squad member now carries the legal balls he faced and bowled per phase in the edition, and the
   cohort mean the engine divides by is weighted by them. Before, weighting by matches put the
   batters who actually face the balls 7–11% above "neutral" in runs per ball and 5–9% below in
   hazard (2024 and 2016, measured directly).
3. **Non-striker run outs** (`engine/match.ts`, `ENGINE.nonStrikerRunOut`, `strikerRunOutShare`).
   Measured over 3,242 men's T20Is since 2016: 1,460 of 40,290 wickets (3.62%) were non-strikers run
   out, 96% of them on balls the striker scored 0–2 on, at per-1,000-ball rates of 1.10 / 1.63 /
   5.77 (first innings PP / middle / death) and 1.28 / 1.46 / 3.97 (chase). The engine now draws them
   at those rates, the striker's dismissal mix carries only the striker's run-out share (4.35% of
   striker dismissals against 7.79% of all wickets), and `hazardCalibration` went from 1.04 to 1.
4. **Streak null within phase, n/a band out of the base** (`analysis/situation.ts`). The null now
   permutes outcomes within innings and phase, and the first six balls of an innings are filed but
   kept out of the context base, since the engine plays them as 1. Before, every powerplay band read
   1.04–1.06 against its null.
5. **Calibrations to 1.** With 1–4 in place and the other agent's terms still on, scoring / hazard /
   death at 1 / 1 / 1 gave run rate +0.01, PP −0.11, middle +0.09, death +0.05, balls per wicket
   −0.01 (60 sims, seed 1). The old 0.89 / 1.14 pair left the same build 0.34 an over low. The
   calibration grid in `cli/calibrate.ts` now includes 1.
6. **Term-by-term A/B** (each term off alone, calibrations 1, 60 sims, seed 1):

   | Switched off | Brier | Chase win bias | Note |
   |---|---:|---:|---|
   | none | 0.2018 | −1.6 | |
   | inningsPhase | 0.1940 | +0.4 | its ×1.035 chase hazard was the chase-wicket excess |
   | shape | 0.1961 | −1.7 | uses later-career balls |
   | found | 0.1987 | −1.6 | |
   | streak | 0.1993 | −2.6 | |
   | chaseDots | 0.1990 | −2.6 | |
   | setness | 0.2002 | −1.9 | PP −0.24 without it |
   | pressure + gear | 0.2062 | −4.3 | pressure earns its place |

   Kept: pressure (re-measured with players removed at ^0.7, `analysis/pressure.ts`), streak,
   setness, ballInOver, chaseDots, matchup, pace/spin. Parked at exponent 0: inningsPhase, shape,
   found, gear; the hand-set Squeezer gap set to 1 / 1. The engine tests switch them on where they
   test the mechanism.
7. **Extras booked from the real breakdown** (`cricsheet/match.ts` `runsByes`, `environment.ts`,
   `match.ts`). Byes and leg-byes are now their own rate, and a wide costs its mean runs
   (`runsPerWide`) instead of the extra runs on wides being booked as byes on dot balls. Dot-share
   bias went from −1.49 to −0.59 points.
8. **Powerplay bowler share** (`ENGINE.allocation.powerplayHoldPenalty`). The utility pick gave each
   side's two best bowlers 40–45% of powerplay balls against 30–35% real, so the sim's powerplay
   bowler was 2.5–3.4% harder to hit than the real one. Each powerplay over a bowler has already
   bowled now costs him 4.5 runs for the next; the share lands at 32.7% (2024, real 30%) and 35.4%
   (2016, real 35.2%), the bowler's boundary ratio on 1.00.
9. **Player-adjusted setness** (`analysis/pressure.ts` `setness`, `ENGINE.adjustedSetness`). Built
   and switchable; off for now (PP −0.20 against −0.13 raw, Brier 0.2026 against 0.2008), to be
   re-tested now the powerplay share is right.
10. **Out-of-sample replay** (`matchEnvironment(…, { base: "window" })`, `replayEdition(…, { base })`).
    Base rates from the form-window population instead of the edition's own balls cost 0.003 Brier
    (0.2042 against 0.2013), so the replay score is not materially flattered by in-sample conditions
    once projection is off. The phase shape under window rates is off (PP +0.37, death −0.28): an
    edition's phase shape really is its own.
11. **Client:** the Batting styles tab and panel were removed (styles are defined by scoring rate, so
    the table only said fast scorers score fast). The style tag on cards stays as a description.

## Where it stands (phase 4, 60 sims × 2 seeds, exponents 0.7)

| Measure | Bias |
|---|---:|
| Run rate | −0.01 |
| Powerplay / middle / death | −0.04 / +0.04 / −0.04 |
| Balls per wicket | −0.07 |
| Chase win share | 0.0 |
| Dot share | −0.71 |
| Six share | 0.00 |
| First-innings SD | +1.9 |
| Brier (match-weighted) | 0.2013 (0.1959) |

Edition means hide less than before: the mean absolute edition bias is 0.08 RPO overall and 0.08 /
0.10 / 0.16 by phase; 2024 remains the outlier at −0.23 an over.

## Do the players matter?

India 2024 replaced by elevens from the 2024 pool, 60 tournaments each (phase 4, exponents 0.7):

| Eleven | Card mean | Match wins | Titles | Out in groups |
|---|---:|---:|---:|---:|
| Real XI | 88.7 | 65.5% | 15% | 22% |
| Best eleven by card | 103.9 | 78.3% | 55% | 3% |
| Worst valid eleven | 60.1 | 38.2% | 0% | 80% |
| Four random valid elevens | 79–84 | 45–59% | 0–5% | 27–62% |

At exponents 0.9 the spread widens a little (real 68.5%, best 81%, worst 31%).

## Exponents and dispersion

Batting and bowling exponents, nine editions, 60 sims (seed 1 unless marked):

| bat / bowl | Brier | 1st-inn SD bias | Note |
|---|---:|---:|---|
| 0.6 / 0.6 | 0.2033 | +0.6 | |
| 0.7 / 0.7 | 0.2013 (2 seeds) | +1.9 | kept |
| 0.8 / 0.8 | 0.2028 | +3.1 | |
| 0.9 / 0.9 | 0.1972 (2 seeds) | +4.4 | |
| 1.0 / 1.0 | 0.1967 | +5.6 | |
| 0.7 / 0.9 | 0.2011 (2 seeds) | +1.8 | the single-seed 0.1999 was noise |
| 0.8 / 0.9 | 0.2011 | +3.1 | |
| 0.6 / 0.9 | 0.2046 | +0.9 | |
| 0.9 / 0.7 | 0.2033 | +4.2 | |

Two seeds move Brier by about ±0.003, so only 0.9 / 0.9 is a real gain (−0.004), and it buys it
with a first-innings spread 10% wider than real, which day and match effects cannot repair: at
0.9 the spread stays +3.7 with every dispersion constant at zero. The spread comes from the
batting exponent (0.7 / 0.9 keeps it at +1.8). 0.7 / 0.7 stays: it is the realistic setting and
within noise of the best on prediction. Dispersion stays at 0.10 / 0.08 / 0.05 / 0.03: lower
settings did not change the spread and zero cost 0.005 Brier.

## Engine items, 2026-11-02

Four questions from the audits, each measured on the replay harness or on the same real fixtures
replayed many times (scratch scripts `baseline.mts`, `player-dist.mts`, `dots.mts`, `eval.mts`).

1. **Out-of-sample baseline.** Over 296 decided matches in nine editions, base rates from the
   form window (not the edition): sim Brier 0.2035, in-sample 0.1993, a pre-tournament Elo
   baseline from the archive 0.2056, a coin 0.25. The player model carries about as much
   information as team rankings while knowing nothing about teams; it beats Elo clearly in 2012,
   2021 and 2026 and loses in 2007, 2014 and 2024. No change.
2. **Player-level distribution test** (six editions, 2012–2024, 20 sims a fixture, by card band).
   Batting matches to the band: strike rate within ±4 (90+ cards 140 against 136, under-70 cards
   105 against 108), balls per dismissal within 1.5, fifty-plus rates 15.2 against 15.1 and 4.0
   against 4.8 at the two ends. The sim gives the best batters a few too many ducks (8.8% against
   7.0%) and the weakest a few too few. Bowling economy matches to 0.04 an over in every band, but
   **wicket-taking is compressed**: 85+ bowlers take a wicket every 19.2 balls against 17.3 real
   and three-fors 10% against 14%. A separate bowler hazard exponent (`bowlHazardExponent`, kept
   at 0.7) at 0.9 moved nothing, and halving the ratings' hazard prior (2000 → 1000, rebuilt)
   moved nothing either: the bowlers' wicket cells are already near 1 because dismissal rates do
   not stabilise at these sample sizes (validation r ≈ 0.09). The compression is the record's
   predictability, not a bug; both dials were put back. Individual gaps over 120 balls are
   tournament form (Rohit 2024 real 165 against 112 expected), mean absolute 17 strike-rate points
   where sampling noise alone is about 12.
3. **Dot clustering.** Real World Cup balls: a dot follows a dot 43.6% of the time and a scoring
   ball 36.2%, a lift of 7.4 points; the sim's lift is 9.0 (powerplay 6.0 against 4.0, death 7.8
   against 4.9). The engine already clusters dots as much as reality or slightly more, through the
   streak, ball-in-over and chase-dot terms, so the −0.7 dot share is not a missing dependency.
   No change.
4. **Pitch pace against spin, built.** `MatchEnvironment.classScoring`: the ground's spin-minus-pace
   runs an over in this edition against the edition's, shrunk by balls (`pitch.groundPriorBalls`
   2000), clipped at ±12%, split half each way as scoring multipliers on each bowler class; plus
   the pitch of the day, a per-match normal draw of SD 2.8% half each way (0.42 an over at 7.5).
   Replay, nine editions, 40 sims × 2 seeds: **Brier 0.1942 with it against 0.1965 without**,
   every bias unchanged within noise (run rate −0.003, phases −0.04 / +0.04 / −0.03, balls per
   wicket −0.07, spread +1.9, chase +0.5, dot −0.70). Leans are modest: Dubai 2016 spin 0.97,
   Daren Sammy 2024 0.96, Nassau 2024 1.02, Perth 2016 1.06. Only a ground's record in the
   edition itself is used; its all-editions record, measured against other mixes, read every
   2024 ground as pace-friendly. `pitchExponent` 0 switches both parts off; an engine test holds
   the symmetry, the clip and the switch.
5. **Associates, team-tier destination gains (ratings, not adopted).** Real fixtures,
   `scripts/research/associates.mts` (30 sims a fixture) on fit editions 2014–2022 and hold-out
   2024–26, and `eval.mts` at 40 sims × 2 seeds, both builds measured on the same day:

   | `destinationGain` / `strongGain` | Hold-out associate wins (real 2.5%) | Fit (real 25%) | Brier | 1st-inn SD bias |
   |---|---:|---:|---:|---:|
   | 1 / 1 (kept) | 23.3% | 36.7% | 0.1930 | +2.1 |
   | 2.0 / 1.3 | 21.8% | 31.2% | 0.1910 | +3.2 |

   Associate batting moved towards real: in the fit set 6.83 to 6.60 an over (real 6.54), in the
   hold-out 6.98 to 6.84 (real 6.55). The bowling side did not move: full members batting against
   associates in the hold-out lose a wicket every 18.6 and 18.5 balls against 22.5 real, and every
   associate side's mean bowling card is identical in the two builds. The gains act on the two-way
   team-tier destination, and only batting uses it; bowling rates with `tierMode` "elo"
   (`DEFAULT_OPTIONS` in `rate.ts`, chosen in Phase 1 because the two-way table cost bowling
   stability without predictive gain). So none of the gain settings, including those measured
   before on 2026-11-02, could reach the 12–16% target. The batting gain alone also widens the
   spread past +3. Both stay at 1. What's left is the associate bowlers: either rate them through a
   team-tier destination of their own, or discount bowling edges earned against weak batting. That
   would reverse a Phase 1 decision, so it waits for Yash.

   **Bowling through the two-way step (measured 2026-11-02 at Yash's request, not adopted).**
   Bowling `tierMode` set to "twoWay", same harnesses; ratings validation from the build's
   `RATINGS.md` default row (within-edition prediction, edition-to-edition stability):

   | Bowling mode / weak-side gain | Hold-out | Fit | FM balls per wicket v associates, hold-out (real 22.5) | Brier | Spread | Bowl prediction | Bowl stability |
   |---|---:|---:|---:|---:|---:|---:|---:|
   | elo / 1 (kept) | 23.3% | 36.7% | 18.6 | 0.1930 | +2.1 | 0.191 | 0.585 |
   | twoWay / 1 | 21.7% | 33.3% | 19.5 | 0.1924 | +2.0 | 0.175 | 0.541 |
   | twoWay / 2.0 (batting too) | 18.8% | 28.3% | 19.7 | 0.1888 | +2.9 | 0.174 | 0.506 |

   The last row is the best fixture and Brier result so far (the Brier gain of 0.004 is just past
   two-seed noise) and keeps the spread under +3. But it misses the 12–16% target and costs
   bowling ratings their stability and some prediction, the trade Phase 1 rejected. The reason it
   stalls is 2024: the two-way bowling table has the wrong slope there. Mean associate bowling
   cards in 2024 rise from 69.8 to 71.3 at gain 1 and 72.1 at gain 2.0, above the full members'
   70.9, while 2026 drops the right way (67.1 to 61.5). A larger gain makes 2024 worse, so the
   sweep stopped here. The 2024 hold-out stays at 23.5% against 5% real, and 2026 is 14.2%
   against 0%. A fix would have to repair the table's slope first, for example by pooling the
   bowling rows over more editions or forcing it to fall with team strength, before any gain is
   worth measuring. Settings restored: bowling "elo", gains 1.
6. **The bowling tier step, measured directly (2026-11-02, research only).** Why associate bowling
   cards sit level with full members' (2024: 69.8 against 69.9) while their batting sits far below
   (56.9 against 70.7):
   - **A closed circuit.** In men's T20Is from mid-2021 to mid-2024, 94.5% of associate bowling went
     to associate batting and 94.3% of associate batting faced associate bowling. The ratings judge
     a bowler against an average bowler's outcome for the same year, phase and batting side's Elo
     bin, and for weak bins that average bowler is almost always an associate. So an average
     associate bowler reads as an average bowler. Batting has the two-way destination to place
     the circuit; bowling has nothing. The edge discount can't help either, because it trims edges,
     and the error here is in the level.
   - **A thin bridge.** Zimbabwe and Ireland supply 60% of the balls between the tiers in that
     window, and they play near associate level themselves. The other ten full members met
     associates for about 4,000 balls each way in three years.
   - **The step** (`scripts/research/bowling-tier-step.mts`; T20Is from 2014, observed ÷ expected for
     the same year, phase and batting Elo bin; bowlers grouped by their own side's membership):

     | Batting side's Elo | Associate bowlers: runs / wickets | Full-member bowlers: runs / wickets |
     |---|---|---|
     | Below 1500, World Cups out (413k / 29k balls) | 1.002 / 0.996 | 0.994 / 1.019 |
     | 1500–1699, World Cups out (55k / 113k) | 1.018 / 0.941 | 1.001 / 1.031 |
     | 1700 and up, World Cups out (656 / 32k) | 1.157 / 0.663 | 1.001 / 1.024 |
     | 1700 and up, World Cups in (2,539 / 38k) | 1.049 / 0.746 | 0.997 / 1.017 |

     The associate deficit grows with the strength of the batting faced, and it is mostly in
     wickets. Full-member bowlers hold level across all three bands. Within the same bowlers (30+
     balls against both weak and strong batting, World Cups out), 142 full-member bowlers step
     runs ×1.02 and wickets ×1.00. Only 6 associate bowlers qualify (240 balls against strong
     batting): runs ×1.16 (95% 1.01–1.31) and wickets ×0.29 (95% 0.00–0.50).
   - **What this means.** Outside World Cups, 74% of associate bowling's exposure to strong batting
     doesn't exist: 1,883 of their 2,539 balls against it since 2014 came in World Cups. So the
     form window can't show an associate bowler's level against a strong side, and the rating
     reads his level from the circuit. The size needed is in line with the sim's error: on the
     2024–26 hold-out, associate bowling needs about ×1.05 runs and ×0.85 wickets to match real
     (8.51 against 8.90 an over, 18.6 against 22.0 balls per wicket). The middle band, the only
     well-sampled bridge, gives ×1.02 and ×0.91 against full-member bowlers facing the same
     batting. The World Cup rows can't be used to fit a fix, since they include the hold-out.
7. **Associate bowling step in the ratings (2026-11-02, built, `MODEL.bowlTierStep`; per-match
   version in item 8).** Fitted with World Cups left out: from the batting associate bowlers usually face (Elo
   1389) to the 1500–1699 band (1515), runs ×1.016 and wickets ×0.945, so per 100 Elo the runs rate
   is +0.0126 and the wickets rate −0.0449. Full-member bowlers hold level over the same move
   (×1.007, ×1.012). Extended to the 1700+ band it predicts ×1.046 and ×0.85, against ×1.049 and
   ×0.75 observed there with World Cups in. An associate bowler's runs and wicket cells move by
   that rate for the gap between the batting he faced (his side's Elo with no record) and the
   edition's opposition, capped at 400, and dots take up the difference. Same harnesses as item 5:

   | | Gain 1, no step | With the step |
   |---|---:|---:|
   | Hold-out associate wins (real 2.5%) | 23.3% | 22.2% |
   | Fit (real 25%) | 36.7% | 32.7% |
   | Hold-out full members v associates, balls per wicket (real 22.0 on legal balls) | 18.6 | 19.0 |
   | Hold-out full members v associates, runs an over (real 8.90) | 8.51 | 8.62 |
   | Brier, 40 sims × 2 seeds | 0.1930 | 0.1886 |
   | First-innings spread | +2.1 | +2.0 |
   | Bowling prediction, within edition | 0.191 | 0.195 |
   | Bowling stability | 0.585 | 0.603 |
   | Bowling wicket component | 0.160 | 0.175 |
   | 2024 mean bowling card, associates / full members | 69.8 / 69.9 | 66.6 / 71.0 |

   Every measure improves, and associate bowling cards now sit below full members' as they should
   (2026: 64.5 against 71.2). But the fixtures barely move. A rating can carry only one gap, to the
   edition's average opposition, and in a 20-team field that average includes the associates
   themselves. An associate's matches against full members face batting 250–350 Elo above his
   circuit, while the step applies the much smaller average gap. Closing the fixtures needs the gap
   per match, in the engine: the batting side's Elo against the bowler's circuit. If the card stays
   at the field-average step, the engine would add only the difference between this match's gap
   and the average, so the card and the engine stay consistent. Both suites pass with the step on
   (54, 63).
8. **Associate bowling step per ball, in the engine (2026-11-02, built, `ENGINE.bowlTierExponent`).**
   Ratings now carry each associate bowler's circuit (`evidence.tierStep`: the batting Elo he
   usually faced, and the field Elo his card's step was taken to; 2024 field 1586) and every
   player's side Elo (`teamElo`). The game's eleven mixes editions, so there is no team Elo per
   fixture. The ball model therefore reads the striker's own side Elo against the bowler's circuit
   and applies the measured step for that gap, less the card's share already arriving through the
   bowler's vector at the bowl exponents. Runs cells and the wicket cell move, and dots take up the
   difference. Same harnesses, against the card step alone:

   | | Card step only | Plus the per-ball step |
   |---|---:|---:|
   | Hold-out associate wins (real 2.5%) | 22.2% | 18.8% |
   | Fit (real 25%) | 32.7% | 32.2% |
   | Hold-out full members v associates, runs an over (real 8.90 legal balls) | 8.62 | 8.80 |
   | Hold-out full members v associates, balls per wicket (real 22.0) | 19.0 | 19.6 |
   | Hold-out associates v full members, runs an over (real 6.66) | 6.92 | 6.94 |
   | Brier, 40 sims × 2 seeds | 0.1886 | 0.1883 |
   | First-innings spread | +2.0 | +2.5 |
   | Run rate / PP / middle / death bias | −0.004 / −0.047 / +0.046 / −0.036 | −0.002 / −0.040 / +0.046 / −0.027 |

   From the start of the day (gain 1, no step) to now: hold-out 23.3% to 18.8%, fit 36.7% to 32.2%,
   Brier 0.1930 to 0.1883, spread +2.1 to +2.5. Runs against associate bowling now match real. Two
   gaps remain:
   - **Associate wickets are still too frequent** (19.6 balls per wicket against 22.0). The linear
     wicket rate from the middle band predicts ×0.85 at the strong band, while ×0.75 was observed
     with World Cups in, so the true curve probably steepens with the gap. The data outside World
     Cups (656 balls) is too thin to fit that.
   - **Associate batting is untouched** (6.94 against 6.66). It has the two-way destination, but
     the same average-gap limit applies to it. A batting counterpart of this step, measured the
     same way, is the next candidate.

   Checks: both suites pass (54, 63), the client builds and typechecks, and a full browser draft
   ran to the souvenir issue with no console errors (Bangladesh 2009, out in the Super 8 at 2–3;
   Italy 2026's bowling cards now run 63–77). Rarity over 1,000 greedy runs: unbeaten 1.2% of all
   runs (was 2.7%) and 5.0% of the top decile (was 4.0%), both inside the spec's dials; champion
   7.6% (was 10.4%) and 23.0% of the top decile (was 14.0%). Over 100 runs a decile is noisy,
   about ±4 points, but the top-decile champion rate rose: squads with no associates now meet
   weaker associate bowling.
9. **World Cups in the fit, and the curve (2026-11-02, Yash: these match-ups only happen at World
   Cups).** The step script now takes World Cups before a given year (`noWc=2024`): every World
   Cup before the 2024–26 hold-out joins the fit, and the hold-out stays out. That doubles the
   strong-band evidence (1,297 balls, 43 wickets) and shows the fall steepening with the gap:

   | Associate bowlers, from the weak band (Elo 1390) | Gap | Runs / wickets | Per 100 Elo, runs / wickets | Per (gap/100)², runs / wickets |
   |---|---:|---|---|---|
   | To 1500–1699 (2,990 wickets) | +127 | ×1.016 / ×0.945 | +0.0109 / −0.0415 | +0.0086 / −0.0326 |
   | To 1700+ (43 wickets) | +353 | ×1.136 / ×0.648 | +0.0356 / −0.1214 | +0.0101 / −0.0344 |

   On a straight line the strong band's wicket rate is three times the middle band's. As a square
   of the gap the two bands agree, so the step is now exp(rate × (gap/100)²), with runs +0.009 and
   wickets −0.033. Full-member bowlers stay near zero on both scales. Starting the data in 2007
   changes nothing. Same harnesses, against the straight-line step of item 8:

   | | Straight line | Square of the gap |
   |---|---:|---:|
   | Hold-out associate wins (real 2.5%) | 18.8% | 17.2% |
   | Fit (real 25%) | 32.2% | 30.9% |
   | Hold-out full members v associates, runs an over (real 8.90) | 8.80 | 9.09 |
   | Hold-out full members v associates, balls per wicket (real 22.0) | 19.6 | 20.8 |
   | Fit full members v associates, balls per wicket (real 18.9) | 19.7 | 20.2 |
   | Brier, 40 sims × 2 seeds | 0.1883 | 0.1884 |
   | First-innings spread | +2.5 | +3.0 |
   | Bowling prediction / stability | 0.195 / 0.603 | 0.194 / 0.598 |
   | Rarity, 1,000 greedy: unbeaten all / top decile | 1.2% / 5.0% | 1.6% / 4.0% |
   | Rarity: champion all / top decile | 7.6% / 23.0% | 7.3% / 18.0% |

   The square fits the ball data and moves the hold-out further, but the two fixture sets now pull
   apart. In 2014–22 full members lose wickets to associates less often than real (20.2 against
   18.9 balls), while in 2024–26 they still lose them more often (20.8 against 22.0). Runs in the
   hold-out now overshoot by 0.19 an over. That split looks like the associates themselves
   changing: the 20-team fields brought newcomers weaker than their circuit records say. One
   step per Elo gap can't serve both, and Brier doesn't separate the two curves. Kept: the square,
   since it's what the ball data show. Spread is at the +3 limit. Both suites pass (54, 63) and
   the client builds; the client code didn't change, so no second browser run.

## Still open

- Dot share −0.7 points: the sim turns a few dots into singles at the same run rate; not a counting
  artefact (checked both sides).
- 2024 scores 0.23 an over low in the sim; 2026 loses a wicket every 16 balls against 17.2 real.
- Setness, streak, ballInOver and chaseDots are still measured without player adjustment (the
  adjusted setness table exists, off); the pressure module can measure the rest the same way.
- Pressure sixes at required rates of 14–16 and dead-chase dots were not re-measured.
- The replay still takes extras, dismissal mix, rain, venue factors and chase uplift from the
  edition being replayed; only the base rates have an out-of-sample switch.
