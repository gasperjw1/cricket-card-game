# SWIPE SIXER — ToDo List

Living roadmap. Current state: live at `cricket-card-game.fly.dev` with
multi-format play (T1, T3), CPU bots (3 difficulties), role/phase perks,
storytelling sequences, settings, and a working World Cup career mode.

---

## Shipped

### Core engine + cards
- [x] Core card system (tiers, zones, strengths/neutrals/weaknesses)
- [x] Bowler adjective modifier system (no-stack for Elite 2-adj bowlers)
- [x] Batter resistance system (cancels matching adjective)
- [x] Fielding coverage (heuristic shot→region mapping)
- [x] Wide outside off (tier-based wide-call on dots)
- [x] Full roster — 168 batters + 164 bowlers + 16 situation cards across 18 nations
- [x] Categorical shot/dismissal taxonomy (drives result-screen images later)
- [x] Handedness on every batter (mirror grid + silhouette)
- [x] Roles on every batter (top-order / middle-order / finisher) + every bowler (powerplay / middle-overs / death-overs)

### Engine perks (v4 role/phase update)
- [x] Batter in-phase upgrade (10% scoring tier-up)
- [x] Batter out-of-phase dot (25% scoring → dot)
- [x] Bowler in-phase wicket (10% dot → wicket)
- [x] Bowler out-of-phase wide bump (+20% on leg/outside-off)
- [x] Wicket save → 2 / 4 byes (15% each) with dismissal-typed narrative
- [x] Misfield (5% 4↔6 swap)
- [x] Inside edge on bowled (5% bowled wicket → 1-4 runs)
- [x] Run-out on neutral (10% 1/2 → wicket)
- [x] Rebowl rule: BOTH mandatory cards return to deck on No Ball / Wide

### Match flow
- [x] Monorepo (shared / server / client) + parsed card data + Socket.IO contracts
- [x] Resolution engine (50 unit tests)
- [x] Lobby + invite-code + reconnect + leave-closes-match
- [x] Coin toss flow (countdown → call → flip → bat/bowl)
- [x] Server innings flow (random decks, ball loop, two innings, end-of-match)
- [x] Mid-ball swap UI (Mankad / Retired Out / Cramps)
- [x] Live ball timer (pitch-clock baked into scorebug)
- [x] Post-ball pause (10s) + final-ball reveal before match-over
- [x] Match formats: T1 (6 balls) + T3 (18 balls)

### UI
- [x] Pokemon-style card with tier-color border, nation flag, silhouette, role chip
- [x] 3×4 zone grid (mirrored for lefties)
- [x] Combined card view in hand (description + grid + skills, no tabs)
- [x] In-phase ✦ highlight on role chip when matching current phase
- [x] "Use" button under each hand card (one-tap commit, modal still available)
- [x] Horizontal-scrolling draft + deck-mgmt grids with peek-at-next + count hints
- [x] Scorebug (TV-style + phase pill + integrated timer)
- [x] Story-sequence reveal (pitch → bowler → batter → result, with SFX hooks)
- [x] Settings panel (SFX on/off, commentary style, story speed)
- [x] Fan-made disclaimer + About modal on home screen

### CPU bot
- [x] Three difficulties (Gully / Domestic / International)
- [x] Single-nation themed bot decks with cross-nation fallback for short tiers
- [x] Heuristic ball selection scaled to format phase
- [x] Bot-vs-batter / Bot-vs-bowler match-up scoring

### Career mode (World Cup)
- [x] localStorage-backed `CareerSave` with permanent collection + ephemeral WC run
- [x] 5-round draft (Elite/Gold batters + bowlers + situations)
- [x] Hidden knockout opponents until reached
- [x] WC ladder state machine (group → semi → final, group needs 3+ wins to advance)
- [x] Custom-deck server path: client supplies card ids, server validates + tops up
- [x] Per-win pack (6 cards, pick 2 → run inventory)
- [x] Trophy pack (special composition, picks → permanent collection)
- [x] Pack-opening screen (basic, no animations yet)
- [x] Deck management between matches (inventory ↔ deck swap)
- [x] Abandon-run flow

### Polish
- [x] Cancel-notice banner when Biryani / Old School blocks a played situation
- [x] Reveal trail with sequential step animation
- [x] Mobile portrait lock with rotate hint
- [x] iOS audio-pool init on first tap (autoplay restriction workaround)

---

## In flight / next

- [ ] **Source the 10 SFX files** per `docs/sfx-sources.md` and drop into `client/public/sfx/`
- [ ] Pack-opening polish: per-card reveal animation, rarity-specific pull sounds, anticipation pause
- [ ] Read-only collection-view modal (currently just a count in career-home footer)
- [ ] Real-photo asset library — per-player shot images + bowler run-ups + celebrations
- [ ] Edge-case tests for the WC state machine

## Backlog

- [ ] **T5 format** (5 overs, design with margin for swap effects from the start)
- [ ] Replace real player names with fictional names before public launch (see memory: project_fun_polish_plan.md)
- [ ] Roster expansion to support T5 / nation-locked decks
- [ ] **Nation mode** career — locked to one nation's roster, deferred until roster expansion
- [ ] Online use of permanent collection (the "freeplay" tier the WC trophy pack feeds)
- [ ] CPU bot Phase 2 — smarter card pickings, hand-aware strategy
- [ ] Trade-in: convert 3 Bronze of same nation into 1 Silver
- [ ] Daily challenge with curated deck → bonus pack reward
- [ ] Achievements + per-run stats screen
- [ ] Messenger Instant Games SDK integration

## Known issues / quirks

- Career mode locked to T3 (T1 too short for tournament arc; T5 not built yet)
- Outlier Gold batters (Mendis, Asalanka, Phillips) have stronger-than-baseline tier shape — intentional, not bugs
- 10 Bronze cards have S0 N3 W3 (no reliable scoring zone) instead of S1 N2 W3 — intentional sub-pattern for tail-end power hitters
