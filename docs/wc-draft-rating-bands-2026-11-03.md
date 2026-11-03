# World Cup Draft — rating bands, exploration (2026-11-03)

Yash: "ratings don't fully capsulate how a player plays. Southee could be 81-rated for like 6 balls,
then he most likely gets out. Maybe we should have rating bands … as granular as Cricket 26 … use
both domestic and international limited overs data."

Research only; nothing in the engine or on the cards changed. Script:
`wcdraft/scripts/research/rating-bands.mts` (about five minutes).

## What was measured

Men's T20Is and 13 leagues since 2014 (1.73 million deliveries; the Afghanistan league archive is
not extracted), and men's ODIs since 2014 (0.71 million) for the cross-format check. Cricsheet has
no domestic one-day (List A) archive, so "domestic limited overs" means the T20 leagues, which the
ratings already use.

Every attribute is a player's observed rate ÷ the expected rate for the same balls, where expected
is the mean of the same cell: source (T20I, league, ODI), year, over, wickets down, innings. 100 is
the average ball in the same spot, so a No. 10's numbers are against other balls faced at No. 10's
moments, not against openers. No opposition adjustment beyond the cell.

For each attribute:

- **Reliability.** Each player's T20 matches split alternately into two halves; the correlation
  of the two halves gives the per-ball reliability, so the reliability R at any number of balls
  follows (Spearman-Brown).
- **Bands it supports.** The separation strata H = (4G + 1) / 3 with G = √(R / (1 − R)): how many
  levels can be told apart with three standard errors between them. This is the honest ceiling on
  "how granular".
- **True spread.** The SD across players with the noise taken out, in index points.
- **ODI.** The correlation of each player's ODI and T20 values, then corrected for the noise in
  both (1 = the same skill in both formats).

## Results

| Attribute | R at 300 balls | R at 1,000 | R at 3,000 | Bands at 300 / 1,000 / 3,000 | True SD | ODI, corrected |
|---|---|---|---|---|---|---|
| **Batting** | | | | | | |
| Strike rate | 0.47 | 0.75 | 0.90 | 1.6 / 2.6 / 4.3 | 10.7 | 0.61 |
| Dismissal rate (survival) | 0.28 | 0.56 | 0.79 | 1.2 / 1.8 / 2.9 | 18.2 | 0.61 |
| Six hitting | 0.55 | 0.80 | 0.93 | 1.8 / 3.0 / 5.0 | 40.2 | 0.82 |
| Four hitting | 0.28 | 0.56 | 0.79 | 1.2 / 1.8 / 3.0 | 14.9 | 0.52 |
| Rotation (1s–3s) | 0.48 | 0.75 | 0.90 | 1.6 / 2.7 / 4.4 | 9.0 | 0.65 |
| Dot rate | 0.50 | 0.77 | 0.91 | 1.7 / 2.8 / 4.6 | 11.6 | 0.49 |
| Start (first 10 balls), SR | 0.56 | 0.81 | 0.93 | 1.8 / 3.1 / 5.1 | 11.9 | 0.66 |
| Set (ball 11 on), SR | 0.48 | 0.75 | 0.90 | 1.6 / 2.7 / 4.4 | 8.7 | 0.59 |
| SR v pace | 0.49 | 0.76 | 0.90 | 1.6 / 2.7 / 4.4 | 11.0 | 0.63 |
| SR v spin | 0.54 | 0.79 | 0.92 | 1.8 / 2.9 / 4.9 | 11.5 | 0.64 |
| SR, powerplay | 0.60 | 0.83 | 0.94 | 2.0 / 3.3 / 5.5 | 13.7 | 0.56 |
| SR, death | 0.46 | 0.74 | 0.90 | 1.6 / 2.6 / 4.2 | 8.4 | (small sample) |
| **Bowling** | | | | | | |
| Economy | 0.31 | 0.60 | 0.82 | 1.2 / 2.0 / 3.1 | 7.6 | 0.63 |
| Wicket rate | 0.06 | 0.18 | 0.39 | 0.7 / 1.0 / 1.4 | 8.1 | 0.44 |
| Dot rate | 0.41 | 0.70 | 0.87 | 1.4 / 2.3 / 3.8 | 9.1 | 0.48 |
| Boundaries conceded | 0.33 | 0.62 | 0.83 | 1.3 / 2.0 / 3.3 | 13.7 | 0.84 |
| Sixes conceded | 0.20 | 0.45 | 0.71 | 1.0 / 1.5 / 2.4 | 19.0 | 0.70 |
| Bowled + lbw rate | 0.17 | 0.40 | 0.67 | 0.9 / 1.4 / 2.2 | 28.3 | 0.79 |
| Wides + no-balls | 0.56 | 0.81 | 0.93 | 1.9 / 3.1 / 5.1 | 43.3 | 0.88 |
| Economy, powerplay | 0.35 | 0.64 | 0.84 | 1.3 / 2.1 / 3.4 | 8.4 | 0.32 |
| Economy, death | 0.22 | 0.49 | 0.74 | 1.0 / 1.6 / 2.6 | 5.0 | (small sample) |

How many balls sit behind a card: the shown batting cards in the 10 editions rest on a median 305
T20I and league balls (quartiles 70 and 943); bowling cards on 455 (138 and 1,100).

## What it says

1. **Cricket 26's granularity is not in the data.** At a typical card (300–450 balls) no attribute
   separates even two levels with confidence, and at 1,000 balls the best support about three.
   Only long careers (3,000+ balls: Kohli, Maxwell, Russell, Bumrah) support four or five. A
   15-step scale would be mostly noise for almost every card. Cricket 26 can be that fine because
   its numbers are hand-set by designers, not measured.
2. **Southee's case is already in the engine.** "81 for six balls, then out" is a high six rate with
   a high dismissal rate. The engine plays every player through per-phase outcome vectors (dot,
   1, 2, 3, 4, 6, out), so it plays that pattern now; the single card number hides it. His T20
   batting since 2014 (387 balls), shrunk for the thin record: sixes 120 (72nd percentile), but out
   107 (35th percentile, the shakiest number here at ±15). Bands would show what the engine
   already does; they would not change a match.
3. **A rating that changes within an innings is weak as a personal trait.** Start and Set are each
   stable, but mostly because they are the same batter; the gap between them did not hold out of
   sample in the earlier test (r 0.06–0.24, engine refit). The engine plays it, heavily shrunk
   (±3–5%).
4. **Wickets are mostly luck for a bowler.** Wicket rate barely repeats (0.18 at 1,000 balls).
   Economy, dots and boundaries conceded are the skill. A "wicket-taker" band would mislead.
5. **The steadiest things are style, not quality:** six hitting, dots and rotation (batting); wides
   and dots (bowling).
6. **ODIs help for some things, not others.** Six hitting (0.82), boundaries conceded (0.84) and
   wides (0.88) carry over almost whole; strike rate, survival and economy about 0.6; dots (0.5)
   and powerplay economy (0.3) poorly. The ratings now use ODIs as one flat weak prior. Weighting
   ODI evidence by attribute would help the thin cards, 2007 and 2009 most.
7. **Two candidates are not played by the engine per player**: wides/no-balls and bowled + lbw
   come from the ground and phase, not the bowler (`match.ts`). Wides is the most reliable bowling
   attribute measured (and the most spread: 43 points). Showing either needs engine work first.

## Worked examples

Shrunk to the population by their reliability at the player's own balls; ± is one standard error.
100 = the average ball in the same spot; percentile among players (higher = better at it).

**Rashid Khan, batting (1,178 balls)**, the Southee pattern on three times the balls. Sixes 126
(77th), start 110 (79th), but out 118 (16th), rotation 85 (4th), dots 110 (18th): swings early
and often, and does not last.

**Rashid Khan, bowling (8,347).** Economy 86 (97th), dots 120 (99th), boundaries conceded 78
(94th), bowled + lbw 204 (100th), wides 47 (88th). Wickets 107 (79th), one of the few long
careers where the wicket rate is clear of the noise.

**Andre Russell, batting (4,993 balls).** Strike rate 120 (97th). Sixes 210 (100th), fours 110,
rotation 71 (0th), dots 125 (1st): all or nothing. Survival 95 (61st). Death 120 (98th).

**Glenn Maxwell, batting (5,995).** Strike rate 120 (97th). Sixes 158 (94th), fours 126 (96th),
rotation 92 (18th). Out 107 (36th). Spin 123 (98th) against pace 116.

**Virat Kohli, batting (7,273).** Strike rate 102 (58th) but out 63 (98th: hard to dismiss).
Rotation 116 (96th), dots 86 (88th), sixes 85 (39th). Death 112 (87th). Pace 105, spin 96.

**Jasprit Bumrah, bowling (5,611).** Economy 86 (96th), dots 113 (94th), sixes conceded 67 (95th),
death 90 (98th). Wickets 96 (27th): the luckless number, as above.

**Mitchell Starc, bowling (2,667).** Economy 103 (33rd), boundaries conceded 110 (20th), but
bowled + lbw 134 (88th) and wides 140 (16th): attacks the stumps, sprays some.

**Tim Southee, bowling (3,801).** Economy 102 (38th), dots 97, bowled + lbw 71 (15th), wides 90.

## Options for Yash

1. **Attribute bars on the full card, display only.** Batting: Power (sixes and fours), Survival,
   Rotation, Start, v Pace, v Spin, Death. Bowling: Economy, Dots, Boundaries, Powerplay, Death.
   Each shrunk by its reliability, on the 40–99 scale, five steps at most, and greyed when the
   evidence is thin (R under 0.5). Honest by construction: every bar is a part of the vectors the
   engine plays. No wickets bar.
2. **Trait badges only where confident**, like the batting style tags: "Six hitter", "Hard to
   dismiss", "Rotator", "Spin hitter", "Squeezer", "Hard to hit". Shown only when the shrunk value
   is clear of average by two standard errors.
3. **Engine, measure first:** per-bowler wides and no-balls (stable and large), and ODI evidence
   weighted per attribute for thin cards. Each would go through the replay eval before landing.

Not recommended: a 15-level scale, a wicket-taking attribute, or shot and delivery skills (drives,
yorkers, slower balls): Cricsheet has no shot, line, length or speed data.
