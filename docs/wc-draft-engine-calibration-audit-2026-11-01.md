# World Cup Draft — engine calibration audit, 2026-11-01

Branch `wcdraft/gazette`. The audit followed the wide-counting bug, to see whether anything else in
the calibration had been misread. **It changed no engine code, and none of the causes below is fixed
yet.** The model it describes is the uncommitted build on that branch.

Terms: PP is overs 1–6, middle 7–15, death 16–20. RPO is runs per over. "Sim − real" is the simulated
figure minus the real one, on the same matches and the same cuts.

## Findings

The engine's run rate and phase figures match real cricket, but three of its constants are getting
there by covering for other errors:

| Constant | What the code says it does | What it is really doing |
|---|---|---|
| `scoringCalibration` 0.89 | Absorbs feedback from hot streaks | Mostly offsets player vectors centred on the wrong weight, plus an inflated PP streak term |
| `deathCalibration` 1.14 | Restores death scoring against the best bowlers | Mostly cancels `scoringCalibration`: 0.89 × 1.14 = 1.015 |
| `hazardCalibration` 1.04 | Absorbs the same feedback | Stands in for non-striker run-outs, 3.4% of wickets, which the model leaves out |

Three causes account for most of it:

1. Player vectors are centred by matches played, not balls.
2. The ball model has no non-striker run-outs.
3. The streak term's baseline inflates the powerplay.

With those removed, the two scoring calibrations can be dropped and every phase lands within 0.23
RPO of real. The rest of this report has the evidence, the smaller findings and what is still unknown.

## The build as it stands

Ten editions, 200 sims a match, two seeds. Each figure is the mean bias, sim − real, over editions:

| Measure | Seed 1 | Seed 2 |
|---|---:|---:|
| Run rate | −0.01 | −0.01 |
| Powerplay RPO | +0.05 | +0.05 |
| Middle RPO | −0.03 | −0.04 |
| Death RPO | −0.01 | −0.03 |
| Balls per wicket | −0.07 | −0.07 |
| Dot % | −0.64 | −0.61 |
| Four % | +0.01 | +0.02 |
| Six % | +0.07 | +0.09 |
| First-innings average | −0.07 | −0.04 |
| First-innings SD | +3.31 | +3.24 |
| Brier | 0.1934 | 0.1890 |
| Favourite right | 70.9% | 69.4% |
| Chase win (real 50.5%) | 49.2% | 49.5% |

Split by innings on the 333 replay matches, at 60 sims a match, the two innings differ even though
the means above look clean:

| RPO, real v sim | PP | Middle | Death |
|---|---:|---:|---:|
| First innings | 7.17 v 7.26 | 7.40 v 7.35 | 9.55 v 9.55 |
| Chase | 7.35 v 7.47 | 7.33 v 7.32 | 8.80 v 8.66 |

## How it was measured

- **Same estimator on real and simulated balls.** One script makes the same cuts on both, by innings
  and phase, over the 333 replay matches with a full XI on both sides. Rain is off in the sim and
  reduced innings are out of the real set.
- **Calibration runs.** 30 sims a match with fixed seeds. The four runs below were repeated for this
  report and reproduced exactly.
- **Real-ball test.** The model's context terms run over 3,232 real T20Is since 2016 (670,148 balls)
  with no players and no calibration, then predicted is divided by observed. A ratio away from 1 in a
  plain cut, such as innings × phase, suggests a term is double counting. Cuts tied to player quality
  drift anyway, because better batters reach them: wickets bands, setness 25+, required rate 18+.
  Drift there says nothing about the model.
- **Dropping one term at a time** from that test shows which term causes a drift.
- **Pass-through runs.** Set a multiplier to a known value and see how much reaches run rate.

Real wicket rates in the phase tables count the striker only, so they need about 3.5% added to compare
with the sim, which targets all wickets.

## What the calibrations are covering

Sim − real RPO as each cause is removed:

| Run | 1st PP | 1st mid | 1st death | Chase PP | Chase mid | Chase death |
|---|---:|---:|---:|---:|---:|---:|
| A. All three calibrations at 1 | +0.59 | +0.44 | +0.24 | +0.67 | +0.49 | +0.05 |
| B. A, plus ball-centred vectors | +0.33 | +0.24 | +0.26 | +0.38 | +0.29 | +0.10 |
| C. B, plus hazard 1.035 | +0.27 | +0.16 | +0.11 | +0.31 | +0.21 | −0.01 |
| D. C, plus streak off | +0.06 | +0.15 | +0.23 | +0.11 | +0.20 | 0.00 |

Row A is the main result. Without calibration, death is already close and the overshoot sits in the
PP and middle overs. `deathCalibration` therefore isn't correcting death at all; it undoes
`scoringCalibration` there, because that constant was needed only earlier in the innings.

Dot % in run D, real v sim:

| | PP | Middle | Death |
|---|---:|---:|---:|
| First innings | 47.3 v 47.6 | 30.6 v 30.5 | 23.4 v 22.7 |
| Chase | 47.0 v 46.1 | 31.5 v 30.4 | 26.9 v 25.4 |

Limits of these runs:

- Run B divides by one ball-weighted mean per phase, read from simulated balls of the current build
  and applied to all editions. It is a test of the size, not the fix. The fix computes it per edition.
- Run D switches streak off to size the problem. The streak effect itself is real, so the fix is a
  correct baseline, not removing the term. Run D therefore loses whatever real streak effect exists,
  and its first-innings death rises by 0.12 compared with run C.
- 30 sims a match is enough for phase means but not for a final fit.

## Cause 1: player vectors centred by matches, not balls

[`centreOnCohort`](../wcdraft/src/engine/data.ts:276) divides each player vector by a mean weighted by
`member.matches`, with the same weight in every phase. A No. 10 counts as much as an opener towards
the PP mean, though the opener faces nearly all the PP balls. Weak vectors drag the mean down, so the
batters who actually face the balls sit above 1. The bowler side works the same way: frontline bowlers
beat a mean that counts part-timers equally.

Ball-weighted mean over simulated balls, where 1 is neutral:

| Term | Phase | Dot | Four | Six | Wicket |
|---|---|---:|---:|---:|---:|
| bat^0.7 | PP | 0.949 | 1.083 | 1.094 | 0.960 |
| bat^0.7 | Middle | 0.951 | 1.051 | 1.049 | 0.952 |
| bat^0.7 | Death | 0.988 | 0.998 | 0.986 | 0.979 |
| bowl^0.7 | PP | 1.023 | 0.971 | 0.940 | 1.003 |
| bowl^0.7 | Middle | 1.012 | 0.975 | 0.973 | 1.004 |
| bowl^0.7 | Death | 1.008 | 0.976 | 0.979 | 1.003 |

Multiplying the two sides gives the net effect on fours: about +5% in the PP, +2.5% in the middle and
−2.6% at the death. That is the phase shape the calibrations were fitted around. Correcting it removes
0.26–0.29 RPO from the PP and 0.20 from the middle, and adds 0.02–0.05 at the death (run A to run B).

`vsClass` and `shape` are neutral on the same check, at 0.999–1.002.

**Fix:** weight the mean by the balls each player really faced or bowled in each phase of the edition.

## Cause 2: non-striker run-outs

Of 4,180 wickets in the replay set, 142 (3.40%) were non-strikers run out. The base `W` cell counts the
striker only, while the replay target counts every wicket. 1 / (1 − 0.034) = 1.035, which is almost
exactly `hazardCalibration`.

The sim has run-outs, but [they're always the striker](../wcdraft/src/engine/match.ts:53), and a
non-striker is never dismissed. So the "feedback" explanation in
[`model.ts`](../wcdraft/src/engine/model.ts:116) is wrong for the wicket side.

**Fix:** model the non-striker run-out directly, then set hazard back towards 1.

## Cause 3: the streak term inflates the powerplay

The [`streak`](../wcdraft/src/engine/ball.ts:113) term is the real table divided by a null built by
[shuffling outcomes across the whole innings](../wcdraft/src/analysis/situation.ts:218). That has two
effects in the PP:

- The null's outcomes come from all 20 overs, not the PP, so the ratio carries the phase difference
  as well as the serial effect.
- The first six balls are band "n/a", which plays as 1, though those slow balls are included in the
  base rate. The PP bands therefore don't average 1.

Real-ball test, predicted ÷ observed:

| Cut | Runs | Sixes |
|---|---:|---:|
| First six balls (n/a) | 0.811 | 0.576 |
| PP, 0–3 in the last six | 1.192 | 1.341 |
| PP, 4–7 | 1.099 | 1.299 |
| PP, 8–12 | 1.059 | 1.174 |

Run ratio with and without the term:

| Cut | All terms | Without streak |
|---|---:|---:|
| First-innings PP | 1.041 | 1.003 |
| Chase PP | 1.065 | 1.034 |
| Whole game | 1.019 | 1.008 |

Some of the first-six figure is opener quality, since this test has no players in it. Setness and τ
also overlap streak in those balls, so all three need checking together.

**Fix:** build the null within phase, and give the n/a band a real value.

## Multipliers that arrive at half size

Anything applied to the scoring cells before renormalising reaches run rate at about half its stated
size, because raising the cells also raises the total they are divided by. Measured:

| Input | Stated | Reaches run rate |
|---|---:|---:|
| `venueFactor` 1.1 | +10% | +5.0% |
| `venueFactor` 0.9 | −10% | −5.6% |
| `chaseUplift` 0.10 | 10% gap | 4.7% gap |

The whole product on [`ball.ts:221`](../wcdraft/src/engine/ball.ts:221) goes through this step, so
match effects, day form, venue and all calibrations behave the same way. At that rate
`scoringCalibration` of 0.89 takes only about 6% off run rate.

Effect by input:

- **Grounds:** sim ground gaps run at 0.41 of real across 47 ground-editions (r 0.71, SD 0.41 v 0.73).
  Don't double the factor to fix this. Most of the real spread is noise, and the true ground SD is
  about 0.19, so the sim's spread may already be wide enough. It needs its own measurement.
- **Chase lean:** fine in the result. Edition lean is −0.25 real and −0.28 sim, slope 0.92, r 0.89.
  Why it comes out right with `chaseUplift` at half strength hasn't been traced.
- **Day form:** the day SDs were fitted through this step, so they're correct in effect even though
  the numbers overstate it.

## Other gaps

Open, in rough order of size:

- **First-innings spread is too wide:** SD +3.3 over real, and the sweep that set it used the old
  vectors. Rerun it after the fixes.
- **Chase wickets in the PP and middle run high:** 5.2 and 5.1 per 100 against about 4.8 and 4.9 real
  with non-strikers added. My `inningsPhase` term added 0.2 of that (PP 4.9 to 5.1, middle 4.8 to 5.0),
  because `chaseScale` restores the scoring level only. The figures are 4.9 and 4.9 in run D, so the
  fixes above should remove most of it. Real-ball wicket ratios are neutral here, so why the term
  lifts wickets in play hasn't been explained.
- **Sides lose wickets early:** 44.0% of sim death balls come at 6+ down against 39.1% real, and the
  middle overs show 8.6% against 6.7%. Wicket totals match but they come sooner. This may follow from
  the chase wickets above, but that hasn't been tested.
- **Sixes under pressure are low:** 8.0 per 100 against 9.1 at a required rate of 14–16. The real-ball
  ratio is only 0.95–0.96, so most of the gap appears when the sim plays out. Cause not found. The
  sim figure is from the 2016–2024 editions and the real one from T20I and league chases, so the size
  is rough.
- **Dead chases have too few dots:** 23.6% against 26.5% at a required rate above 18.

## Replay isn't out of sample

Replay agreement is partly built in, so it can't count as proof of accuracy:

- `env.base`, extras, dismissal mix, rain, venue and `chaseUplift` come from the edition being replayed.
- Replay ratings have `projection: true` ([`rate.ts:755`](../wcdraft/src/ratings/rate.ts:755)), so thin
  cards borrow later balls. Only `validate` turns it off.
- Debutants are rated from their tournament balls.
- Batter shape and style use the whole career, [including later years](../wcdraft/src/analysis/tempo.ts:226).
- The calibrations are fitted on these same editions.

This explains why the run rate fits well. It also means Brier is flattered by an unknown amount. A
fairer test would build each edition from earlier data only.

## Inputs measured at one strength, played at another

Each was confirmed by reading the code. None has been sized.

- **Pressure, gear and found:** measured against an expected that uses full-strength batter and bowler
  ratios ([`pressure.ts:119`](../wcdraft/src/analysis/pressure.ts:119)), but the engine plays players at
  ^0.7. Part of what's left in these tables may be the player gap, and they apply to everyone.
- **Matchup:** `expected` uses a pooled base and career player rates with no year
  ([`matchups.ts:138`](../wcdraft/src/analysis/matchups.ts:138)). Era mix can leak in.
- **Shape:** it sits on top of the PP vector, which for an opener is mostly the same start-of-innings
  balls. The mean is neutral (see cause 1), so this could only widen a few players' spread.

## Comments that are wrong

| Where | It says | Actually |
|---|---|---|
| [`model.ts:50`](../wcdraft/src/engine/model.ts:50) | Situation tables are T20Is since 2016 | No date filter; the whole archive, 759,938 balls |
| [`model.ts:116`](../wcdraft/src/engine/model.ts:116) | Calibrations absorb feedback | See the first table; the 0.89 / 1.14 refit note below it doesn't correct this |
| [`model.ts:127`](../wcdraft/src/engine/model.ts:127) | Death needs restoring against the best bowlers | Death needs almost nothing |

The date error matters little: the audit's since-2016 cut alone has 670,148 balls, so most of the table
is modern. Era drift itself wasn't measured.

## Checked and fine

- **Pace/spin split:** an agent flagged it as compressed twice, once by the 2000 prior and again by
  ^0.7. That isn't a defect. The prior leaves a slope of 0.64 (95% 0.09 to 1.28), and ^0.7 brings that
  to about 0.91, close to 1.
- **Dead-chase share:** 21% of death balls in both. Sixes 7.9 v 8.0 and wickets 9.9 v 9.7 also match.
- **Set-batter shares:** within 1.4 points of real in every band and phase.
- **Edition chase lean:** see above.

## Too small to matter

- Wides are drawn per delivery at a per-legal-ball rate: 0.0320 v 0.0332, about 0.01 runs an over.
- Runs off wides beyond the first are [booked as byes](../wcdraft/src/engine/data.ts:360): sim wides
  give 0.24 runs an over in the PP against 0.27 real, and sim byes 0.25 against about 0.20. Totals are
  kept. New in this report.
- No-ball boundaries (43 fours, 19 sixes) are missing from sim four and six percentages.
- Six retired batters are counted as wickets in the situation state.

## Earlier misreads this corrects

- Every sim phase figure before 2026-11-01 read about 0.2 RPO low, because `phaseRuns` skipped wides.
  That was most of the reported −0.28 death bias.
- I then blamed that bias on lowering `deathCalibration`, which was wrong.
- I said `deathCalibration` restores death scoring, which was also wrong (row A above).
- Commit `5a2b229` repeats a Brier gain that sits inside seed noise. Its message should be reworded
  before it is pushed.

## Not measured

- How much the replay's use of its own edition flatters Brier.
- The size of each input in the section on measured strengths.
- Era drift in the situation tables.
- The cause of low pressure sixes, and of chase wickets beyond the `inningsPhase` share.
- Whether ground spread should rise at all.
- Any browser replay of these runs. All of this is engine and data work.

## Suggested order

1. Centre vectors by balls, per edition and phase.
2. Add non-striker run-outs, then take hazard towards 1.
3. Rebuild the streak null within phase and give n/a a real value.
4. Refit with a real sample size. Expect the scoring and death calibrations near 1. If either stays
   far from 1, something else is still hidden.
5. Rerun the dispersion and bat/bowl exponent sweeps, which were set on the old vectors.
6. Replace the three wrong comments with what the refit shows.
7. Add an out-of-sample replay, so later changes can be judged on it.
8. Re-measure pressure, gear and found at ^0.7 once the rest has settled.
