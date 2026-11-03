# World Cup Draft — UI/UX audit, 2026-11-02

Four runs. (1) A full draft in the browser at 1024 × 768 (Pakistan 2016, coach Mark Boucher, seed
`scoop-4138`), through every Gazette issue to the souvenir issue, then the home, identity, coach,
draft, match and Gazette screens again at phone width (375 × 812), with the run reopened from its
`?run=` link. (2) The Daily World Cup (West Indies 2024 after an identity reroll, a coach-panel
reroll, a keeper left to the end, a blank card opened, "Back to the draft" from the lineup). (3)
India 2007 and (4) Kenya 2026 as Afghanistan's stand-in, both opened from built `?run=` links,
with the tempo changed between matches. Each item says where it was seen and, where the code was
read, what causes it.

## Fixed 2026-11-03

All broken items below (1–5 and A–F) are fixed, each checked in the browser or by script:
"Next over" stops at the end of the over; the sub-100, standout-bowler and stand sentences read
right for either innings and either result; "Back to the draft" is gone (`LineupScreen.tsx`); your
eleven bowls exactly who the overs meter counted and the card shows a number for (`simulate.ts`);
the real record reads "0–1, 1 no result" and says Afghanistan's games are withheld; the death-overs
chip is a level against the archive (`VenueBrief.tsx`); cards with neither number are not spun
(`rules.ts`); "unknown" becomes batter or bowler, "positionless" becomes "floats in the order";
display names come from the hand-entry sheets too (Mayank Kumar, Harshit Kaushik, Louren
Steenkamp, Max Heingo, Willem Myburgh, Yuvraj Samra; Nitish Hirani by override); the footer is off
the draft screen; Copy result shows the text to copy by hand when the browser refuses. A qualifier
that wasn't the real one now takes the real slot-holder's date and ground (`tournament.ts`
`slotOccupant`, held to the slot's own first-round group): group fixtures with a real date rose in
every edition (2009 344 → 480 of 480, 2016 520 → 564, 2021 481 → 680, 2024 816 → 922 over 20
tournaments) with no team booked twice on a day. Pakistan 2016 meet the qualifier on 16 March at
Eden Gardens whoever qualifies.

Share links made before these changes replay differently (fixture grounds and who bowls changed).

## Confusing items fixed 2026-11-03, each checked

- **Coach panels** (8): three coaches whose printed tempos all differ (`rules.ts` `drawCoachPanel`).
  Over 2,000 seeds on the real pool: 764 panels had two coaches reading alike before, 0 after,
  and all 67 coaches still come up. The grounds brief is closed on the coach screen.
- **Stand-in squads** (9) say so under the squad name; the flag is set for exactly the stand-in
  squads (Namibia 2016, Zimbabwe 2024, Kenya 2026) and not for real ones (Namibia 2021).
- **No squad twice in a draft** (10): a full draft with both rerolls spun 13 different squads.
- **"estimated (0 balls)"** (12) reads "no balls against it; his overall batting".
- **Live board** (13): run rate, required rate, partnership, last wicket. Checked against the
  scorecard: 30/2 after 5 overs, partnership 15 (15), last wicket van Lingen 3 (7) at 2–15, 2.3
  overs; the scorecard has 2-15 (van Lingen, 2.3 ov) and the stand ending at 40 (36). **Fast** (14)
  is 80 ms a ball (about twenty seconds a match).
- **Souvenir actions** (15) are in the bottom bar on the souvenir issue; a player of the
  tournament is no longer repeated under "Better than their cards" (23).
- **Phone** (16): the slot buttons sit under the name in the card sheet; slot buttons are named for
  screen readers ("Place at No. 5, batting 80").
- **Daily date** (17) is the player's own calendar date, seed and label alike.
- **Lever** (G): a line says what changed and from which match. Checking it found a real bug: the
  side's nth match in the engine was the nth its group's pair loop reached, not the nth by date,
  so a plan for the next match changed a match already played (Pakistan v Ireland went from 33 to
  26 runs). The engine now dates every group fixture before the stage and plays in date order
  (`tournament.ts` `dateUndated`). Over 246 plans (four editions, three sides each, eight seeds)
  no earlier match changed, and the client no longer has to date any group fixture; a test holds it.
- **Squad rating** (H) comes from the in-edition numbers the sheet prints: 82.5 for Pakistan 2016
  (the table's eleven better numbers sum to 908), 85 on a fresh lineup (the sheet averages 85.0).

## 0. Broken, found in runs 2–4

A. **"Back to the draft" from the lineup soft-locks the run.** The draft screen asks for a 12th
   squad, shows "No squad with undrafted players found; try a reroll" and "Spinning…", and the
   reroll does nothing; only a reload (losing the run) gets out. `App.tsx` `backToDraft` returns to
   the draft step with all eleven picked. Since the order is final once drafted, the button has
   nothing to go back to.
B. **Players whose card says "he will not be given overs" bowl.** Elton Chigumbura (Zimbabwe 2012,
   bowling not rated) bowled 6.1 overs in 2007 and four spells in 2026 while Brandon Glover (bowl
   77) sat out matches. The engine's `canBowl` (`engine/data.ts`) is decided from the record, the
   card's wording from whether the bowling number is shown; the two disagree.
C. **The real record counts no-results and ties as defeats.** Ireland 2012 reads "0–2 in 2
   matches"; the West Indies game was washed out. `IdentityScreen.tsx` takes losses as matches
   minus wins. It also leaves out Afghanistan's withheld games without saying so (West Indies 2024
   "4–2 in 6"; they played 7).
D. **Ground chips contradict the numbers beside them.** Brian Lara Stadium 2024 "death overs fly"
   at 8.0 an over against the edition's 8.3; Kensington Oval "death overs held" at 8.6. The chips
   compare a ground's death overs with its own scoring rate, but read as against the field.
E. **A card with no batting and no bowling is draftable into the top order** (Fahad Nawaz, UAE
   2022, role "unknown"), where the engine gives him the position's typical numbers; the slot
   buttons show no number for him.
F. **Labels that leaked**: role "unknown" (Ayan Khan, Fahad Nawaz); "MR Kumar" (UAE 2026) shown in
   initials, no display name.
G. **Changing the tempo or captain between matches gives no sign it took**; the rest of the
   tournament does re-simulate (Kenya beat South Africa by 38 instead of 9 after "attack").
H. **The squad rating ignores the edition**: 83.5 for the same eleven in 2007, 2016 and 2026, while
   the table under it prints the in-edition numbers (Warner 94, 92, 95).

## 1. Broken

1. **"Next over" stops one ball into the next over.** Three taps from the start left the board at
   3.1 overs with "This over" showing a single ball; the over just bowled is never shown whole.
   `MatchView.tsx` `nextOver` jumps to the first ball of the next over instead of the last ball of
   this one.
2. **Wrong-side sub-100 sentence.** "Pakistan were left with little to chase after India were
   dismissed for 95." India were chasing. Two `subHundred` frames in `bank.ts` assume the side
   bowled out batted first; the fact does not carry which innings it was.
3. **A qualifier other than the real one loses its fixtures.** Pakistan 2016 played the first-round
   qualifier on 16 March at Eden Gardens. When Ireland qualified instead of Bangladesh, that game
   moved to 26 March in Bengaluru, which contradicts the identity screen ("2 of your 4 matches" at
   each ground). `tournament.ts` looks fixtures up by team pair, so a pairing that never happened
   gets the group's venues in turn and no real date. Matching by bracket slot would give the new
   qualifier the real qualifier's date and ground.
4. **On a 1024 × 768 window the fixed footer covers the bottom of the team sheet.** Slot 11's
   "Place here" sits under the footer line until the sheet is scrolled.
5. **Copy result fails silently** when the browser refuses clipboard access (unhandled promise, no
   message, no fallback). Success shows "Copied".

## 2. Honesty (the rule: nothing on a card or in the paper that the engine doesn't play)

6. **Coach tags are not played.** "Bowl first", "Bat first", "Six-bowler rotation", "Frontline
   trust", "Wicket preserver", "Risk taker", "Deep batting", "Top-heavy" come from
   `analysis/coaches.ts` and are shown on the coach screen; the engine uses only the coach's
   per-phase intent (the toss decision is the ground's toss habit, bowler use ignores rotation).
   Either drop them from the screen or make the engine play them.
7. **A drafted player can face himself.** Martin Guptill (New Zealand 2021) opened for Pakistan
   while the real New Zealand 2016 eleven fielded Martin Guptill too (57* in the washed-out match).
   The rule says one instance per XI, so this is allowed today. **Decided (Yash, 2026-11-03):
   leave it**; CPU sides keep their real elevens.

## 3. Confusing

8. **The three coaches can be nearly identical.** Two of the three read "balanced" in every phase,
   so the choice is a coin toss.
9. **Stand-in squads aren't labelled.** Namibia 2016 (Afghanistan's slot) spins with nothing saying
   it is a stand-in; most of its cards sit at 70–71 on thin records.
10. **The same squad can come up twice.** Namibia 2016 came up twice in eleven spins and Namibia
    2021 once more; Namibia has five editions plus a stand-in year, so uniform spins favour it.
11. **"positionless"** appears as a role tag ("middle order · positionless"); it is internal jargon.
12. **"estimated (0 balls)"** on pace/spin lines for thin cards reads oddly.
13. **The live board loses wickets.** No "last man" line, no fall of wickets, no run rate, no
    partnership; a wicket is visible only in the one-line commentary until the next ball.
14. **Fast is slow**: about three overs every five seconds, a full match over a minute.
15. **Souvenir actions are buried**: Copy result and Draft again sit halfway down the right-hand
    column; the bottom bar only has "Previous issue". Below the paper, the dark tabs (Your matches,
    Player ratings, Stats, Tables, Knockouts) are a second, differently styled interface on the
    same page.
16. **Phone: the placement buttons are at the very bottom of the card sheet**, under the whole
    breakdown, so every pick needs a scroll; the coach screen opens with grounds expanded, so the
    coaches are below the fold.
17. **Daily button shows the UTC date** ("11/3/2026" while it is still 2 November locally).

## 4. Polish

18. "ODI" tags on the v pace / v spin line wrap onto a second line on some cards (Mitchell Johnson).
19. The detail panel's phase labels run together ("PowerplayMiddleDeath").
20. "Place here" buttons cover the slot names on the sheet ("O..", "N.").
21. "thin record" under a bowl number on the sheet is cramped.
22. Bowler cards say "rarely bats" and "no batting record" (the same fact twice).
23. Adil Rashid led both "Players of the tournament" and "Better than their cards" with the same line.
24. Phone: the Gazette section tabs are 15 px too wide, so "TABLES" looks cut off; the header wraps
    onto two lines; the six-button bottom bar takes two rows.
25. Accessibility: squad cards are buttons with no accessible name; the detail panel's slot buttons
    are named by phase shares ("faces 65% powerplay…"), not by slot.
26. Home screen is plain dark UI; the print register starts at the team sheet and the paper.

## 5. Ratings seen on cards (for review, not UI)

- **Junaid Siddiqui (Canada 2024) bowling 93\***, 97th percentile, on 0 form balls and 349 career
  balls. The card says a thin record "leans on the average for his type"; this one doesn't.
- **Adam Zampa 2024 bowling 51** (8th percentile; 324 form balls that went for runs; 75 in 2021,
  74 in 2022). Faithful to the window, but it will read wrong to anyone who watched 2024.
- **Tim Southee 2021 batting 81 as a "finisher".**
- **Josh Hazlewood 2024 batting 70\*** as a No. 11 (estimate from position).
- **Jan Loftie-Eaton (Namibia 2021) as a bowler who "rarely bats"**; Paras Khadka and Elton
  Chigumbura with no bowling number.
- **Sam Curran (England 2026) bowling 40**, the floor; **Sikandar Raza (Zimbabwe 2024) batting 63**;
  **Yuvraj Singh (India 2014) batting 95**.
- Yash's read (2026-11-02): one number can't say how a player plays (Southee may hit like an 81 for
  six balls and then get out). Explore rating bands, as granular as Cricket 26's attributes, from
  domestic and international limited-overs data.

## 6. Flair list (agreed 2026-11-01): built and not built

Built: print register on the team sheet and the Gazette; scorecard notation, stands and fall of
wickets; the "This over" ticker; "Need X off Y" with the target; one-line ball commentary; era
facts (bowl-out, super over) in the paper; between-match captain and tempo; share link that replays
the run exactly (checked: same 157/8 on reopening).

Not built: worm, Manhattan, partnership bars, required-rate line; "last man" on the board; umpires
and referee; card silhouettes; the tour-programme spin page; era kit palettes; "Twenty20" in 2007;
DRS from 2012.
