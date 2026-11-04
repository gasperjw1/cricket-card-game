# Bowling roles: phases, tags and captains (2026-11-04)

Yash's question: should a bowler carry a ratings penalty in a phase he rarely bowls, with the card
showing an overall rating plus New ball and Death tags, and should a captain short of specialists
arrange his remaining best bowlers to fill those overs? Four measurements, then a decision.

Scripts:
- `wcdraft/scripts/research/rare-phase.mts`: performance in a rare phase, men's T20Is since 2012.
- `wcdraft/scripts/research/dot-gap.mts`: the split "bowler × phase × usage", real World Cup
  balls against simulated ones.
- `draft/scripts/bowling-roles.mts`: play-test of greedy drafted elevens.
- `wcdraft/scripts/research/captain-phase.mts`: captains' habits.

**Usage** throughout is a bowler's share of his overs in a phase ÷ that phase's share of an innings
(powerplay 6/20, middle 9/20, death 5/20), so 1.0 is neutral. The bands are rare (under 0.5), usual
(0.5–1.25) and regular (1.25 or more). Axar Patel's powerplay usage is 0.93 in 2022, 0.99 in 2024
and 0.67 in 2026: usual, never rare. That is why the engine's usage charge costs him almost nothing
with the new ball (0.02 runs in 2024).

## 1. Does a bowler do worse in a phase he rarely bowls?

Each bowler's spell in one phase of one match is set against a prediction: the year's rate for that
phase × his own level in the other two phases (this match left out). So the prediction uses nothing
from the phase being tested.

Economy, actual ÷ expected, men's T20Is since 2012 (±1 SE, clustered by spell):

| Usage of the phase | Powerplay | Middle | Death |
|---|---|---|---|
| under 0.25 | 1.13 ±0.04 | 1.08 ±0.03 | 0.98 ±0.04 |
| 0.25–0.5 | 1.06 ±0.03 | 1.03 ±0.01 | 0.94 ±0.02 |
| 0.5–0.8 | 1.01 ±0.02 | 1.02 ±0.01 | 0.98 ±0.01 |
| 0.8–1.25 | 1.04 ±0.01 | 1.01 ±0.01 | 1.01 ±0.01 |
| 1.25–1.75 | 0.97 ±0.01 | 0.98 ±0.01 | 1.00 ±0.01 |
| 1.75+ | 0.92 ±0.01 | 1.02 ±0.01 | 1.01 ±0.03 |

- **Powerplay: yes.** A man who rarely takes the new ball goes 6–13% dearer than his level
  elsewhere, and a regular 3–8% cheaper. The same holds within spin (1.12 down to 0.90) and within
  pace (1.05 down to 0.93), in 2012–18, in 2019 onward, and at World Cups (regulars 0.88).
  Rare-powerplay spinners give up 19% more fours and 48% more sixes.
- **Middle overs:** mild. Seamers who rarely bowl there are 3–8% dearer.
- **Death: no, the other way.** Spinners at the death are 6–9% *cheaper* than their middle-overs
  level, in every usage band (dots ×1.06–1.09, fours ×0.82). The likely reason is selection: a
  captain bowls a spinner at the death on the days it works. A flat out-of-phase penalty would be
  wrong here.

### Does the engine already carry it?

A rating shrinks a thin phase toward the bowler's pooled vector (300 balls of prior). So a rare
phase is rated at roughly his level elsewhere, which is exactly the prediction above. In the World
Cup replays the sim duly over-rated rare new-ball seamers (2.6 points too many dots) and
under-rated every spinner at the death (2–3 points too few), whatever his usage.

The measured cells went into the engine behind a switch (`phaseUsagePrior`, `phaseUsageCells`),
weighted by the prior's share of each phase vector, 300 ÷ (300 + his balls there):
- Powerplay spin dots moved on to real (+0.7 → +0.1) and spin death runs a ball nearer (1.452 →
  1.406, real 1.375).
- Spin death dots stayed 1.9 short, and the nine-edition Brier was 0.1877 against 0.1862 without
  it.

**Off for now:** it does not yet earn its place in match results. The right home is the ratings, as
the phase prior's centre, so the card's phase numbers would show it too.

## 2. Who bowls when: the bigger error

The usage split in the replays showed the allocation, not the ratings, was most of the problem.
Seamers who usually open bowled 13.3% of all balls in the powerplay (real 20.6%), and spinners who
rarely open 3.8% (real 0.9%). The powerplay spread penalty (4.5 a further over) spread the new
ball past the side's other seamers to its spinners.

The fix uses the bowler's own usage both ways in the powerplay and at the death: a charge below his
phase's share (weight 3) and a pull above it (weight 4, not in the middle overs). The spread
penalty drops to 3. Any lower and openers spend their quota early: at 1.5, even with a 2-run
opener death bonus, only 31% of overs 19–20 went to an opener (real 43%). The sixth-bowler charge
is 1.2.

| Share of all balls (World Cup replays) | Real | Before | Now |
|---|---|---|---|
| Seamers who usually open, powerplay | 20.6 | 13.3 | 19.0 |
| Spinners who rarely open, powerplay | 0.9 | 3.8 | 1.0 |
| Seamers who usually bowl it, death | 9.1 | 6.5 | 8.7 |
| Spinners who rarely bowl it, death | 1.3 | 3.0 | 1.5 |
| Spinners who usually bowl them, middle | 23.8 | 19.2 | 23.4 |
| Summed error, 18 cells | | 30.6 | 10.6 |

Other checks:
- 6.20 bowlers a full innings (real 6.20); 42.9% of overs 19–20 to an opener (real 43%).
- Brier 0.1871 with the coach rotation retuned to match (0.1865 before that), against 0.1860
  (seed noise is about 0.003): match results are no better predicted. Death overs score 0.10 an
  over high against +0.02 before, mostly in the first innings (1.55 runs a ball against 1.52).
  Followed up in refit item 20. The first-innings excess was the innings × phase term at the death
  counting the innings gap twice; it is now at weight 0.4. The rest of the eval's death figure is
  within the real data's noise (±0.13 an over).
- Coach rotation scale 3 (was 2.5): with each man held to his phases, 2.5 gave 0.88 bowlers per
  unit of rotation and 3 gives 0.99.
- Rarity (1000 greedy): unbeaten 1.7%, champion 6.1% (1.7% and 5.7% after refit item 20).
- Every phase × pace/spin cell is within 0.8 dot points of real except spinners at the death
  (−2.0, was −2.8).
- Bowlers' dot rates are more spread out: 5.1 points against 6.1 real, was 3.9.

## 3. Play-test: drafted elevens short of specialists

300 greedy drafts × 4 matches against real default elevens of the edition. Bowlers count as new-ball
or death men at usage 1.25 or more.

| Powerplay balls bowled by the side's new-ball men | Before | Now |
|---|---|---|
| Drafted eleven with 1 new-ball man | 18.3% (about 1 over of 6) | 30.9% (about 2) |
| With 2 | 34.2% | 54.2% |
| With 3+ | 56.2% | 76.5% |
| Real elevens (real World Cups: 65%) | 47.8% | 66.9% |

| Death balls bowled by the side's death men | Before | Now |
|---|---|---|
| Drafted eleven with 1 death man | 22.5% | 29.4% |
| With 2 | 40.6% | 53.0% |
| Real elevens (real World Cups: 42%) | 33.3% | 43.5% |

A side with one new-ball bowler now gets two powerplay overs from him and fills the rest from its
best remaining options. Spinners take most of the rest: 55% of the powerplay with one new-ball man,
37% with two. Win rates by count are not read here: greedy drafts with no new-ball men are the
batting-heavy best-card sides, so the count is confounded with strength.

## 4. Tags in the engine, or the usage itself?

The same allocation was run reading usage snapped to what a card tag would say. One version used
three levels (rare / usual / regular); the other used a yes/no New ball or Death tag, with the
middle overs untagged.

| Engine reads | Summed error, 18 cells | Rare spinners in the powerplay (real 0.9) | Real elevens' powerplay to new-ball men (real 65) | Brier |
|---|---|---|---|---|
| The usage share | 10.6 | 1.0 | 66.9% | 0.1865 |
| Three-level tag | 17.1 | 1.9 | 61.9% | 0.1872 |
| Yes/no tag | 21.5 | 4.7 | 60.6% | 0.1864 |

Yes/no tags lose the Axar case. "No New ball tag" puts a man who opens one match in three with one
who never does, so pure middle-overs spinners start opening. **The engine keeps the share.** A tag on
the card can summarise it (New ball at powerplay usage 1.25+, Death at death usage 1.25+). The
honest version shows the share itself, a three-segment bar of where his captains bowled him, which
is exactly what the engine reads.

## 5. Captains' phase habits

Men's T20Is since 2010. A match goes to the tenure covering its year whose captain is in the eleven
(tenures are whole years and overlap). Against the year's mean for the same options, 19 captains
with 30+ innings show stable habits: split-half correlation 0.80 for spin in the powerplay, 0.68
for death trust, 0.65 for bowlers used.

That residual still carries who each captain *had*: Sammy's +21 points of powerplay spin is mostly
Samuel Badree, whose own shares the engine already reads. The fair test is the same bowlers under
different captains of the same side:

| Habit, same bowlers under other captains | Captains | Split-half r | Spread |
|---|---|---|---|
| Spinners' share in the powerplay | 26 | 0.06 | 2.7 points (noise) |
| Seamers' share in the powerplay | 35 | 0.66 | 3.1 points |
| Seamers' share at the death | 35 | 0.46 | 2.1 points |
| Spinners' share at the death | 26 | 0.56 | 1.9 points |

The captain's own habit is small, 2–3 points of a bowler's balls. Some of even that is a bowler's
career stage, since the same bowler under a later captain is older: young seamers open and move to
the death later. Spin in the powerplay is not a captain habit at all. **Not added.** If it is wanted
later, the seamers' powerplay share is the only candidate, and it would need a career-stage control
first.

## Decision

- **Adopted:**
  - Usage-led allocation (`usageWeight` 3, `usageBoost` 4, `powerplayHoldPenalty` 3,
    `extraBowlerPenalty` 1.2, `openerDeathBonus` 0.5).
  - The engine reads each bowler's own phase shares.
- **Measured, kept off:**
  - The rare-phase performance cells (`phaseUsagePrior`): real in the powerplay, reversed at the
    death; to go into the ratings' phase prior later.
  - Tags in the engine (`usageTags`).
  - Captain phase habits.
- **For the cards (Yash's call):**
  - Overall bowling rating plus New ball / Death tags drawn from the same shares, or the
    three-segment usage bar.
  - Either is honest, because the engine plays the share behind both.
