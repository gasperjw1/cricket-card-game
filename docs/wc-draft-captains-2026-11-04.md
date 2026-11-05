# Captains: what they change, in the sim and in real cricket (2026-11-04)

Yash asked whether captains should be tagged, whether one should be compulsory, whether "captain IQ"
(Bumrah held for the 18th over of the 2024 final, Arshdeep the 19th, Hardik the 20th) should move
results, whether the six-bowler habit belongs to the captain rather than the coach, and whether the
captain, not the user, should set a batting order that changes from match to match (India 2024
sending Axar in ahead of Rinku and recognised batters).

Scripts:
- `wcdraft/scripts/research/captain-ab.mts`: the sim, one side's captain z set from −2 to +2.
- `wcdraft/scripts/research/captain-effects.mts`: men's T20Is since 2010, captain against coach.

## 1. In the sim today

The engine's only captain effect is the noise on bowling choices (`captainNoiseSlope` 0.3,
`allocation.ts`). Each side's real eleven played its real tournament with the captain's z set to
−2, −1, 0, +1 and +2, 300 tournaments an arm on common seeds.

| Side | Wins a tournament, −2 → +2 | Runs conceded an over, −2 → +2 |
|---|---|---|
| India 2024 | 4.82 → 4.89 (+0.07 ± 0.10) | 6.687 → 6.688 |
| Australia 2021 | 3.07 → 3.15 (+0.09 ± 0.08) | 7.613 → 7.542 |
| England 2022 | 3.97 → 3.93 (−0.04 ± 0.08) | 7.631 → 7.635 |
| Scotland 2022 | 1.62 → 1.54 (−0.08 ± 0.08) | 7.501 → 7.541 |

Pooled: +0.01 ± 0.05 wins a tournament. The captain rating does nothing measurable in the sim.

## 2. In real T20Is

Men's T20Is since 2010. A side's captain is the tenure covering the year whose captain is in the
eleven; its coach is from `coaches.csv`. Each measure is a residual against its year. A two-way fit
splits it between captain and coach, which only the changes of one with the other in place can
separate. A trait counts as real only if it repeats: the split-half correlation across captains
with 15+ rows in each half. With 15–30 captains, a split-half r has a standard error of about 0.2.

| Measure | Captain, coach held: r, true spread | Coach, captain held: r, true spread |
|---|---|---|
| A. Wins beyond the Elo expectation | −0.07, none | 0.13, 0.2 wins per 10 matches |
| B. Bowlers used an innings | 0.58, 0.09 bowlers | 0.83, 0.12 bowlers |
| B. Death overs to an opening bowler | 0.71, 2.9 points | 0.81, 3.6 points |
| B. Death overs to the day's two best bowlers | 0.77, 3.3 points | 0.81, 4.2 points |
| B. Hooked after an over of 14+ | 0.02, 0.8 points | 0.30, 3.4 points |
| C. Runs conceded beyond the bowlers' own rates | 0.06, 0.9 runs an innings | −0.12, none |
| E. Matchup runs from the bowler chosen | 0.60, 0.14 runs an innings | 0.76, 0.14 runs an innings |
| E. The part from reading the batters in | 0.59, 0.04 runs an innings | 0.13, 0.02 runs an innings |
| D. Nos. 3–7 not the side's usual man that year | 0.45, 2.9 points | 0.48, 3.0 points |
| D. Runs scored beyond the batters' own rates | 0.66, 2.9 runs an innings | 0.10, 1.0 runs |

What these say:
- **A. Results.** The captain rating the game uses (wins above expectation, `captaincy.ts`) does
  not repeat from one half of a captain's matches to the other. It is noise.
- **B. Bowling habits.** These are real and repeat. They belong to the side under both captain and
  coach, since each shows them with the other held. Their size is small:
  - A captain one spread above another gives his best two bowlers 3.3 points more of the death
    overs, or 0.17 overs an innings.
  - A death over from the day's best two goes for 8.56 against 9.36 from the rest, a gap of 0.79.
  - So the habit is worth about 0.13 runs an innings. Balbirnie, the most extreme at +10 points,
    gains about 0.4 runs.
- **Hooking** a bowler who has just been hit is not a captain habit.
- **C. Captain IQ in results.** Bowlers concede no less than their own records under any captain
  that repeats. That covers fields, plans and within-phase choices.
- **E. Matchups** (added 2026-11-05: does a captain bowl the right type at the right batter?).
  - Method: at the start of each over, the chosen bowler's matchup edge against the two batters in
    (hand × bowler class × phase, from `matchups.json`, shrunk as the engine shrinks it), less the
    mean edge of the bowlers who could have bowled that over. A placebo keeps each pick but uses
    the batters from the innings' other overs of the same phase. What the placebo gets is the
    part of the edge that comes from the phase and the roster alone.
  - Over 32,677 overs, the chosen bowler beats the available mean by 0.037 runs an over, about
    0.7 runs an innings. The placebo gets 0.028 of that. Three-quarters of the edge is spinners
    bowling the middle overs to a mostly right-handed batting line-up, not a read of who is in.
  - Reading the batters in is worth about 0.009 runs an over, 0.17 runs an innings, for every
    side alike. Captains differ in it by 0.04 runs an innings.
  - The room was there: the best and worst bowlers available differ by 0.37 runs an over on
    matchup alone. But the edges are small (×0.93 to ×1.07 on scoring), and other things decide
    a bowling change: overs left, phase plans, form.
  - The engine already reads the batters in for every side: allocation scores each bowler through
    the ball model, matchup term included.
- **D. Batting order.**
  - Moving the order is a repeatable habit, again shared by captain and coach. India under
    Suryakumar Yadav is +8.7 points of Nos. 3–7 changed; India under Dhoni is −8.4.
  - Real World Cup sides send a man other than the usual one into Nos. 3–8 at 25–40% of entries,
    more often when a wicket falls at the death (`lineup-deviation.json`).
  - Sides that move the order more do not score more (r 0.14 across 107 captains).
  - "Runs scored beyond the batters" repeats with the captain, but it looks like team eras (Sammy's
    West Indies, Dhoni's and Suryakumar's India, Morgan's England above; Finch, Pooran, Balbirnie
    below), not captaincy. It cannot be separated from batters improving faster than their records.

### F. After an early collapse (2026-11-05)

Yash: does a captain hold the finishers back after an early collapse and send in a bowler who can
bat to steady it? Script: `wcdraft/scripts/research/collapse-response.mts`, men's T20Is since 2010.

- **Method.** A collapse is 3 down by the end of over 6, 4 down by over 8, or 5 down by over 10.
  Each entry at Nos. 3–8 is read against the side-year's usual positions:
  - in order;
  - a batter sent ahead of a man usually higher;
  - a bowler (usually No. 8 or lower) sent ahead;
  - a finisher held: a man who usually bats 6–7 passed over.
- **What sides do.** They don't change course after a collapse; if anything they keep to the order.

  | Entries at 3–5 down | In order | Batter ahead | Bowler ahead | Finisher held |
  |---|---|---|---|---|
  | After a collapse, all T20Is (3,107) | 84.3% | 12.0% | 3.8% | 9.7% |
  | Otherwise (11,604) | 82.4% | 13.9% | 3.7% | 8.9% |
  | After a collapse, World Cups (306) | 89.2% | 8.8% | 2.0% | 7.5% |
  | Otherwise, World Cups (1,137) | 84.7% | 12.7% | 2.6% | 7.9% |

  A bowler sent in to steady things is rare (2–4% of entries) and no more common after a collapse.
- **Does it pay?** First innings, runs from the entry to the end against entries at the same
  wickets down and over:
  - Raw, going out of order looks costly: −9 runs for a batter sent ahead, −12 for a bowler.
  - Within the side-year (team strength taken out), that is about nothing: −1.7 ± 1.5 and
    +0.9 ± 2.1. Weaker sides improvise more; improvising doesn't cost them.
  - Holding a finisher back is +2.8 ± 1.4 runs within the side-year. That is suggestive, at
    about two standard errors.
- **Is it the captain's?**
  - Holding a finisher after a collapse repeats with the captain: r 0.57 over 19 captains, a
    spread of 3.4 points. It doesn't repeat with the coach (r 0.08). With 19 captains the r has a
    standard error of about 0.2.
  - Sending anyone ahead at 3–5 down repeats with both: captain r 0.53 (2.8 points), coach 0.67
    (3.7 points).
  - Size: a captain one spread above another holds a finisher in 3.4 more collapses in 100, at
    +2.8 runs each, which is about 0.1 runs a collapse.

### G. Six bowlers (2026-11-05)

Yash: a "Six-bowler rotation" coach requires six bowlers in the draft, and the captain uses
them. Script: `wcdraft/scripts/research/six-bowler.mts`, real World Cup elevens 2012–24 with full
bowling innings (315), counted by the draft's rule (`bowls()`; the keeper not counting).

- **Real elevens already have six who bowl.** 90% of all elevens do, and 88% under six-bowler
  coaches. The coach doesn't pick more bowlers; he uses more of those he has. Sides with six who
  bowl used 6.25 a full innings under six-bowler coaches, against 5.91 under the rest (12 and 82
  elevens).
- **The tag needs six to play.** In the sim (real fixtures, rotation 0.33, the six-bowler coaches'
  mean, against 0), bowlers used a full innings went:
  - 5 or fewer who can bowl: 5.55 → 5.55, nothing;
  - exactly 6: 5.86 → 5.92;
  - 7 or more: 6.41 → 6.74.
  Win share didn't move in any band.
- **At exactly six the tag hits a ceiling, not a fault.** It adds 0.06 bowlers, against a real
  gap of +0.34. With six who can bowl, the sim already uses 5.86 of a possible 6. The real sides
  got to 6.25 with men the draft's rule doesn't count: part-timers with no bowling number shown.
  In the draft only those who bowl can bowl, so the tag's room is a seventh bowler.
- The draft's `bowls()` and the engine's `canBowl` agree on "six or more" for 92% of elevens.

## 3. The literature

A summary of a search for this question. Most sources were read in full; some were seen as
abstracts only.
- **Captains in cricket.** No peer-reviewed study measures a captain's effect on winning beyond
  team strength. Sadekar et al. 2024 (*R. Soc. Open Sci.*) find captain-batters score more while
  captain (about +16%), but they do not look at team results. County captain changes moved results
  "barely perceptibly" (Hacking 2016, a blog, not peer-reviewed).
- **Bowling plans and batting orders.** These are optimisation studies, inside their own models:
  - Ganesh 2026 (arXiv, one match each, no holdout): an optimal death plan is worth +5.2 points of
    win probability, and an optimal order of Nos. 4–6 in a chase +4.1 points.
  - Bukiet & Ovens 2006 (ODI): realistic batting orders span about 10 runs.
  - Perera, Davis & Swartz 2016: lineup gaps of 15–30 runs, mostly from team selection, not order.
- **Managers in other sports.**
  - MLB managers: about ±2 wins per 162 games, and bullpen handling about ±0.5.
  - NFL fourth-down errors: about 2 points of win probability a game (Romer 2006).
  - Soccer managers: 0.3 points a game from the 80th to the 20th percentile (Muehlheusser et al.
    2018). That includes training and selection.
- **The toss.** In T20 it is worth 1.3 points to the winner, not significant (Sood & Willis 2016).
  Captains also choose to bat more often than the results justify (Sacheti et al. 2016).
- **Upshot.** Decisions are worth modelling; a captain skill stat is not. An honest effect is 1–3
  points of win probability on average from good against bad decisions, with 4–5 points only in
  particular late-innings states.

## 4. What follows for the game

1. **The captain rating should go.** It does not repeat in real data, and it does nothing in the
   sim. Remove the numbers from the captain pickers, and the `captainZ` noise term from the engine
   (`captainNoiseSlope` to 0). The captain stays as a name: (c) on the scorecard, who tosses.
   Done 2026-11-05: `captainNoiseSlope` is 0 and the pickers no longer show the number.
2. **No captain tag or requirement.** There is no skill to tag, matchups included (§2 E).
   - Yash decided otherwise on 2026-11-05, with the captain carrying his measured habit, not a
     skill. Built:
     - A Captain tag goes on everyone who has led his country in a men's T20I, rated or stand-in
       (`draft/src/game/captain.ts`).
     - The eleven needs a captain. When it has captains, the user chooses among them; the default
       is the one with the most matches as captain. With none, the user marks any player, and
       Play waits until he does.
     - The captain brings his collapse habit (§2 F), computed in the pipeline
       (`analysis/captain-habits.ts`, `collapseHold` in `captaincy.json`, 83 of 138 rated
       captains with a record). The floater plays it.
     - Fixed after the 2026-11-05 review:
       - A finisher is whoever the side's order has at No. 6 or 7, as the habit was measured. The
         engine had used the card's archetype, which a quarter of the pool lacks, so many elevens
         never played the habit.
       - `holdScale` 0.92 plays the habit one for one, around a 7.6% average (real World Cups
         7.5%): a captain at −4.5 / +4.5 / +15 points holds 3.7 / 11.5 / 22.5%. The pickers show
         7.6% + habit, which is what plays.
       - The lever and the engine name the captain through one resolver (`playingCaptain`).
       - Shared links carry `ENGINE_VERSION`. A link from an older engine replays on today's with
         a one-line note.
       - Win share doesn't move with the captain.
   - (Original note, before that decision.) A habit tag is possible, but the habits are shared
     with the coach (who already carries rotation tags) and are worth about a tenth of a run.
3. **Captain IQ becomes the engine's decisions, for every side.** Real captains do not differ
   measurably, so the honest place for the Bumrah-for-the-18th logic is the allocation itself:
   save the best death bowler for the over where the chase is most in reach, judged on the match
   state. That would apply to every side, worth 1–3 points of win probability where it bites. It
   should be measured against real death allocations before it goes in.
4. **The batting order changes in the match, around the user's order.** Real sides move Nos. 3–8
   often, by situation, but moving it more does not win more. A captain-set order would undo the
   draft's slot mechanic (Place, slot numbers, line-up moves) for no measured gain. The honest
   middle ground: the user's order stands as the base, and the engine sends in a floater or hitter
   on a late wicket, the way real sides do (the pool already marks players who float in the order).
   Match the real deviation rates by phase.
   - After a collapse, the floater keeps to the order about as often as real sides do (§2 F). A
     bowler goes in to steady things at the real 2–4%. How readily a side holds its finisher back
     can be the captain's style (3.4 points of spread), since that is the one collapse habit that
     follows the captain and not the coach.
   - Built 2026-11-05 for the drafted eleven (`ENGINE.floater`, `sendIn` in match.ts). Real rates
     from `floater-rates.mts`: World Cup entries at Nos. 3–8 go out of the usual order 8% in the
     powerplay, 12% middle and 17% at the death (30–38% at the death with 2–3 down). The man sent
     out-hits the man due 7, 12 and 17 points more often than a random pick would. Left-right adds
     about 5 points before the death; spin matchups add nothing. `floater-check.mts`: the sim gives
     7.8 / 12.9 / 18.8%, hitter lift +8 / +10 / +16 points, 1.7 places a jump. Win share is 51.8%
     off and 51.9% on, and runs an innings 138.9 against 138.3. Real elevens keep their real order
     that day, which already has its moves.
5. **Six-bowler coaches require six who bowl** (§2 G). The rule matches real elevens, so it costs a
   real side nothing, and below six the tag does nothing in the engine. Built 2026-11-05
   (`bowlersRequired` in draft/src/game/rules.ts). The meters now count bowlers against the
   requirement, not overs. At exactly six the tag is near its ceiling (5.86 of 6 used already), so
   a seventh is where it spreads the overs; the coach's tag note says so.
