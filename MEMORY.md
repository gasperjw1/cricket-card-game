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

**Turn timer:** Each player has **30 seconds** to lock in their selection. If the timer expires, a mandatory card is auto-selected at random from hand and no situation card is played.

**Resolution order (canonical — mirrors `docs/situation-cards.md`):**
1. **Old School Cricket Only check** — if either player played it, the opponent's situation card is cancelled. If both played it, both cancel and the ball resolves with no situation effects.
2. **Card swaps** — Mankad / Retired Out / Cramps force the affected player to discard their played mandatory card and play a different one from hand (Mankad applies a downgrade penalty if the batting side has no other batsman).
3. **Zone modifiers** — Trot Down (length shift), Day 5 Pitch (line shift), Switch Hit (mirror batter zones) modify the lookup before resolution.
4. **Base lookup** — bowler's (possibly modified) delivery zone is looked up on the batter's (possibly mirrored) card → raw result.
5. **Invariable Bounce** — if played, downgrade outcome one tier.
6. **Bowler adjective** — if batter isn't resistant, downgrade one tier (stacks with Invariable Bounce).
7. **Fielding coverage** — if shot goes to a covered region, downgrade one tier.
8. **Power Surge** — if played, upgrade final outcome one tier (does not protect against weakness/wicket).
9. **DRS Review** — if result is a wicket and DRS Review was played, overturn to dot ball.
10. **Review Appeal** — if final result is a dot ball and Review Appeal was played, 40% chance becomes a wicket.
11. **Apply runs / wicket → update scoreboard → discard played cards → draw back to hand size.**

**Important rule:** During a turn, you can only get out once (max 1 wicket per ball).

**Outcome reveal:** Instead of animated playback, after resolution the UI shows a paired real-life photo set: bowler delivering + batter playing the resulting shot (or dismissal). See "First Iteration Scope" below.

---

## Deck System

### Two Decks Per Player
- **Batting deck:** 20 cards (batsman cards + batting situation cards)
- **Bowling deck:** 20 cards (bowler cards + bowling situation cards)

When batting, you draw from your batting deck. When bowling, you draw from your bowling deck. They never mix.

### Hand Management
- Hand size: always **4 cards**.
- After each ball, draw back up to 4 from the active deck.
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

## First Iteration (v1) Scope

The first playable build is intentionally narrow. It exists to validate the core ball-by-ball loop end-to-end before investing in deck building, Messenger sync, or art.

**In scope for v1:**
- Coin toss flow (Player B calls heads/tails → winner chooses bat or bowl)
- Hand size of **4** cards per active deck (per design above)
- **30-second turn timer** per player; on expiry, auto-pick a mandatory card at random and skip the situation card
- Simultaneous reveal of both players' selections after both lock in (or both timers expire)
- Full resolution order as specified above
- Discard played cards, update scoreboard (runs, wickets, balls, target if 2nd innings), draw back to 4
- **Outcome reveal screen**: instead of animation, after resolution show two paired real-life photographs — (1) the bowler delivering, (2) the batter playing the resulting shot or dismissal — alongside the runs / wicket text
- End-of-innings + end-of-match summary

**Out of scope for v1 (deferred):**
- Pre-made decks UI — v1 uses the **draft flow below**, no pre-made decks
- Messenger Instant Games SDK integration — v1 runs as a plain web build
- Custom card art — v1 uses simple typographic cards (with player photos in outcome reveal)
- Role bonus / phase upgrade (still backlog)

### Deck Draft (v1)

Before the match starts, each player drafts **two decks** (batting + bowling) independently. Both players draft in parallel — neither sees the other's picks.

**Per deck: 20 rounds, 15 seconds per round.** Each round shows 4 options; player picks one. Round structure:

| Rounds | Tier shown | Picks |
|--------|-----------|-------|
| 1–2    | Elite     | 2 |
| 3–5    | Gold      | 3 |
| 6–10   | Silver    | 5 |
| 11–20  | Bronze    | 10 |
| **Total** | | **20** |

**Situation card injection.** Before the draft starts, sample 5 of the 20 round indices uniformly at random. In those 5 rounds, replace one of the 4 player options with a situation card. The 5 situation cards shown across those rounds are sampled without replacement from that deck's situation card pool (6 available, see below) — so a draft never offers the same situation card twice.

**Duplicate rules within a draft:**
- **Within a single round of 4 options:** all 4 are unique (no duplicates among the cards shown together).
- **Across rounds:** an unpicked card *can* reappear in a later round of the same tier. Once a card is *picked*, it's removed from the pool for the remainder of that draft.
- Bowling and batting decks are drafted from disjoint pools, so a player who's an all-rounder can be picked in both decks (their batsman card and bowler card are distinct cards in the data — see "Old School + all-rounder card model" below).

**Situation card pools:**
- Batting deck draft pool (6): DRS Review, Power Surge, Retired Out, Switch Hit, Trot Down, Old School Cricket Only (Batting variant). Pick 5.
- Bowling deck draft pool (6): Mankad, Review Appeal, Cramps, Invariable Bounce, Day 5 Pitch, Old School Cricket Only (Bowling variant). Pick 5.

**Auto-pick on timer expiry:** if the 15s timer expires, the system picks one of the 4 options at random.

**Total pre-match draft time:** ~5 min per deck × 2 decks = 10 min per player; both players draft in parallel ≈ **10 min total**.

### Old School + all-rounder card model

Two data-model decisions that simplify the engine:

1. **Old School Cricket Only is two distinct cards** with identical effect text — `old-school-batting` (lives in the batting situation pool) and `old-school-bowling` (lives in the bowling situation pool). At resolution they behave identically. This keeps draft pool sampling clean — each deck draft has exactly 6 situation cards in its pool.
2. **All-rounders are always two distinct cards** — one in the batsmen list, one in the bowlers list, with different IDs (e.g. `hardik-pandya-bat`, `hardik-pandya-bowl`). The roster already separates them; card data and draft logic both treat them as fully independent cards.

### Photo asset model (v1)

Per-player photo library. Files live under `assets/photos/<playerId>/<outcomeKey>.jpg`.

**Per batsman:** every shot listed on their card (e.g. Kohli has `cover-drive-4`, `flick-6`, `pull-4`, `push-2`, `late-cut-1`, `edge-to-keeper`) plus standardized `leave`, `block`, `bowled`, `lbw`, `caught-off-side`, `caught-leg-side`, `caught-straight`.

**Per bowler:** `run-up.jpg` (delivering) and `wicket-celebration.jpg`.

**Fallbacks:** when a specific photo is missing, the engine falls back to a generic stock image for that outcome key (e.g. a stock "cover drive" photo). All stock fallbacks carry a small watermark so they're visually distinguishable from real player photos. The engine resolves photo paths at render time and substitutes fallbacks transparently — no code changes needed when real photos are dropped into the asset folders.

---

## Technical Notes

### Target Platform
- **Long-term:** Facebook Messenger Instant Games (single HTML/JS app loaded into a Messenger webview)
- **v1 target:** plain web build, networked across two devices via the v1 stack below. Messenger SDK integration is deferred.

### v1 Tech Stack
- **Frontend:** React + TypeScript + Vite (SPA)
- **Backend:** Node.js + Express + Socket.IO (authoritative game server)
- **State:** in-memory match map on the server, no database for v1 (matches are ephemeral; players use 6-character invite codes for lobbies, no accounts)
- **Hosting target:** Fly.io free tier first, pivot to a paid plan only if needed
- **Why server-authoritative:** simultaneous reveal requires a neutral third party to hold both selections until both submit. The 30s and 15s timers are also server-authoritative so neither client can cheat the clock.

### Repo Layout (monorepo)
```
cricket-card-game/
├── README.md
├── package.json            ← npm workspaces root
├── docs/
│   ├── MEMORY.md           ← this file (canonical design)
│   ├── card-roster.md      ← full 264-card roster
│   ├── situation-cards.md  ← 11 situation cards (incl. Old School split)
│   └── todo.md             ← development roadmap
├── shared/                 ← TS types, card data (JSON), enums, socket event contracts
├── server/                 ← Node + Express + Socket.IO; resolution engine lives here
├── client/                 ← React + Vite SPA
└── assets/
    └── photos/             ← per-player photo library + watermarked stock fallbacks
        ├── <playerId>/
        └── _stock/
```
The `shared/` workspace is the single source of truth for card data and type contracts that both client and server import. **Resolution logic lives only on the server** — clients never compute outcomes themselves.

### GitHub Repository
`https://github.com/gasperjw1/cricket-card-game`
