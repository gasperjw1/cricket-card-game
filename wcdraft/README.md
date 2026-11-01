# World Cup Draft — data pipeline (Phase 0)

Builds every derived table the World Cup Draft game and its simulation engine need from the
Cricsheet men's T20I archive. Design spec: [`docs/wc-draft-game-design.md`](../docs/wc-draft-game-design.md).

## Quick start

```bash
# from the repo root, Node 20 via fnm (see memory: reference_node_environment)
npm install
npm run data:fetch  --workspace wcdraft   # downloads the men's T20I (≈15 MB) and ODI (≈18 MB) zips into wcdraft/.cache and extracts them (≈790 MB total)
npm run data:bowlers --workspace wcdraft  # bowler types for everyone in the archives → data/labels/bowler-types.csv
npm run data:build  --workspace wcdraft   # ≈40 s → data/out/
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
| `player-editions/<edition>.json` | One row per (player, edition, team): `tournament`, `form` (24 months before), `formByOpposition` (the same form split by whether the opposition was a full member or an associate at the time), `formByOppBin` (pooled form counts per opponent-Elo bin), `careerToDate` (T20I snapshot at the edition's first match), `odiCareerToDate` (ODI snapshot, summary only; the weak prior for 2007/2009) and `usage` (matches picked vs team matches, form window and tournament). Blocks hold raw per-phase outcome counts for batting and bowling **and the context-expected counts over the same balls** (Phase 1.5), batting positions, dismissal kinds, fielding counts, and a display summary |
| `window-population.json` | Per edition: form-window outcome vectors per phase, split by the tier of the side faced (batting vs full/associate attacks; bowling vs full/associate batting). Shrinkage priors and normalisation targets for ratings |
| `team-strength-odi.json` | The same Elo timeline over men's ODIs (team strength before T20Is existed; ODI captaincy baseline) |
| `squads/<edition>.json` | Per team-edition: players with appearances, inferred keepers, a `defaultXI` (most-used eleven in modal batting order) and `defaultBowlingOrder` for pairings that never happened, and every real match with XI, batting order, bowler per over, venue and result. Stand-in teams (Afghanistan's replacements) are included with `standIn: true` and a `source` of `form-window`, `nearest-t20is` (first T20Is after the edition, within 60 months) or `hand` (from `config/hand-squads.json`) |
| `people.json` | Person registry: Cricsheet id, display name, teams, editions |
| `bowling-usage.json` | Per edition and team-edition: bowlers used, quota completion after expensive starts, return rate after expensive overs, death-overs trust, phase share by bowler rank, sixth-bowler timing |
| `lineup-deviation.json` | Per team-edition modal batting order and how often positions 3–8 deviated from it, by phase of entry |
| `partnerships.json` | Squad-mate pairs with ≥ 60 balls together (tournament + form window) |
| `team-style.json` | Every team's batting/bowling style per calendar month over all T20Is (powerplay intent, wickets at 15, lower-order share, death RPO, bowlers used, bowl-first %), plus global per-month values for era-relative indices. Join coach/captain tenures on (team, month) |
| `team-strength.json` | Elo timeline over all men's T20Is: rating per team per month and every match with its pre-match win expectation (for captaincy wins-above-expectation and opposition quality). Tiered starts: full members 1600, others 1400; see the known limitation in the source header |
| `situation.json` | Engine situation tables: outcome counts by innings × over × wickets down, by innings × phase, by chase required-rate band × phase, streak (with shuffled null), setness, ball-in-over, chase dots, day effects |
| `matchups.json` | Engine matchup tables: observed vs expected outcomes by batting hand × bowler class × phase |
| `coaches.json` | Coach tenures with era-relative style indices, philosophy tags and the engine's per-phase intent profile; the World Cups each coached |
| `captaincy.json` | Captaincy ratings: wins above Elo expectation per tenure, shrunk and standardised, joined to Cricsheet people (Cricinfo-sourced rows excluded pending a decision) |
| `ratings/populations.json` | Per edition: the value populations the rating vectors live in and the realised edition population (engine inputs) |
| `engine/replay-<edition>.json`, `engine/rarity-<edition>.json` | Replay harness and rarity measurement outputs (written by `npm run engine:replay` / `engine:rarity`) |
| `coverage.json`, `COVERAGE.md` | Which teams and players each edition gives us and who lacks form data |
| `meta.json` | Archive snapshot, licence, form window, thresholds |

## Ratings (Phase 1.5)

```bash
npm run ratings:build --workspace wcdraft   # ≈16 s → data/out/ratings/<edition>.json, RATINGS.md, ratings-summary.json
```

`src/ratings/` turns the player-edition tables into per-ball outcome vectors per phase and a
40–99 display rating per skill. The model, chosen by the validation sweep in `RATINGS.md`
(every knob and the evidence behind it is documented in `src/ratings/model.ts`):

1. **Context-expected evidence** (Phase 1.5). A first pass over the whole archive builds outcome
   populations by year-quarter × opponent-Elo bin × phase (sparse cells fall back quarter → year →
   all-time, then to "any opponent"; minimum 600 balls per cell) plus a scoring factor per ground
   (shrunk toward 1 with a 1,200-ball prior). The main pass then accumulates, next to every
   player's observed outcome counts, the counts an average player would have produced in each
   ball's context. `outcomes ÷ expected` is a context-neutral relative vector, so career, form and
   tournament blocks arrive pre-adjusted for era, opposition and (for bowling only, by the sweep)
   ground. This replaced the Phase 1 window-population normalisation.
2. **Career anchor**: the career-to-date relative vector, shrunk toward neutral, is the prior
   centre; its strength grows with career balls (×0.5, capped at 300).
3. **Form**: the 24-month window is shrunk toward that prior (100 pseudo-balls, bowling ×2), the
   dismissal cell on its own 2,000-ball prior because dismissal rates do not stabilise at these
   sample sizes.
4. **Phases**: a pooled vector first, then each phase shrunk toward it with a 300-ball prior.
5. **Edge transfer**: only part of an edge earned against weaker opposition is carried up to the
   **strongest third of the edition's teams** (the sides an unbeaten run must beat): the share is
   max(0.1, 1 − Δ/300) for an Elo gap Δ. Measured directly from the per-bin form counts, the slope
   of a player's edge against strong opposition on their edge against weak opposition is 0.23
   (batting, n = 112) and 0.05 (bowling, n = 115). The transport destination is still shaped by the
   player's team tier (two-way table): the sweep showed it earns its place even though it looks
   like counting team strength twice.
6. **Value**: percentage of population expected runs gained (or saved), net of 2.6 runs per extra
   dismissal, against the window population projected onto the edition's opponent mix; phase
   weights 0.30 / 0.45 / 0.25. **Cohort standardisation**: the context expectation's reference (an
   average T20I player of the period) weakened as the T20I pool grew, so World Cup squads beat it
   by 5% in 2010 and 13% in 2026 and later editions filled the top of the scale. Each edition's
   values are therefore shifted and scaled so the squads of its ten strongest teams have mean 0
   and a common spread; rankings within an edition and engine vectors are untouched. The display
   maps the median to 70, the 99th percentile to 99 and the 5th to 45, linear in value, after
   shrinking thin samples toward the middle.
7. **Usage**: `usage.formShare` / `tournamentShare` (matches picked ÷ team matches) and the
   era-locked **Squad Player** tag (under 25% of the tournament; 76 player-editions). A within-team
   selection prior (rarely picked players rating above their team median lose value) is
   implemented but **off**: the sweep found it neutral to slightly negative.
8. **Backup evidence and shown skills** (decided 2026-10-30). `npm run data:fetch` also pulls the
   men's domestic and franchise T20 league archives from Cricsheet (IPL, BBL, PSL, CPL, T20 Blast,
   SA20, ILT20, MLC, LPL, BPL, Super Smash, Syed Mushtaq Ali, MSL; `--no-leagues` skips them). Each
   player-edition carries `domesticToDate`: career-to-date league outcomes per phase with the
   competition × season expectation over the same balls. The ratings use the domestic relative
   vector, shrunk (100 balls) and partially transferred (exponent 0.7), as the centre the T20I
   career shrinks toward, so a bowler who has faced 30 T20I balls but 800 in the IPL gets his IPL
   batting while a regular T20I batter is untouched. The ODI prior is usable from 120 balls (was
   300) with weight in proportion, which is what backs 2007 and 2009 bowlers' batting. Every skill
   carries `shown`: false when the window, the T20I career, the **recent** domestic record (balls
   in the edition year and the three seasons before it: Kohli's 2008–13 IPL overs do not make him a
   bowler in 2024) and the ODI record are all thin. The ODI record vouches for batting in every
   edition but for bowling only in 2007 and 2009, before the league archives are deep enough. The
   role's own skill is always shown (a bowler with eleven T20Is is still a bowler; the low-sample
   badge says how thin the number is), and a skill that is not shown cannot earn the player an
   all-rounder role. The client prints "rarely bowls" / "rarely bats" instead of a prior-shaped
   number. Result over 2,074 player-editions: 889 bowling numbers hidden (735 specialist batters),
   488 batting numbers hidden (356 specialist bowlers), 18% of specialist batters show a bowling
   number, 52% of player-editions carry domestic batting evidence. A **tournament debutant** with no
   record anywhere before the event (no T20Is, no recent league, no ODIs: Rohit 2007, Amir 2009,
   Mathews 2009) is rated from the tournament's own balls, `source: "tournament"`, shown from 24
   balls faced / 36 bowled (162 player-editions; the within-edition validation already needs 60
   pre-tournament balls, so they stay out of it). A player with no record even there (appeared,
   neither batted nor bowled; 19 player-editions) is a Bronze card with both skills hidden. The
   draft client's sync script lists squads whose cards are mostly blank (`blankSquads` in
   `index.json`: only Namibia standing in for Afghanistan 2012) and the spin skips them; they still
   play in the simulated tournament. Phase numbers shrink toward the median exactly like the headline.
   **Position prior** (2026-10-30, after Bumrah made 60 in a playtest): the bottom of the batting
   shrinkage chain is no longer the all-batters population but the pooled relative vector of the
   edition's batters in the player's own position band (openers, 3–4, 5–7, 8–11; pre-tournament
   positions only; `MODEL.positionPrior`). A No. 10 with no record is an average No. 10: 2024
   tail-enders' mid-overs hazard moved from the population's 5.1% to 5.7% per ball (death overs
   ≈ 11%), scoring from 1.04 to 0.99 runs a ball. Bowling still rests on neutral.
   **Pace/spin split** (rebuilt the same day; `analysis/class-split.ts`, `bowlClassSplit` in
   `rate.ts`). `data/labels/bowler-types.csv` (`npm run data:bowlers`) gives the type of every
   bowler in the T20I, league and ODI archives, not only World Cup players; see "Bowler types"
   below. Each ball a World Cup player faced is filed by source and class against an average
   batter of the same hand, against that class, in that source, year and phase, each ball once.
   Inside each source the expected counts are scaled to the batter's own level, so a class is
   judged against him and a format gap cannot pass for a pace/spin gap. The sources pool (league
   ×1; ODI ×0.25 and only when T20 balls against a class are under 60, decided 2026-10-30), each
   class shrinks toward his level (2,000 balls, hazard 6,000), the two are held to a mean of 1 over
   the balls he faced and clipped to 0.6–1.6. The engine multiplies the striker's vector by it for
   the bowler's class, on top of the population hand × class matchup term; the card shows the
   headline shifted by both. Every batter the card shows has both numbers: `estimated` (printed
   with `*`) under 60 balls even with ODIs, where the residual is close to 1 and hand does the
   work; `fromOdi` (a small ODI tag) when ODIs were needed. 1,421 of 1,638 shown batters have 60+
   real balls of both. The evidence and the strengths are in the `MODEL.bowlClassSplit` comment.
   Expect small gaps: the old split (prior 200) was about four times wider than batters' actual
   splits in World Cups, so most cards now differ by 2 or 3 points.
9. **Tiers, roles and phases** (spec §5.6). The headline value weights phases by the player's own
   exposure (a finisher over the death overs he bats in, a new-ball bowler over the powerplay;
   population weights as a 60-ball prior), so the card `tier` is role-relative: the better skill
   percentile plus an all-round bonus, cut at the percentile thresholds in
   `data/config/tiers.json` (Elite = top 8% of a skill; the rarity dial), capped at Gold when the
   best skill has under 120 balls faced / 144 bowled in the window and at Silver when it is
   low-sample. Each skill also carries `displayByPhase` (40–99 per phase, same map as the
   headline) with `phaseEvidence` badges, and `archetype` names where the player is used (opener /
   top order / middle order / finisher / tail; new ball / middle overs / death / all phases).
   Current split: Elite 7%, Gold 21%, Silver 65%, Bronze 7%; against the 222 hand-rated Swipe
   Sixer cards the best-edition tier agrees exactly 30% of the time, within one tier 78%
   (Spearman 0.31).

`RATINGS.md` lists every edition's Elite and Gold cards with role, archetype and both skill numbers;
that list is the review surface.

Validation, primary metric = within-edition correlation between the pre-tournament rating and
the raw value in that World Cup (each edition demeaned, so field composition cannot masquerade as
skill; 392 batting / 324 bowling player-editions): batting 0.33 vs 0.27 for raw form and raw
strike rate (Phase 1: 0.31); bowling 0.19 vs 0.09 raw (Phase 1: 0.17). Edition-to-edition
stability 0.76 / 0.59 vs 0.45 / 0.44 raw. Known limits for Yash's review: Erasmus 2024 still
rates 99 at bowling after a 0.35 transfer share (the two-sided bowling model is the parked fix);
anchors with low dismissal rates (Kohli 2022/2024 in the 70s) are undervalued because hazard is
shrunk hard; ODI priors for 2007/2009 are crude; Sundar 2026 bowls 89 with the Squad Player tag.

## Bowler types

`npm run data:bowlers` writes `data/labels/bowler-types.csv`: bowling type and batting hand for
everyone who bowled or faced a ball in the archives (run it before `data:build`). The matchup term
stays on the World Cup sheet `players.csv`; this sheet drives the pace/spin split and the pace and
spin shares in the grounds brief. First non-empty wins, matched by person id, never by name:

1. `data/labels/bowler-entries*.csv`: reviewed rows, each with a source link
2. rows entered by hand in `players.csv`
3. `mixed` when the snapshot lists both a pace and a spin style. Cricsheet has no type per ball, so
   those balls stay out of the split unless an entry settles the bowler's main style
4. the rest of `players.csv`, then the `player_meta` snapshot by Cricsheet id, then by Cricinfo key

98.3% of balls bowled have a label. `bowler-entries.csv` holds 143 researched rows (associate
bowlers and post-March-2025 debutants the snapshot lacks, plus the main style of dual-style
bowlers; single-source rows say so in `notes`). 106 bowlers with 120+ balls are still unlabelled:
sources conflicted, no source was found, or the research hit its search limit first. Their balls
stay out of the split.

To add a bowler, add a row to `bowler-entries.csv` with `personId,name,bowlingType,handedness,sourceUrl,notes`
and rerun `data:bowlers`, `data:build` and `ratings:build`. Sources are never scraped from Cricinfo.

## Display names

Cricsheet stores "RG Sharma" and the snapshot the legal "Rohit Gurunath Sharma"; neither is what a
fan says. `npm run data:names` writes `data/labels/display-names.csv` from the committed snapshot
subset: the first given name plus Cricsheet's surname, unless
`data/labels/display-name-overrides.csv` says otherwise (keyed by Cricsheet name, and a typo there
fails the run). Overrides cover people known by initials (MS Dhoni), a short form (Chris Gayle) or
a middle name (Lasith Malinga). The Test nations, Ireland, the Netherlands and Scotland were read
through by hand; other associates rely on the rule, and about 20 players with no legal name on
record keep Cricsheet's initials. The engine never sees these names.

## Engine (Phase 2)

```bash
npm run engine:replay -- 2024 100              # replay an edition's real matches with real elevens, compare with reality
npm run engine:calibrate -- 24 dispersion      # sweep engine constants (exponents | dispersion | terms | calibration | chase)
npm run engine:tournament -- 2024 India 200    # full tournaments with India's default eleven as the identity side
npm run engine:rarity -- 2024 300              # unbeaten-run rarity for random drafts in random identity slots
```

**Refit 2026-11-01** (`docs/wc-draft-engine-refit-2026-11-01.md` has every step and number): all
three calibration constants are 1; player vectors are centred by the balls each player faced and
bowled per phase (`SquadOut.players[].exposure`); non-striker run outs are drawn at measured rates;
the streak null is built within phase; byes and wide runs come from the real breakdown; the
powerplay is shared the way captains share it (`allocation.powerplayHoldPenalty`); projection is
off by default; innings-phase, shape, found, gear and the Squeezer gap are parked at exponent 0.
Nine editions at 60 sims × 2 seeds: run rate −0.01, powerplay / middle / death −0.04 / +0.04 /
−0.04, balls per wicket −0.07, chase win share 0.0, Brier 0.2013. `replayEdition(id, sims, seed,
{ base: "window" })` is the out-of-sample variant (+0.003 Brier).

`src/engine/` is the per-ball simulator the draft game and, later, the management sim run on.
It is pure given its inputs and a seed. Per delivery (`ball.ts`):

```
p ∝ base[phase] × batRel^0.7 × bowlRel^0.7 × τ[innings][over][wickets] × chase[required rate]^0.15
    × streak (residual over a shuffled null) × setness (striker's balls faced) × ballInOver × chaseDots
    × matchup (batting hand × bowler class) × match, innings and player day effects × venue factor
    × calibration (scoring 0.94, hazard 1.04, death overs 1.15), then coach intent on the boundary and dismissal cells
```

- Coach intent (`coaches.json`) and captaincy (`captaincy.json`) attach to CPU sides from the
  coach who took the team to that World Cup and the captain whose tenure covers it; the drafted
  side gets its drafted coach and named captain. Intent buys boundaries with risk; a better captain
  chooses bowlers with less noise.

- `base` is the edition's realised per-phase population; the player relative vectors come from
  the ratings and are divided by the appearance-weighted mean of the edition's real squads so
  real elevens reproduce their own edition rather than inflating it.
- `τ`, the chase table and the state terms are measured over every complete 20-over T20I innings
  (`analysis/situation.ts` → `data/out/situation.json`), each as a ratio to its own conditioning
  base and shrunk toward 1. The streak term is the real multiplier divided by a shuffled-innings
  null, so only serial dependence beyond the situation counts (×1.07 scoring after 13+ runs off
  six balls). Setness replaces the Test-cricket eye-in curve: in T20 a new batter scores less and
  is out less, and both rise as he gets set. Day effects (per bowler-innings and batter-innings)
  come from a variance decomposition in the same file. Matchups (`analysis/matchups.ts` →
  `matchups.json`) are observed ÷ expected by batting hand × bowler class beyond both players' own
  averages: left-handers struggle against off-spin and feast on left-arm orthodox, right-handers
  lose boundaries to leg-spin and left-arm spin, pace is hand-neutral.
- Extras (wides, no-balls with a free hit, byes) are drawn from the edition's rates; the toss
  follows the edition's field-first norm; ties go to a super over, bowl-out or coin per edition.
- Rain: a ground-and-edition probability of an affected match, split into no-results, equal
  reductions (5–19 overs, from the archive's distribution) and chases cut short, the last decided
  on a resource table fitted to T20I first innings (`situation.json` → `resources`, the DLS
  Standard Edition construction on our own data). Washed-out knockouts get a reserve day.
- Bowling allocation (`allocation.ts`) scores eligible bowlers per over by expected runs, wicket
  value, specialist bonuses, death reservation, spell continuity and a hit penalty, with Gumbel
  noise; it reproduces the measured bowlers-used norm within a few points.
- `data.ts` builds an edition's engine data from parsed JSON with no file-system dependency (the
  browser client in `draft/` uses it with fetched files); `load.ts` is the Node reader over
  `data/out/`. Both build teams from a real match's eleven and batting order or from a squad's
  default eleven; `replay.ts` is the acceptance harness (environment, result calibration, bowler usage).
- `progression.ts` compiles each edition's structure from `config/formats.json` (groups, seed
  slots, Super-stage slot rules, knockout pairings) with the Afghanistan stand-in in Afghanistan's
  slot; `tournament.ts` plays it: real pairings at their real venues with real elevens, generated
  pairings at the stage's venues, standings with net run rate and the edition's tie-breakers,
  seed-slot inheritance, knockouts, and an identity team fielding a drafted eleven; `rarity.ts`
  measures how often random slot-constrained drafts go unbeaten.

Replay of 2024 (44 matches × 40): run rate 7.13 real vs 7.09 simulated, balls per wicket 16.6 vs
16.4, dot % 44.4 vs 44.2, first-innings average 134.9 vs 134.2, chase win 58% vs 60%, favourite
right in 73% of decided matches, Brier 0.16 against 0.25 for a coin. The replay also reports the
design spec's §9 acceptance tests: first-innings quantiles, wickets by over, per-ball marginal
distance, par after ten overs, death-overs trust and chase-win share per ground. Other editions,
the sweeps (`npm run engine:calibrate -- 24 exponents|dispersion|terms|calibration|chase|matchups`)
and the calibration notes are in the design spec's Phase 2 and 2b sections.

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
