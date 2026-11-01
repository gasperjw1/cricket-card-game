# World Cup Draft — second audit, 2026-11-01 (fresh eyes)

A review of the work done on `wcdraft/gazette` between the 2026-10-30 session log and today (four
commits plus the uncommitted build), and of the first audit
(`wc-draft-engine-calibration-audit-2026-11-01.md`). Everything here was checked against the source
or measured on the built data; where a figure is the first audit's and not re-measured, it says so.
No engine code was changed. Tests on the uncommitted build: 52 wcdraft, 32 draft, all passing.

## 1. The first audit holds

All three root causes are in the code exactly as described:

- `centreOnCohort` (`engine/data.ts`) weights each player by `member.matches`, the same weight in
  every phase.
- Every simulated run out dismisses the striker (`engine/match.ts`, `drawDismissal`); a non-striker
  is never out.
- The streak null shuffles outcome labels across the whole innings (`analysis/situation.ts`,
  `addMatch`), and the first six balls are the "n/a" band that plays as 1.

My own measurements agree with its sizes and in two places make them sharper:

**Centring.** Mean of the engine's centred `battingRel`, weighted by matches (what the engine
assumes is neutral) against weighted by the balls each player actually faced in the window:

| Edition | Phase | Runs per ball, ball-weighted | Hazard, ball-weighted |
|---|---|---:|---:|
| 2024 | PP | ×1.103 | ×0.938 |
| 2024 | middle | ×1.070 | ×0.912 |
| 2024 | death | ×1.035 | ×0.950 |
| 2016 | PP | ×1.108 | ×0.944 |
| 2016 | middle | ×1.070 | ×0.913 |

Bowling runs the other way at ×0.97 to ×0.99. The batters who face the balls are 7–11% better than
the "average" the engine centres on, and 5–9% harder to dismiss. The base rates are ball-weighted
by construction, so this is pure bias, before any calibration.

**Streak null.** Real ÷ null for innings 1, powerplay, 0–2 down, by band:

| Band | 0–3 | 4–7 | 8–12 | 13+ |
|---|---:|---:|---:|---:|
| Runs ratio | 1.040 | 1.039 | 1.061 | 1.058 |

Every band is above 1, so the term adds 4–6% scoring to every powerplay ball after the first six,
not just the hot ones. The cause is the n/a band: 21,256 of the context's 119,493 balls, scoring at
0.79 of the base, sit in the denominator and are then played as 1. At the death the same ratios run
0.93–1.03, roughly neutral.

## 2. What the first audit understates

**Mean bias hides edition bias.** Its headline table averages sim − real over editions. Edition by
edition (60 sims, seed 1, build as it stands) the picture is less tidy:

| Edition | RPO sim / real | PP | Middle | Death | Balls per wicket | 1st-inn SD sim / real |
|---|---:|---:|---:|---:|---:|---:|
| 2007 | 7.97 / 7.99 | +0.07 | −0.08 | 0.00 | 17.3 / 17.0 | 34.8 / 36.9 |
| 2010 | 7.62 / 7.63 | −0.02 | −0.01 | +0.10 | 17.3 / 17.2 | 32.6 / 28.7 |
| 2012 | 7.78 / 7.65 | +0.16 | +0.09 | +0.10 | 19.1 / 18.9 | 33.3 / 27.0 |
| 2014 | 7.59 / 7.60 | +0.07 | −0.05 | −0.07 | 17.7 / 18.1 | 34.0 / 31.7 |
| 2016 | 7.90 / 7.86 | +0.02 | +0.09 | +0.02 | 18.3 / 17.8 | 33.8 / 27.8 |
| 2021 | 7.54 / 7.43 | +0.12 | +0.09 | +0.04 | 18.5 / 18.6 | 34.9 / 37.2 |
| 2022 | 7.53 / 7.52 | +0.05 | +0.01 | +0.02 | 17.4 / 17.2 | 34.5 / 25.3 |
| 2024 | 6.90 / 7.13 | +0.08 | −0.40 | −0.31 | 16.5 / 16.6 | 36.7 / 43.1 |
| 2026 | 8.89 / 8.74 | +0.33 | +0.05 | +0.14 | 16.1 / 17.2 | 47.0 / 35.7 |

2024 (the edition most played in the game) is 0.4 an over low in the middle and 0.3 low at the
death; 2026 is 0.33 high in the powerplay and loses a wicket every 16 balls against 17.2 real. The
first-innings SD is not "+3.3": it is +9 in 2022, +11 in 2026 and −6 in 2024. A single
`scoringCalibration` cannot fix an edition-shaped error, and the audit's run D numbers are also
edition means.

**The five new state terms do not earn their place yet.** Same nine editions, 60 sims, seed 1,
with `inningsPhase`, `pressure`, `gear`, `found` and `shape` at exponent 0 (squeezer left on):

| | Mean Brier | Editions better | Mean RPO shift |
|---|---:|---:|---:|
| Build as it stands | 0.1987 | — | — |
| New terms off | 0.1963 | 5 of 9 | −0.05 |
| Calibrations at 1 | 0.1989 | 4 of 9 | +0.46 |

Switching the terms off makes Brier slightly better on average and run rate 0.05 lower everywhere.
At 60 sims that difference is noise, which is the point: the terms were added, the calibration was
refit around them (0.94 → 0.89), and the result is no more predictive. The first audit says they
were measured at full player strength and played at ^0.7; this shows the net effect in play.

**The run-out framing is slightly off.** The sim does produce run outs: 5.4% of dismissals in 2024
are drawn as "run out" from the ground's fingerprint, all charged to the striker, and
`hazardCalibration` already restores the total wicket count. What is wrong is *who* is out and
*when*: a set batter at the non-striker's end can never go, so set batters survive a little too
well, and the striker carries a hazard that is partly the non-striker's. The fix is the same one the
audit proposes; the stated size (1.035) is right for the count, not for the survivorship effect,
which nobody has measured.

## 3. New findings

**Hindsight in the ratings the engine plays with.**

- `MODEL.projection` lets any low-sample or no-record skill borrow balls from `laterEditions`, and
  that window starts at the edition's own window start and runs 60 months (`pipeline/build.ts`,
  `addMonths(w.start, MODEL.projection.months)`). It is on by default in `ratings:build`, so the
  committed ratings, every replay and every calibration run contain the tournament being replayed
  plus the next five years for exactly the players whose cards are least known. Only `validate`
  turns it off. The replay Brier is therefore flattered by an amount nobody has measured, and the
  calibration constants were fitted on leaked cards.
- Batting `style` and `shape` pull a three-year window toward a career that includes later balls
  (`analysis/tempo.ts` says so in its header), and `shape` is an engine term.
- For the draft game this is also a design question, not just a measurement one: a "2007 Rohit"
  card that borrows 2008–2012 balls is no longer an edition-locked card, which was the premise.

**The Batting styles tab is circular.** `style-results.json` reports Aggressors adding +15 runs
per 100 balls at World Cups and Anchors −4.9. Styles are defined by first-10 boundary rate and
later strike rate, from careers that include those same World Cups, so the table says that players
who score fast score fast. It should not be shown as a finding.

**Setness is not player-adjusted while its neighbours are.** `pressure`, `gear` and `found` remove
the batter's and bowler's own levels before measuring; `setness`, `streak`, `ballInOver` and
`chaseDots` do not. Raw setness for innings 1, middle overs, 0–2 down: 0–2 balls faced ×0.70 runs,
25+ balls ×1.16 runs and ×1.15 hazard. Part of the 25+ figure is that better batters reach 25 balls,
and the engine then gives that to every batter who gets there on top of his own rating. The
pressure module already has the machinery to measure these terms the same way.

**`inningsPhase` adds chase wickets.** Its hazard cells are ×1.034 (PP) and ×1.037 (middle) for
the second innings, which is most of the +0.3 per 100 balls the first audit found in chase wickets
and could not place. The term is also unshrunk, against the file header's claim.

**Calibration grid is a local search.** `cli/calibrate.ts` offers scoring 0.88–0.90 and death
1.13–1.15, so a refit cannot find that both belong near 1.

## 4. What genuinely improves the engine

Real fixes, verified in the source, that should be kept whatever happens to the rest:

- Bowler balls were overs × 6; now legal balls (`countLegalBalls`), so part-overs and economy
  are right.
- A no-ball counts as a ball faced; a wide does not. Off a no-ball or free hit only a run out is
  possible. Both were wrong before.
- Wides are booked into `phaseRuns`, so phase run rates include them and the −0.2 RPO reading
  error the first audit describes is gone.
- Extras per phase (`env.extras[ph]`): death overs get their real wide and no-ball rates.
- One keeper per side who does not bowl, chosen from stumpings in the edition, then career, then a
  non-bowling batter. I checked every 2024 and 2016 CPU side: Wade, Buttler, Pant, Dhoni, de Kock,
  Rizwan, Pooran and so on, no misfires.
- Named captains from `world-cup-captains.csv`, with the captaincy noise still only from rated
  tenures.
- `depthPenalty` in allocation: neutral on Brier (the commit message overstated it), but it stops
  drafted sides spreading overs to a weak sixth bowler by noise, which is what the game needs.
- The pace/spin split rebuild: counted once (form was inside career before), contrasted within
  each source, ODI only under 60 T20 balls, exposure-weighted mean of 1, bowler labels for 98% of
  balls. The old split was about four times too wide. This is a real accuracy gain.
- Coach intent at 0.06 / 0.05, the measured size, instead of 0.15.
- Toss no longer contradicts the batting order on replayed pairings; player of the match keyed by
  team and person; no award in a no-result.
- Product work (Gazette, scoreboard, display names, player-ratings tab, phone layout) is outside
  this audit but is what makes the sim legible.

Plausible but unproven: `inningsPhase` fills a real gap (the base pools both innings) and would be
worth keeping once shrunk and re-measured; `pressure` is a better-built replacement for the old
chase table once it is measured at ^0.7; `found` is small (exponent 0.4) and harmless; `gear`,
`shape` and the hand-set `squeezer` (1.04 / 0.98 by decree) have no evidence behind them in play.

## 5. Suggested order, amended

The first audit's order stands, with three additions marked *:

1. *Turn projection off for replays and calibration (keep it as an opt-in for cards, and decide
   whether edition-locked cards should borrow later balls at all).
2. Centre vectors by balls, per edition and phase.
3. Non-striker run outs; hazard toward 1.
4. Streak null within phase, with the n/a band given its real value.
5. *Hold the five new terms at exponent 0 through the refit; widen the calibration grid to include 1.
6. Refit at 200 sims, two seeds; expect scoring and death calibrations near 1.
7. Rerun the dispersion and exponent sweeps.
8. *Re-measure setness, streak, ballInOver and chaseDots with the pressure module's player
   adjustment; then re-measure pressure, gear and found at ^0.7 and switch on what survives.
9. Out-of-sample replay (each edition from earlier data only) before any further term is added.
10. Remove the Batting styles tab or re-state it as a description, not a result.

Scripts used: `scratchpad/engine-checks.mts` (centring weights, keepers, squeezers) and
`scratchpad/terms-ab.mts` (nine-edition A/B at 60 sims; note `setEngineOverrides` accumulates, so
defaults must be restored between runs).
