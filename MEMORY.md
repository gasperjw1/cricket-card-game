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

**Resolution order (canonical — mirrors `docs/situation-cards.md` and the engine in `shared/src/engine/resolve-ball.ts`):**
1. **Old School Cricket Only check** — if either player played it, the opponent's situation card is cancelled. If both played it, both cancel and the ball resolves with no situation effects.
2. **Card swaps** — Mankad / Retired Out / Cramps prompt the affected player to swap their played mandatory card with another from their hand (15s timer; auto-pick on timeout). Mankad applies a one-tier downgrade penalty if the batting side has no other batsman.
3. **Zone modifiers** — Day 5 Pitch (line shift toward off, clamps at wide outside off), Trot Down (length compression toward Full), Switch Hit (mirror batter zones), Shuffle Across (line shift toward leg on batter card, clamps at leg).
4. **Base lookup** — bowler's modified delivery zone is looked up on the batter's modified card → raw result.
5. **Invariable Bounce** — if played, downgrade outcome one tier.
6. **Bowler adjective** — if batter isn't resistant, downgrade one tier (stacks with Invariable Bounce).
7. **Fielding coverage** — if shot goes to a covered region, downgrade one tier.
8. **Power Surge** — if played, upgrade final outcome one tier (does NOT protect against weakness/wicket).
9. **DRS Review** — if result is a wicket and DRS Review was played, overturn to dot ball.
10. **Review Appeal** — if final result is a dot ball and Review Appeal was played, 40% chance becomes a wicket.
11. **No Ball** — if batting side played it, cancel any wicket on this delivery, +1 extra run, mark ball as re-bowled.
12. **Wide outside off check** — automatic, no card needed. If the bowler delivered Wide outside off and the resolved outcome is a dot ball, the umpire may call wide based on bowler tier (Bronze 40% / Silver 25% / Gold 15% / Elite 5%). On call: +1 extra run, mark ball as re-bowled.
13. **Apply scoring:** add `outcomeRuns + extraRuns` to innings runs, increment wickets if outcome is wicket, increment `ballsBowled` only if the ball was NOT re-bowled. Discard played cards (incl. swap replacements). Refill hand. **15-second post-resolution pause** before the next ball's timer starts (or before innings/match transition).

**Important rule:** During a turn, you can only get out once (max 1 wicket per ball).

**Outcome reveal:** After resolution the UI shows both played cards side-by-side, the resolution-step trail with hover tooltips, and the final outcome (with extras pills if any). A 15s "Next ball in: Xs" countdown ticks during the pause. Players can click Continue to dismiss the reveal locally, but the next ball doesn't begin until the server-side pause elapses.

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

## Situation Cards (Designed & Built)

Situation cards are one-time-use tactical plays, similar to spell/trap cards in Yu-Gi-Oh. Both players may optionally play one situation card per ball, alongside their mandatory batsman/bowler. Cards are revealed simultaneously and resolved per the canonical chain above. Full design lives in [`docs/situation-cards.md`](docs/situation-cards.md).

### Batting pool (7 + 1 shared)

| Card | Effect summary |
|------|----------------|
| **DRS Review** | Wicket → dot ball. No effect on non-wickets. |
| **Power Surge** | All outcomes upgrade one tier (does NOT save wickets). |
| **Retired Out** | Voluntarily swap your played batsman for another from your hand. |
| **Switch Hit** | Mirror line on the batter's card lookup (off↔leg, 5th/wide → leg, mid stays). |
| **Trot Down** | Length compresses one step toward Full. |
| **No Ball** | Cancels any wicket on this delivery, +1 run, ball is re-bowled. |
| **Shuffle Across** | Bowler's line is met one stump further toward leg on the batter's card (inverse of Day 5 Pitch). Clamps at Leg stump. |
| **Old School Cricket Only** *(shared)* | Cancels opponent's situation card. |

### Bowling pool (5 + 1 shared)

| Card | Effect summary |
|------|----------------|
| **Mankad** | Force the batting side to swap their played batsman for another from hand. If no swap target, outcome takes a one-tier downgrade. |
| **Review Appeal** | Dot ball → 40% chance of becoming an LBW wicket. |
| **Cramps** | Voluntarily swap your played bowler for another from your hand. |
| **Invariable Bounce** | Outcome downgraded one tier (stacks with adjective + fielding). |
| **Day 5 Pitch** | Bowler's line shifts one step toward off side. Clamps at Wide outside off. |
| **Old School Cricket Only** *(shared)* | Cancels opponent's situation card. |

### Other automatic mechanics

**Wide outside off (no card needed):** when a bowler delivers Wide outside off and the resolved outcome is a dot ball, the umpire calls a wide based on the bowler's tier — Bronze 40%, Silver 25%, Gold 15%, Elite 5%. A wide awards +1 run and re-bowls. Doesn't fire if the batter scored.

### Old School & all-rounder data-model split
- **Old School Cricket Only** is two distinct cards in the data model: `old-school-batting` (in the batting pool) and `old-school-bowling` (in the bowling pool). Identical effect — split exists to keep draft pool sampling clean.
- **All-rounders** are always two distinct cards (e.g. `hardik-pandya-bat` and `hardik-pandya-bowl`).

### Mid-ball swap interaction
Mankad / Retired Out / Cramps all force a card swap *during* resolution. The server pauses the ball, presents the affected player with a swap-picker UI showing both played cards on the table plus the candidate replacements from their hand, with a 15s timer (auto-picks first candidate on timeout). Once the pick is in, resolution continues with the new card.

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

### Bronze / Silver inherent Pace-or-Spin resistance (deferred)
Decision recorded: every Bronze and Silver batsman should have an inherent resistance to **either Pace or Spin** for game balance. The choice per-player should be **based on real cricket stats** — i.e. an aggressive top-edge slogger like Mitchell Owen would reasonably have Pace resistance, a wristy spinner-killer might have Spin resistance. This is a manual roster pass (~120 cards across 12 nations × ~10 Bronze+Silver per nation), deferred until the mechanics shake out. NOT a parser-side deterministic transform — fidelity to real players is the goal.

### Roster gaps (deferred)
Documented gaps to fix in a v1.1 roster pass:
- **No batsmen with 5th stump strengths.** 5th stump shows up as weaknesses and neutrals, never as a strength. Add a few elite/gold batters who score off this zone (late cut, dab to third) so 5th stump bowling has counterplay.
- **No bowlers deliver Wide outside off.** The wide outside off mechanic is implemented but won't trigger until at least one bowler card uses this delivery zone. Add 1–2 death overs specialists (yorker bowlers who deliberately go wide) per nation.
- **No batsmen with strengths at Wide outside off.** Some neutrals exist (Rohit, Travis Head with 1-run drives) but no 4s or 6s. Add elite players who can manhandle this zone (David Miller / Rohit Sharma scooping over fine leg, Shreyas Iyer late cuts for 4).

These gaps are orthogonal to mechanics — addressing them is high-effort and low-leverage until we know the game balance feels right.

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

The v1 build validates the core ball-by-ball loop end-to-end before investing in deck building UI, Messenger sync, or art. Per the path-2 sequencing decision, decks are temporarily auto-filled with random cards (15 player cards in tier-mix + 5 situation cards from the deck's pool) so the ball loop and resolution engine can be exercised first; the player-driven draft slots in afterward.

**In scope for v1:**
- Lobby with invite codes + reconnect-by-token + close-on-disconnect (lobby phase only)
- Coin toss flow (Player B calls heads/tails → winner chooses bat or bowl) with 10s pre-flip countdown, 30s call/choose timers, server-authoritative flip
- Hand size of **4** cards per active deck
- **30-second turn timer** per player (live countdown, server-authoritative); on expiry, auto-pick a mandatory card at random and skip the situation card
- **15-second post-resolution pause** between balls so players can read the breakdown before timer pressure resumes
- Simultaneous reveal of both players' selections
- Full resolution chain (Old School cancel → Mankad/Retired Out/Cramps swaps with prompted picker → engine: zone modifiers / base lookup / Invariable Bounce / adjective / fielding / Power Surge / DRS / Review Appeal / No Ball / Wide-outside-off check)
- Pokemon-style card UI with click-to-view, tooltips on every icon, and a swap-picker that shows the table snapshot while the player chooses a replacement
- Per-player deck/hand/discard tracking with anti-clog rule
- End-of-innings transition (roles swap) + end-of-match summary with margin

**Out of scope for v1 (deferred):**
- Pre-made decks UI — v1 uses random auto-fill, draft flow comes later
- Messenger Instant Games SDK integration — v1 runs as a plain web build
- Custom card art — v1 uses simple typographic cards with emoji-placeholder icons
- Real-life photo library for outcome reveals — v1 shows the cards themselves at reveal
- Role bonus / phase upgrade (still backlog)
- Bronze/Silver inherent Pace-or-Spin resistance based on real player stats (still backlog)
- Roster gaps for 5th stump strengths and Wide outside off bowlers/batters (still backlog)

## Build Status (as of current commit)

What's actually shipped on `main`:

| Layer | Status |
|-------|--------|
| Monorepo scaffold (npm workspaces; shared / server / client) | ✅ |
| Card data parsed from markdown to JSON (132 batsmen + 132 bowlers + 14 situation cards) | ✅ |
| Resolution engine (pure function, 29 unit tests) | ✅ |
| Lobby (create / join / reconnect / leave) | ✅ |
| Coin toss state machine | ✅ |
| Innings flow (random decks, ball loop, two innings, end-of-match) | ✅ |
| Mid-ball swap interaction (Mankad / Retired Out / Cramps with player picker) | ✅ |
| 15s post-reveal pause + final-ball reveal before match-over | ✅ |
| No Ball, Wide outside off mechanic, Shuffle Across | ✅ |
| Pokemon-style card UI + tooltips + click-to-view | ✅ |
| Live ball timer (30s) + swap timer (15s) + post-ball timer (15s) | ✅ |
| Reveal: filter cards to only show in-play attributes | ⏳ next |
| Resolution breakdown animation (CSS keyframes) | ⏳ |
| Deck draft (player-chosen) | ⏳ |
| Messenger Instant Games integration | ⏳ |
| Real-photo asset library | ⏳ |

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
