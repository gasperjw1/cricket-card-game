# World Cup Draft — data pipeline (Phase 0)

Builds every derived table the World Cup Draft game and its simulation engine need from the
Cricsheet men's T20I archive. Design spec: [`docs/wc-draft-game-design.md`](../docs/wc-draft-game-design.md).

## Quick start

```bash
# from the repo root, Node 20 via fnm (see memory: reference_node_environment)
npm install
npm run data:fetch  --workspace wcdraft   # downloads the men's T20I (≈15 MB) and ODI (≈18 MB) zips into wcdraft/.cache and extracts them (≈790 MB total)
npm run data:build  --workspace wcdraft   # ≈7 s, ≈230 MB peak RAM → data/out/
npm run data:labels --workspace wcdraft   # (re)generates data/labels/players.csv, preserving hand edits
npm test            --workspace wcdraft   # acceptance baselines against the spec's measured numbers
```

`data:fetch` is idempotent: it reuses the cached zip and re-extracts only when the extracted
file count does not match the zip listing. Pass `-- --force` to re-download. It also fetches two
small biography supplements into `.cache/`: the `player_meta` snapshot from the `cricketdata`
R package (pinned commit; ESPNcricinfo profile facts as at 24 March 2025, keyed by Cricsheet id)
and Cricsheet's people register. `src/cricinfo/rda.ts` reads the R data file directly, so no R
installation or extra package is needed.

## Layout

```
wcdraft/
  data/
    config/editions.json    hand-authored: editions, hosts, rule era, Afghanistan slot, stand-in + slot changes
    config/venues.json      canonical venues + Cricsheet alias strings (strict: unmapped WC venue = error)
    config/afghanistan-fixtures.json  Afghanistan's real World Cup fixtures (withheld by Cricsheet), for stand-in schedules
    config/hand-squads.json           hand-made squads for stand-ins with no T20Is near the edition
    config/captains.csv     T20I captains per nation (one row per captain, years only; 80 rows Cricinfo-sourced — see notes)
    config/coaches.csv      head-coach tenures per nation (Wikipedia; year precision for full members)
    config/formats.json     structured tournament format per edition (groups, pre-seeded vs positional Super stages, tiebreaks)
    config/rules-verification.json  playing-condition flags per edition with quoted sources
    labels/players.csv      labelling sheet: handedness, bowling type, keeper flags, dob (snapshot-prefilled)
    labels/hand-entries*.csv reviewed lookups for players the snapshot lacks (matched by name + team)
    labels/sources/         raw snapshot values for our players, for auditing the normalisation
    out/                    generated (committed): see "Outputs"
  src/
    cricsheet/archive.ts    download / extract / index / stream the archive (one match in memory at a time)
    cricsheet/match.ts      normalised match model: id-keyed balls, innings summaries, phases
    cricsheet/types.ts      the subset of the Cricsheet JSON schema we read
    cricinfo/rda.ts         dependency-free reader for R .rda files (XDR v2/v3; gzip/bzip2/xz)
    cricinfo/player-meta.ts supplement download, parse, join and style normalisation
    analysis/               one accumulator per output table (editions, venues, players, usage, lineup, partnerships)
    pipeline/build.ts       the single chronological pass that drives every accumulator
    pipeline/report.ts      COVERAGE.md renderer
    pipeline/labels.ts      labels sheet generation + non-destructive merge
    cli/                    thin entry points for the npm scripts
  test/baselines.test.ts    measured-number acceptance tests
  .cache/                   gitignored raw archive + index
```

## Outputs (`data/out/`)

| File | Contents |
|---|---|
| `editions.json` | Per edition: scoring environment (RPO, dot/4/6 %, balls per wicket, phase RPO, first-innings avg/SD, chase win %, toss norms, dew proxy, extras), dismissal fingerprint, DRS review counts, rain, groups and stages, host win %, associate upsets, population outcome vectors per phase, rule flags, Afghanistan slot and stand-in |
| `venues.json` | Same environment block per canonical venue, overall and per edition |
| `player-editions/<edition>.json` | One row per (player, edition, team): `tournament`, `form` (24 months before), `formByOpposition` (the same form split by whether the opposition was a full member or an associate at the time), `careerToDate` (T20I snapshot at the edition's first match) and `odiCareerToDate` (ODI snapshot, summary only; the weak prior for 2007/2009). Blocks hold raw per-phase outcome counts for batting and bowling, batting positions, dismissal kinds, fielding counts, and a display summary |
| `window-population.json` | Per edition: form-window outcome vectors per phase, split by the tier of the side faced (batting vs full/associate attacks; bowling vs full/associate batting). Shrinkage priors and normalisation targets for ratings |
| `team-strength-odi.json` | The same Elo timeline over men's ODIs (team strength before T20Is existed; ODI captaincy baseline) |
| `squads/<edition>.json` | Per team-edition: players with appearances, inferred keepers, a `defaultXI` (most-used eleven in modal batting order) and `defaultBowlingOrder` for pairings that never happened, and every real match with XI, batting order, bowler per over, venue and result. Stand-in teams (Afghanistan's replacements) are included with `standIn: true` and a `source` of `form-window`, `nearest-t20is` (first T20Is after the edition, within 60 months) or `hand` (from `config/hand-squads.json`) |
| `people.json` | Person registry: Cricsheet id, display name, teams, editions |
| `bowling-usage.json` | Per edition and team-edition: bowlers used, quota completion after expensive starts, return rate after expensive overs, death-overs trust, phase share by bowler rank, sixth-bowler timing |
| `lineup-deviation.json` | Per team-edition modal batting order and how often positions 3–8 deviated from it, by phase of entry |
| `partnerships.json` | Squad-mate pairs with ≥ 60 balls together (tournament + form window) |
| `team-style.json` | Every team's batting/bowling style per calendar month over all T20Is (powerplay intent, wickets at 15, lower-order share, death RPO, bowlers used, bowl-first %), plus global per-month values for era-relative indices. Join coach/captain tenures on (team, month) |
| `team-strength.json` | Elo timeline over all men's T20Is: rating per team per month and every match with its pre-match win expectation (for captaincy wins-above-expectation and opposition quality). Tiered starts: full members 1600, others 1400; see the known limitation in the source header |
| `coverage.json`, `COVERAGE.md` | Which teams and players each edition gives us and who lacks form data |
| `meta.json` | Archive snapshot, licence, form window, thresholds |

## Ratings (Phase 1 prototype)

```bash
npm run ratings:build --workspace wcdraft   # ≈12 s → data/out/ratings/<edition>.json, RATINGS.md, ratings-summary.json
```

`src/ratings/` turns the player-edition tables into per-ball outcome vectors per phase and a
40–99 display rating per skill. The model, chosen by the validation sweep in `RATINGS.md`:

1. **Career anchor**: the T20I career-to-date vector, shrunk toward the population, is the prior
   centre; its strength grows with career balls (×0.5, capped at 300) so a thin form window cannot
   overturn a long record.
2. **Form**: the 24-month window is shrunk toward that prior (50 pseudo-balls, bowling ×2), with
   the dismissal cell on its own 1,000-ball prior because dismissal rates do not stabilise at these
   sample sizes (validation: r ≈ 0.1 for any estimator).
3. **Phases**: a pooled vector first, then each phase shrunk toward it with a 150-ball prior.
4. **Opposition**: batters are judged against batters from teams of the same strength facing the
   same opponent mix (a two-way, log-additively smoothed Elo table) and carried through the
   tier-to-tier gap into the edition's opponent mix; bowlers against what all bowlers conceded to
   batting sides of the strengths they faced. Only a measured share of an edge earned against weaker
   opposition is carried upward (≈0.15 left at a 250-Elo step).
5. **Venue normalisation** (computed, off by default): each ground in the form window gets a
   scoring factor (runs per ball ÷ window average, shrunk toward 1 with a 1,200-ball prior) and
   each player an exposure-weighted factor. Dividing scoring outcomes by it did not improve
   prediction, because window-averaged factors sit near 1; the per-innings, venue-type version
   (spin vs pace by ground class) and a projected modifier for the identity team's fixtures are
   the next step, and the factors are exported for it.
6. **Value**: percentage of population expected runs gained (or saved), net of 2.6 runs per extra
   dismissal, against the **window population projected onto the edition's opponent mix**, never
   the tournament's realised scoring (which inflated whole editions); phase-weighted 0.30 / 0.45
   / 0.25. The display rating maps the median to 70, the 99th percentile to 99 and the 5th to
   45, linear in value, after shrinking thin samples toward the middle.

Validation (pre-tournament rating vs what happened in that World Cup, 392 batting and 324
bowling player-editions): batting r = 0.30 vs 0.27 for raw strike rate and 0.28 for the same
value formula on raw form; bowling r = 0.15 vs 0.04 raw. Edition-to-edition stability 0.77 /
0.66 vs 0.45 / 0.44 raw. Known limits: associate bowlers with little exposure to top sides still
rate high (Erasmus 2024), because the edge-transfer gap is measured against the edition's average
opponent rather than the Super-8 field; anchors with low dismissal rates (Kohli) are undervalued
because hazard is shrunk hard; ODI priors for 2007/2009 are crude.

## Conventions

- People are keyed by Cricsheet person id; names are display-only.
- A ball is legal unless wide or no-ball. Batters face no-balls but not wides.
- Runs per over = all runs (wides and no-balls included) per six legal balls, as on a scorecard.
- Batting outcome `W` = striker dismissed on that ball (any kind). Non-striker run-outs are kept
  separately so they do not inflate the striker's hazard.
- Bowler runs conceded exclude byes, leg-byes and penalties; bowler `W` = bowler-credited dismissal.
- Phases: powerplay overs 1–6, middle 7–15, death 16–20.
- Usage norms use complete 20-over innings only; super overs are excluded everywhere.
- Rain-reduced innings (`Innings.reduced`) keep their innings-level figures but are excluded from
  per-phase outcome vectors; nine down with no rain counts as all out (absent-hurt cases).
- A dismissal off a wide counts as a dismissal "ball" in the striker's vector even though wides
  are not balls faced in the official figures.
- `chaseUplift` (2nd-innings RPO minus 1st) reflects dew where present but also target knowledge;
  it is not a pure dew measure.
- Wicketkeeper rule: anyone with any keeping evidence is keeper-eligible in every edition.
- Low-sample badge: fewer than 60 balls faced and fewer than 72 bowled in the form window.
- World Cup matches are identified by event name (`ICC World Twenty20`, `World T20`,
  `ICC Men's T20 World Cup`) and season key; qualifiers are excluded by exact-name matching.

## Known limits

- Afghanistan is withheld by Cricsheet, so every Afghan player and every match against
  Afghanistan is absent. Stand-ins per edition are in `config/editions.json`.
- Cricsheet has no line/length, shot type, handedness, bowling style, captain or coach. The
  first two cannot be recovered. Handedness, bowling type, date of birth and career keeper role
  come from the Cricinfo snapshot for 891 of 903 players; the rest, plus per-edition keeping,
  are hand-labelled in `data/labels/players.csv` (set `source` to `hand` on rows you edit so
  regeneration preserves them). Captains and coaches are compiled from open sources separately.
- Pre-2019 associate matches often lacked T20I status and are therefore missing; 2007 squads
  have almost no prior T20Is at all. See `COVERAGE.md` for the per-team picture.

## Data licences

- Match data and the people register © Cricsheet, licensed under the Open Data Commons
  Attribution License v1.0 (ODC-By). Any public use of these tables, or of the game built on
  them, must credit Cricsheet and name the licence.
- Player biography facts come from the `player_meta` dataset in the `cricketdata` R package
  (Hyndman et al., GPL-3), a snapshot of ESPNcricinfo profile fields. We use the data file only,
  do not redistribute the package, and do not scrape Cricinfo ourselves.
- This is an unofficial fan project, not affiliated with the ICC, any cricket board, or any player.
