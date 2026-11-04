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
10. **The newcomer question (2026-11-02, research only): it's associate Elo, not newcomers.**
    `scripts/research/associates-newcomers.mts` splits the associate-v-full-member World Cup
    fixtures by team, by experience (played an earlier edition or not) and by side Elo, on the
    current build (30 sims a fixture):

    | Associates v full members | Fixtures | Real wins | Sim wins | Associates bat, runs an over real / sim | Full members bat, balls per wicket real / sim |
    |---|---:|---:|---:|---|---|
    | Fit, established | 26 | 26.9% | 31.2% | 6.79 / 6.80 | 17.6 / 20.2 |
    | Fit, newcomers | 10 | 20.0% | 30.3% | 5.90 / 6.88 | 24.1 / 20.4 |
    | Hold-out, established | 30 | 0.0% | 18.1% | 6.69 / 7.12 | 21.5 / 20.6 |
    | Hold-out, newcomers | 10 | 10.0% | 14.3% | 6.13 / 6.30 | 26.6 / 21.4 |
    | Side Elo below 1450 | 22 | 22.7% | 27.1% | 6.51 / 6.63 | 18.5 / 20.8 |
    | Side Elo 1450 and up | 54 | 9.3% | 22.3% | 6.55 / 6.97 | 21.7 / 20.4 |

    Newcomers are roughly right in the hold-out (1 win in 10 against the sim's 14%). The error sits
    with the established associates, who went 0 for 30 against the sim's 5.4 expected wins (about a
    0.5% chance if the sim were right), and with the higher-Elo associates. Every 2024–26 associate
    rates 1438–1516, against about 1400 in 2014.

    `scripts/research/elo-drift.mts` checks team Elo itself over every men's T20I between an
    associate and a full member since 2010 (connectivity-regularised Elo, as the ratings read it):

    | Years | Matches | Associate Elo / full member Elo | Elo-expected associate wins | Real |
    |---|---:|---|---:|---:|
    | 2010–2018 | 36 | about 1420 / 1545 | 34% | 22% |
    | 2019–2023 | 103 | 1416–1464 / 1431–1532 | 41–48% | 27–35% |
    | 2024 | 41 | 1472 / 1597 | 33.5% | 9.8% |
    | 2025 | 25 | 1488 / 1587 | 37.4% | 24.0% |
    | 2026 | 30 | 1500 / 1641 | 32.4% | 6.7% |
    | All | 235 | | 38.1% | 21.7% |

    Elo rates associates too high against full members in nearly every year, and the gap widens in
    2024–26. Among themselves the associate circuit stays at about 1400 every year. The sides that
    meet full members, though, climb towards the 1500 connectivity cap by beating weaker associates,
    with no matching gain against full members. A real 21.7% against an expected 38.1% is about 140
    Elo of overrating on average (pre-2024 about 90; 2024–26 several hundred, though those rows
    include the hold-out). Team Elo feeds the ratings in several places: the batting two-way
    destination (by the side's Elo), the empty-record prior, the edge transfer, and the bowling
    step's "batting he faced". An overrated associate Elo makes associate batting look closer to
    full-member level, and it shrinks the bowling step's gap. That fits the remaining hold-out
    errors (associate batting 7.12 against 6.69, step too small in 2024–26) and the step overshooting
    in 2014–22, when associate Elo sat nearer 1400. **Next, not built:** correct associate Elo
    against full members, fitted on cross-tier results before 2024 (an associate offset in the
    expectation, or a firmer connectivity rule), rebuild, then refit the bowling step and re-measure
    the hold-out before any batting step.
11. **Associate Elo corrected (2026-11-02, built).** `scripts/research/elo-connectivity-sweep.mts`
    tried two read-out rules over every decided men's T20I before 2024, plain Elo underneath:

    | Rule | Cross-tier expected / real (139 matches) | Cross-tier log loss | All 1,814 matches, log loss | 2024–26 cross-tier expected (real 12.5%) |
    |---|---|---:|---:|---:|
    | No rule | 40.9% / 28.1% | 0.5970 | 0.6520 | 35.2% |
    | Cap 1500 (was in use) | 40.9% / 28.1% | 0.6001 | 0.6548 | 34.2% |
    | Cap 1400 | 38.7% / 28.1% | 0.5860 | 0.6618 | 28.9% |
    | Cap 1300 | 34.2% / 28.1% | 0.5601 | 0.6695 | 23.4% |
    | Isolation 200 | 31.4% / 28.1% | 0.5385 | 0.6436 | 22.7% |
    | **Isolation 300** | **27.7% / 28.1%** | **0.5327** | **0.6428** | **18.0%** |
    | Isolation 400 | 24.6% / 28.1% | 0.5388 | 0.6438 | 14.3% |

    The old cap predicted all matches slightly worse than no rule, and lowering it made that worse.
    The isolation rule (raw rating less 300 × the share of the last 20 matches not against full
    members) is calibrated across the tiers and the best over all matches. It is now the rule in
    `analysis/team-strength.ts`, and data and ratings were rebuilt. On the new scale associate sides
    read about 1100–1200, and the bowling step was refitted in the units the ratings use (Elo bin
    centres): wickets per (gap/100)² −0.026 to the middle band and −0.028 to the strong band, so
    −0.027; runs ×1.004 and ×1.087 (the latter on 1,027 balls). Same harnesses:

    | | Committed (old Elo, square step) | Elo fix, step with runs | Elo fix, wickets-only step (kept) |
    |---|---:|---:|---:|
    | Hold-out associate wins (real 2.5%) | 17.2% | 10.8% | 13.4% |
    | Fit (real 25%) | 30.9% | 26.7% | 28.2% |
    | Hold-out associates bat, runs an over (real 6.55) | 6.92 | 6.65 | 6.68 |
    | Hold-out full members v associates, runs an over (real 8.79–8.90) | 9.09 | 9.43 | 9.11 |
    | Hold-out full members v associates, balls per wicket (real 22.5) | 20.8 | 22.6 | 22.6 |
    | Fit full members v associates, runs / balls per wicket (real 7.66 / 19.0) | 7.79 / 20.2 | 7.84 / 20.9 | 7.68 / 20.8 |
    | Brier, 40 sims × 2 seeds | 0.1884 | 0.1867 | 0.1884 |
    | First-innings spread | +3.0 | +3.6 | +3.0 |
    | Run rate / middle-overs bias | +0.013 / +0.064 | +0.032 / +0.088 | +0.021 / +0.076 |
    | Batting prediction / stability | 0.350 / 0.756 | 0.362 / 0.819 | 0.362 / 0.819 |
    | Bowling prediction / stability | 0.194 / 0.598 | 0.209 / 0.618 | 0.210 / 0.607 |

    The Elo fix alone brings associate batting in line with real in both sets (no batting step
    needed for now) and matches hold-out wickets. Batting stability jumps from 0.756 to 0.819 and
    both predictions improve. With runs in the step, Brier is best (0.1867), but the spread breaks
    the +3 limit and full members score 0.5 an over too freely against associates. The runs
    evidence is thin, so runs is set to 0. Still open: hold-out associate wins at 13.4% against 2.5%
    (1 win in 40, so the true rate is uncertain; the sim expects about 5), fit-set wickets a little
    rare (20.8 against 19.0 balls), and middle-overs scoring +0.08 an over.

12. **In-match terms measured with the players held (2026-11-02).** Streak, ball-in-over and
    chase dots were measured on raw balls, so they carried who was batting and bowling and how
    their day was going, which the engine adds again through the players' vectors and day
    effects. `analysis/pressure.ts` now measures them as it measures pressure and setness: each
    ball against its expected shares with the batter, the bowler and the striker's setness removed,
    and the two sequence terms against a null that shuffles each innings' balls. The null was
    tested on the sim with every sequence term off, where it must read 1
    (`scripts/research/sequence-null-check.mts`, about 8,400 simulated World Cup matches). A
    shuffle within phase, striker and bowler read wickets 0.78–0.92 after dots and 0.90 after a
    quiet run, the measurement's own bias, not cricket. Three things have to stay put: a dismissal
    (always the batter's last ball), the batter's setness band (his first balls are the dot-heavy,
    low-risk ones) and the odd or even total (it decides who faces next). With all three held the
    null reads 1 within about 0.03 in every cell.

    Measured that way on the archive (T20Is and leagues since 2014), there is no momentum. After a
    hot or cold last six balls, and after any run of dots, the next ball moves 3% or less in every
    cell. The exception is sixes at 3–5 down in middle-overs chases, 0.90 after three dots. Split by
    batting style, by bowler pace or spin, and by the bowler's own dot and wicket thirds (set on the
    other half of the archive; `scripts/research/dot-response.mts`), every type reads the same
    within noise: no style of batter and no type of bowler answers a run of dots differently.
    Ball-in-over keeps its shape (ball 1 quieter, balls 2–4 riskier, ball 6 fewer sixes).

    | Nine editions, 40 sims × 4 seeds | Brier | Spread | PP / mid / death | Balls per wicket | Dot-after-dot lift (real 7.4) |
    |---|---:|---:|---:|---:|---:|
    | Raw tables | 0.1876 | +2.9 | −0.03 / +0.07 / 0.00 | +0.02 | 9.4 |
    | Adjusted streak, ball-in-over, chase dots | 0.1876 | +3.2 | −0.01 / +0.06 / 0.00 | +0.17 | 8.3 |
    | The same plus adjusted setness (**kept**) | 0.1866 | +2.6 | −0.08 / +0.03 / −0.02 | +0.15 | 7.4 |

    `ENGINE.adjustedStates` and `adjustedSetness` are both 1; the raw tables stay in
    `situation.json` behind the switches. The sim's dot clustering now matches real, which settles
    item 3 above: the excess was the raw tables counting the players twice. Rarity
    (`draft/scripts/rarity.mts 1000 greedy`): unbeaten 1.3% (was 2.1%), champion 8.7% (8.8%); top
    decile unbeaten 3.0% (8.0%), champion 15.0% (15.0%). The perfect run is still under the 3%
    target.

13. **Chase pressure by required rate (2026-11-02, `scripts/research/chase-pressure.mts`).**
    World Cup chases 2012–24, real against the sim on the same fixtures, 10 sims each. Live chases
    (up to 7 down) match on dots and wickets in every band. Sixes run short at required rates of
    10–14 (10–12: 5.0 per 100 balls real against 3.9; 12–14: 5.8 against 5.0), and at 14–16 the
    sim gives 5.3–6.3 against 6.9. In chases already gone (8 down, 18+ needed), dots match (34.7
    against about 33) but sixes are 5.8 against 3.5, on only 432 real balls.

14. **Bowling types filled from the archive sheet (2026-11-02).** `players.csv`, the label file
    the engine and the cards read, took bowling types from the Cricinfo snapshot and the hand lists
    only, never from `bowler-types.csv`, where reviewed entries with sources sit. Six associate
    bowlers with shown bowling numbers had no type as a result (Kariko and Atai of PNG, Miyaji,
    Rafiullah, Mutua, Hirani), so their cards showed no code and the engine played them with no
    pace or spin class. `pipeline/labels.ts` now falls back to that sheet; every one of the 1,250
    shown bowling numbers has a type. The 24 card holders still without one are batters with 34
    career balls or fewer and no shown bowling number.

15. **Every coach tag played (2026-11-03, Yash: show nothing the engine ignores).** Two tests per
    tag before building. Whether the team index repeats across alternate months of a tenure
    (`scripts/research/coach-tag-stability.mts`; 59 tenures with 15+ innings a half, 17 with 30+):
    powerplay tempo 0.35 / 0.06, powerplay wickets 0.26 / 0.19, death tempo 0.28 / 0.11, lower-order
    share 0.37 / 0.40, middle wickets 0.49 / 0.53, bowlers used 0.14 / 0.64, bowl first 0.42 / 0.65.
    Then, for the batting tags, what a side did beyond its players (`scripts/research/coach-residuals.mts`,
    every ball since 2014 against expected shares with batter, bowler and setness removed, 67 tenures
    with 600+ balls a half): powerplay runs repeat (split-half r 0.38, r 0.79 with the tag), death
    runs repeat (0.31, 0.70), powerplay wickets do not (−0.07), lower-order runs repeat a little
    (0.27) but match the "Deep batting" index poorly (0.18: the share of runs is mostly who bats there).

    | Tag | Engine | Measure |
    |---|---|---|
    | Powerplay aggressor / anchor, Death hitter / conservative | `intent` (as before) | real beyond the players |
    | Bowl first / Bat first | toss: the edition's field share moved by his habit in log-odds (`fieldShareWith`) | his habit, centred on the average coach, shrunk for thin tenures |
    | Six-bowler rotation / Frontline trust | the allocation's sixth-bowler and below-fifth charges × exp(−2.5 × rotation) | `scripts/research/coach-rotation-calibrate.mts`: −0.5 rotation gives about −0.5 bowlers an innings; upward the real elevens run out of bowlers (+0.27 for +0.5) |
    | Deep batting / Top-heavy | scoring cells × (1 + effect) for strikers from No. 6 down | redefined from the player-removed lower-order residual, shrunk by its reliability (0.43) and a 300-run prior; tags at ±0.6 SD: +1.1% to +5.9% and −1.3% to −4.3% |
    | Wicket preserver / Risk taker | dropped | no coach effect beyond the players |

    The drafted side now tosses for its own matches (the real toss was another side's decision); real
    elevens keep their real batting order. The coach panel prints each coach's habits in numbers from
    the same helpers the engine uses, and the tags sit on clean bands of them (rotation tagged +0.26
    to +0.53 against untagged −0.22 to +0.24; bowl first +8 to +21 points against −7 to +8). Replay,
    nine editions, 40 sims × 4 seeds: Brier 0.1871 with the habits against 0.1866 without, every bias
    within 0.01. Rarity (1000 greedy): unbeaten 1.8%, champion 6.9% (7.2% with the habits off; 8.7%
    before the fixture, toss and bowling-card changes of this round). Tests hold all three
    mechanisms. A first version printed "fields after 105% of toss wins" for a coach in a World Cup
    where 84% fielded; the log-odds helper fixed both the card and the engine, which had capped it.

16. **Tie-breakers played properly and kept (2026-11-03, Yash: no way to see a super over or
    bowl-out scorecard).** Showing the super-over card exposed three faults. (a) It was played as
    the first over of a 20-over innings: 4.6 runs a side. `scripts/research/super-overs.mts`, men's
    T20Is: 35 super overs make 12.4 runs batting first (sd 7.0) and 10.1 chasing, against 11.9 for a
    20th over with five or fewer down (n 1,263) and 6.2 for a first over. Super overs are now played
    as an innings' last over (`closing`), with the batters set by the median a real 20th-over
    striker had faced, 11 balls (quartiles 3–26). (b) The three batters and the bowler were picked on
    the role-relative display numbers, which sent USA's Nos. 9 and 10 in ahead of their top order;
    they are now picked on absolute death-overs rates, the bowler from those who bowl a fifth or
    more of their overs at the death (India: Suryakumar, Rohit, Kohli and Bumrah; Australia: David,
    Maxwell, Head and Cummins). (c) The bowler's figures read 0 balls (no ball log was passed).
    (d) The chosen bowler was not enforced: the over's allocation picked among the three batters
    too (USA's Harmeet Singh bowled instead of Anderson); only the chosen man may bowl now.
    India v South Africa 2024 super overs now make 10.2 batting first, 0.48 wickets; the real figure
    is from a small sample of mostly weaker attacks (standard error about 1.2). Every super over is
    kept, the tied ones too. The 2007 bowl-out, a coin toss before, is now bowled: five a side in
    turn (the men who bowled most in the match), most hits wins, then sudden death, stopped once a
    side cannot catch up. There is no data on bowl-outs, so every ball has the same 40% chance for
    both sides and it stays an even contest. Only tied matches change: replay, nine editions, 40 sims
    × 4 seeds, Brier 0.1871 (as item 15), every bias as before. Player of the tournament
    sums the player-of-the-match points (`awards.ts` `matchPoints`, the same rule per match).
    Checked over 100 super-over ties and 100 bowl-outs on five pairings: balls, wickets, runs,
    targets, one bowler an over and every winner add up; bowl-outs stopped early only when the side
    behind could not catch up; the side bowling first won 52 of 100.

17. **T20I records from full-member matches only (2026-11-03).** The real T20I book counts only
    matches between full members, but the sim's matches all went into it, so Ireland's 58 all out
    against South Africa in 2014 read as a T20I record. `foldRecords` now takes the edition and
    keeps associate matches out of the T20I book (they still count for the World Cup books). The
    souvenir's "Records broken" also uses the reports' rule: a mark is a record of all T20Is or all
    World Cups only when it displaced a real one. In 2007, the first World Cup, every mark had been
    flagged as a T20 World Cup record; against the real T20I book six of eight were T20I records, and
    the highest total (220 against Australia's 221) and highest score (94 against Ponting's 98*) were
    records of that World Cup only.

18. **Dots: byes, who bowls when, and both innings alike (2026-11-04, Yash: is it the players, the
    engine, the situation or the phase?).** The sim had 0.65 points too few dots. Real World Cup balls
    were set against the sim's on the same fixtures and real elevens (nine editions,
    `scripts/research/dot-gap.mts`) and split by phase, innings, wickets, balls faced, position,
    bowler type, dots in a row and required rate. A dot here is a legal ball with no runs at all.
    - **Players, not the cause.** The ball-weighted gap per player was about 0 for batters and
      bowlers alike, and every split by batter showed the same small shortfall. The batters'
      ordering is kept (correlation 0.56; noise-corrected spread 5.3 against 6.2 real).
    - **The cause was byes.** The edition profile gives bye runs per ball, and the engine used that
      as the chance of a one-run bye ball. Real bye and leg-bye balls bring 1.31–1.46 runs
      (`scripts/research/byes.mts`, men's T20Is since 2014: about 82% one, 8% two, 10% four). So the
      sim made a third too many bye balls, and every one of them was a dot lost. Bye balls are now
      drawn at runs ÷ runs-per-ball, with runs from that table (`byeEvents`, `byeRuns`), so the
      edition's bye runs do not change. This alone took the dot gap from −0.65 to +0.10.
    - **Phase: who bowls when.** The pick was by expected runs alone, so a spinner whose powerplay
      record is mostly his overall one looked as good with the new ball as a seamer. Spinners bowled
      13.3% of all balls in the powerplay (real 6.8%) and 9.1% at the death (real 5.1%). A charge on
      the log of a bowler's own phase share against the phase's share of an innings
      (`allocation.usageWeight` 2, charge only) brings these to 11.8% and 6.3%.
      - A boost as well as a charge sent part-timers on for every middle over (6.5 bowlers an
        innings).
      - The specialist bonus is off (the shares say the same thing), the opener death bonus is down
        to 0.5 and the sixth-bowler charge is up to 1.6. The result is 6.13 bowlers a full innings
        (real 6.20) and 42.6% of overs 19–20 with an opening bowler (real 43%).
      - Coach rotation still sizes at 2.5: 1.03 bowlers per unit.
      - At weight 4, powerplay spin falls to 10.2%, but Brier is 0.1885 and death overs +0.07.
    - **Situation: both innings alike.** With the pooled phase base, chase death overs had 3.0 points
      too few dots. Innings × phase is back on (exponent 1), on runs and dots only
      (`inningsPhaseHazard` 0, since its chase wicket term was why it was switched off). Chase death
      dots are now −0.7, and first-innings death +0.2.

    | Nine editions, 40 sims × 4 seeds | Brier | PP / mid / death | Balls per wicket | Chase | Dots |
    |---|---|---|---|---|---|
    | Before (one-run byes) | 0.1871 | | | | −0.65 |
    | Bye events | 0.1875 | −0.08 / +0.03 / −0.01 | +0.17 | −1.5 | +0.10 |
    | + usage charge, innings × phase (now) | 0.1860 | −0.07 / +0.02 / +0.02 | +0.17 | −1.3 | +0.07 |

    Every outcome's share of balls is now within 0.16 points of real (fours −0.13, the largest gap).
    Rarity (1000 greedy): unbeaten 1.9%, champion 7.8%. Left as they are:
    - Bowlers' dot rates are compressed: noise-corrected spread 3.9 against 6.0 real. The 0.7 bowl
      exponent is part of it.
    - Spinners at the death have 2.8 points too few dots: few death overs, so their death vectors
      fall back to their overall ones. This needs a ratings change, not an engine one.
    - Seamers bowl 20.2% of all balls in the powerplay against 25.1% real.

19. **Bowlers bowl in their phases (2026-11-04, Yash: a captain short of new-ball or death bowlers
    has to arrange the rest).** Full write-up in `wc-draft-bowling-roles-2026-11-04.md`.
    - The usage charge from item 18 is now a pull as well in the powerplay and at the death
      (`usageBoost` 4, `usageWeight` 3), with the powerplay spread penalty down to 3 and the
      sixth-bowler charge at 1.2.
    - Who bowled what in the replays, by phase × pace/spin × usage, is within 2.1 points of real in
      every cell (summed error 30.6 → 10.6). Bowlers' dot spread is 5.1 against 6.1 real (was 3.9).
    - A drafted eleven with one new-ball man gives him two powerplay overs, up from one.
    - 6.20 bowlers a full innings and 42.9% of overs 19–20 to an opener (real 6.20 and 43%).
      Coach rotation scale 3 (was 2.5).
    - Brier 0.1871 against 0.1860, within seed noise. Death overs are +0.10 an over against +0.02.
      Rarity: unbeaten 1.7%, champion 6.1%.
    - Measured and kept off:
      - a rare-phase performance adjustment (real in the powerplay, reversed at the death);
      - card tags read by the engine (less accurate than the share);
      - captains' phase habits (2–3 points, partly career stage).

20. **The death-overs bias (2026-11-04).** Item 19 left the replay's death overs 0.10 an over high.
    Checked a second time the same day with an independent review of the scripts. That review
    corrected the mechanism and the weight below. Four measurements:
    - **Not the allocation.** `dot-gap.mts` compares real and simulated balls on the same fixtures.
      The old and new allocations both gave first-innings death 1.55 runs a ball against 1.52 real.
      The excess was with the top order and the set batter:
      - Nos. 1–4 scored 1.90 a ball against 1.72.
      - Batters on 25+ balls scored 1.88 against 1.68.
      - Both were out less: 7.5–8.1% of balls against 8.7–10.4%.
      (These are from the first run. The rerun fixed two biases: matched full-length fixtures
      only, and a striker run out on a run scores 0, as the engine's W ball does.)
    - **Not mainly the batters' ratings.** `batting-phase.mts` is the batting twin of
      `rare-phase.mts` (men's T20Is since 2012, balls-faced bands to 55+). At the death:
      - Batters who rarely bat there score 0.96–0.99 of their level elsewhere.
      - Openers score 0.95–0.96, and are out ×1.05–1.10.
      - Nos. 3–4 score ×1.03–1.06.
      That is a small ratings effect for openers. It is not the cause: the ball model below is as
      far off for Nos. 3–4 as for openers.
      The powerplay shows a larger rare-phase effect (rare 0.85, regular openers 1.06), not
      followed up here.
    - **The ball model, at the death.** `ball-check.mts` feeds every real World Cup ball, in its
      real situation and with the real batter and bowler, through `outcomeDistribution`:
      - First-innings death came out +0.067 runs a ball and chase death −0.001.
      - The powerplay and middle overs were within 0.012.
      - With innings × phase off, the death cells were +0.030 and +0.063.
      - Setness, streak and ball-in-over off moved nothing.

      At the death the term is the archive's whole raw innings gap: ×1.076 first innings against
      second, with each innings' overall level taken out. Real World Cups show ×1.076 too. But
      with the term off, the ball model already makes ×1.051 itself, from the real batters and
      bowlers, wickets down and balls faced. So at full weight most of the gap is counted twice.
      The gap wants a weight of about 0.34.
    - `inningsPhaseDeathExponent`, the term's weight at the death. Replay columns are sim − real,
      runs a ball, on matched full-length fixtures:

      | Weight | 1st-inn death | Chase death | Innings gap (real 0.112 ±0.038) | Brier | Chase wins |
      |---|---|---|---|---|---|
      | 1 | +0.036 | −0.034 | 0.182 | 0.1871 | −1.3 |
      | 0.6 | +0.022 | −0.007 | 0.141 | 0.1860 | −0.3 |
      | 0.4 | +0.016 | +0.003 | 0.125 | 0.1865 | +0.2 |
      | 0 | | | | 0.1869 | +1.0 |

    **0.4 adopted.** It is the weight the innings gap measures in both the ball check and the
    replays. The Brier differences are all inside the 0.003 seed noise, so they decide nothing.
    (0.6 was first chosen on that 0.0005 difference, and changed on review.)

    Rarity (1000 greedy): unbeaten 1.7%, champion 5.7%, against 1.7% and 6.1% before. The
    difference is under half a standard error (about ±1.0 point on the difference).

    The eval's own death figure stays at +0.09 an over at every weight, and at +0.08 with rain
    off. Two checks show why it is not a defect:
    - Its baseline equals the real death rate of the replayed matches in every edition.
    - The real World Cup death rate is only known to ±0.021 runs a ball, ±0.13 an over (bootstrap
      over 307 matches).

    Ball for ball, pooled death runs are within 0.04 an over of real. Against the old allocation,
    item 19 put the death up 0.07 an over and the middle overs down 0.03, with total runs
    unchanged. Within that noise, neither phase split is more right than the other.

## Still open

- Spinners at the death 2.3 points short on dots. Bowlers' dot spread is 5.0 against 6.1 real
  (was 3.9; item 19). Death overs read +0.09 an over in the eval, within its noise (item 20).
- 2024 scores 0.23 an over low in the sim; 2026 loses a wicket every 16 balls against 17.2 real.
- Pressure sixes run short at required rates of 10–16 and in chases already gone (item 13).
- Balls per wicket +0.15 and powerplay −0.08 an over with the adjusted tables (item 12).
- The replay still takes extras, dismissal mix, rain, venue factors and chase uplift from the
  edition being replayed; only the base rates have an out-of-sample switch.
- A tied super over goes to another, up to three, then a coin. The real rule changed by era (a
  count-back on sixes or boundaries before late 2019, repeated super overs since); not yet per
  edition, and the exact rule for each edition is still to be checked.
