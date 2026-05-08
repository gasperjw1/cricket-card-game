# SWIPE SIXER — Project Memory & Context

This document captures every design decision, mechanic, and discussion point for the Swipe Sixer cricket card game. It serves as the single source of truth for anyone (human or AI) picking up this project.

---

## Project Overview

**What:** A turn-based cricket card game played between two players.
**Where:** Facebook Messenger (Instant Game format).
**Inspiration:** Stick Cricket meets Yu-Gi-Oh. Simple cricket mechanics with strategic card play and deck building.

---

## Game Flow

### Pre-Match
1. Player A creates a game and sends invite via Messenger.
2. Player B joins.
3. **Coin toss:** Player B (the invited player) calls heads or tails. If correct, Player B chooses to bat or bowl first. If incorrect, Player A chooses.
4. Both players have pre-built decks ready.

### Match Structure
- **Two innings.** Each player bats once and bowls once.
- **Each innings:** Maximum 6 balls OR 2 wickets (whichever comes first).
- **Second innings:** The batting player knows the target and is chasing.
- **Winner:** Whoever scores more runs.

### Turn Structure (Each Ball)
Both players select cards **simultaneously and face-down**, then reveal at the same time (blind selection, like poker or Yu-Gi-Oh trap cards).

**Batting side plays:**
- 1 Batsman card (mandatory)
- 1 Situation card (optional)

**Bowling side plays:**
- 1 Bowler card (mandatory)
- 1 Situation card (optional)

**Resolution order:**
1. Situation cards activate simultaneously
2. If situation cards change the board state (force batsman swap, cancel other situation card, etc.), apply those effects
3. Bowler's delivery zone is looked up on the batter's card → raw result
4. Bowler's adjective modifier applies (downgrades outcomes if batter isn't resistant)
5. Bowler's fielding coverage applies (downgrades shots to covered fielding regions)
6. Final result: runs scored or wicket taken
7. Update score, draw back to 6 cards

**Important rule:** During a turn, you can only get out once (max 1 wicket per ball).

---

## Deck System

### Two Decks Per Player
- **Batting deck:** 20 cards (batsman cards + batting situation cards)
- **Bowling deck:** 20 cards (bowler cards + bowling situation cards)

When batting, you draw from your batting deck. When bowling, you draw from your bowling deck. They never mix.

### Hand Management
- Hand size: always **6 cards**.
- After each ball, draw back up to 6 from the active deck.
- **Anti-clog rule:** If your hand is ALL situation cards (no batsman/bowler available for your mandatory play), discard one situation card and redraw.
- This creates a deck-building tension: too many situation cards = clogged hands, too few = no tactical options.

### Card Usage
- **All cards are one-time use.** Played batsman cards, bowler cards, and situation cards are discarded permanently after use.
- Across a full match (two innings, up to 12 balls), you'll play up to 6 batsman cards and 6 bowler cards.
- With 20 cards per deck, you'll cycle through roughly 12 cards per innings, leaving 8 unseen. This creates variance and replayability.

---

## Card System

### Delivery Zone Grid
- **5 Lines:** Leg stump | Middle stump | Off stump | 5th stump | Wide outside off
- **3 Lengths:** Short | Good length | Full
- **15 total zones.** Originally had 5 lengths (including Yorker and Short of good length) but simplified to 3 for cleaner gameplay. Yorker-level effectiveness is represented through bowler adjectives instead.

### Batsman Card Tiers

| Tier | Strengths | Neutrals | Weaknesses | Resistances |
|------|-----------|----------|------------|-------------|
| Elite | 3 (6s & 4s) | 2 (2s & 1s) | 1 (wicket) | 2 |
| Gold | 3 (6s & 4s) | 2 (2s & 1s) | 1 (wicket) | 1 |
| Silver | 2 (4s & 2s) | 2 (2s & 1s) | 2 (wickets) | 0 |
| Bronze | 1 (4 or 6) | 2 (2s & 1s) | 3 (wickets) | 0 |

- **Everything not listed on the card = dot ball.**
- **Weaknesses are triggered by delivery ZONE only** (line + length). No adjective references in batter weaknesses. This was an explicit design decision — adjectives are a bowler modifier applied separately.

### Bowler Card Tiers

| Tier | Delivery Zone | Adjective | Fielding Coverage |
|------|--------------|-----------|-------------------|
| Elite | Primary zone | 1 adjective | Covers 2 regions |
| Gold | Primary zone | 1 adjective | Covers 1 region |
| Silver | Primary zone | 1 adjective or none | Covers 1 region |
| Bronze | Primary zone | Sometimes 1, often none | Basic (0-1 region) |

### Adjective System (Bowler Modifier)
Adjectives represent the quality/deception of a delivery beyond its basic zone. They are:
- **Swing** (outswing/inswing)
- **Seam** (deviation off the pitch)
- **Cutter** (off-cutter/leg-cutter, slower with sharp deviation)
- **Spin** (offspin/legspin/carrom/wrist spin)
- **Pace** (extreme speed)
- **Reverse** (old ball reverse swing)

**How adjectives work:** If the bowler has an adjective and the batter is NOT resistant to it, every outcome on the batter's card shifts DOWN one tier:
- 6 → 4
- 4 → 2
- 2 → 1
- 1 → dot
- dot → dot (stays)
- weakness → weakness (stays)

**Batter resistances** cancel specific adjectives. Example: Kohli is resistant to Pace and Swing, so a bowler with a Swing adjective gets no downgrade benefit against Kohli.

### Fielding Coverage System
Each bowler card has fielding regions that cover certain areas of the ground:
- **Slip cordon** — covers edges outside off
- **Gully/Point** — covers cuts and square drives
- **Cover** — covers cover drives
- **Mid-wicket** — covers flicks and on-drives
- **Fine leg/Leg slip** — covers leg glances and flicks behind
- **Short leg/Silly point** — covers bat-pad catches

If a batter's outcome sends the ball to a fielded region, the result downgrades one tier (same scale as adjective downgrades). This can stack with the adjective downgrade.

### Weakness Distribution Philosophy
- **Weaknesses should be spread across all zones**, not clustered on 5th stump outside off (which was the original problem).
- Every bowling zone should have batsmen who are vulnerable there, making every bowling style viable.
- Weaknesses reflect how T20 batsmen actually get out:
  - Power hitters → bowled through the gate on middle stump trying to slog across
  - Technically limited players → beaten on off stump, can't access that area
  - Aggressive openers → bowled playing across straight deliveries
  - Leg-side dominant players → anything outside off is a dot, but their wicket weakness might be full middle stump (bowled slogging across)
- Bronze batsmen have strengths mostly on leg stump (feast on bad bowling) and weaknesses on off stump / middle stump (can't play quality bowling)
- Bronze bowlers bowl middle/leg stump or lack adjectives (they're the "bad bowling" that bronze batters can score off)

---

## Card Roster

### Per Nation: 11 Batsmen + 11 Bowlers = 22 cards
- 1 Elite
- 2 Gold
- 3 Silver
- 5 Bronze

### Player Selection Philosophy
- **T20 focused** — players selected for T20I/IPL/franchise relevance, not Test careers
- **Elite** — all-time great or current superstar (Kohli, Buttler, Rashid Khan)
- **Gold** — established international star (Rohit, Maxwell, Shadab Khan)
- **Silver** — fringe international or brief T20I career (Jake Ball, Cameron Green, Chris Lynn type)
- **Bronze** — barely-there international or domestic journeyman (Rahul Tewatia, Mason Crane type)
- **Dual-role cards** — all-rounders (Shakib, Stoinis, Shadab, Raza) appear as both batsman AND bowler cards
- Signature deliveries/shots are based on the player's MOST KNOWN/EFFECTIVE ball or shot, not generic cricket

### 12 Test Nations
🇮🇳 India | 🇦🇺 Australia | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England | 🇿🇦 South Africa | 🇳🇿 New Zealand | 🇵🇰 Pakistan | 🇱🇰 Sri Lanka | 🌴 West Indies | 🇧🇩 Bangladesh | 🇿🇼 Zimbabwe | 🇦🇫 Afghanistan | 🇮🇪 Ireland

**Total: 264 player cards** (132 batsmen + 132 bowlers)

Full roster is in `docs/card-roster.md`.

---

## Situation Cards (To Be Designed)

Situation cards are one-time use tactical plays, similar to spell/trap cards in Yu-Gi-Oh. Key design principles discussed:

- Both players can play a single situation card per turn
- They both activate at the same time during reveal
- Neither player knows if the other is playing a situation card until reveal
- Some cards are offensive (batting or bowling side), some are defensive/counters
- Some cards exist purely to cancel the opponent's situation card

### Example Concepts Discussed (Not Finalized)
**Batting side:**
- "DRS Review" — if batsman got out, challenge it (50% chance overturned)
- "Power Surge" — all outcomes upgrade one tier this ball
- "Pinch Hitter" — play two batsman cards, use better result

**Bowling side:**
- "Medic Break" — opponent discards their played batsman, must play a new one
- "Aggressive Field" — fielding coverage doubles this ball
- "Bouncer Barrage" — force delivery zone to short length

**Counter/Defensive:**
- "No Ball" — cancels opponent's situation card, +1 run free hit
- "Rain Delay" — cancels opponent's situation card, ball is replayed
- "Captain's Challenge" — cancels opponent's card, see their next situation card

**Note:** These need refinement and balancing. Marked as future work.

---

## Future Features (ToDo)

### Batter Role Bonus (Phase Upgrade)
Some batters get a one-tier upgrade to ALL outcomes when played in their preferred innings phase:
- **Openers** — bonus on balls 1-2
- **Middle Order** — bonus on balls 3-4
- **Finishers** — bonus on balls 5-6

Upgrade scale: dot→1, 1→2, 2→4, 4→6, weakness→dot (survive but don't score)

Each batter card would have a "Role" field. Some elite batters could have dual roles for flexibility.

**Open questions:**
- Should weakness→dot be allowed? (Can't get out in your phase — might be too strong)
- Should there be a DOWNGRADE for playing out of position?
- Resolution order: adjective downgrades THEN role upgrades, or vice versa?

### Wide Outside Off Zone
Discussed as a multi-purpose design space:
- Elite batters can smash wide full balls for 6 (David Miller, Rohit Sharma style)
- Crafty batters can late cut for 4 (Shreyas Iyer style)
- Bronze batters chase and edge to slip
- Death bowlers deliberately bowl wide with fielding at cover/long-off
- Bad bowlers bowl wide because they can't control line

---

## Project History & Key Decisions

### Original Concept
Started as a Stick Cricket-style batting game with animated characters. After extensive iteration on the visual/animation side (batsman stance, camera angle, stumps positioning), we pivoted to a card game format which plays to the strengths of the platform (Messenger) and avoids the character animation challenges.

### Key Pivots
1. **Stick Cricket clone → Card game** — animation was too hard to get right in canvas, card game is more strategic and better suited for Messenger's turn-based nature
2. **Test cricket players → T20 players** — T20 matches the 6-ball format, opens up franchise/IPL players for Bronze tier
3. **5 lengths → 3 lengths** — simplified from Short/Short of good length/Good length/Full/Yorker to just Short/Good length/Full. Yorker effectiveness represented through adjectives.
4. **5th stump weakness clustering → distributed weaknesses** — originally most batsmen were weak to 5th stump, making that bowling zone overpowered. Redistributed so every zone has vulnerable batsmen.
5. **Adjectives in batter weaknesses → zone-only weaknesses** — batter weaknesses are triggered purely by delivery zone (line + length). Adjectives are bowler modifiers applied separately in the resolution chain.

### Design Principles
- **Rock-paper-scissors depth** — no single card dominates; every card has matchups it wins and loses
- **Deck building matters** — the tension between power cards and filler, situation cards vs clogging
- **Authentic cricket** — delivery zones, shot types, and player attributes reflect real cricket
- **Simultaneous reveal** — the blind selection creates mind games and prevents reactive play
- **Accessible for casual fans** — you don't need to understand cricket deeply to play, but cricket knowledge helps with deck building

---

## Technical Notes

### Target Platform
- Facebook Messenger Instant Games
- Must be a single HTML/JS application
- Two-player synchronous gameplay (both players online)
- Server needed for game state management and simultaneous reveal

### File Structure
```
cricket-card-game/
├── README.md
├── .gitignore
├── docs/
│   ├── card-roster.md    ← full 264-card roster
│   ├── todo.md           ← development roadmap
│   └── MEMORY.md         ← this file
├── src/                  ← game code (to be built)
└── assets/               ← card art, images (to be built)
```

### GitHub Repository
`https://github.com/gasperjw1/cricket-card-game`
