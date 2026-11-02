# World Cup Draft — match-report style corpus (2026-11-02)

Patterns abstracted by a research pass over ~120 men's T20 World Cup headlines and ~45 report
openers (2007–2024) from Sky Sports, the ICC's own site, Wisden and Stuff NZ. The Guardian, BBC,
Cricbuzz, Telegraph, SMH and Times of India refused the crawler; ESPNcricinfo was not visited.
Nothing here is a sentence to reuse verbatim; slots are placeholders. The gazette bank
(`draft/src/game/bank.ts`) should be grown from these shapes in our own words.

## Headline formulas (most seen first)

- `{Player} {feat-verb} [{feat}] as {Team} {result-verb} {Team}` (~28) — "fires unbeaten N as … crush …"; "takes W-R as unbeaten … storm into …".
- `{Team} {rout-verb} {Team} [for {low total}] [to {consequence}]` (~27) — skittle, bowl out for N, obliterate, rout debutants.
- `{Team} beat {Team} [by {margin}] to {consequence}` (~18) — the stake is always present: reach semi-final, qualify, knock out.
- Loser-led elimination: `{Team} knocked out after defeat to …` / `crash out` / `{Team}'s hopes take huge hit as debutants {Team} earn first win` (~14).
- `{Team} qualify for / storm into / through to / one win away from {Stage} [as {Team} miss out]` (~11).
- History/first: `{Associate} beat {Team} for historic win`, `win first title`, `reach first ever final` (~11).
- `{Team} keep {hopes / title defence} alive with {margin} win` / `stay unbeaten` (~9).
- Upset: `{Underdog} stun/shock {Favourite}` (+ "in last-ball thriller", "to clinch first-ever win") (~8).
- Narrow: `{Team} edge / hold off / edge past {Team}`, `Heartbreak for …`, `after chaotic finish` (~8).
- Favourite wobble: `{Favourite} survive {adj} scare` / `suffer {adj} defeat` (~7).
- Rain: `Rain wrecks … chance of … upset as match abandoned`, `secure famous win after rain-affected match` (~7).
- Seal/secure: `{Team} seal glory / clinch spot / book place in final [in Super Over]` (~7).
- `{Player}'s {feat} in vain as {Team} lose` (3); `{Team} set up {Opponent} semi-final` (4); `bounce back / bow out with victory` (4); `off to perfect start / make it three from three` (6); `win at a canter / routine victory` (5); `{Captain}'s side` as team synonym (5); `end {Team}'s unbeaten run / title defence` (5).
- Headlines are present tense; margins compress to "{n}-run win", "eight-wicket win"; low totals "for just 97".

## Verb bank

- Comfortable: beat (default), thrash, crush, hammer, thump, rout, dismantle, demolish, ease past, cruise, at a canter, romp, see off, make light work of, blow away, put to the sword, power past.
- Bowling rout: skittle, roll / rolled for, bowl out for, restrict to, hold to, rip through, tear through the tail, mop up / polish off the tail, run riot, ripped the heart out of, dismantled the top order.
- Narrow: edge / edge past, hold off, scrape home, squeeze out, hold their nerve, get over the line (most common), survive a scare, overcome a wobble, nervy, down to the wire, with {n} balls / an over / a ball to spare, last-ball.
- Upset: stun, shock, pull off a shock, claim {Team}'s scalp, spring a surprise, famous win, earn first win, historic.
- Chase: chase down, knock off, overhaul, wrap up the chase, broke the back of the chase, home with {n} to spare, up with / ahead of the rate, fell {n} short. Writers do not use "hunt down" or "run down".
- Defence: defend {n}, hold to, squeeze, strangle, stifle, restrict, nailed their yorkers, defended {n} off the final over.
- Collapse: collapsed from X to Y, slumped to, stumbled from, crumbled to, limped / stuttered to, reduced to, left reeling, in tatters, lost {n} wickets for {n}, wickets kept tumbling, a flurry of wickets.
- Seal: seal, secure, clinch, book, rubber-stamp, all but secure, put beyond doubt, storm into, march to, progress.
- Stakes: knock out, dump out, end hopes, dent hopes, hanging by a thread, blow the group wide open, keep alive, on the brink, crash out, bow out, early exit, must-win, virtual eliminator.
- Rain: abandoned, washed out, rain-affected, share the points, DLS, the weather had the final say, ahead of par. Rain reports avoid "lost"; they prefer "denied", "points shared".
- Batting feats: fires, blasts, blitz, smashes, thumps, stars, shines, guides, inspires, propels, powers, rescues, tonked, clubbed, plundered, pumped.

## Opening-sentence shapes

1. `{Player} {past-verb} {feat} as {Team} beat {Team} by {margin} in {City}.` (most common; result and margin in sentence one, venue last, totals in sentence two.)
2. Abstract-noun subject: `{Player}'s {masterclass / hat-trick / blistering knock} {came in vain / powered / took} {Team} to a {margin} {win/defeat}.`
3. `{Team} {beat / dismantled / held off / edged / cruised past} {Team} by {margin} to {open campaign / make it two from two / reach semi-finals / keep hopes alive}.`
4. `{Team} made the perfect start … bowling out {Team} for {n} on the way to a {n}-wicket win.`
5. Hopes as subject: `{Team}'s {title defence / winning streak / hopes} {remains alive / came to a crashing halt} after …`
6. `{Team} survived a scare against {Team} as …` / `overcame a mid-innings wobble as they chased down {n}`.
7. Present perfect for eliminations: `{Team} have been knocked out after a {margin} defeat to {Team}.`
8. Shock-led: `{Team} caused a huge, historic shock with a Super Over win over {Team} in {City}.` Upset openers name the favourite's status (defending champions, world No. 1) in sentence one.
9. Rain: `{Team} were denied the chance of a shock win as rain forced the abandonment at {Ground}.`
10. Bowling-unit subject: `{Team}'s spinners crushed a woeful {Team} side …`
11. Literary scene-setter (Wisden): short, no numbers, margin two sentences later.
12. Second-sentence conventions: participial chase framing ("Chasing {n}, {Team} were cruising at {score} before …"); bowler figures in parentheses after the name; the total as "{score} in {overs}" mid-sentence; a next-fixture line.

## Colour idioms by situation

- Lone hand: played a lone hand; came in vain; dragged his side to {score}; a shining light among the gloom; carried a weak side almost alone; anchored while wickets fell around him; rock and platform.
- Collapse: slumped from X to Y; the wickets kept tumbling; sunk further into the mire; in tatters at; left reeling at; a flurry of wickets; ripped the heart out of the middle order; disintegrated; limped to; lost their last five for {n}; bamboozled by spin; came to a crashing halt.
- Big stand / hitting: unbroken opening stand of {n}; rollicking stand; broke the shackles; went into overdrive; teed off; ignited the innings; to all parts; cleared the ropes; reduced the attack to rubble; plundered {n} off the over; took some tap; lusty blows; pyrotechnics; a knock that defied logic.
- Tight chase / defence: got over the line; down to the wire; nip-and-tuck; a grandstand finish; nerve-jangling; held his nerve; swung the pendulum; turned the game on its head; dragged the game back; the equation {n} off {n}; up with the rate; too many dot balls; in the driving seat; rested on {Player}'s shoulders; agonisingly short; heartbreak; squeezed the chase out; strangled the middle overs; nailed their yorkers; grabbed defeat from the jaws of victory; steadied the ship.
- Death overs: a late flurry / surge; took 20 off the final over; sealed it with a six; one hit needed and he found it; back-to-back sixes; went berserk; child's play.
- Tail: the tail wagged; salvaged their fortunes; dragged themselves out of trouble; lifted them from {score} to {total}; in dire straits at {score}; mopped up the tail.
- Bowling control: ran riot; out-thought and out-fought; put the brakes on; the pick of the attack; squeezed the life out of the chase; a turning wicket; beat the bat repeatedly; castled / nicked off / dragged on / holed out; a double blow / two in two / on a hat-trick; a screamer; shelled a dolly; a dropped catch they will rue.
- Rain: the weather had the final say; the covers stayed on; points shared; rain was the killjoy; a revised target of {n} from {n} overs.
- Upset / stakes: a famous win; the biggest shock in the tournament's history; took a major scalp; blew the group wide open; hanging by a thread; sweating on net run rate; a virtual eliminator; staring at an early exit; dead and buried; flirted with humiliation; bowed out with a bang; the writing was on the wall.
- Final: it all came down to this; a fitting climax; a pressure-cooker environment; ended a {n}-year wait; in commanding style.

## Register

- First sentences run 25–40 words: one main clause plus one subordinate (as / after / to / before). Wisden openers are 6–15 words and literary.
- Numbers: margin in sentence one; venue closes it; totals in sentence two as "172-4" (Sky), "172/4" (ICC) or "172 for four" (prose); individual scores in parentheses after the first body mention, "{Player} (87no off 47)", "{Bowler} (4-22)"; balls remaining as "with seven balls to spare"; overs by ordinal, "a 30-run 16th over"; low totals "for just {n}".
- Naming: full name on first mention, surname after; "captain {Name}" or "skipper"; team synonyms on second reference (the defending champions, the co-hosts, debutants {Team}, {Captain}'s side); role epithets before names (opener, seamer, leg-spinner).
- Teams are plural in British usage ("England are through", "Pakistan were cruising"); nicknames too.
- Headlines in simple present; body in simple past, past perfect for context; eliminations sometimes present perfect.
- Writers avoid a bare "won the match" (the result always carries a consequence or manner), never open a sentence with a number, never repeat "beat" from the headline in the body (saw off, edged, overcame), rarely "hunt down", no exclamation marks, no first person. About one colour idiom per paragraph, not more.
