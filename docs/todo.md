# SWIPE SIXER — ToDo List

## Future Features

### 1. Batter Role Bonus (Phase Upgrade)
Some batters get a one-tier upgrade to ALL outcomes when they play in their preferred phase of an innings:

**Openers** — if played on ball 1 or 2, all outcomes upgrade:
- Dot → 1
- 1 → 2
- 2 → 4
- 4 → 6
- Weakness → Dot (they survive but don't score)

**Middle Order** — if played on ball 3 or 4, all outcomes upgrade.

**Closers/Finishers** — if played on ball 5 or 6, all outcomes upgrade.

This adds another layer of deck-building strategy:
- Do you play your finisher (Rinku) on ball 3 without the bonus, or hold him for ball 6 and risk losing wickets before he comes in?
- Do you burn your opener (Rohit) on ball 1 to get the bonus, or save him for a crucial middle-over ball?
- Players like SKY who bat middle order in real life would get the middle-over bonus, making them even more dangerous on balls 3-4.

**Card notation idea:** Each batter card would have a "Role" field:
- 🏏 Opener (balls 1-2)
- 🏏 Middle Order (balls 3-4)  
- 🏏 Finisher (balls 5-6)

Some elite batters (like Kohli) could have a dual role (Opener/Middle Order) making them flexible.

**Open questions:**
- Should the upgrade apply to weaknesses too? (Weakness → Dot would mean they can't get out in their preferred phase, which might be too strong)
- Should there be a DOWNGRADE if you play a batter out of position? (Opener on ball 6 gets downgraded?)
- Does this interact with bowler adjectives? (Adjective downgrades THEN role upgrades, or vice versa?)

---

## Completed
- [x] Core card system (tiers, zones, strengths/neutrals/weaknesses)
- [x] Adjective modifier system (bowler downgrades, batter resistances)
- [x] Fielding coverage system (heuristic shot→region mapping)
- [x] Weakness distribution across all zones
- [x] Full roster — all 12 nations, 264 player cards + 14 situation cards
- [x] Situation cards (13 effects: DRS, Power Surge, Retired Out, Switch Hit, Trot Down, **No Ball**, **Shuffle Across**, Mankad, Review Appeal, Cramps, Invariable Bounce, Day 5 Pitch, Old School ×2)
- [x] **Wide outside off automatic mechanic** (tier-based wide call on dot)
- [x] Monorepo scaffold (shared / server / client) + parsed card data + socket contracts
- [x] Resolution engine (29 unit tests; full 11-step chain + extras)
- [x] Lobby (create / join / invite codes / reconnect-by-token / leave / disconnect-closes-match)
- [x] Coin toss flow (10s countdown → call → flip → bat/bowl choose; server-authoritative timers)
- [x] Server innings flow (random decks, ball loop, two innings, simultaneous reveal, end-of-match)
- [x] Mid-ball swap interaction (Mankad / Retired Out / Cramps prompt the affected player to pick)
- [x] Pokemon-style card UI + tooltips on every icon + click-to-view + swap picker shows table snapshot
- [x] Live 30s ball timer + 15s post-resolution pause
- [x] Final-ball reveal before match-over screen

## In Progress
- [ ] Reveal redesign — filter cards to show only the attributes that fired
- [ ] Resolution breakdown animation (CSS keyframes, sequential step reveal, slash effect, number ticks)

## Backlog
- [ ] Player-driven deck draft (20 rounds per deck, 15s timer, situation card injection)
- [ ] Real-photo asset library (per-player shot/dismissal + bowler run-up + celebration)
- [ ] Messenger Instant Games SDK integration
- [ ] Custom card art (replace emoji placeholders)
- [ ] Bronze/Silver inherent Pace-or-Spin resistance — based on real cricket stats per player
- [ ] Roster gaps:
  - [ ] Add batsmen with strengths at 5th stump (counterplay to off-side bowling)
  - [ ] Add bowlers who deliver Wide outside off (so the wide mechanic actually fires)
  - [ ] Add batsmen with strengths at Wide outside off (for those who can manhandle the line)
- [ ] Batter Role Bonus / phase upgrade (see "Future Features" above)
