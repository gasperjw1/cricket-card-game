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

## Notes

- `tsconfig.app.json` is a leftover stub; `tsconfig.json` (app) and `tsconfig.node.json` (config
  and tests) are the real ones.
- Player numbers marked `*` are low-sample (prior-led); tiers already cap those.
