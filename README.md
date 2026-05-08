# 🏏 Swipe Sixer

A turn-based cricket card game designed for Facebook Messenger.

## Concept

Swipe Sixer is a two-player card duel where each player builds a **batting deck** and a **bowling deck** of 20 cards each. Players take turns batting and bowling over a 6-ball innings, playing cards simultaneously each ball in a blind-reveal mechanic.

## How It Works

### Match Flow
1. **Coin Toss** — invited player calls it, winner chooses to bat or bowl first
2. **First Innings** — 6 balls (or 2 wickets), one player bats, the other bowls
3. **Second Innings** — roles swap, chasing begins
4. **Result** — highest score wins

### Each Ball
Both players select cards face-down, then reveal simultaneously:
- **Batting side plays:** 1 Batsman card (mandatory) + 1 Situation card (optional)
- **Bowling side plays:** 1 Bowler card (mandatory) + 1 Situation card (optional)

### Card Interactions
1. Situation cards activate (cancels, swaps, buffs)
2. Bowler's delivery zone is looked up on the batter's card
3. Bowler's adjective modifier applies (downgrades outcomes if batter isn't resistant)
4. Bowler's fielding coverage applies (downgrades shots to covered regions)
5. Final result: runs scored or wicket taken

### Card Types

**Batsman Cards** have strengths (4s and 6s), neutrals (1s and 2s), weaknesses (wickets), and resistances against certain bowling adjectives. Everything not listed is a dot ball.

**Bowler Cards** have a delivery zone, an optional adjective (swing, seam, spin, pace, cutter, reverse), and fielding coverage that neutralizes certain shot regions.

**Situation Cards** are one-time-use tactical plays (details TBD).

### Card Tiers
| Tier | Strengths | Neutrals | Weaknesses | Resistances |
|------|-----------|----------|------------|-------------|
| Elite | 3 | 2 | 1 | 2 |
| Gold | 3 | 2 | 1 | 1 |
| Silver | 2 | 2 | 2 | 0 |
| Bronze | 1 | 2 | 3 | 0 |

### Deck Building
- Each deck holds 20 cards (batsman/bowler cards + situation cards)
- Hand size: 4 cards, draw back to 4 after each ball
- All cards are one-time use — played cards are discarded
- If your hand is all situation cards, discard one and redraw

## Card Roster

264 player cards across all 12 Test nations (11 batsmen + 11 bowlers per nation):
- 🇮🇳 India | 🇦🇺 Australia | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England | 🇿🇦 South Africa
- 🇳🇿 New Zealand | 🇵🇰 Pakistan | 🇱🇰 Sri Lanka | 🌴 West Indies
- 🇧🇩 Bangladesh | 🇿🇼 Zimbabwe | 🇦🇫 Afghanistan | 🇮🇪 Ireland

See [docs/card-roster.md](docs/card-roster.md) for the full roster with every card's attributes.

## Project Status

See [docs/todo.md](docs/todo.md) for the current roadmap and [docs/MEMORY.md](docs/MEMORY.md) for the canonical design.

### Completed
- ✅ Core card system design (tiers, zones, strengths/weaknesses)
- ✅ Adjective modifier system
- ✅ Resistance system
- ✅ Fielding coverage system
- ✅ Full 264-card roster across 12 nations
- ✅ 11 situation cards designed (data model splits Old School Cricket Only into batting/bowling variants → 12 in JSON)
- ✅ Monorepo scaffold + parsed card data + server health check + client shell

### Up Next
- ⬜ Coin toss flow
- ⬜ Deck draft (20 rounds per deck, 15s timer, situation card injection)
- ⬜ Ball loop (selection, 30s timer, simultaneous reveal, full resolution chain)
- ⬜ Outcome reveal screen with photo library
- ⬜ Messenger Instant Games integration

## Tech Stack
- **Frontend:** React + TypeScript + Vite (`client/`)
- **Backend:** Node.js + Express + Socket.IO (`server/`)
- **Shared types & card data:** TypeScript workspace (`shared/`)
- **Hosting target:** Fly.io free tier
- Node version pinned via `.node-version` (Node 20)

## Repo Layout
```
.
├── shared/    npm workspace — types, constants, card data (parsed JSON)
├── server/    npm workspace — Express + Socket.IO authoritative game server
├── client/    npm workspace — React + Vite SPA
├── assets/    photo library (per-player + watermarked stock fallbacks)
└── docs/      design docs (MEMORY.md, card-roster.md, situation-cards.md, todo.md)
```

## Local Development

Prerequisites: [`fnm`](https://github.com/Schniz/fnm) (or any Node version manager) — the repo pins Node 20 via `.node-version`.

```bash
fnm use            # picks up .node-version
npm install        # install all workspace deps
npm run parse-cards    # regenerate shared/src/data/cards.json from docs/*.md (optional; checked in)
npm run typecheck      # typecheck shared, server, client
npm run build          # build all three workspaces
```

To run the dev environment (two terminals):
```bash
npm run dev --workspace server   # http://localhost:3001
npm run dev --workspace client   # http://localhost:5173
```

## License
TBD
