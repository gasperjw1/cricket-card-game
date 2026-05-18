# CPU Bot Opponent — Plan

> **Status (v4): Phase 1 shipped.** Three difficulty tiers
> (Gully / Domestic / International) are live in `server/src/bot/`. The
> "Play vs CPU" home-screen entry wires through. International saves
> Elite cards for the death phase (scaled per format). Phase 2 (smarter
> heuristics) is in the backlog — see [todo.md](todo.md).

This doc covers the design for adding a CPU/bot opponent so players can
play solo without needing a friend. Based on Yash's feedback that many
players have asked for this.

---

## Goals

1. **Solo onboarding** — let new players try the game without finding a
   friend or sharing an invite code.
2. **Practice mode** — let existing players warm up vs predictable AI
   before challenging real opponents.
3. **Foundation for career mode** — long-term, this becomes a
   single-player progression where players draft + build their own
   deck against a series of bot opponents.

## Non-goals (for v1)

- ML-trained bots, lookahead simulation, or perfect-play AI.
- Networked bot scaling (the bot lives on the same Fly server).
- Bot-vs-bot spectator mode.
- Career mode itself — this is parked for later. The bot infrastructure
  built here will support it, but no progression / unlocks for now.

---

## Difficulty levels

Three levels with cricket-themed names:

| Difficulty | Strategy | Skill |
|------------|----------|-------|
| **Gully** | Mostly random valid picks. Cricket on the street. | Beginner-friendly; easy to win against. |
| **Domestic** | Heuristic — bowler bowls toward batter weaknesses, batter avoids cards with too many weaknesses on the likely zone. Saves Elite for last over. | Real challenge for casual players. |
| **International** | Domestic logic + tier prioritization, situation-card timing (DRS at the right moment, Day 5 Pitch when bowling Outside off). | Punishing — beat this and you've earned it. |

Phase 1 implements all three but the heuristic is shallow. Phase 2
deepens it.

---

## Bot identity

**Names** — pool of ~10 fun cricket-themed options, picked at random per
match:

```
Bot McBowlface, Captain Sixer, The Spin King, Boundary Bot,
Yorker Yogi, Sir Slog-a-lot, The Pinch Hitter, Cover Drive,
Reverse Sweep Pete, Captain Cover
```

**Nation** — random from the 18 available (12 Test + 6 associate). Bot
matches the visual treatment of a real opponent — flag, name, etc.

**Avatar/abbreviation** — derived from name, same way humans get one
(`defaultAbbrFromName` already exists).

---

## Architecture

The bot is a **server-side player** that the match registry treats as a
normal player slot, except it has no socket connection. At every
"waiting for opponent input" point, the server invokes the bot
controller to synthesize the input inline.

```
┌─────────────────────────┐
│  HomeScreen             │
│   "Play vs CPU" button  │
│   → difficulty selector │
│   → submit              │
└──────────┬──────────────┘
           │ socket: "match:create-bot" { difficulty }
           ▼
┌─────────────────────────┐
│  Server                 │
│   MatchRegistry         │
│    creates match with   │
│    slotB = bot          │
│    slotB.isBot = true   │
│    slotB.difficulty=... │
│    no socket attached   │
│                         │
│   Coin toss / Innings:  │
│    if (slot.isBot) {    │
│      decision = bot     │
│        .pick(state, ...)│
│      submit(decision)   │
│    }                    │
└─────────────────────────┘
```

Most of the existing code stays as-is. The only "everywhere" change is:

```ts
// At each decision point:
const otherPlayer = match.players[otherSlot];
if (otherPlayer.isBot) {
  const decision = botController.pick(otherPlayer, match);
  applyDecision(otherSlot, decision);
}
```

---

## Files affected

### New (server)

- **`server/src/bot/controller.ts`** — main bot decision functions:
  - `botCallCoinToss(player, match) → "heads" | "tails"`
  - `botChooseRoleAfterToss(player, match) → "bat" | "bowl"`
  - `botSubmitBall(player, match) → BallSelection`
  - `botPickSwap(player, match, swap) → cardId`

- **`server/src/bot/heuristics.ts`** — strategy logic shared across
  difficulties (find weakest zone, find safest pick, etc.).

- **`server/src/bot/names.ts`** — name pool + abbreviation derivation.

### Modified (server)

- **`server/src/match-registry.ts`** — `createBotMatch(difficulty)`
  spawns a match with a pre-attached bot slot. `PlayerState` gains
  `isBot: boolean` and optional `botDifficulty: BotDifficulty`.

- **`server/src/coin-toss.ts`** — after human's call/choose, if the
  other slot is a bot, invoke bot controller to resolve its half.

- **`server/src/innings.ts`** — at each ball reveal, if a slot is a bot,
  call bot controller to submit its selection. Same for swap picks.

- **`server/src/index.ts`** — register new socket event
  `match:create-bot`.

### Modified (shared)

- **`shared/src/types/game.ts`** — add `BotDifficulty` type and
  `isBot` / `botDifficulty` fields to `PlayerState`.

- **`shared/src/types/socket.ts`** — add `match:create-bot` event +
  payload type.

### Modified (client)

- **`client/src/screens/HomeScreen.tsx`** — add "Play vs CPU" button
  with a dropdown (or radio set) for difficulty. Calls
  `client.createBotMatch(difficulty)`.

- **`client/src/state.ts`** — new `createBotMatch` method on
  `MatchClient` that emits the new socket event.

---

## Phase 1 scope (~3-4 hours)

1. Bot infrastructure on the server (the architecture above).
2. **Gully difficulty: pure random picks** (any valid card).
3. **Domestic difficulty: shallow heuristic** —
   - Bowler picks the bowler card whose delivery zone hits the most
     weakness zones on the *most recently revealed* batter card. (We
     don't know the next batter, so use the last one we've seen.)
   - Batter picks the batter card with the fewest weakness zones, among
     valid cards.
4. **International difficulty: Domestic + tier prioritization** — saves
   Elite cards for the last 2 balls of an innings.
5. Bot handles coin toss (just calls a side, picks bat or bowl 50/50).
6. Bot handles swap picks (random valid).
7. Home screen: "Play vs CPU" button + difficulty selector.
8. **No changes to engine, no changes to reveal flow, no changes to
   storytelling** — bot looks like a real opponent end-to-end.

## Phase 2 scope (~3-4 hours, deferred)

- Smarter heuristics:
  - Track running score/wickets to inform card selection.
  - Bowler considers batter resistances when picking adjective-bearing
    cards.
  - Strategic situation card use (DRS only when wicket likely; Day 5
    Pitch when bowling Outside off; etc.).
- Bot personality variation: aggressive (favors slogs/lofts) vs
  defensive (favors anchors).

## Phase 3 scope (~2 hours, polish)

- "Bot is thinking..." UI delay (currently bot picks instantly which
  feels weird).
- Bot reaction emoji on the result screen ("😅" on a wicket, "🔥" on
  a six, etc.) for personality.
- Bot post-match dialogue ("Good game!" / "Lucky escape!").

---

## Long-term: World Cup mode (parked)

The bot infrastructure built in Phase 1 supports an eventual
**single-player World Cup mode** where players progress through a
tournament structure and earn better cards as they go:

1. Start with a small starter deck (maybe 1 nation, mostly Silver/Bronze).
2. Play through a tournament-style series of bot opponents at
   progressively higher difficulty (Gully → Domestic → International),
   structured like a real cricket World Cup (group stage → knockouts).
3. After each match win, **draft new cards into your deck** — better
   wins (e.g. knockout stages) unlock higher-tier picks.
4. Lose your tournament progress on a knockout-stage loss; group-stage
   losses just cost you a match.
5. Eventually unlock all nations / all tier slots and replay with
   different starter decks for variety.

This is **not in scope for Phase 1-3.** The plan here is just to make
sure the bot infrastructure doesn't preclude it later. Notes on what
would be needed when we build it:
- Persistent player state (currently match state is ephemeral) —
  probably needs a small SQLite or per-user JSON store.
- Deck-building UI (the existing draft flow may be reusable).
- Tournament bracket / progression tracking.
- Card-unlock economy (which cards unlock when, replay incentives).
- World Cup theming for the UI (bracket visualization, "you've reached
  the semis" celebration, etc.).

---

## Decisions confirmed (from Yash)

1. ✅ Phase 1 first, then evaluate.
2. ✅ Three difficulties: Gully / Domestic / International.
3. ✅ Random fun name + random nation per bot match.
4. ✅ Infinite bot matches (no per-user limits).
5. ✅ Long-term goal: single-player career mode with deck building.

## Decisions still to make (during Phase 1 implementation)

1. **UI placement** — "Play vs CPU" as a primary button next to "Create
   match" / "Join match"? Or hidden behind a "More" submenu? My vote:
   primary button, equal weight to the multiplayer flows.
2. **Name pool** — the 10 names above are placeholders. Want me to use
   them, or do you have other ideas?
3. **Bot socket disconnect handling** — should a bot match end if the
   human disconnects, or persist (so they can reconnect)? My vote:
   end on disconnect for now, no reconnect.
