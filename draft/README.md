# World Cup Draft — client (Phase 3)

A web client over the `wcdraft` data and engine: spin an identity (a country at a men's T20 World
Cup, 2007–2026), pick a coach, draft eleven players from real squads of any edition into batting
slots, then play that edition's whole tournament ball by ball against real elevens. Decided
2026-10-30: website or app, not a Messenger Instant Game.

## Run

```bash
npm run data:build --workspace wcdraft      # once, after fetching the archive (see wcdraft/README.md)
npm run ratings:build --workspace wcdraft   # once
npm run dev --workspace draft               # syncs data into public/data, starts Vite on :5174
npm run build --workspace draft             # typecheck + production build in dist/
npm test --workspace draft                  # draft rules
```

`scripts/sync-data.mjs` copies the files the client fetches from `wcdraft/data/out` and
`wcdraft/data/config` into `public/data/` (git-ignored) and writes slim per-edition **pool** files
(what a spin card shows) so the heavy rating vectors are only fetched when a run is simulated.

## How it works

- **Engine in the browser.** `src/lib/data.ts` fetches the shared tables once and builds engine
  data per edition through `wcdraft/src/engine/data.ts` (pure; the Node loader `load.ts` wraps the
  same function). Everything the client imports from `wcdraft/src` is file-system free.
- **Rules** (`src/game/rules.ts`, tested): spins are uniform over every (team, edition) squad;
  one instance of each real person; eleven slots (2 openers, 2 top, 2 middle, 3 lower, 2 tail)
  with archetype fit highlighted; at least one keeper (anyone who has ever kept in a T20I); five
  players who bowl (the overs meter); budgets of 1 identity reroll, 1 coach-panel reroll and 2
  squad rerolls.
- **Determinism.** Every spin and the simulation derive from the run's seed, so a seed replays a
  run exactly (the basis for share links).
- **Simulate** (`src/game/simulate.ts`): drafted players keep their own edition's relative vectors
  (era-free), the coach's intent profile and the chosen captain's rating attach to the side, and
  `simulateTournament` runs the identity edition with the drafted eleven in the identity's slot,
  keeping that side's scorecards for the result screen.

## Screens (first slice)

Home (rules, seed) → Identity (team, edition, real record, reroll) → Coach (panel of three with
tags and intent words) → Draft (squad spin, slot placement, overs meter, keeper check) → Lineup
(reorder, captain, problems) → Result (headline, your matches with scorecards, group tables,
knockouts). Classic mode only; Cricket-IQ, head-to-head, leaderboard and share links follow.

## Cards, slots and grounds (added 2026-10-30)

- **Shown skills.** A card prints a batting or bowling number only when the record exists
  (T20Is, the last four league seasons, or ODIs; see `wcdraft/README.md` ratings item 8); otherwise
  "rarely bats" / "rarely bowls". Every card carries the batting hand (RHB/LHB) and, for anyone
  who bowls, the Cricinfo bowling code (RFM, OB, SLA …, spelled out on hover).
- **Against pace, against spin.** Every card with a batting number has a "v pace / v spin" line:
  the batting number shifted by the player's own split by bowler type and the population hand ×
  class term (`batting.byBowlClass`, see `wcdraft/README.md` item 8), both of which the engine
  applies ball by ball. `*` marks an estimate (under 60 balls even with ODIs); a small ODI tag marks
  a number that needed ODIs because T20 balls fell short. The stronger side is tinted when the gap
  is five points or more and neither number is an estimate.
- **Batting out of position** (`src/game/slots.ts`, tested). The engine applies a batter's
  per-phase vectors ball by ball, so a No. 3 at No. 7 is judged on his death-overs numbers. Each
  slot carries the phase mix that position actually faces in the identity's edition
  (`environment.positionPhaseBalls`, pooled across editions when thin), and a selected player's
  "Place here" button, the filled slot row and the lineup rows show his batting number re-weighted
  to that slot. Hover a slot for the mix ("faces 61% powerplay, 35% middle, 4% death").
- **Grounds and conditions** (`src/components/VenueBrief.tsx`). The identity screen and the
  draft header describe the edition against the whole archive (runs an over, powerplay and death
  rates, balls per wicket, chases won, spin against pace) and list the grounds your fixtures are
  at with the same numbers and plain-words chips (low-scoring, spin-friendly, chase ground, death
  overs fly …), ending with what those grounds ask of the eleven. All of it is measured from the
  ball-by-ball data the engine plays on; nothing is written by hand per venue.
- **Spins skip mostly blank squads** (`blankSquads` in `public/data/index.json`, written by the
  sync script): Namibia standing in for Afghanistan 2012 has no record in that era. The tournament
  still simulates them.

## Match summary and scorecard (added 2026-10-30, after the Cricket Chairman review)

- **Engine log** (`wcdraft/src/engine/match.ts`): every wicket now has a dismissal (kind drawn
  from the ground's dismissal fingerprint, bowler credited unless run out, fielder from the bowling
  side with the keeper taking stumpings and a share of catches), on a forked random stream so the
  match itself is unchanged. Innings carry partnerships and the extras split; bowlers carry maidens,
  dots, wides and no-balls; each ball in the log carries the score after it, for the live feed to
  come. `engine/awards.ts` names a player of the match by a points rule (runs scaled by strike
  rate, wickets with an economy adjustment, a little for catches, a tilt to the winner).
- **Result screen**: each of your matches is a summary card (`components/MatchCard.tsx`: both
  scores and overs, leading batters and bowlers, result line, toss, ground and date, player of the
  match) with the full scorecard underneath (`components/Scorecard.tsx`: batter with how he went,
  R B 4s 6s SR, extras and total, fall of wickets, stands, O M R W Econ). Your own players are
  highlighted. Both the summary card and the scorecard are laid out **by innings**: first innings
  on the left (batting side, then the fielding side's bowling), second on the right.
- **Result tabs**: Your matches · Stats · Tables · Knockouts. Stats holds your squad's batting and
  bowling and the **tournament leaders** over every match (`keepScorecards` keeps all fixtures'
  innings; ball logs stay identity-only): most runs, wickets, sixes, boundaries, best strike rate
  (60+ balls), best economy (12+ overs), player-of-the-match awards. Your players are highlighted.
  Knockouts show full match cards. Still to come: match-by-match pacing and live playback (steps 3
  and 4 of the review plan).
- **Draft guard** (`eligible` / `needs` in `rules.ts`, tested): once the open slots are down to what
  the side still needs (five players who bowl and a keeper), players who meet neither need are
  greyed out and a note says why; a spin always offers someone who can still be taken. The guard
  first bites after five picks with no bowlers or keeper among them. **The keeper does not bowl**
  (`designatedKeeper`): with one keeper in the side he keeps and his bowling does not count toward
  the five; with two, the gloves go to one who does not bowl so the other is free to bowl. The
  engine honours it too: the designated keeper is marked unable to bowl when the eleven is assembled.

## Player ratings tab (added 2026-10-30)

The result screen's **Player ratings** tab shows what each drafted player was worth in the World
Cup actually played (`src/game/final-ratings.ts`, tested; `components/PlayerRatings.tsx`). It does
not invent a second rating model: it runs the vectors the engine used through the engine's own
combination (base × rel^0.7 against average opposition, before match situation, with
`applyIntent` from `engine/ball.ts`) on both editions' base rates, and reads each value off that
edition's field on the card scale (median 70, 99th percentile 99, 5th percentile 45).

Each step is a difference on that scale, anchored on the card, so a number the card has already
held back for a thin record stays held back:

- **Era**: the same edge in the identity edition against its field, compared with the player's own
  edition against that field. Reflects both the scoring environment and where the player would
  stand among that field.
- **Batting at No. n**: the slot's phase mix (`slotWeights`) instead of the player's own.
- **Pace and spin mix**: the player's `batVsClass` residual against the edition's share of pace and
  spin. Measured as the engine applies it, so it carries any bias in the residual.
- **Coach intent**: the drafted coach's intent per phase.

Under the steps: strike rate or economy and balls per dismissal by phase, then and now; the
evidence behind the rating (balls by source, how much of the edge carries to the strongest sides);
and the player's figures in this run. Tournament Form points are not shown because the engine does
not apply them. A skill the card hides prints no rating, only an estimate of its rates.

## Deployment

The client builds with Vite `base: "/draft/"` and the Swipe Sixer server serves `draft/dist` at
`/draft` (same pattern as `/cottage` and `/play`); the homepage links to it. The Dockerfile copies
`wcdraft/` (committed data tables) and `draft/` into the builder, and `.dockerignore` keeps the
1.3 GB `wcdraft/.cache` out of the build context.

## Notes

- `tsconfig.app.json` is a leftover stub; `tsconfig.json` (app) and `tsconfig.node.json` (config
  and tests) are the real ones.
- Player numbers marked `*` are low-sample (prior-led); tiers already cap those.
