# World Cup Draft — session log, 2026-10-30

Branch `wcdraft/phase-0-1`. Everything below is committed unless marked **uncommitted**. Detailed
rationale lives in `docs/wc-draft-game-design.md` (§5.6, Phase 2/2b/3, §11 decisions),
`wcdraft/README.md` (ratings items 1–9, engine) and `draft/README.md` (client).

## Commits, in order

| Commit | What |
|---|---|
| e49d950 | **Shown skills + backup evidence.** 13 Cricsheet league archives fetched; `domesticToDate` per player-edition; domestic relative vector is the prior centre under the T20I career (shrink 100, transfer 0.7); ODI prior usable from 120 balls. Every skill carries `shown`: hidden when window, T20I career, *recent* domestic (last 4 seasons) and ODI are all thin; ODI vouches for bowling only in 2007/09; the role's own skill is always shown; a hidden skill cannot make an all-rounder (Kohli 2024 = batter). Cards print "rarely bats / rarely bowls". `data:build` no longer wipes `data/out/engine/`. |
| 20c7f7e | **Debutants + blank squads.** No record anywhere → rated from the tournament's own balls (`source: "tournament"`, 162 player-editions, outside validation). 19 player-editions with nothing at all → Bronze, both hidden. Squads that are mostly blank (Namibia standing in for Afghanistan 2012) are listed in `index.json` `blankSquads` and never spun. |
| c4c3fbc | **Card review.** RHB/LHB on every card, bowling code (RFM, OB, SLA…) for anyone who bowls. **Batting out of position**: `environment.positionPhaseBalls` (balls by position × phase) → `draft/src/game/slots.ts` re-weights a batter's number to the slot's phase mix, shown on "Place here", slot rows, lineup. **Grounds brief** (`VenueBrief.tsx`): edition vs archive, your grounds, pace/spin split (`environment.paceSpin`), plain-words chips, "what your grounds ask for". |
| 7d42227 | **Engine log + scorecards (steps 1–2 of the presentation plan).** Dismissals (kind from the ground's fingerprint, bowler credited unless run out, fielder/keeper), partnerships, extras split, bowler maidens/dots/wides/no-balls, `runsAfter`/`wicketsAfter` per ball, `engine/awards.ts` player of the match. Client: `MatchCard.tsx` + `Scorecard.tsx`, your players highlighted. |
| 9145a00 | **Stats tab, innings-first layout, draft guard.** `keepScorecards` keeps every fixture's innings; result tabs (matches / stats / tables / knockouts) with tournament leaders. Summary and scorecard laid out by innings. `needs()`/`eligible()`: once open slots = what the side still needs (5 who bowl + keeper), only players meeting a need are selectable; bites first after 5 picks. |
| 3f0b974 | **Keeper does not bowl; `/draft` deploy.** `designatedKeeper()`: a lone keeper-bowler keeps and loses his overs; a second non-bowling keeper frees him; engine marks the keeper `canBowl: false`. Vite `base: "/draft/"`, back link, `.dockerignore` excludes `wcdraft/.cache` (1.3 GB). |
| d8cf210 | **Position prior, pace/spin split, standings.** Thin batting records rest on the player's position band (1–2, 3–4, 5–7, 8–11) instead of the all-batters population (the "Bumrah 60" cause: tail-enders carried a middle-order survival rate). Per-batter `batting.byBowlClass` (residual vs own level, shrunk, clipped 0.6–1.6) → engine `batVsClass` multiplier and card "v pace / v spin" (from 60 balls). Standings redrawn as proper tables (# team P W L NR Pts NRR). |

Tests at the end: **41 wcdraft, 6 draft, all passing.** Data outputs (`wcdraft/data/out`) rebuilt and committed with each ratings change.

## Uncommitted, for Yash to commit with his own cottage/play set

- `server/src/index.ts`: serves `draft/dist` at `/draft` (same pattern as `/cottage`, `/play`).
- `Dockerfile`: copies `wcdraft/` + `draft/` into the builder, `draft/dist` into the runtime; builds with `--if-present`.
- `client/src/screens/HomeScreen.tsx`: "🏏 World Cup Draft" link above Game Night.
- Root `package.json` / `package-lock.json` already carry the `wcdraft` and `draft` workspaces.
- Then: merge → push → `fly deploy`. `draft/tsconfig.app.json` is a stub to delete.

## Facts worth remembering

- Dev server: `npm run dev --workspace draft` → **http://127.0.0.1:5174/draft/** (base path). "No record everywhere" on cards = stale `draft/public/data`; run `npm run sync:data --workspace draft`.
- Pool = players who appeared (West Indies 2007 = 11 cards); official 15-man squads is a parked item.
- Validation unchanged by the shown/prior work (within-edition bat ≈ 0.33, bowl ≈ 0.19; needs 60 pre-tournament balls so tournament-sourced debutants stay out).
- Known modelling notes: hazard prior 2000 means tail dismissal rates move only ~10% from their band centre; batExponent 0.7 compresses further. A 60 from a No. 10 is now a one-in-several-hundred innings, not impossible.

## Open with Yash

- Livingstone 2021 Gold: count career balls in the thin-evidence Elite cap? (78 window balls, first among 2021 batters.)
- Presentation plan steps 3–4: match-by-match pacing with hub (play next / sim to my next / sim the rest) and live playback of `FixtureResult.balls` with commentary and speed control; step 5 headlines.
- Later: Cricket-IQ, head-to-head, leaderboard, share links, Timeless/Tournament Form tags, coach bonuses/duos, official squads, bowler-aware death intent.
