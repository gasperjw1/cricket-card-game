# SWIPE SIXER — Situation Cards

## Rules
- Each player can play **one** situation card per ball (optional)
- Both situation cards are revealed **simultaneously** with the batsman/bowler cards
- Situation cards are **one-time use** — discarded after playing
- Situation cards go in their respective decks (batting situations in batting deck, bowling situations in bowling deck)
- "Old School Cricket Only" exists as **two distinct cards** in the data model — `old-school-batting` (in the batting situation pool) and `old-school-bowling` (in the bowling situation pool). The effect is identical; the split keeps draft pool sampling clean (each pool has exactly 6 unique situation cards).

---

## BATTING SITUATION CARDS (8 + 1 shared)

### 1. DRS Review
*"Not out! The batsman survives on review."*

If your batsman gets out this ball, the dismissal is overturned and it becomes a **dot ball** instead. Does not change any other outcome — only triggers on a wicket result.

**When to play:** Protecting a weaker batsman against a dangerous bowler. Wicket insurance when you can't afford to lose one of your 2 allowed dismissals.

---

### 2. Power Surge
*"The field is up! Time to attack."*

All outcomes on your batsman's card **upgrade one tier** this ball:
- Dot → 1
- 1 → 2
- 2 → 4
- 4 → 6

**Weaknesses still trigger as wickets** — this does not protect against getting out. Only improves scoring zones.

**When to play:** When you're confident the delivery will land on a strength or neutral zone. Turns a neutral 2 into a boundary 4.

---

### 3. Retired Out
*"New batsman walks to the crease mid-over."*

Discard your played batsman card **before** the delivery resolves. Immediately play a replacement batsman from your hand. The new batsman faces the delivery instead.

If you have no other batsman in hand, this card cannot be played.

**When to play:** When you suspect a bad matchup. Swap a Bronze batsman for a better one in your hand. Also useful for burning a weak card to bring in a finisher.

---

### 4. Switch Hit
*"The batsman switches stance! Off side becomes leg side."*

Your batsman's card zones are **mirrored** for this ball:
- Off stump ↔ Leg stump
- 5th stump ↔ (treated as Leg stump)
- Middle stump stays Middle stump
- Wide outside off ↔ (treated as Leg stump)

The bowler's delivery zone does NOT change — only which part of the batsman's card it maps to. Fielding positions are NOT mirrored.

**When to play:** When your batsman has strong leg-side zones but you expect off-side bowling. Flips your strengths to cover the bowler's likely delivery.

---

### 5. Trot Down
*"The batsman charges down the pitch!"*

Your batsman pre-meditates walking down the track, changing the effective length of the delivery:
- **Good length → Full** (the batsman has closed the distance)
- **Short → Good length** (the short ball arrives at good length height)
- **Full → Full** (stays the same, already full)

The bowler's line stays unchanged. Only the length shifts.

**When to play:** When your batsman has strengths on full-length deliveries but the bowler typically bowls good length. Turns a dot-ball zone into a scoring zone. Risky against bowlers who already bowl full — no benefit.

---

### 6. No Ball
*"Foot fault! The umpire's called it!"*

The bowler oversteps the crease. This delivery:
- **Cancels any wicket** — if the result was a wicket, it becomes a dot ball.
- **+1 run** to the batting team (the no-ball extra).
- **Re-bowled** — this delivery doesn't count against the innings ball total.

The runs from the actual outcome (e.g. a 4 or 6 if the batter still hit it) ALSO stand and are added on top of the +1 extra.

> **Important — no free hit.** Unlike real T20 cricket, the No Ball card does **not** grant the next delivery free-hit status. The wicket protection applies only to *this* ball; the re-bowled ball resolves under normal rules.

**When to play:** Wicket insurance with a bonus. Particularly strong as a tempo card late in an innings — guarantees you face one extra ball without losing a wicket.

---

### 7. Shuffle Across
*"The batsman shuffles across his stumps."*

Your batsman steps across to the off side, treating the bowler's line as one stump further toward leg on their card:
- **Outside off → Off stump**
- **Off stump → Middle stump**
- **Middle stump → Leg stump**
- **Leg stump → Leg stump** (clamped — can't shuffle further)

Length is unchanged. Inverse of Day 5 Pitch.

**Wide-call risk.** If the bowler delivered on **Leg stump** when Shuffle Across is played, the batter has shuffled past the line — the umpire calls a wide. +1 extra run, ball is re-bowled.

**When to play:** When your batsman has strengths on leg-side / middle stump zones and you expect the bowler to attack off stump. Turns an Outside off fishing line into an Off stump zone, an Off stump good length into a middle stump pull, etc.

---

### 8. Deep in the Crease
*"The batsman steps back, deep in his crease."*

Your batsman creates extra time by stepping back. The effective length shifts outward (toward the bowler):
- **Good length → Short** (good length is met higher and earlier)
- **Full → Good length** (full balls become drivable good-length deliveries)
- **Short → wide call** (short balls bounce too high — auto-wide)

The bowler's line stays unchanged. Inverse of Trot Down.

**When to play:** When your batsman has strengths on Short or Good length deliveries and you expect the bowler to bowl Full. Especially valuable against pacers who routinely target full lengths. Risky against bowlers who go short — the auto-wide *helps* the batting team there, but only as a +1 free run, not a scoring opportunity.

---

### 9. Old School Cricket Only *(Shared — available in both batting and bowling decks)*
*"Play the game properly! No tricks today."*

**Cancels the opponent's situation card entirely.** Both situation cards are discarded and the ball resolves with just the batsman vs bowler cards — no situation effects.

If the opponent didn't play a situation card, this is wasted.

**When to play:** When you suspect the opponent is playing a high-impact situation card. Pure mind game.

---

## BOWLING SITUATION CARDS (6 + 1 shared)

### 1. Mankad
*"The bowler spots the batsman backing up too far..."*

Your opponent must **discard their played batsman** and play a different batsman from their hand. The new batsman faces the delivery instead.

If the opponent has no other batsman in hand, the original batsman stays but all their outcomes **downgrade one tier** this ball (treated as facing an extra adjective).

**When to play:** When you want to force the opponent to burn through batsmen faster. Disrupts their batting order plans. Especially strong if you suspect they played an Elite batsman — force them to replace with whatever's left in hand.

---

### 2. Review Appeal
*"Howzaaaaat! The bowler appeals for everything."*

If this ball results in a **dot ball**, it becomes a wicket appeal — **40% chance** the dot is upgraded to a wicket (LBW/caught behind).

Does not trigger on any other outcome (runs scored or existing wicket). Only dots become potential wickets.

**When to play:** When you're confident the delivery zone will be a dot ball on the batsman's card. Best against batsmen with limited scoring zones. Gambling card — 40% is not guaranteed.

---

### 3. Cramps
*"The bowler pulls up mid run-up. Replacement needed."*

Discard your played bowler card **before** the delivery resolves. Immediately play a replacement bowler from your hand. The new bowler delivers instead.

If you have no other bowler in hand, this card cannot be played.

**When to play:** When you see the batsman on reveal and realize your bowler is a bad matchup. Swap to a bowler whose zone targets the batsman's weakness. Also useful for burning a Bronze bowler and bringing in a better one.

---

### 4. Invariable Bounce
*"The ball doesn't come onto the bat. Everything is a mis-hit."*

All outcomes on the opponent's batsman card **downgrade one tier** this ball:
- 6 → 4
- 4 → 2
- 2 → 1
- 1 → Dot
- Dot → Dot (stays)
- Weakness → Weakness (stays)

This stacks with the bowler's adjective downgrade if applicable. A batsman facing an adjective they're not resistant to PLUS Invariable Bounce gets **double downgraded**.

**When to play:** Against strong batsmen to neutralize their scoring. Pairs devastatingly with an Elite/Gold bowler who has an adjective — double downgrade turns 6s into 2s.

---

### 5. Day 5 Pitch
*"The pitch is crumbling. The ball is doing things."*

Your bowler's delivery line shifts **one line away from the batsman's body**:
- Leg stump → Middle stump
- Middle stump → Off stump
- Off stump → 5th stump
- 5th stump → Wide outside off
- Wide outside off → Wide outside off (stays)

The length stays unchanged. The bowler's adjective and fielding still apply normally.

**When to play:** When you want to push the delivery into unfamiliar zones for the batsman. Turns a leg-stump delivery (where most Bronze batsmen have strengths) into a middle/off-stump delivery (where they have weaknesses or dots). Represents the pitch deteriorating and the ball misbehaving.

---

### 6. Third Umpire Distracted by Biryani
*"The third umpire's lunch arrived. Decisions get… liberal."*

A counter to extras. When played by the bowling side:
- Any **No Ball** the batting side played has its effects **fully cancelled** — no extra run, no re-bowl, no wicket overturn.
- Any **wide call** that would have happened (tier-based wide on Outside off, leg-side wide from Shuffle Across, Outside-off wide from Day 5 Pitch, Short auto-wide from Deep in the Crease) is converted to a **regular dot ball** — no extra run, ball counts.

If neither a No Ball was played nor a wide would have been called, this card is wasted.

**When to play:** Insurance when you bowl Outside off (defangs the tier-based wide check) or anticipate the batter playing No Ball. Especially valuable for Bronze/Silver bowlers who otherwise risk frequent wides.

---

### 7. Old School Cricket Only *(Shared — available in both batting and bowling decks)*
*"Play the game properly! No tricks today."*

**Cancels the opponent's situation card entirely.** Both situation cards are discarded and the ball resolves with just the batsman vs bowler cards — no situation effects.

If the opponent didn't play a situation card, this is wasted.

**When to play:** When you suspect the opponent is playing a high-impact situation card. Pure mind game.

---

## Summary Table

| Card | Deck | Effect Type |
|------|------|-------------|
| DRS Review | Batting | Defensive — wicket protection |
| Power Surge | Batting | Offensive — outcome upgrade |
| Retired Out | Batting | Tactical — batsman swap |
| Switch Hit | Batting | Zone modifier — mirror zones |
| Trot Down | Batting | Zone modifier — shift lengths inward (toward Full) |
| No Ball | Batting | Defensive — wicket protection + extras + re-bowl |
| Shuffle Across | Batting | Zone modifier — shift lines toward leg (with leg-stump auto-wide risk) |
| Deep in the Crease | Batting | Zone modifier — shift lengths outward (with Short auto-wide risk) |
| Mankad | Bowling | Disruptive — force batsman swap |
| Review Appeal | Bowling | Gamble — dots become potential wickets |
| Cramps | Bowling | Tactical — bowler swap |
| Invariable Bounce | Bowling | Offensive — outcome downgrade |
| Day 5 Pitch | Bowling | Zone modifier — shift lines toward off (with Outside-off auto-wide risk) |
| Third Umpire Distracted by Biryani | Bowling | Counter — cancels No Ball effects and wide calls |
| Old School Cricket Only (Batting) | Batting | Counter — cancels opponent's situation card |
| Old School Cricket Only (Bowling) | Bowling | Counter — cancels opponent's situation card |

**Total unique situation cards in data model: 16** (8 batting + 6 bowling + Old School split into 2 variants with identical effect). Conceptually 15 distinct effects (Old School is one effect with two data-model entries).

### Automatic mechanics (no card)

**Outside off umpire call.** Whenever a bowler delivers Outside off and the resolved outcome is a dot ball, the umpire may call wide based on the bowler's tier:

| Bowler tier | Chance of wide call |
|-------------|---------------------|
| Bronze | 40% |
| Silver | 25% |
| Gold | 15% |
| Elite | 5% |

A wide awards +1 extra run and the ball is re-bowled (doesn't count against the over). Doesn't fire if the batter scored — only on dots.

**Situation-card auto-wides.** Several zone-modifier cards push the bowler's line off the strike zone, triggering an automatic wide call (+1 extra, re-bowled, no actual delivery resolution):

- **Shuffle Across** (batting) on a delivery already on **Leg stump** — the batter has shuffled past the line.
- **Day 5 Pitch** (bowling) on a delivery already on **Outside off** — the line shift would push the ball outside the strike zone.
- **Deep in the Crease** (batting) on a delivery on **Short** length — the bouncer goes too high over the batter who's stepped back.

All wide calls (tier-based and situation-card auto-wides) are cancelable by the bowling side's **Third Umpire Distracted by Biryani**.

**Bowler adjective stacking rule.** Elite bowlers may carry **2 adjectives**, but only one fires per ball. The engine picks an un-resisted adjective; if the batter resists both, no downgrade fires; if the batter resists neither, only one of the two downgrades is applied (no double-stack).

---

## Resolution Order with Situation Cards

When both players reveal their cards simultaneously:

1. **Check for Old School Cricket Only** — if either player played it, cancel the opponent's situation card. If BOTH played it, both are cancelled and ball resolves normally.
2. **Check for Mankad / Retired Out / Cramps** — card swaps happen before the delivery resolves. New cards are played from hand.
3. **Apply zone modifiers** — Trot Down (length shift), Day 5 Pitch (line shift), Switch Hit (zone mirror) modify the delivery zone or batsman card lookup.
4. **Base lookup** — bowler's (possibly modified) delivery zone is looked up on the batsman's (possibly mirrored) card.
5. **Apply Invariable Bounce** — if played, downgrade the outcome one tier.
6. **Apply bowler adjective** — if batter isn't resistant, downgrade one tier (stacks with Invariable Bounce).
7. **Apply bowler fielding** — if the shot goes to a covered region, downgrade one tier.
8. **Apply Power Surge** — if played, upgrade the final outcome one tier.
9. **Check for wicket + DRS Review** — if the result is a wicket and DRS Review was played, overturn to dot ball.
10. **Apply Review Appeal** — if the final result is a dot ball and Review Appeal was played, 40% chance it becomes a wicket.
11. **Final result.**

---

## Deck Building Considerations

With 11 unique situation cards available, players need to decide:

- **How many to include?** Each situation card takes a slot away from a batsman or bowler card. Too many = clogged hands. Too few = no tactical options.
- **Which ones?** Old School Cricket Only is the safest pick — it's never wasted if the opponent plays a situation card. But if they never play one, you've wasted a deck slot.
- **Anti-clog rule reminder:** If your hand is ALL situation cards, discard one and redraw. So running 8+ situation cards in a 20-card deck is very risky.
- **Suggested split:** 14-16 player cards + 4-6 situation cards per deck.
