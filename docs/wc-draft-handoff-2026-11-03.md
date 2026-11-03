# World Cup Draft — handoff for the next agent (2026-11-03)

Everything a fresh agent needs to pick up the remaining work on World Cup Draft. Read this, then
`docs/wc-draft-game-design.md` (the spec and its dated decision log at the end of Phase 3) and
`docs/wc-draft-engine-refit-2026-11-01.md` (engine state and measurements). Branch: `wcdraft/gazette`,
head 8514cb1 or later; `main` is behind it. Owner: Yash (solo dev, cricket-literate, makes the calls).

## How the project is laid out

- `wcdraft/` — data pipeline (Cricsheet archives → `data/out`), ratings, and the ball-by-ball engine.
  `npm run data:build` wipes `data/out` except `engine/` and must be followed by `npm run ratings:build`.
  Tests: `npm test --workspace wcdraft` (53, several need the built data).
- `draft/` — the Vite + React client (the game). `npm run sync:data --workspace draft` copies the
  outputs into `draft/public/data`. Tests: `npm test --workspace draft` (63). Build:
  `npm run build --workspace draft` (tsc then vite). Dev server: run from a shell in `draft/`
  with `node node_modules/vite/bin/vite.js --port 5174 --strictPort --host 127.0.0.1`
  (the app's preview launcher fails with EPERM on this machine), then open
  `http://127.0.0.1:5174/draft/`. Served in production at `/draft` by the Swipe Sixer server.
- `wcdraft/scripts/research/` — the measurement scripts used this week (replay eval, associates,
  player-level distributions, dot clustering, Elo baseline, intent A/B, era scale, pooled scale).
  Run with `npx tsx wcdraft/scripts/research/<name>.mts …` from `wcdraft/`; each prints its usage
  in its header comment. `draft/scripts/facts-corpus.mts` and `draft/scripts/rarity.mts` are the
  gazette corpus and rarity harnesses.

## Working rules Yash has set (do not break these)

- Node 20 via fnm: `eval "$(fnm env)"; fnm use default` before any node/npm command.
- Edit files with the Edit/Write tools only; no shell heredocs, no sed edits, never `rm`.
- Vet any third-party package and wait for Yash's OK before installing.
- Research agents must not use proxies, readers or caches, and must not scrape ESPNcricinfo.
- Do not commit the root `package.json` / `package-lock.json` (Yash's own changes there).
- After pushing visible changes, tell Yash to merge `wcdraft/gazette` → `main`, push, `fly deploy`.
- Placement in the draft is always the user's choice (no auto-place); the batting order cannot be
  changed after the draft; "edition" is the World Cup's word, a newspaper is an "issue".
- The sim need not match real results; it must be honest: nothing on a card or in the paper that
  the engine does not play or the scorecard does not show. Measure before changing the engine.

## State of the ratings data

`wcdraft/data/out` and `draft/public/data` were last rebuilt and synced on 2026-11-03 with every
ratings knob at its committed value (team-tier gains neutral). Safe to deploy as is. If you change
anything under `wcdraft/src/ratings` or the engine's data layer, rebuild ratings and sync again.

## Done (so the next agent does not redo it)

Engine refit (calibrations 1/1/1, ball-weighted centring, non-striker run outs, real extras,
powerplay share, pitch pace/spin condition, shared card scale, intent A/B measured), the Gazette as
dated issues with innings cards, facts, record books (real all-time baselines), stop press ranked by
weight with combined facts, late news, souvenir issue (performers against expectation at the field's
level, record chains, the journey), between-match lever (captain and tempo), daily seed, Performance
score, share link, rarity measured inside the spec's dials, card overhaul and three-pane draft, team
sheet, draft-time fit. All of it is written up in the design doc's decision log with dates.

## Remaining work, in Yash's order

### 1. Finish the associates fix (parked, measured, not decided)

Problem: the sim gives associates 29% of their World Cup matches against full members; real is 13%
over 76 matches (2014–2026). Both roles are too kind: associates bat about 0.37 runs an over too
well, and their bowlers take wickets too often (full members lose a wicket every 18.7 balls against
them in the sim, 20.7 real; 22.5 in 2024–26).

Cause: not empty records. The two-way team-tier destination in `wcdraft/src/ratings/rate.ts`
(the `twoWay` branch around "tierDestination") has a flat bowling slope between a 1450 and an 1850
side, because the form window is dominated by associate cricket and the full-member rows are thin.

What exists: `MODEL.teamPrior` in `wcdraft/src/ratings/model.ts` with `destinationGain` (sides
below the field's mean Elo, fading in over 200 Elo) and `strongGain` (above), both at 1; the code
that applies them is in `rate.ts` just before the `own`/`dest` two-way mixtures. A `teamBinCentre`
prior was added too (`baseCentre`); it has no measurable effect and can stay.

Measured (ratings rebuilt for each, `wcdraft/scripts/research/associates.mts` on fit editions
2014,2016,2021,2022 and hold-out 2024,2026; `eval.mts` for Brier and first-innings spread):

| Setting | hold-out associate wins (real 2.5%) | fit (real 25%) | Brier | 1st-inn SD bias |
|---|---:|---:|---:|---:|
| gain 1 (today) | 23% | 31% | 0.1942 | +1.9 |
| symmetric 1.4 | 21% | 31% | 0.1901 | +3.5 |
| symmetric 2.0 | 15.7% | 29.6% | 0.1899 | +5.6 |
| weak-side only 2.0 | 22.7% | 31.1% | 0.1922 (2 seeds) | +2.8 |

Next step: rebuild at `destinationGain: 2.0, strongGain: 1.3` (written, never rebuilt), run the
same three measurements, and pick the setting that gets hold-out associates near 12–16% with the
first-innings spread no worse than about +3. Then: `npm test --workspace wcdraft` (the ratings test
"rests an empty record on its side's strength" must pass), sync, `npm test --workspace draft`,
rerun `draft/scripts/rarity.mts 1000 greedy` (expect lower rates), write the result into the refit
doc's "Engine items" section and the design doc's decision log, commit, tell Yash to deploy.

**Update 2026-11-02:** 2.0 / 1.3 was rebuilt and measured and did not qualify: hold-out 21.8%,
spread +3.2. The gains only reach batting, because bowling rates in `tierMode` "elo", not the
two-way branch, so the bowling half of the cause above is not where these knobs act. Gains are
back at 1. Bowling on the two-way step was then measured too (best: hold-out 18.8%, Brier
0.1888, but bowling stability 0.585 → 0.506). 2024's two-way bowling table runs the wrong way, so
it isn't adopted; see refit doc "Engine items" 5. Then the associate bowling step was measured
and built, on the card and per ball (items 6–8), then refitted with pre-2024 World Cups on the
square of the Elo gap (item 9). The fit/hold-out split traced to team Elo overrating associates,
not newcomers (item 10). Elo now uses an isolation penalty and the step is wickets only (item 11):
hold-out 13.4%, fit 28.2%, associate batting matches real (no batting step needed for now), Brier
0.1884, spread +3.0.

### 2. Era rule (step 4)

Largely settled: card steps between editions now read off one shared scale (`POOLED_SCALE` in
`draft/src/game/final-ratings.ts`), so the era step is the value shift alone. **Decided
2026-11-02: no explicit years-apart or adaptability rule.** There is no way to say which players
would adapt and which styles would not transfer between editions (design doc decision log).

### 2b. Yash's order from 2026-11-02

(1) In-match effects: **done** (refit doc items 12–14: adjusted streak, ball-in-over, chase-dot and
setness tables on; no momentum and no type differences after dots; bowling types filled for six
associate bowlers). (2) UI/UX clean-up and update: **done** (`wc-draft-ui-audit-2026-11-02.md`:
broken and confusing items fixed; every coach tag now played, refit doc item 15). Then on
2026-11-03: numbers only on every card, a landing page, the draft as rows with a full card on tap,
the souvenir issue in five sections, and super-over and bowl-out scorecards (audit doc "Rebuilt
2026-11-03"; engine side refit item 16). The rating bands exploration is written up in
`wc-draft-rating-bands-2026-11-03.md`: at a typical card's 300–450 balls no attribute separates two
levels, so no Cricket 26-style 15-step scale; three options (attribute bars, trait badges,
per-bowler wides and ODI weighting in the engine) await Yash's choice. (3) Dots: the −0.7 dot share, with the
pressure-sixes shortfall at required rates of 10–16 from item 13. (4) Re-evaluate. Leaderboards
and growth features go last; a Test-cricket auction league is the eventual pivot, on the back burner.

### 3. Housekeeping

Delete `draft/src/components/StyleResults.tsx` (unused) and `draft/tsconfig.app.json`; Yash must
do deletions himself or approve them. The Gazette preview's batting-order table still prints card
numbers rather than the in-edition numbers the draft showed (small).

### 4. Later, from the plan

Leaderboard (needs the Swipe Sixer server), "coming in" form on cards (the rating keeps no career
number; a ratings build change), growing the bank further from
`docs/wc-draft-report-style-corpus-2026-11-02.md` (460 now; Yash wanted 600–900). The stop-press
rate was remeasured after the associates fix (2026-11-02): upsets 6.8% of matches against 3.6%
real, stop press in 31.4%. No Gazette change; the excess is the associates gap, which Yash
accepts as it stands (it makes the game a little harder), so the associates fix is closed.

## Checks Yash expects on every change

Build and both test suites green; a browser run through a whole draft to the result when the
client changed (he has caught real bugs this way: innings tabs, a captain hand-off, team labels);
for engine or ratings changes, the replay eval before and after with Brier, biases and the
first-innings spread, plus the specific measurement the change targets; and a dated entry in the
design doc's decision log saying what was measured and what was decided.
