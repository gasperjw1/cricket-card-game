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

## Still open

- Dot share −0.7 points: the sim turns a few dots into singles at the same run rate; not a counting
  artefact (checked both sides).
- 2024 scores 0.23 an over low in the sim; 2026 loses a wicket every 16 balls against 17.2 real.
- Setness, streak, ballInOver and chaseDots are still measured without player adjustment (the
  adjusted setness table exists, off); the pressure module can measure the rest the same way.
- Pressure sixes at required rates of 14–16 and dead-chase dots were not re-measured.
- The replay still takes extras, dismissal mix, rain, venue factors and chase uplift from the
  edition being replayed; only the base rates have an out-of-sample switch.
