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
- [x] Adjective modifier system (bowler upgrades that downgrade batter outcomes)
- [x] Resistance system (elite batters can nullify certain adjectives)
- [x] Fielding coverage system (bowler fielding downgrades shots to covered regions)
- [x] Weakness distribution across all zones (not clustered on 5th stump)
- [x] India roster — 11 batsmen + 11 bowlers (v3, approved)

## In Progress
- [ ] Remaining 11 nations roster

## Backlog
- [ ] Situation cards design
- [ ] Deck building rules and constraints
- [ ] Coin toss flow
- [ ] UI/UX design for card game
- [ ] Game state management
- [ ] Messenger integration
- [ ] Card art/visual design
