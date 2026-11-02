# World Cup Draft — Design Specification

**Status:** Draft v0.1 (2026-10-28). Living document; sections marked *DECIDED* reflect
conversations with Yash, sections marked *PROPOSED* are recommendations awaiting sign-off,
and every number marked *MEASURED* was computed from the Cricsheet men's T20I archive
(downloaded 2026-10-27) during design.

**Companion material:**
- Research report: `reports/Cricsheet data and cricket sim models.md` (engine literature, licence)
- Research notes: `research_notes/Cricsheet data and cricket sim models/`
- Prior-art installs: Cricket Coach 2014, OOTP 27 (see memory `reference_sim_game_installs`)

---

## 1. Vision and scope

### 1.1 What it is

An Era Ball–style draft-and-simulate game for men's T20 World Cups. The player:

1. **Spins an identity** — a real (country, edition) pair, e.g. *India 2007*. They replace that
   team and inherit its real schedule, venues, group, opponents and era rules.
2. **Drafts a coach** from a panel of real head coaches, whose data-derived philosophy sets a
   build target and the team's in-match intent.
3. **Drafts eleven players**, one per spin of (country, edition), into eleven literal batting
   positions.
4. **Simulates the tournament** with a true ball-by-ball engine and sees whether the XI runs
   the table.
5. **Shares** a result card; competes on a leaderboard ranked by how the season went.

### 1.2 Why this and not the management sim first (*DECIDED*)

- The draft game and the management sim share the same **data layer** and **engine**. The draft
  game is the thinnest possible client on top of a real simulation, so nothing built here is
  thrown away when the management sim follows.
- It fits short sessions, a share card and head-to-head, which suits social distribution far
  better than a management sim does. (Platform decided 2026-10-30: website or app, not a Messenger
  Instant Game.)
- It needs no card art. The aesthetic is text, badges and a share card.

### 1.3 Design principle: true simulation, not a win curve (*DECIDED*)

82-0 and 16-0 compute a strength number and push it through a win curve. We do not. Every
match is simulated ball by ball; every modifier is a **data table with a documented source**,
never a constant in code; the engine emits a full ball-by-ball log and scorecard even though
the first UI only shows the record. Niche analytics (venue, dew, DRS, dismissal fingerprints,
toss norms, upset rates, partnerships, fielding, phase specialists, era rules) are scoped now
precisely so they carry forward.

### 1.4 Scope boundaries

| In scope (v1) | Later | Out |
|---|---|---|
| Men's T20 World Cups 2007–2026 (10 editions) | ODI World Cups (6 editions, 2003–2023) | Pre-2003 editions (no ball-by-ball data) |
| Full-member and associate players present in Cricsheet | Associate coaches | Afghanistan (withheld by Cricsheet; *DECIDED* exclude) |
| Default coach = real coach of identity team; coach panel draft | Cross-era coach modes, Gauntlet-style runs | Player likeness, logos, photos |
| Classic and hidden-ratings modes, share card, leaderboard | Daily challenge, head-to-head | Monetisation |

### 1.5 Prior art and what we take from each

| Game | Take | Leave |
|---|---|---|
| **82-0** | Team+decade slot machine; hidden-stats mode | Additive stat total, no positions |
| **Era Ball** | Choose the era you simulate in; position-fit penalties; era penalties; special tags; coach pick; real season + bracket + awards; Gauntlet as future franchise mode | Hand-tuned tiers (we derive) |
| **16-0.app** | Franchise+season spin; slot-fit batting-order ratings; keeper attribute; overs-covered meter; Performance-vs-Squad leaderboard; cookieless, no-account | IPL only; win-curve season |
| **Cricket Coach 2014** | Bowling plans per format/aggression tier; pitch 1–10 bounce scale; weather states; attribute vocabulary | Binary engine |
| **OOTP** | Ratings stored as outcome components (contact/gap/power/eye ≈ dot/1/boundary/wicket); run-expectancy and leverage tables as text; engine knobs as config | Baseball |

---

## 2. Game loop

### 2.1 Identity spin (*DECIDED*)

- Spin yields a (country, edition) that actually competed. The user may reroll once (budget
  shared with player rerolls? — *OPEN*).
- Inherited from the real team: group, fixture list, venues and dates, era rules, tournament
  bracket shape, and the real head coach as **default coach**.
- Opponents field their **real elevens and batting orders** from Cricsheet `info.players` and
  observed batting order. The user's XI replaces the identity team only.

### 2.2 Coach panel (*DECIDED*)

- Shown **first**, before any player pick. Panel of **3 coaches** drawn from the pool; pick one or
  use the **single coach reroll** for a fresh panel of three. Coaches are **always drafted**; the
  identity team's real coach is not forced (*DECIDED* 2026-10-28).
- Panel is **stratified** across philosophy archetypes so the choice is meaningful (*PROPOSED*).
- Card shows philosophy tags and the concrete build bonuses they unlock, not a letter grade.

### 2.3 Player draft (*DECIDED*)

- Eleven picks. Each spin yields a (country, edition) squad; the user picks one player from it
  into an open slot.
- Rerolls: **2 for the whole squad draft** (separate from the 1 coach reroll) (*DECIDED*).
- Spins are **uniform over all squads** that competed, including associates (*DECIDED*).
- One instance of a real person per XI (Gayle 2007 and Gayle 2012 cannot coexist) (*DECIDED*).
- No overseas rule: it is an international tournament.
- Mode: ratings visible, and each candidate shows their **T20I career record up to the start of
  the drafted edition** (M, Inns, Runs, Avg, SR, 50s, HS; Wkts, Econ, SR, Best) (*DECIDED*).
  A hidden-ratings mode is deferred.

### 2.4 Lineup slots (*DECIDED*)

Eleven slots are literal batting positions:

| Slot group | Positions |
|---|---|
| Openers | 1, 2 |
| Top order | 3, 4 |
| Middle order | 5, 6 |
| Lower order | 7, 8, 9 |
| Tail | 10, 11 |

- **Role** (batter / bowler / all-rounder) is a **per-edition** attribute derived from that
  edition's usage, not a career summary: Mitchell Marsh 2014 is an all-rounder, Marsh 2024 an
  opener who rarely bowls (*DECIDED*).
- **Wicketkeeper is a tag**, not a role: keepers are batters who can keep. At least one
  keeper-tagged player is required to lock the XI; more are allowed (*DECIDED*). **Anyone who has
  ever kept is keeper-eligible in every edition** (*DECIDED* 2026-10-28), so KL Rahul 2021 and
  2022 both carry the tag. Eligibility derives from three evidence columns in the labels sheet
  (stumpings around the edition, Cricinfo keeper role, any T20I stumping ever) and can be
  overridden by hand; every one of the 144 squads has at least one eligible keeper.
- An **overs-covered meter** shows bowling depth. No hard bowler validation: the engine
  punishes a weak fifth bowler legibly.
- Position fit is scored from each player's real batting-position band (see §5.5).

### 2.5 Simulation and result

- Full tournament from the identity team's first fixture through the bracket.
- Result screen: record, stage reached, scorecards, Orange/Purple Cap, tournament MVP, key
  moments (super over, DLS finish, review drama, upset).
- **Share card** with XI, coach, identity, record. Share link reproduces the season.
- Leaderboard ranked by **Performance** (how the season went), shown beside **Squad rating**.

---

## 3. Data sources and licensing

### 3.1 Cricsheet (primary) — *CONFIRMED*

- Licence: **ODC-By 1.0** for all match data (since 7 Oct 2026). Attribution required wherever
  derived data is publicly used; no non-commercial clause; no share-alike. The licence covers the
  database, not player names/likenesses. Attribution text goes in README, in-game credits and a
  `DATA-LICENSE` file.
- Archive used: `t20s_male_json.zip` (3,646 men's T20Is as of 2026-10-27). World Cup matches
  are identified by `info.event.name ∈ {"ICC World Twenty20", "World T20",
  "ICC Men's T20 World Cup"}` — the dedicated event zip omits 2007–2012.
- Per-delivery fields: batter, bowler, non_striker, runs {batter, extras, total, non_boundary},
  typed extras, wickets [{kind, player_out, fielders}], review {by, umpire, batter, decision,
  type, umpires_call} (2021+), replacements.
- Per-match: dates, venue, city, toss {winner, decision}, outcome {winner, by, method, result},
  event {name, stage, group}, players per team, registry (8-char person IDs), powerplays,
  target, super_over flag.

**Editions available** (*MEASURED*):

| Edition | Season key | Matches in archive | Host |
|---|---|---|---|
| 2007 | 2007/08 | 26 | South Africa |
| 2009 | 2009 | 27 | England |
| 2010 | 2010 | 25 | West Indies |
| 2012 | 2012/13 | 25 | Sri Lanka |
| 2014 | 2013/14 | 32 | Bangladesh |
| 2016 | 2015/16 | 27 | India |
| 2021 | 2021/22 | 40 | UAE / Oman |
| 2022 | 2022/23 | 39 | Australia |
| 2024 | 2024 | 44 | USA / West Indies |
| 2026 | 2025/26 | 49 | India / Sri Lanka |

**Known gaps:** all Afghanistan men's matches withheld (removes ~20% of 2021–2026 World Cup
matches and every Afghan player; *DECIDED* accept). No line/length, ball speed, shot type,
field placements, handedness, bowling style, captain, coach, weather. ~15% of run-outs lack a
named fielder.

### 3.2 Hand-labelled and open-source supplements

| Dataset | Source | Volume | Owner |
|---|---|---|---|
| Handedness, bowling type, date of birth, career keeper role | **cricketdata `player_meta` snapshot** (*DECIDED* 2026-10-28, replacing hand entry): ESPNcricinfo profile facts as at 24 Mar 2025, keyed by Cricsheet id; covers 891 of 903 WC players, bowling type for 795. Gaps and per-edition keeping are hand-labelled | ~900 distinct WC players | Pipeline + Yash for gaps |
| Captain tenures per nation (T20I) | Wikipedia per-nation T20I captain lists (CC BY-SA) | ~30 nations | Agent-compiled, Yash spot-checks |
| Head-coach tenures per nation | Wikipedia coach lists | ~150 coach-editions | Agent-compiled |
| Climate normals per host city, tournament month | Public climate tables | ~40 venues | Agent-compiled |
| Boundary dimensions (optional) | Public ground pages | ~40 venues | Later |
| Existing card heat-maps → tags | `shared/src/data/cards.json` | 226 of 293 current cards appear in a WC (*MEASURED*) | Already owned |

### 3.3 Explicitly excluded

- Scraping ESPNcricinfo (Disney ToS prohibits). `python-espncricinfo` was security-vetted and is
  clean (MIT, trusted publishing, no risky calls) but is a live scraper, bundles no data, and
  depends on Playwright; **not used**.
- Kaggle re-packs with unverified licences.

### 3.4 T20I status caveat for associates

All ICC members' men's matches have carried T20I status only since 1 January 2019. Before
that, only selected associates had it, so pre-2019 associate players (e.g. Nepal and Hong Kong
2014, Oman 2016) have thin or missing records in the archive even where they played many
internationals. Form windows for those players fall back to the World Cup itself plus the
qualifier matches that are present (`ICC World Twenty20 Qualifier` 2008–2015, partial; `ICC
Men's T20 World Cup Qualifier` 2019 onward, 51+ matches).

### 3.5 Footprint (*MEASURED* 2026-10-28)

| Item | Size / cost |
|---|---|
| `t20s_male_json.zip` | 14 MB download; 289 MB extracted (3,646 files) |
| ODI World Cup zip (future) | 1.7 MB; 47 MB extracted |
| Full parse of all 3,646 T20Is in Python | 2.9 s, 17 MB peak RAM |
| Derived JSON tables shipped in repo (estimate) | 5–20 MB |
| One simulated T20 match | ~240 ball draws; sub-millisecond in TypeScript |
| One tournament (≈45 matches) | well under a second |
| Calibration run (1,000 tournaments) | seconds to low minutes, single core |

The full Cricsheet archive (all formats, 148 MB zipped / ~3 GB extracted) is **not** needed.
The raw zip need not be committed; the pipeline downloads it on demand and caches it outside
the repo. Machine checked: 17 GB RAM, 428 GB free disk.

---

## 4. Data model

All derived tables are produced by a deterministic pipeline (`tools/wc-data/`, *PROPOSED*
location) from the raw archive and the hand-labelled CSVs, and written as JSON under
`shared/src/data/wc/`. Every table carries `source`, `generated_at`, `cricsheet_snapshot`.

### 4.1 Core entities

```
Edition        { id, year, seasonKey, hosts[], teams, format: {groups, super8|10|12, knockout},
                 rules: {bowlOut|superOver, freeHitScope, drs, concussionSub, stopClock},
                 env: EditionEnvironment, upsetRate, tossNorm, hostWinRate }
Venue          { id, name, city, country, profile: VenueProfile, climate: {rainProbability} }
Team           { id, name, isFullMember }
Person         { id (cricsheet), names[], handedness, bowlingType, keeper: bool, cardId? }
Squad          { editionId, teamId, personIds[], coachId, captainId, realXIsByMatch }
PlayerEdition  { personId, editionId, teamId, bat: PhaseVectors, bowl: PhaseVectors,
                 positionBand, formEnteringTournament, tournamentForm, fielding, keeping,
                 rating: {bat, bowl, field, overall}, tags[] }
Coach          { id, name, tenures[{teamId, from, to}], philosophy: PhilosophyProfile, tags[] }
Captaincy      { personId, matches, winsAboveExpectation, rating, styleTags[] }
Match (real)   { id, editionId, venueId, date, teams, toss, xis, battingOrders, outcome }
```

### 4.2 Derivations from Cricsheet (summary)

| Derived field | Cricsheet source |
|---|---|
| Per-ball outcome counts by phase (PP 1–6, middle 7–15, death 16–20) | `runs.batter`, `wickets`, over index |
| Batting position per innings → position band | Order of first appearance of `batter` |
| Bowler phase usage, overs bowled, spell structure | First delivery's `bowler` per over |
| Partnerships (for Dynamic Duos) | (`batter`, `non_striker`) pairs per ball |
| Fielding (catches, run-out involvements), keeping (stumpings, catches as keeper) | `wickets[].fielders`, `wickets[].kind` |
| Dismissal fingerprint per edition/venue | `wickets[].kind` |
| Review behaviour (2021+) | `review` |
| Dew proxy: 2nd-innings RPO − 1st-innings RPO | innings index |
| Toss norms, bowl-first rate, toss-winner win rate | `info.toss`, `info.outcome` |
| Rain: D/L finishes, no-results | `outcome.method`, absence of `winner` |
| Real XIs and batting orders for CPU teams | `info.players`, batting order |
| Team strength timeline (for captaincy expectation) | all men's T20Is |

---

## 5. Ratings specification

### 5.1 Philosophy

Ratings are **per-ball outcome vectors**, not scalars. A scalar 0–99 is derived for display and
draft comparison; the engine consumes the vectors. This mirrors OOTP (ratings are outcome
components) and the academic simulators (Davis–Perera–Swartz 2015).

### 5.2 Batting base rating (*PROPOSED*)

For each (person, edition):

1. **Raw counts** over a form window of all men's T20Is in the 24 months before the edition's
   first match, plus the edition itself weighted as form (§5.3): counts of {0, 1, 2, 3, 4, 6,
   W} per phase, legal balls only; extras handled separately.
2. **Shrinkage**: Dirichlet / pseudo-count blend toward the era-and-phase population vector with
   prior strength **c = 50 balls per phase** (literature range 40–60). Players with tiny samples
   land near era-average.
3. **Era adjustment**: express each phase vector relative to the edition environment (§6.1) so a
   2009 and a 2026 batter are comparable: `relative = player / editionAverage`.
4. **Display scalar**: expected runs per ball and dismissal hazard combined into runs-above-
   average per 20 balls, mapped to an era-adjusted percentile, then anchored to 40–99 for
   display (*DECIDED* range 40–99; 16-0 uses 55–97). **Superseded as the card face on
   2026-10-30 by tiers (§5.6); the 40–99 numbers remain for phase values, card detail and the
   ratings-visible mode.**

### 5.6 Tiers, roles and per-phase ratings (*DECIDED 2026-10-30*)

Prompted by the Sammy 2016 case (a death-overs finisher rated 95 at batting, above Kohli, because
the scalar is a per-ball rate with fixed phase weights and the powerplay he never bats in inherited
his death edge) and by Cricket Chairman's bowling display (overall grade plus a number per phase).

- **Card face = tier, not a number.** Bronze / Silver / Gold / Elite, the Swipe Sixer colour scheme
  and names, so the existing art language and the 222 hand-rated cards carry over and the card
  audit becomes the sanity check.
- **Tiers are role-relative.** A card's tier is how good the player is at what you would draft him
  for: the better of a batting value weighted over the phases he actually bats in (from his
  position band) and a bowling value weighted over his own phase shares, with an all-round bonus
  when both clear a bar. A player's tier does **not** drop because his role faces few balls: an
  elite finisher who is also a useful bowler is Elite or high Gold, the same as an elite anchor.
- **Role is visible and binds the lineup.** Tier says how good, the role attribute and phase row
  say where. The engine draws from the real phase vectors and dismissal hazard, so a Gold finisher
  placed at No. 3 plays like a No. 7 asked to bat fifteen overs.
- **Per-phase numbers are shown for both skills** (powerplay / middle / death, 40–99). Bowling
  phases are a genuine role (81% of bowler-editions have ≥ 100 middle-overs balls, 63% powerplay,
  55% death); batting phases are a consequence of position, so the batting row carries a dimmed
  number or no number where evidence is thin. Every phase number carries its own evidence badge,
  because the hierarchical prior makes a thin phase mostly the pooled number in disguise.
- **Evidence gates the tier, not the role.** Thin samples (e.g. Munro 2016 on 99 form balls,
  Stokes 2016 on 30) are capped at Silver or carry the low-sample badge, so Elite is not the tier
  of small samples.
- **Tier thresholds are the rarity dial** and live in config (percentile cut-offs across all
  player-editions), to be tuned with unbeaten-run rarity once the engine exists.
- **Platform**: the game will be a website or app, not a Messenger Instant Game, so the card face
  has room for the full phase row and the share-card constraints no longer apply.

**Built 2026-10-30** (`rate.ts`, `data/config/tiers.json`, 29 tests). Headline phase weights =
own exposure with a 60-ball population prior (harness: a tie with the fixed weights on prediction,
batting 0.327 vs 0.326 and bowling 0.186 vs 0.190 within-edition, so the design reason decides).
Tier score = best skill percentile + 0.1 × max(0, second − 0.5), thresholds 0.92 / 0.72 / 0.40,
caps Gold below 120 faced / 144 bowled and Silver when low-sample. Cutting at *shares* of the score
distribution was tried and dropped: it put Kohli 2024 (55th batting percentile) in Bronze because a
specialist's score is one percentile while most players' best-of-two sits higher. Result: Elite 7%,
Gold 21%, Silver 65%, Bronze 7% (2007 has no Elite: every 2007 card is thin-capped). Card audit
against the 222 hand-rated Swipe Sixer cards, best-edition tier vs card tier: exact 30%, within one
78%, Spearman 0.31. Outcomes on the review cases: Sammy 2016 Gold (death weight 0.75, capped from
Elite by the 120-ball rule), Kohli 2016 Elite, Kohli 2024 Silver (hazard credit still parked),
Munro 2016 Gold (capped), Bumrah 2024 Gold (capped: injury-thin window), Erasmus 2024 Elite and
Sundar 2026 Elite (both for Yash's review). `RATINGS.md` now lists Elite and Gold cards per edition
with role, archetype and both skill numbers.

### 5.3 Tournament Form (*DECIDED*, parameters *PROPOSED*)

- The player's World Cup performance in the drafted edition is **not** the base rating; it is
  a modifier that fires **only when the simulation era equals the drafted edition**.
- Magnitude: bounded ±5 display points (equivalently a capped multiplier on the vector), gated
  at a minimum of **30 balls faced / 48 balls bowled** in that edition; below the gate it is
  neutral.
- Rationale: single-tournament samples are tiny (*MEASURED*: T20 WC median 39 balls faced,
  66 balls bowled per player), so form is flavour layered on a stable base.

### 5.4 Bowling base rating (*PROPOSED*)

Same construction: per-phase conceded-outcome vectors and wicket hazard, shrunk with c = 50,
era-relative, with a display scalar from runs-saved and wickets-above-average per 24 balls.
Phase usage share from data defines the bowler's **natural phases** (powerplay / middle /
death) used by the allocation policy.

### 5.5 Position band and fit penalty (*DECIDED* concept, *PROPOSED* numbers)

- From real batting positions: natural band = inter-quartile range of positions actually
  batted (weighted toward the drafted edition).
- Penalty on batting vector by distance from band: 0 inside band; −5% one position outside;
  −12% two; −20% three or more. Bowlers at 10–11 carry no batting penalty. All-rounders have
  wide bands by construction.
- Slot also sets **expected balls faced** in the engine, so a number nine's value is mostly
  bowling.

### 5.6 Timeless tag (*DECIDED*, rule *PROPOSED*)

- Data rule for the candidate list: top-decile era-adjusted rating in **≥ 3 editions spanning
  ≥ 8 years**. Yash curates the final list.
- Effect: no era penalty when played outside the home edition.
- Expected candidates: Gayle, de Villiers, Rohit, Kohli, Shakib, Malinga, Southee, Warner,
  Buttler, Dhoni. Yusuf Pathan is the canonical non-Timeless example.

### 5.7 Era penalty for non-Timeless players (*PROPOSED*)

- Playing outside the home edition applies a penalty growing with distance in years, e.g.
  −3% per edition step, capped at −15%, applied to the relative vector before the destination
  edition's environment is applied. Pre-DRS / pre-2015 players get no extra penalty (unlike
  Era Ball's pre-3PT rule) — the environment scaling already handles scoring inflation.

### 5.8 Fielding and keeping (*PROPOSED*)

- Catches per match and run-out involvements per match (named fielders only), shrunk;
  keepers additionally stumpings and catches as keeper. Feeds a fielding conversion multiplier
  on catch-type dismissals (Perera–Davis–Swartz pattern) and the **Gun fielder** tag.

### 5.9 Captaincy rating (*DECIDED*, method *PROPOSED*)

- Eligibility: captained ≥ 1 men's T20I (any match, not only World Cups).
- Captain per match from Wikipedia tenure tables joined to Cricsheet dates.
- Rating = wins above expectation during tenure, where expectation comes from a team-strength
  rating computed over all men's T20Is (Elo-style), shrunk by matches captained.
- Style tags from Cricsheet: toss choice vs era norm, spin share in powerplay, hook speed,
  bowler rotation breadth, death-over trust.
- Effect: modulates the bowling-allocation policy (§7.5). Strong captain ≈ near-optimal
  choices; weak captain adds noise and over-hooks.

### 5.10 Coach philosophy (*DECIDED*, metrics *PROPOSED*)

Computed over the coach's **whole T20I tenure** (30–60 matches typical), each indexed to the
era average (1.00 = typical):

| Metric | Definition |
|---|---|
| Powerplay intent | Team PP runs per over / era PP RPO |
| Wicket preservation | Wickets down at 15 overs vs era |
| Batting depth | Share of runs from positions 7–11 vs era |
| Finisher reliance | Death-overs (16–20) RPO vs era |
| Spin share | Spin overs share vs era (requires bowling types) |
| Bowl-first preference | Fielding-first rate at toss |
| All-rounder count | Mean bowlers who batted top 8 |

Archetype tags derive from these (e.g. *Powerplay Aggressor*, *Anchor & Finish*, *Bat Deep*,
*Spin Heavy*, *Pace Battery*, *Chase First*). Yash edits tags, because the metrics measure
style, not intent, and are partly the captain's and squad's doing.

*MEASURED* sanity check (India, World Cup innings only, indexed to edition):

| Edition | Coach | PP intent | Wkts down @15 (team vs era) | Lower-order run share |
|---|---|---|---|---|
| 2014 | Fletcher | 1.00 | 2.3 vs 4.0 | 0.07 |
| 2016 | Shastri | 0.85 | 3.8 vs 4.0 | 0.56 |
| 2022 | Dravid | 0.87 | 3.5 vs 4.3 | 0.33 |
| 2024 | Dravid | 1.14 | 4.2 vs 4.7 | 0.40 |
| 2026 | Gambhir | 1.21 | 4.2 vs 4.3 | 0.55 |

**Effects of the coach (*DECIDED*):**
- Draft-time: each tag defines a **build bonus** condition (e.g. ≥ 3 batters above the era's
  75th percentile PP intent; batting rating ≥ threshold at slots 7–8). Meeting it earns a
  modest synergy bonus; missing it costs nothing.
- In-sim: the coach sets the team's **default intent profile** per phase (§7.3).
- The coach does **not** affect between-game form or CPU lineups.

### 5.11 Other data tags (*PROPOSED*)

| Tag | Data rule |
|---|---|
| Dynamic Duo | Pair with ≥ N partnership balls together and partnership RPO above era; bonus when both drafted and adjacent in order |
| Gun Fielder | Top decile catches + run-out involvements per match |
| Powerplay Specialist / Death Specialist (bowler) | ≥ 50% of overs in that phase and economy better than era |
| Finisher | ≥ 40% of balls faced in overs 16–20 with SR above era death SR |
| Anchor | Low dismissal hazard, below-era boundary rate, high balls faced per innings |
| Giant-Killer | Starred (top-2 performer) in a full-member defeat by an associate |
| Chase Master | Runs-above-average in second innings materially above first innings |
| Big-Match | Positive runs/wickets-above-average in knockout matches across ≥ 2 editions |
| Heat-map tags (current cards) | From `cards.json` strengths/adjectives: *Pull Specialist*, *Spin Killer*, *Yorker King*, etc. |

---

## 6. Modifier catalogue

Every modifier is a table in `shared/src/data/wc/` with the evidence column filled.

### 6.1 Edition environment (*MEASURED*, World Cup matches only)

| Edition | Host | RPO | Dot % | 4s % | 6s % | Balls/wkt | PP RPO | Death RPO | 1st-inns avg | Chase win % | Toss→field % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2007 | South Africa | 7.99 | 38.1 | 11.1 | 4.5 | 17.0 | 6.97 | 8.82 | 164 | 52 | 65 |
| 2009 | England | 7.63 | 36.3 | 11.1 | 2.8 | 17.8 | 7.38 | 8.88 | 156 | 41 | 48 |
| 2010 | West Indies | 7.63 | 37.9 | 8.8 | 4.7 | 17.2 | 6.38 | 9.28 | 159 | 42 | 40 |
| 2012 | Sri Lanka | 7.65 | 38.0 | 11.0 | 3.8 | 18.9 | 6.60 | 9.27 | 154 | 45 | 44 |
| 2014 | Bangladesh | 7.60 | 39.1 | 11.1 | 4.0 | 18.1 | 6.87 | 9.09 | 156 | 59 | 72 |
| 2016 | India | 7.86 | 36.6 | 11.4 | 4.2 | 17.8 | 7.19 | 9.58 | 157 | 50 | 63 |
| 2021 | UAE / Oman | 7.43 | 38.1 | 9.5 | 4.1 | 18.6 | 6.34 | 9.23 | 146 | 68 | 78 |
| 2022 | Australia | 7.52 | 38.0 | 9.6 | 3.5 | 17.2 | 6.58 | 8.31 | 155 | 42 | 38 |
| 2024 | USA / WI | 7.13 | 44.4 | 8.7 | 4.9 | 16.7 | 6.42 | 7.94 | 140 | 56 | 84 |
| 2026 | India / SL | 8.74 | 34.9 | 11.9 | 6.5 | 17.2 | 8.27 | 9.95 | 182 | 43 | 71 |

**Dismissal fingerprint and other per-edition facts (*MEASURED*):**

| Edition | lbw % | bowled % | caught % | stumped % | run out % | DRS reviews (upheld / umpire's call) | D/L · NR · ties | Toss-winner win % | Host win % | Associate upsets | 2nd − 1st inns RPO |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2007 | 6.9 | 20.7 | 57.2 | 3.2 | 11.8 | none | 0 · 1 · 1 | 56 | 80 | 0/3 | −0.19 |
| 2009 | 5.0 | 22.0 | 60.2 | 5.9 | 6.8 | none | 1 · 0 · 0 | 48 | – | 1/4 | −0.62 |
| 2010 | 4.1 | 15.4 | 68.9 | 3.8 | 7.9 | none | 3 · 1 · 0 | 62 | – | 0/0 | −0.60 |
| 2012 | 8.8 | 23.5 | 55.8 | 4.9 | 7.0 | none | 1 · 3 · 2 | 32 | 67 | 0/0 | −0.25 |
| 2014 | 5.4 | 20.5 | 59.3 | 5.4 | 9.2 | none | 3 · 0 · 0 | 56 | 17 | 3/10 | −0.03 |
| 2016 | 6.4 | 20.1 | 57.6 | 6.4 | 9.5 | none | 2 · 1 · 0 | 65 | 60 | 2/6 | −0.30 |
| 2021 | 9.6 | 21.3 | 60.1 | 1.1 | 7.5 | 81 (17% / 17%) | 0 · 0 · 0 | 70 | – | 2/13 | +0.50 |
| 2022 | 6.6 | 17.7 | 66.7 | 1.8 | 6.8 | 78 (18% / 15%) | 3 · 1 · 0 | 39 | 67 | 4/11 | −0.55 |
| 2024 | 10.5 | 18.1 | 62.8 | 2.7 | 5.3 | 91 (25% / 14%) | 3 · 3 · 2 | 56 | 50 | 1/20 | +0.24 |
| 2026 | 4.5 | 17.4 | 69.6 | 2.6 | 5.1 | 85 (19% / 14%) | 0 · 0 · 0 | 43 | 69 | 0/20 | −0.63 |

**Application:** the edition environment scales the engine's situation vector τ (boundary
rate, dot rate, dismissal hazard, powerplay and death scaling). Dismissal fingerprint shapes
*how* wickets fall (commentary + fielding). Toss norms drive the AI captain's toss decision.
Upset rate and host win rate calibrate associate and host modifiers.

### 6.2 Venue profiles (*MEASURED*; venues with ≥ 5 WC matches, extremes shown)

| Venue | Matches | RPO | Balls/wkt | 1st-inns avg | Chase win % | Stumped % | Bowled+lbw % | Dew (2nd − 1st RPO) |
|---|---|---|---|---|---|---|---|---|
| Nassau County, New York (2024) | 8 | 5.42 | 16.7 | 109 | 62 | 0.9 | 21.5 | +0.36 |
| Dubai (2021) | 12 | 7.35 | 20.2 | 148 | **92** | 0.8 | 29.4 | **+2.20** |
| Abu Dhabi (2021) | 12 | 7.00 | 19.1 | 139 | 75 | 2.1 | 32.9 | +0.44 |
| Sylhet (2014) | 6 | 7.77 | 19.5 | 147 | 100 | 1.5 | 22.1 | +1.45 |
| Antigua (2024) | 8 | 7.81 | 16.2 | 163 | 62 | 2.2 | 25.8 | +1.66 |
| Lord's (2009) | 8 | 7.02 | 18.9 | 150 | 38 | **11.0** | 23.0 | −0.34 |
| Shere Bangla, Dhaka (2014) | 13 | 7.28 | 19.7 | 159 | 54 | 9.2 | 25.7 | −0.58 |
| Nagpur (2016) | 5 | 6.46 | 15.5 | 136 | 40 | 9.7 | 20.8 | −0.29 |
| SCG (2022) | 7 | 7.48 | 16.8 | 176 | 29 | 2.1 | 26.3 | **−1.95** |
| Bridgetown (2010) | 10 | 7.25 | 17.0 | 162 | **20** | 2.9 | 20.4 | −1.03 |
| Chepauk (2026) | 5 | 9.24 | 23.3 | 199 | 40 | 0.0 | 22.9 | −0.72 |
| Ahmedabad (2026) | 6 | 8.96 | 18.2 | 200 | 33 | 0.0 | 21.1 | −1.41 |
| Wankhede (2026) | 8 | 8.84 | 17.3 | 184 | 38 | 2.9 | 20.0 | −0.19 |
| Sharjah (2021) | 10 | 7.16 | 18.9 | 158 | 50 | 0.0 | **39.0** | −0.57 |

**Application:** venue is the **primary** modifier source; edition is the fallback for venues
with thin samples (shrink venue toward edition with prior strength ≈ 6 matches, *PROPOSED*).
Dew → chase advantage; stumped share → spin friendliness proxy until bowling types exist;
bowled+lbw share → low bounce / skid; RPO and balls/wkt → batting vs bowling friendliness.
Spin-vs-pace economy by venue is added once bowling types are labelled.

### 6.3 DRS (*MEASURED*, modelling *PROPOSED*)

- Reviews recorded from 2021 onward only (consistent with DRS availability at T20 World
  Cups). ~80–90 reviews per edition; ~17–25% upheld; ~14–17% umpire's call.
- LBW share is higher in DRS editions on low/turning surfaces (2021: 9.6%, 2024: 10.5%) but
  not on flat decks (2026: 4.5%). Model DRS as a **modest LBW-probability lift in DRS editions
  conditioned on venue bounce**, plus review events in commentary at measured rates, including
  overturned decisions and umpire's call. Not a major balance lever.

### 6.4 Rain (*PROPOSED*)

- Per-venue rain probability = blend of measured D/L and no-result frequency (edition/venue)
  with public monthly climate normals for the host city in the tournament month.
- When rain fires: reduced overs with a real DLS target computed from the Standard Edition
  resource table (public), or no-result with points shared. Rare by design; the predictor
  explains it.

### 6.5 Rule-era touches (*DECIDED* to include; verify each before implementation)

| Edition range | Rule |
|---|---|
| 2007 | Bowl-out for ties |
| 2009 → | Super over for ties |
| 2007–2015 | Free hit only for front-foot no-balls; 2015 → all no-balls |
| 2021 → | DRS available; concussion substitutes |
| 2024 → | Stop clock |
| Per edition | Real group structure: Super 8 (2007, 2009, 2010), Super 10 (2012, 2014, 2016), Super 12 (2021, 2022), 20 teams + Super 8 (2024, 2026) |

### 6.6 Explicitly flavour-only (no data source)

Delivery-length vocabulary shifts (short/good/full → slot/yorker), cloud cover and swing
conditions, pitch wear within a match. Represent in commentary text keyed to venue/edition;
death-overs bowled+lbw share and six rate are the only quantitative proxies.

---

## 7. Engine contract

### 7.1 Core model (from the research report; *DECIDED* direction)

Per-ball categorical outcome over {0, 1, 2, 3, 4, 6, W} following Davis–Perera–Swartz (2015):

```
p(outcome | batter i, bowler k, over o, wickets w, context) ∝
    τ[o][w]                 situation multiplier, estimated directly from Cricsheet
  × p_i[phase]              batter relative vector (shrunk, era-adjusted, position-fit, form)
  ⊕ q_k[phase]              bowler relative vector, combined as p + q − p̄ with clipping
  × env[edition]            edition environment scaling
  × venue[v]                venue profile scaling (dew applied to 2nd innings)
  × intent[team][phase]     coach/chase-driven aggression shift (moves τ column)
  × fielding Λ              per-fielder conversion on catch-type outcomes
```

- Extras drawn separately (~5% Bernoulli, wides/no-balls vs byes/leg-byes, era-scaled).
- Eye-in multiplier on dismissal hazard for a new batter (Stevenson–Brewer form; batters start
  at 25–50% of set ability, L ≈ 2–6 runs).
- Innings-level random effect (pitch/day) to fix under-dispersion of pure Markov engines
  (Mishra 2026 warning).
- Chase rule: compare expected runs per resource vs required; shift intent column with 0.8
  damping.

### 7.2 Outputs

- Ball-by-ball log (same schema as Cricsheet deliveries + engine annotations), scorecard,
  partnerships, fall of wickets, review events, rain/DLS events, awards inputs.
- Deterministic given a seed, so share links reproduce seasons.

### 7.3 Intent profile

Per team, per phase, default from **coach philosophy**; the chase rule and match state
override at runtime. A high-intent powerplay raises boundary rate and dismissal hazard
together, as the 2026 India data shows.

### 7.4 Toss, captain decisions

AI captain follows the **edition toss norm** adjusted by venue dew. Captain rating sets the
noise level on all captain decisions.

### 7.5 Bowling allocation policy (*DECIDED* approach; measured norms below)

Per over, choose among eligible bowlers (quota < 4, did not bowl previous over) by utility:

```
score(k) = −E[runs | k, batters, phase, venue, era]
           + λ_w · P(wicket | k, …)
           − λ_spell · recentSpellEconomyPenalty(k)
           + λ_match · matchupBonus(k, striker handedness/type)
           + roleReservation(k, oversRemaining)      hold death/new-ball specialists
           + captainStyle(k)                         per-captain tags
           + ε(captainRating)                        noise shrinks with rating
```

The policy must reproduce the measured usage norms within a few points (acceptance test):

| Measured behaviour (454 complete WC innings) | Value |
|---|---|
| Bowlers used per innings | 5: 17% · 6: 62% · 7: 20% · 8: 1% |
| New-ball bowler completes 4 overs if first two overs cost ≤ 10 / 17–24 / 25+ | 83% / 66% / 52% |
| Bowler returns later after an over costing 0–6 / 12–17 / 18+ | 92% / 70% / 54% |
| Overs 19–20 bowled by an opening bowler | 43% |
| New-ball bowler bowls at the death regardless of early economy | 62–68% |
| Bowler #6 overs per innings; share in middle overs | 1.59; 75% |
| Bowler #6 first introduced | mostly overs 7–12 |
| Bowlers #4–#5 share of work in middle overs | 64–65% |

Consequences: six bowlers is the norm; a hit frontline bowler is pulled from the spell about
half the time after an 18+ over but almost always returns; death trust is sticky; a
3-specialist + 3-all-rounder XI naturally yields specialists in PP/death and all-rounders in
the middle.

### 7.6 Tournament simulation

Replays the identity team's real fixture list and venues; the rest of the group plays its
real fixtures with real elevens; standings, net run rate, and the edition's real bracket
decide progression. Ties resolved by bowl-out or super over per edition rules.

---

## 8. Draft rules and balancing

- Spins draw (country, edition) uniformly over squads that exist (*DECIDED*).
- Each spin shows the squad with ratings (Classic) or names only (Cricket-IQ), position band,
  role, tags, and slot-fit preview as in 16-0.
- Rerolls by difficulty: 0 / 1 / 3.
- Synergy bonuses: coach build bonuses (§5.10), Dynamic Duos (§5.11). Keep each ≤ ~3 display
  points so no single lever solves the draft.
- Leaderboard: Performance score (stage reached, record, NRR) beside Squad rating.
- **Unbeaten-run rarity target (*PROPOSED*):** the share of completed runs that finish
  unbeaten, measured by simulating thousands of random drafts. 16-0's board shows twelve
  perfect seasons in its top 25, which cheapens the hook. We tune variance, opponent strength
  and knockout difficulty so that a perfect run is rare but reachable, e.g. under 3% of all
  runs and under 15% of runs with a top-decile squad rating. It is a balancing dial, not a
  gameplay rule.

---

## 9. Validation and acceptance tests

Run before any UI is built, on simulated replays of real World Cups with real elevens:

1. **Innings totals** Q–Q against real distribution per edition; first-innings SD ≈ 28–30.
2. **Wickets-by-over** curve within tolerance per edition.
3. **Per-ball marginals** within total-variation 0.02 of real for each edition.
4. **Remaining-runs vs par** within ~5 runs of a Delta-style par table.
5. **Bowler usage table** (§7.5) reproduced within a few points.
6. **Venue effects** reproduced: Dubai chase advantage, Nassau par, SCG bat-first edge.
7. **Rating stability**: shrunk rating in edition *n* predicts edition *n+1* better than raw
   stats and better than career average (choose `c` by this test).
8. **Win-probability calibration** of the live predictor on held-out real matches.

---

## 10. Build plan

### Phase 0 — Data spike (no UI) — **BUILT 2026-10-28**

Implemented in `wcdraft/` (see its README). The canonical measured tables now live in
`wcdraft/data/out/` (`editions.json`, `venues.json`, `bowling-usage.json`,
`lineup-deviation.json`) with a human-readable digest in `wcdraft/data/out/COVERAGE.md`; the
tables in §6–7 of this document were the design-time measurements and differ in places: the
pipeline counts wide and no-ball runs in runs-per-over, as a scorecard does (the design-time
powerplay and death figures did not); first-innings averages now use natural innings only
(20 overs or all out, rain-shortened excluded), which lowers them by 1–7 runs; ties settled by
super over count as decided; and full-member status is time-varying, which changes the
associate-upset counts. The generated tables are canonical. Results: 10 editions, 144 team-editions,
903 people, 1,903 player-editions; 377 player-editions lack form data, 105 of them in 2007
when almost no prior T20Is existed. Build runs in ≈3 s at ≈230 MB peak RAM; outputs total
≈8 MB. Afghanistan stand-ins per edition are recorded in `wcdraft/data/config/editions.json`
(UAE 2010, Namibia 2012, Scotland 2014, Namibia 2016, Scotland 2021 with UAE into the first
round, Sri Lanka 2022 with PNG into the first round, Zimbabwe 2024, Kenya 2026), with evidence
in `research_notes/T20 modifiers and ratings evidence/afghanistan_standins.md`.

- `tools/wc-data/ingest`: stream `t20s_male_json.zip` → SQLite/DuckDB; filter WC events;
  attribution file.
- Tables: PlayerEdition raw counts by phase, batting positions, bowler usage, partnerships,
  fielding, edition env, venue profiles, dismissal fingerprints, reviews, toss, rain.
- Hand-label kickoff: handedness + bowling type (~900 players); captain tenures; coach tenures
  (agent-compiled, Yash spot-checks).
- Deliverable: JSON tables under `shared/src/data/wc/` + a notebook-style report of the
  derived draft pools for a few spins (e.g. Netherlands 2014, India 2007, USA 2024).

### Phase 0.5 — Review follow-ups — **BUILT 2026-10-28**

Pipeline: striker dismissals off wides counted; rain-reduced innings flagged and excluded from
phase vectors (nine down without rain = all out); ties settled by super over count as decided;
stand-in squads built from the form window, or from the team's nearest T20Is within 60 months
(UAE 2010 from 2014, Namibia 2016 from 2019), or from `hand-squads.json` (Namibia 2012);
structured `slotChanges` per edition; `defaultXI` and `defaultBowlingOrder` for every
team-edition; `team-style.json` (team × month) and `team-strength.json` (Elo timeline with
per-match expectations, tiered starts) for tenure aggregation; chase uplift renamed; low-sample
badge counted. Data compiled by agents from open sources, pending or landed in
`wcdraft/data/config/`, all landed: Afghanistan's 36 real fixtures with venue ids and start
times; captain tenures (244 rows; 80 associate and three full-member rows were read from
ESPNcricinfo by the agent against the spec's no-scraping rule and are flagged for Yash's
decision; rows are per captain, not per spell, with years only); head-coach tenures (235 rows,
Wikipedia only, year precision for full members, two double credits to resolve); structured
formats and rule verification (see §13.2 item 5 and §13.3 item 20); the Namibia 2012 hand
squad (14 players); the twelve 2026 debutants (six flagged source conflicts).

Decisions taken with this phase: use Cricsheet ODI data as a weak prior for 2007 and 2009 in
Phase 1; identity reroll = 1; low-sample badge = fewer than 60 balls faced and 72 bowled.

Known limitation carried into Phase 1: the Elo timeline inflates associates that dominate a
closed regional circuit (Uganda sits sixth); replace with a regularised strength model before
it drives opposition adjustment.

### Phase 1 — Ratings prototype — **PROTOTYPE BUILT 2026-10-28**

Implemented in `wcdraft/src/ratings/` with a validation sweep written to
`wcdraft/data/out/RATINGS.md` (`npm run ratings:build`). Findings that changed the design:

- **Dismissal rate is unpredictable at these sample sizes.** No estimator reaches r > 0.13 against
  tournament dismissal rate, while scoring rate reaches 0.39–0.45. The dismissal cell therefore
  carries a 1,000-ball prior; the scalar value keeps the 2.6-run wicket cost for cricket logic,
  but anchors with genuinely low dismissal rates are undervalued (open item: credit hazard from
  career-length evidence, e.g. Kohli 2016 rates 80 not 90).
- **Membership tiers are too coarse for opposition adjustment; a two-way strength table works.**
  Splitting form by full-member vs associate opposition lowered batting prediction. Judging a batter
  against batters from teams of the same Elo strength facing the same opponent mix, then carrying
  them through the tier gap, matched the best predictor and fixed the face validity problem
  (PNG's Tony Ura and Uganda's bowlers no longer top the 2024 lists).
- **Edges barely transfer upward.** For players with ≥120 balls against both associate and
  full-member attacks (n = 44), the slope of log(edge vs strong) on log(edge vs weak) was 0.14.
  The model carries max(0.1, 1 − Δ/300) of an edge up an Elo gap of Δ. This is the single most
  consequential parameter for associate players and rests on a small sample; re-estimate it with
  per-match opponent Elo in Phase 1.5.
- **Bowling is the weak half.** Bowling prediction is 0.11 (vs 0.05 raw) and small-sample
  associate bowlers still inflate; the two-way table costs bowling stability without predictive
  gain, so bowlers use the one-way Elo mixture. A two-sided multiplicative model
  (Bandyopadhyay-style batter × bowler × context) is the Phase 1.5 candidate.
- **Validation targets must share the model's population**: valuing the tournament against a
  different population than the rating created a spurious negative correlation across editions.
- **Display** is percentile-anchored but linear in value (median 70, 99th percentile 99, 5th
  percentile 45), with thin samples shrunk toward the middle before ranking, so stars separate.

Decided inputs now in place: ODI archive as the 2007/2009 prior (badge lifts at ≥600 ODI balls
faced / ≥900 bowled); identity reroll 1; badge thresholds 60/72. Model defaults are in
`wcdraft/src/ratings/model.ts`; every parameter is documented with the evidence behind it.

**Review of the first prototype (2026-10-28, with Yash).** Yash flagged inflated bowling ratings
(Washington Sundar and Muzarabani 99 in 2026, Erasmus 98 in 2024). Diagnosis: value was measured
against each tournament's *realised* scoring level, so the highest-scoring World Cup (2026, 8.7
RPO) inflated every bowler (15 rated 95+, mean value +9.3) and the lowest (2024, 7.1 RPO)
inflated every batter (12 rated 95+) and deflated bowlers (Bumrah 78). Fix: value is a **ratio to
the population** and is measured against the **window-based population projected onto the
edition's opponent mix**, never the tournament's own outcomes; the engine applies the edition
environment at simulation time instead. Residual: Erasmus-type cases, where an associate's
exposure is almost entirely weak opposition and the edition's *average* opponent mix understates
the Super-8 step up; candidate fix is measuring the transfer gap against the strongest third of
the edition's opponents.

**Venue normalisation (agreed 2026-10-28).** Venue spread exceeds era spread (Nassau 5.4 RPO vs
Chepauk 9.2 vs editions 7.1–8.7), so form must be judged against where it was earned. Design:
(1) a venue factor per ground, shrunk venue → country → global because most grounds are thin;
(2) each player's form normalised by the exposure-weighted factor of the grounds they played;
(3) a **projected modifier** for the identity team's actual World Cup venues (fixtures are known),
shown separately from a condition-neutral overall rather than folded into it; (4) condition
interactions estimated at the **type level** (pace vs spin vs left-arm vs wrist spin by venue
class, now measurable with the snapshot's bowling types), with **individual sensitivity only as a
heavily shrunk term surfaced as a tag** when evidence is strong, because per-player samples per
surface type are too thin and bounce is unobservable in Cricsheet (proxies: caught-behind and
bowled shares, spin-vs-pace economy by ground); (5) the validation harness tests venue-adjusted
form against raw form before any UI shows it. Pushback recorded: a per-player bounce-sensitivity
estimate (the Jansen case) would mostly be noise at these sample sizes; the type-level inheritance
is the honest version.

**Outcome of the value fix (2026-10-28, late).** With ratio values measured against the
window population on the edition's opponent mix: batting prediction 0.30 (raw strike rate 0.27),
bowling 0.15 (raw 0.04), stability 0.77 / 0.66 (raw 0.45 / 0.44); bowlers rated 95+ fell from 15
to 8 in 2026 and Bumrah 2024 rose from 78 to 96. The first venue model (a window-averaged
ground scoring factor) was built, tested and **switched off**: it lowered batting prediction
because factors average toward 1 across a window; the factors remain in the outputs for the
per-innings, venue-type version. Still open: associate bowlers with no exposure to top sides
(Erasmus 2024 at 99) need the transfer gap measured against the strongest third of the edition's
opponents.

Remaining Phase 1 items: Tournament Form and position bands are implemented; Timeless candidates
(Gayle, Finch, Maxwell, Warner, Bumrah) are listed for curation; the card audit matches 222 cards
with tier means 79 / 74 / 71 / 67 (Spearman ≈ 0.28). Not yet done: captaincy ratings and coach
philosophy tags from the tenure tables, Elo regularisation, data tags beyond position/phase, and
the Phase 1.5 bowling model.
- Shrinkage, era adjustment, display scalar, position bands, Timeless candidates, Tournament
  Form, tags. Validation test 7. Audit of the 226 overlapping hand-rated cards against derived
  ratings.

### Phase 1.5 — Per-ball context normalisation — **BUILT 2026-10-30**

Plan: score every ball against the population of its own period, opponent-strength bin and ground
at accumulation time, so career, form and tournament blocks arrive pre-adjusted; measure the
edge-transfer gap against the strongest third of the edition's opponents; add usage (Squad Player
tag, within-team selection prior weighted by the harness). Done; the same context populations
(`ContextPopulation`, first pass of the build) become the engine's environment tables.

**What was built.** `wcdraft/src/analysis/context-population.ts` (year-quarter × opponent bin ×
phase counts, fallback chain, venue factors); every `PhaseCounts` now carries `expected` next to
`outcomes`; `formByOppBin` and `usage` on each player-edition; `evidence: "expected"` rating path
(`outcomes ÷ expected`, career-anchored, hierarchical phases); `transferGaps()` measurement;
cohort standardisation; usage shares and the Squad Player tag; selection prior (off); within-edition
correlation as the harness's primary metric. 28 tests. Build 12 s / 395 MB RSS; outputs 36 MB.

**Results (validation sweep, `RATINGS.md`).** Within-edition prediction: batting 0.33 (Phase 1
0.31; raw form 0.27), bowling 0.19 (Phase 1 0.17; raw 0.09). Stability 0.76 / 0.59. Findings
that changed the design:

- **The reference population drifts.** The context expectation is "an average T20I player of the
  period facing this opposition", and that average weakened as the pool grew: World Cup squads beat
  it by 5% in 2010 and 13% in 2026, so 2026 had twelve 99-rated batters. Fix: each edition's
  values are shifted and scaled so the squads of its ten strongest teams have mean 0 and a common
  spread (a scalar standardisation; dividing the vectors cell by cell lowered within-edition
  batting prediction 0.32 → 0.27, so it was reverted). Rankings within an edition and engine
  vectors are untouched.
- **Pooled correlations reward level alignment, not skill.** The tournament target is valued
  against the whole edition's population, whose composition changes with field size, so the pooled
  r moved in step with whatever the model did to edition levels. The harness now reports
  within-edition correlations first; the pooled ones remain for the record.
- **Venue factor: bowling yes, batting no.** With the per-ball ground factor in the expectation,
  bowling prediction rose (0.167 → 0.175) and batting fell (0.311 → 0.306, stability 0.746 →
  0.732). Likely cause: a ground's factor is partly its home batters' quality. `CONTEXT_VENUE` in
  the build is per skill.
- **Transfer to the strongest third.** Measuring the Elo gap to the mean of the edition's top third
  (rather than the balls-weighted opponent mix, which first-round associate fixtures dilute) raised
  within-edition batting prediction 0.27 → 0.28 and bowling 0.19 → 0.20, and cut Erasmus 2024's
  carried share from 0.65 to 0.35 and Ura's from 0.44 to 0.17. Direct measurement from the per-bin
  counts: slope of edge-vs-strong on edge-vs-weak 0.23 (batting, n = 112 at ≥ 60 balls per group)
  and 0.05 (bowling, n = 115); at ≥ 120 balls, 0.05 / 0.12 (n = 31). The linear 1 − Δ/300 rule is
  kept (200 and 450 both validated worse once the destination moved).
- **Tier destination stays on.** Shaping the transport destination by the player's team tier on
  top of a context-neutral relative vector looks like counting team strength twice, but the sweep
  was unambiguous (within-edition batting 0.32 with, 0.28 without), so it stays as an empirical
  tier gap.
- **Stronger priors.** The context-neutral ratios tolerate more shrinkage: c = 100 (bowling 200),
  phase prior 300, hazard prior 2,000 all validated better than the Phase 1 values.
- **Selection prior is off.** Rarely-picked players rating above their team median lose value with
  weight w; the harness was neutral at w = 0.5 restricted to shares under 0.5 and negative beyond.
  The knob (`selectionWeight`, `selectionMaxShare`) and the Squad Player tag remain. With it on at
  0.5, Sundar 2026 bowling would fall by about 5 display points; the tag is what the draft UI shows.

**Open for Yash's review (2016 / 2024 / 2026 lists in `RATINGS.md`).** Erasmus 2024 still 99 at
bowling (an enormous raw edge against weak attacks; the parked two-sided bowling model is the fix if
the review confirms it is wrong); Kohli 2022 / 2024 in the 70s (hazard credit, parked); Sammy 2016
at 95 batting; Bumrah 2024 at 92 (thin, injury-hit window; Tournament Form adds +5); Ferguson 2026
at 99. Named errors become test cases.

### Parked (2026-10-28) — revisit only when a trigger below fires

| Item | Why parked | Trigger to revisit |
|---|---|---|
| ~~Captaincy ratings and coach philosophy tags~~ **Done 2026-10-30** (`captaincy.json`, `coaches.json`; engine intent and allocation noise) | — | — |
| ~~Decision on the 80 Cricinfo-sourced captain rows~~ **Decided 2026-10-30: dropped.** Those sides play with an average captain (`includeCricinfoRows` stays false; the rows remain in `captains.csv` for provenance only) | — | — |
| Two-sided (batter × bowler × context) bowling model | Phase 1.5 lifted bowling prediction to 0.19 (within-edition); the Erasmus 2024 case remains | Yash's review confirms associate bowlers with no top-side exposure are still over-rated |
| Selection prior (usage) weight > 0 | Harness neutral at w = 0.5 (shares < 0.5), negative beyond; Squad Player tag covers the UI need | Playtesters draft rarely-picked players on ratings alone |
| Cohort standardisation by top-ten squads | Scalar fix for the drifting reference population; a two-way (own-team × opponent) context expectation would remove the cause | Per-edition spreads still look wrong after review (2026 has 8 batters at 95+, 2024 has 7) |
| ~~Elo regularisation (closed associate circuits inflate)~~ **Done 2026-10-30**: connectivity rule in `team-strength.ts` (excess above 1500 scaled by the share of the last 20 matches vs full members) | Trigger fired: Uganda at 1668 won 53% of simulated 2024 matches | Revisit if a well-connected associate (Netherlands, Scotland) looks wrong |
| Individual condition sensitivity (Jansen-type bounce) | Per-player samples per surface too thin; bounce unobservable | Type-level interactions proven useful first |
| Hazard credit from long careers (anchors like Kohli undervalued) | Hazard unpredictable at window sizes; career-length evidence is the only route | After per-innings refactor exposes per-innings hazard |
| ODI prior refinement (crude SR / balls-per-out scaling) | Only 17 player-editions depend on it | 2007/2009 ratings look wrong in review |
| Venue-type (spin/pace) interactions by ground class | Needs bowling-type labels joined per ball (now available) | Part of Phase 1.5 or immediately after |
| Hand-review conflicts: six 2026 debutants, Namibia 2012 blanks, SA 2012 / NED 2022 coach double credits | Cell-level edits with no downstream effect yet | Before Phase 3 UI |
| Official 15-man squads (non-playing members) | Draft pool is "players who appeared" | If playtesting misses obvious names |
| **Bowler-aware death intent** (added 2026-10-30, for a later engine phase). Today the death overs are held to the measured phase shape by a flat ×1.15 scoring calibration, because trusting openers at the death put stronger-than-average bowlers on those overs and under-scored them. The honest version: batters' death-overs intent responds to the bowler and the match state (more risk against a weaker bowler, more defence against Bumrah, scaled by wickets in hand and required rate), measured from the archive as the within-batter boundary and hazard shift by bowler quality in overs 16–20. Removing the flat calibration is the acceptance test; opener share of overs 19–20 should then be free to rise toward the 43% norm. | Needs a per-ball bowler-quality covariate in the situation analysis; engine already carries the intent machinery | After Phase 3 ships, or if playtesters report death overs that feel too tame against top bowlers |

### Phase 2 — Engine — **CORE BUILT 2026-10-30**
- New module `wcdraft/src/engine/` (the card-game engine in `shared/` is untouched).
- Built: per-ball multinomial (`ball.ts`: base[phase] × batRel^0.7 × bowlRel^0.7 ×
  τ[innings][over][wickets] × chase^0.5 × centred eye-in × log-normal match and innings effects ×
  venue scoring factor), situation tables from every complete 20-over T20I innings
  (`analysis/situation.ts` → `data/out/situation.json`, 354 over × wickets cells per innings and
  a chase table by required rate), extras (wides, no-balls with free hit, byes), utility-based
  bowling allocation (`allocation.ts`: expected runs, wicket value, specialist bonuses, death
  reservation, spell continuity, hit penalty, Gumbel noise), toss by edition norm, super over /
  bowl-out / coin by edition rule, seeded RNG with forked streams (`rng.ts`), loaders for real
  elevens and default elevens (`load.ts`), and the replay harness (`replay.ts`,
  `npm run engine:replay -- 2024 100`) plus an exponent sweep (`npm run engine:calibrate`).
- Two calibration findings. (1) The rating vectors are relative to the average T20I player while
  the base is the edition's realised population, so real elevens inflated their own editions by
  3–8%; every relative vector is now divided by the appearance-weighted mean over the edition's
  real squads (`centreOnCohort`). (2) The eye-in term must be centred (the base already contains
  new batters' hazard); uncentred it cost 2.7 balls per wicket.
- **State terms (added 2026-10-30 after Yash's momentum note).** Measured over 3,242 men's T20Is
  since 2016 in `analysis/situation.ts`, each as a ratio to its own conditioning base (innings ×
  phase × wickets band) and shrunk toward 1:
  - *Streak* (runs off the previous six balls). The raw within-batter effect was ×1.14 scoring /
    ×1.21 boundaries after 13+ runs, but a shuffled-innings null (same balls, outcome labels
    permuted, the Miller–Sanjurjo correction) explains most of it; the residual the engine uses is
    ×1.07 / ×1.10 after 13+ and ×0.96 / ×0.93 after 0–3, hazard flat. Genuine, but half the size of
    the naive measurement. Off for the first six balls of an innings (that is the openers' setness).
  - *Setness* (striker's own balls faced) replaces the eye-in hazard curve, which was a Test-cricket
    result running the wrong way for T20: new batters score ×0.74 and are dismissed ×0.88 on balls
    0–2, rising to ×1.16 and ×1.06 past 24 balls. Consistent with the 2026 within-batter hazard
    study (hazard rising almost linearly with balls faced) and the intent reading of T20 hitting.
  - *Ball in over*: ±2–3% by position (first-ball hazard ×0.93, balls 3–4 ×1.04).
  - *Consecutive dots in a chase*: three or more cut scoring ×0.88 and raise hazard ×1.04; the
    evidence in the literature was mixed, the archive is not.
  - *Day effects*: a variance decomposition against each player's career mean gives per-innings
    scoring effects of SD 0.21 (bowler-innings) and 0.19 (batter-innings). Those absorb opponent,
    venue and era too, so the engine uses 0.10 / 0.08 with smaller global match (0.05) and innings
    (0.03) effects; the dispersion sweep could not separate the settings (first-innings SD ratio
    1.14–1.17 throughout, Brier 0.200–0.212).
  - Feedback: a dynamic simulation regenerates the state frequencies (hot streaks breed hot
    streaks, fewer wickets mean longer set periods), which lifted the mean by ≈4% with all terms on.
    Two global calibration constants (scoring ×0.95, hazard ×1.04), fitted by the sweep, absorb it.
    The required-rate chase term double counted the second-innings τ table (chase-win bias +4.6
    points at exponent 0.5, +1.9 at 0); it runs at 0.15.
- Replay results, 40 sims per real match, real elevens and batting orders (final constants):

| Edition | Matches | RPO real → sim | Balls/wkt | Dot % | 1st-inn avg | 1st-inn SD | Chase win % | Bowlers used (mean) | Favourite right | Brier (coin 0.25) |
|---|---|---|---|---|---|---|---|---|---|---|
| 2010 | 25 | 7.63 → 7.60 | 17.2 → 16.7 | 37.9 → 37.5 | 155.8 → 155.7 | 28.7 → 33.6 | 42 → 40 | 5.90 | 67% | 0.208 |
| 2016 | 27 | 7.86 → 7.98 | 17.8 → 18.0 | 36.6 → 34.7 | 158.9 → 161.6 | 27.8 → 32.7 | 50 → 46 | 6.02 | 50% | 0.239 |
| 2024 | 44 | 7.13 → 6.96 | 16.6 → 16.2 | 44.4 → 44.5 | 134.9 → 132.2 | 43.1 → 36.4 | 58 → 61 | 6.03 | 73% | 0.175 |
| 2026 | 49 | 8.74 → 8.88 | 17.2 → 16.4 | 34.9 → 34.1 | 180.2 → 179.3 | 35.7 → 44.6 | 43 → 45 | 6.03 | 76% | 0.172 |

  Boundary shares match within 0.5 points everywhere. Bowlers used lands at 5: 22%, 6: 52%,
  7: 20% against the measured 17 / 62 / 20. Still open: the first-innings spread is too wide in
  2010/2016/2026 and too narrow in 2024 regardless of the dispersion settings, which points at
  structure (the real spread is widened by rain-free all-outs and narrowed by par-score chasing
  behaviour the engine does not yet have) rather than noise size. The 2016 result calibration
  (26 decided matches) is within sampling noise of its earlier 65% / 0.228. Sweeps:
  `npm run engine:calibrate -- 24 exponents|dispersion|terms|calibration|chase`. Tests:
  `test/engine.test.ts` (determinism, bookkeeping invariants, state-term directions, 2024 replay
  within tolerance).
- **Tournament layer — BUILT 2026-10-30** (`engine/progression.ts`, `engine/tournament.ts`,
  `engine/rarity.ts`; `npm run engine:tournament -- 2024 India 200`, `npm run engine:rarity -- 2024 300`).
  - Progression is compiled from `formats.json` for all ten editions: group lists, pre-tournament
    seed slots, Super-stage slot rules and knockout pairings. Seed-slot inheritance follows the ICC
    rule (a seeded qualifier keeps its slot; a non-seed takes the highest vacated slot of its group),
    first-round winners join their pre-assigned Super 10 / Super 12 group, and the stand-in takes
    Afghanistan's slot at every stage, including the 2021/22 direct-entrant slot (Scotland and Sri
    Lanka move up, UAE and PNG fill the first round) per `editions.json`.
  - Fixtures: every real pairing keeps its real venue, date and who batted first; the stand-in plays
    Afghanistan's real fixtures at their venues (`afghanistan-fixtures.json`); pairings that never
    happened cycle through the venues that stage really used. Opponents field the eleven they really
    fielded against that opponent, else their default eleven; the identity team fields the drafted
    eleven everywhere.
  - Standings: 2 points a win, net run rate with the full quota charged to a side bowled out, order by
    points → wins → NRR → head-to-head → original seeding. Ties go to the edition's tie-break rule.
  - Team-level calibration (150 full tournaments, real elevens): 2024 India 68% match wins and 21%
    titles, then England, New Zealand, Pakistan, Australia, West Indies (61–68%), South Africa 57%,
    associates 26–45%; 2022 the six strongest full members 63–66%; 2016 South Africa, Australia,
    West Indies, India on top. Two fixes came out of this check and both improved the ratings
    harness (within-edition batting 0.326 → 0.341): (1) **Elo connectivity regularisation** (the
    parked item): a team's read-out rating keeps only the share of its excess above 1500 equal to
    the share of its last 20 matches against full members, which took Uganda from 1668 to 1508 and
    from a 53% simulated win rate to 41%; (2) the **edge-transfer split**: only exposure two or more
    bins below the edition's top-third cutoff is discounted, as the slope was measured, which stopped
    India's batters carrying 77% of their edge because their 2022–24 opposition averaged below the
    top third (India had been simulating weaker than Pakistan).
  - Rarity (first measurement, 200 random slot-constrained drafts in random identity slots, 2024):
    champion 5.5%, unbeaten champion 0.5%, mean match win rate 42%; top squad decile 10% champion,
    0% unbeaten. Real elevens in a random slot: champion 8%, unbeaten 1%. Random drafts are weak
    (the pool is mostly Silver), so the spec's targets will be re-measured once the draft client's
    rerolls, coach bonuses and spin tiers exist; the dial is `data/config/tiers.json` plus
    `ENGINE` constants.
  - Review case surfaced: Kohli 2016 now Gold at the 89th batting percentile (was Elite at the
    94th); his value is scoring-rate led while his dismissal rate is shrunk hard (parked hazard
    credit). The tier test treats Gold or Elite as acceptable for him.
### Phase 2b — Engine depth — **IN PROGRESS (started 2026-10-30)**

Order agreed with Yash: matchups → rain and DLS → coach intent profiles and captain noise →
fielding. The simulation is not required to reproduce real results (§11).

- **Matchups — BUILT 2026-10-30** (`analysis/matchups.ts` → `data/out/matchups.json`;
  `ENGINE.matchupExponent`). Batting hand × bowler class (right-arm pace, left-arm pace, off-spin,
  leg-spin, left-arm spin) from the hand labels, measured as observed ÷ expected where expected is
  the engine's own combination of both players' archive averages (base × batter^0.7 × bowler^0.7),
  so the term is what the matchup adds beyond who the two players are. 270k labelled balls. The
  pooled multipliers match cricket sense: left-handers ×0.93 runs / ×0.87 boundaries against
  off-spin (turning away) and ×1.07 / ×1.10 against left-arm orthodox (turning in, hazard ×1.06);
  right-handers ×0.95 / ×0.91 against leg-spin and ×0.95 / ×0.90 against left-arm spin; pace shows
  no handedness effect (×0.98–1.01). Phase cells shrink toward the pooled cell (2,000-ball prior).
  Replay metrics unchanged with the term on (run-rate bias +0.7% → −0.3%, Brier 0.204 either way),
  which is what a realism term should do. The bowling-allocation policy inherits the matchup through
  the ball model, so a captain now prefers the off-spinner to a left-hander on merit (the spec's
  λ_match). Unlabelled players (111 without a bowling type, 4 without a hand) get a unit multiplier.
- **Rain and DLS-style rules — BUILT 2026-10-30** (`match.ts` `drawRain`, `ENGINE.rain`,
  `situation.json` → `resources`, `reducedOvers`). A match is rain-affected with a probability
  from the ground (DL finishes + no-results + half the uncounted reduced innings, shrunk toward
  the edition's rate with a ten-match prior: 2024 North Sound 25%, Bridgetown 11%, New York 6%;
  2016 Dharamsala 25%; 2021 UAE 0%). An affected match is one of: **no-result** (the edition's share
  of its rain events; a partial first innings, points shared, no run-rate effect), **reduced before
  the start** to the same overs a side (drawn from the archive's distribution of rain-shortened
  first innings, 5–19 overs; bowlers' quota ⌈N/5⌉; situation tables read at the equivalent 20-over
  position so a 10-over game keeps its powerplay and death), or a **chase cut short** between 35%
  and 90% of its balls and decided on the resource table. The resource table is DLS Standard
  Edition's construction fitted to T20I data: mean first-innings runs still to come by balls left ×
  wickets down as a share of a full innings, over every natural 20-over first innings, smoothed
  monotone (half the balls with no wicket down = 66% of the runs; five down = 39%); the
  professional edition is proprietary and the standard tables are 50-over, so a data-derived table
  is both honest and closer to T20 scoring shapes. Par = first-innings total × resources used; above
  par wins "by DLS". Knockouts washed out are replayed once (reserve day), then the higher-placed
  side goes through. First-innings interruptions are folded into the equal-overs case (no G50-style
  uplift). Replay metrics unchanged (2024 chase win 58.9% vs 58 real). Rain can be switched off per
  match (`rainProbability: 0`) for dry-weather modes.
- **Coach philosophy and intent — BUILT 2026-10-30** (`analysis/coaches.ts` → `coaches.json`;
  `ENGINE.intent`). Every tenure in `coaches.csv` is scored on era-relative team style over its
  months (powerplay run rate, powerplay wickets per over, death run rate, lower-order run share,
  wickets at 15, bowlers used, bowl-first share; team ÷ era − 1, innings-weighted), standardised
  across coaches and shrunk by innings ÷ (innings + 20). Tags fire at |z| ≥ 0.6 with ≥ 20 innings:
  Powerplay aggressor / anchor, Wicket preserver / Risk taker, Death hitter / conservative, Deep
  batting / Top-heavy, Six-bowler rotation / Frontline trust, Bowl first / Bat first. 163 coaches
  profiled (72 tenures lack style data, mostly pre-2007 or associate stand-ins); 103 rows carry the
  World Cups coached, which is how a CPU side gets its coach. Face checks: Dravid 2021–24
  *Powerplay aggressor, Wicket preserver, Death hitter, Top-heavy*; Gambhir and McCullum both
  *Powerplay aggressor, Death hitter*; Fletcher 2011–15 *Wicket preserver, Death conservative, Bat
  first*; Gibson's West Indies *Powerplay anchor*; Sammy's *Deep batting, Death hitter*. The engine
  reads `intent` (powerplay z, middle z from wickets at 15, death z; clipped ±1.5): z = +1 lifts the
  boundary cells ×1.15 (sized to the coach-level SD of era-relative powerplay run rate, 7.3%, with
  boundaries carrying ≈60% of runs) and the dismissal cell ×1.03, applied in absolute terms after
  normalisation so the risk is really paid. The risk slope comes from the setness curve (the one
  place a batter accelerates by choice); the team-month and chase data were both confounded (better
  sides score more *and* lose fewer; steep chases raise hazard ×1.46 for ×1.05 boundaries). Coach
  intent does not touch the opponents' form or lineups (decision 2026-10-27).
- **Captaincy — BUILT 2026-10-30** (`analysis/captaincy.ts` → `captaincy.json`;
  `ENGINE.captainNoiseSlope`). Wins above Elo expectation per tenure in `captains.csv`
  (expectation = the team's mean pre-match win probability over the tenure years × matches), shrunk
  with a 20-match prior and standardised (clipped ±2). 121 captains join to Cricsheet people by
  surname + initial within the team; 39 tenures have no person in the World Cup pool (Vaughan,
  Strauss, Cook …) and 4 are ambiguous. **The 80 ESPNcricinfo-sourced rows stay excluded until
  Yash decides** (they are mostly associate stand-in captains, so the main effect is that those
  sides play with average captaincy). In the engine the fielding captain's z scales the
  bowling-allocation noise: noise × (1 − 0.3 z), clipped to 0.4–1.6, so Rohit (z 1.6) picks bowlers
  with half the randomness of an average captain. A CPU side's captain is the tenure covering the
  edition year whose holder is in that eleven; the drafted side will name its own (Phase 3).
- **Fielding Λ — PARKED 2026-10-30.** Cricsheet records catches, stumpings and run-outs but no
  drops, misfields or chances, so a per-fielder conversion rate is not identifiable: a fielder with
  many catches is one whose bowlers induce edges. The dismissal fingerprints (caught 59%, bowled 18%,
  lbw 10% in 2024) are available for commentary and the dismissal-kind draw in the ball log, which
  is where fielding will show up first. Trigger to revisit: a data source with fielding chances.
- Replay metrics with intent and captaincy active are unchanged (2024: run rate 7.03 vs 7.13,
  dot 44.5 vs 44.4, chase win 59 vs 58, Brier 0.168).
- **§9 acceptance tests — RUN 2026-10-30** (`npm run engine:replay -- <edition> 40`; the 2024 run
  is a unit test). Status per test, five editions (2010, 2016, 2021, 2024, 2026), real elevens:

| § 9 test | Measure | Result | Status |
|---|---|---|---|
| 1 Innings totals | first-innings p10 / p50 / p90, real vs sim | medians within 6 runs everywhere; tails narrower than real in 2024 (87/134/184 vs 77/128/194) and wider in 2026 (124/179/248 vs 133/176/225); SD ratio 0.88–1.38 | Pass on level, **open on spread** (structural, not noise size: dispersion sweep could not move it) |
| 2 Wickets by over | mean wickets down entering overs 7 / 11 / 16 and at the close vs the all-T20I reference 1.79 / 2.85 / 4.39 / 6.14 | within 0.3 through over 15 in four editions (2024 runs 0.4–0.7 high, its real balls-per-wicket is the lowest of any edition); at the close the sim loses 0.2–1.3 more wickets | Pass through the middle overs; death-overs hazard slightly high |
| 3 Per-ball marginals | total-variation distance to the edition's phase-weighted population vector | 0.005 (2016), 0.007 (2021), 0.013 (2010), 0.021 (2024), target ≤ 0.02 | Pass (2024 at the line) |
| 4 Remaining runs vs par | mean first-innings runs after the 10-over mark, sim vs resource table | within 0–7 runs (2016 86.5 vs 86.5; 2021 80.5 vs 73.9) | Pass (target ≈ 5) |
| 5 Bowler usage | bowlers used 5 / 6 / 7 vs 17 / 62 / 20; overs 19–20 by an opening bowler vs 43% | 21–31 / 52–55 / 11–21; openers 21–30% | Pass on count; death trust still under the norm (raising it further makes the death overs too cheap, see `deathCalibration`) |
| 6 Venue effects | chase-win share per ground (≥ 4 real matches), with the ground's own second-innings uplift | Dubai 2021 real 92 → sim 72 (uplift +18%), Abu Dhabi 75 → 62, SCG 2022 29 → 31 (−15%), Nassau 63 → 67; small-sample grounds scatter ±20 points | Pass in direction and order; magnitudes shrunk by the ten-match prior |
| 7 Rating stability | ratings harness | 0.75 / 0.57 vs 0.45 / 0.44 raw | Pass (Phase 1.5) |
| 8 Win-probability calibration | Brier on decided real matches (coin 0.25) | 0.164 (2024), 0.178 (2021), 0.181 (2026), 0.214 (2016), 0.225 (2010); favourite right 58–76% | Pass; 2010 and 2016 are the thin-data editions |

  Scoring calibration constants after this pass: scoring ×0.94, hazard ×1.04, death overs ×1.15
  (the death term was added when trusting openers at the death made those overs 8–10% cheaper than
  every edition's; real batters attack the best bowlers anyway). Phase run rates now sit within 3–5%
  of real in every phase and edition except the 2024 middle overs (6.44 vs 6.88).

### Phase 3 — Draft client — **FIRST SLICE BUILT 2026-10-30**
- `draft/` workspace: Vite + React web app (website or app, not Messenger) importing the engine's
  pure modules as TypeScript source from `wcdraft/src`. `engine/load.ts` was split into
  `engine/data.ts` (pure, builds edition data from parsed JSON; shared by Node and browser) and
  the Node reader. A sync script copies the data files into `public/data/` and writes slim
  per-edition pool files for the spin cards; full rating vectors load only at simulation time.
- Built: identity spin (one reroll, real record and stand-in note), coach panel of three with tags
  and intent words (one reroll), eleven squad spins with slot placement (archetype fit highlighted,
  two rerolls, one instance per person), overs meter and keeper check, lineup review with reorder
  and captain choice (captaincy rating shown), full-tournament simulation in the browser (≈1 s
  including data), result screen with headline, your matches and scorecards, group tables and
  knockouts. Seed-deterministic throughout. Verified end to end in the browser (Netherlands 2024
  with a cross-era eleven: Taibu 2010, Jayasuriya 2007, Gayle 2009, Maxwell 2016 …).
- Found and fixed on the way: unmeasured players printed 76–78 because the display guard shrank
  toward zero while the median rated player sits below zero after cohort standardisation (now
  shrinks toward the median: an unknown prints 70); the role fallback called a keeper with 49
  batting a "bowler" because his unmeasured bowling printed 73 (the skill with evidence now wins);
  the identity's exit stage could name a stage the side never played.
- **Card review additions (2026-10-30, after Yash's playtest):** shown skills with backup evidence
  (ratings §5.6 / README item 8); every card carries the batting hand and, for anyone who bowls,
  the bowling code; **batting out of position** is shown as the player's batting number re-weighted
  to the phase mix the slot actually faces (`environment.positionPhaseBalls`, new in the edition and
  venue profiles; `draft/src/game/slots.ts`), on the "Place here" button, the slot row and the
  lineup; a **grounds and conditions brief** (edition against the archive, the side's own grounds
  with spin-against-pace from the new `paceSpin` split, plain-words chips and what they ask of the
  eleven) sits on the identity screen and the draft header. Measured, not hand-written.
- **Presentation plan (2026-10-30, after Yash's Cricket Chairman screenshots):** (1) engine log
  with dismissals, fielders, partnerships, extras split, bowler maidens/dots and a player-of-the-match
  rule, **built**; (2) match summary card and modern scorecard with your players highlighted,
  **built**; (3) match-by-match pacing (simulate once, reveal fixture by fixture with play next /
  sim to my next / sim the rest, hub tabs for fixtures, standings, bracket, squad stats); (4) live
  playback of the ball log with templated commentary and speed control; (5) headlines. The engine's
  own play is untouched by (1): dismissal detail is drawn on a forked stream. Same day, after Yash's
  second look: summary and scorecard laid out by innings (first innings left, second right), a
  **Stats tab** (your squad plus tournament leaders over every match: runs, wickets, sixes,
  boundaries, strike rate, economy, awards; all fixtures' scorecards are now kept), and a **draft
  guard**: once the open slots equal what the side still needs (five who bowl, a keeper), only
  players meeting a need can be taken; the rule bites first after five picks. Refined the same day:
  **the keeper does not bowl**: a lone keeper-bowler keeps and loses his overs, a second keeper who
  does not bowl takes the gloves and frees him; the engine marks the designated keeper unable to
  bowl. The draft client is served at `/draft` by the Swipe Sixer server with a homepage button.
  Playtest follow-ups the same day: **position prior** for batting (a thin record rests on its
  position band's pooled vector, not the all-batters population; Bumrah's 60 came from a tail-ender
  carrying a middle-order survival rate in the mid overs), **pace/spin split** per batter (shown on
  the card, applied by the engine on top of the hand × class term), and the standings tables redrawn
  as proper tables (position, P W L NR Pts NRR, tabular figures, content-sized columns).
- **Engine refit 2026-11-01** (`docs/wc-draft-engine-refit-2026-11-01.md`, after the two audits of
  that day): calibrations to 1 / 1 / 1 with the structural causes fixed (ball-weighted centring,
  non-striker run outs, within-phase streak null, real byes and wide runs, powerplay bowler share),
  projection off by default, the other agent's innings-phase / shape / found / gear / Squeezer
  terms parked at 0 after a term-by-term A/B, pressure re-measured at engine strength. Nine
  editions, 60 sims × 2 seeds: every phase within 0.05 RPO, chase share on real, Brier 0.2013
  (0.1958 before, but that build was leaking the tournament into its ratings). Players matter:
  India 2024's real eleven wins 66% and the title 15%, the best eleven by card 78% / 55%, the worst
  valid eleven 38% / 0%. Exponents stay 0.7 / 0.7 (0.9 is 0.004 better on Brier but widens the
  first-innings spread 10% beyond real).
- **Team sheet and scorecard notation (2026-11-01):** the eleven is drawn as a paper team sheet
  (`draft/src/components/TeamSheet.tsx`) on both the draft and lineup screens: numbered 1–11, full
  names, † before the keeper and (c) after the captain, hand and bowling code under each name, the
  batting number for the slot on the right ("70 of 71" when the slot moves it), pencilled lines for
  open positions, "Place here" on the open rows, the keeper / overs / needs line as the footer. The
  scorecard now writes fall of wickets as `1-12 (Rohit, 2.3 ov)`, extras as `(b, w, nb)`, marks
  †keeper and (c), and lists "Did not bat". Decided the same day: placement stays the user's
  choice in every case (no best-fit auto-place), the sheet shows Bat and Bowl numbers, and **the
  batting order cannot be changed after the draft** (the move arrows were removed; the slot a man
  is placed in is the decision, and the lineup screen only names the captain).
- **Card overhaul, three-pane draft and draft-time fit (2026-11-01, after the team sheet):**
  every card has the same geometry (`PlayerCard.tsx`: tier colour down the left edge, name with
  side and year, a fixed row of marks for role, hand, bowling code and WK, Bat and Bowl cells with
  the number over a three-segment phase bar, dimmed with a dash where the card hides a skill, pace
  and spin on the last line); the small print (thin record, projection, estimate, style, domestic
  balls) moved to a detail pane (`PlayerDetail.tsx`). The draft screen (`DraftScreen.tsx`) is three
  panes that scroll inside themselves: squad, detail with the slot chooser, team sheet; the page
  itself no longer scrolls; under 900px the squad and sheet are tabs and the detail is a bottom
  sheet. The coach screen now names the side and year and carries the grounds brief above the
  three coaches. **Draft-time fit** (`game/fit.ts`, loaders and hooks in `fit-load.ts`): each card
  shows its number in the World Cup being played (era + usual position + pace/spin mix, the sum the
  result screen's Player ratings tab prints) and the slot chooser and sheet quote the engine's own
  number at each position, so the draft and the result tab agree to the point (checked on a full
  run). The coach step is the engine's `applyIntent`, measured over the 2016 field as mostly level:
  an attacking coach lifts every batter about +3 (mean 2.9, SD 0.8) and a holding one costs about
  −3, so it is shown in two parts, the field-wide lift and the **fit** (this batter against the
  field under that coach), and the card chip shows the fit. Open from this: (a) the intent model
  makes an attacking coach a free lift for the whole side in the value metric, which is a balance
  question for the engine (hazard per SD against boundary per SD), not for the card; (b) bowling
  "era" steps of ±13 between 2012 and 2016 look too large and are probably the bowling field
  scale's lower tail, to be checked against the engine's economy and strike rates by edition;
  (c) the Gazette's batting-order table prints card numbers, not the numbers in this World Cup;
  (d) a pitch term for bowlers by class was not built because the engine has no pace/spin
  condition yet (see `project_conditions_findings`); slower balls, cutters and swing are later.
- **The Gazette as a run of dated issues (2026-11-01, evening):** "edition" is the World Cup's word
  and is never used for a paper. Issue 1 is the preview, then one issue per match the side plays,
  then the **Souvenir issue**; the masthead reads "Issue N · date · Match day M of the YYYY World
  Cup" (match days count distinct dates in play order, since a side rarely plays consecutive days),
  and the controls read "Previous issue / Next issue / Skip to the end". Each match issue has four
  sections, Report, 1st innings, 2nd innings, Tables. The scorecard is now one innings per view
  (`InningsCard`: batting left, bowling right with the fall of wickets and stands under it, "Did
  not bat" under the batting) behind innings tabs (`MatchScorecard`), used by the gazette and the
  Your matches and Knockouts tabs alike. Every fixture now keeps its ball log (`keepBallLogs` in
  `simulate.ts`; the tournament stores it), so CPU matches read the same as yours.
  **Facts** (`draft/src/game/facts.ts`, pure): a record book folded over all fixtures in play order
  (highest and lowest total, highest chase, best figures, highest score, biggest wins by runs and
  balls, fastest fifty) that reports a break with its previous holder, how long the mark stood and
  how many times it has moved; detectors for hundred, five-for, hat-trick (ball log), captain's
  duck, sub-hundred total, big total and big chase at edition-relative marks (`marksFor(rpo)`:
  rpo×20+45 and +25, checked against the corpus p90), lone hand (fifty in a win with no team-mate
  past 30, by share of the total), standout bowler (four-for in a win) and cheap wickets (three at
  under six while the rest leaked 8.5+), collapse (four for 25; five for the report), big stand
  (100; 130 for the report), rout, nail-biter, last-ball win, late surge (won from 15+ an over
  inside the last five, from under 10 at the start), twenty off the final over to win, upset
  (associate over a full member, membership by edition), first win, unbeaten run, knockout, super
  over / bowl-out / coin, D/L, no result. Tiers set from the **corpus harness**
  (`draft/scripts/facts-corpus.mts`, 3,024 CPU matches over ten editions): a stop press now in
  about a third of matches (upsets alone 10% until the associates fix; hundreds 5.8%, five-fors
  4.8%, hat-tricks 2.9%), a report fact in three quarters; records that fell inside two days are
  notes, not news.
  **Prose** (`prose.ts` + `bank.ts`): a fragment grammar, `{slot}`, `{n:word}`, `{name:pos}` and
  `[list]` tokens, a seeded picker that never repeats a frame until its list is used up, one
  picker per run so the no-repeat memory holds whatever order the pages are read, and the bank
  carries no digits (a test keeps it so; another renders every frame for every fact and checks
  each number came from the fact; a third holds fifty seeds to no repeats within a run). Register:
  understated British sports page, teams plural, no exclamation marks. `paper.ts` writes the run
  once: stop press (best tier-one fact), up to three fact sentences for the report, and **late
  news**, "Since our last issue", one line per other match since the previous issue (last eight,
  grouped by date) with its best fact where the result line has not already said it. The Tables
  section shows every group as it stood after that match day, the leaders and the record book.
  Open from this: the stop-press rate should fall once associates are rated honestly; the bank is
  about 320 frames and fragments and should grow toward the 600–900 agreed; the souvenir issue
  still has its old content (next phase); the preview's batting-order table still prints card
  numbers.
- **Agreed order after the refit (2026-11-01):** (1) associates fix in the ratings: no-record
  players sit on the global position-band prior, so Italy 2026 bowls at 71 against India's 74 and a
  few tournament balls can make a 77 (shrink empty records toward the side's own mean or an
  associate-tier prior; test against the real associate-v-full-member win rate in 2024/2026);
  (2) player card overhaul (fixed geometry: tier bar, name, fixed tag slots, Bat and Bowl cells
  with phase bars, pace/spin pair; low-sample, projected, squad player and style in a tap-to-open
  detail panel) and a fixed three-pane draft layout where the spin squad, the detail/slot chooser
  and the team sheet each scroll inside their own box; (3) match-by-match hub with a between-match
  lever (order, captain, intent); (4) daily seed, Performance score, share card; (5) rarity tuning.
  **Cricket flair, as it comes:** print register throughout (paper, Oswald heads, serif body, rules
  not boxes, no ICC marks or crests); match view as a ground scoreboard (TOTAL / WKTS / OVERS / LAST
  MAN / batters / bowler's figures) rather than a TV bug; over ticker `. 1 4 W 2 6`; toss, umpires
  and referee from Cricsheet officials; "need 45 off 24"; cards in the cigarette-card format with
  flat silhouettes by hand and action; squad spins as a tour-programme page (real captain, real
  result); worm, Manhattan, partnership bars and required-rate line from the ball log; era touches
  (2007 bowl-out, super over from 2009, DRS from 2012, era kit palettes, "Twenty20" in 2007);
  Cricinfo-voice templated commentary with the live playback.
- Not yet built: Cricket-IQ mode (names only), head-to-head, leaderboard (performance score beside
  squad rating), share links, Timeless and Tournament Form tags on cards, ratings-visible career
  stats, coach build bonuses and Dynamic Duos (§5.10–5.11), Positionless slot bonus, rarity tuning
  on the real draft.

### Phase 4 — Modes and depth
- Daily challenge, head-to-head, coach cross-era modes, associates' coaches, ODI edition.

---

## 11. Open questions for Yash

Resolved 2026-10-28: reroll budget (1 coach, 2 squad); spins uniform over all squads; one
instance per real person; coaches always drafted, 3 per panel; ratings-visible mode with
career-to-date T20I stats.

Resolved 2026-10-28 (second round): display rating range **40–99**; unbeaten-run rarity is
tuned **after** the engine exists, not targeted up front; **no 12th man and no concussion
substitutes** for now; Afghanistan's stand-in is **the team that lost the T20 World Cup
Qualifier final for that edition, or the next team that would have qualified** had Afghanistan
been absent (per-edition lookup in `wcdraft/data/config/editions.json`); associate-nation
coverage is assessed from the full team/player database in Phase 0 (which teams per edition,
then how many players lack data).

Resolved 2026-10-30: card face is a **tier** (Bronze / Silver / Gold / Elite, Swipe Sixer scheme),
**role-relative** so a finisher's tier does not drop for facing few balls; **per-phase ratings
shown for batting and bowling**; platform is a **website or app**, not Messenger. Details in §5.6.

Resolved 2026-10-30 (client review): **a skill is shown only with evidence** — no bowling number
for batters who rarely bowl and no batting number for bowlers who rarely bat, unless the record
exists somewhere; **domestic and franchise T20 records are the backup** for a skill thin in T20Is
(Cricsheet league archives, same person ids), and **ODI records back 2007 and 2009** (List A is
not on Cricsheet). Built the same day (`wcdraft/README.md` ratings item 8): the domestic test is
**recency-aware** (balls in the edition year and the three seasons before it, so Kohli's early IPL
overs do not make him a bowler in 2024), the ODI record vouches for bowling only in 2007 and 2009,
the role's own skill is always shown with the low-sample badge carrying the warning, and a hidden
skill cannot earn an all-rounder role. 889 of 2,074 bowling numbers and 488 batting numbers are
hidden; 18% of specialist batters show a bowling number. Tournament debutants with no earlier
record (Rohit 2007, Amir 2009) are rated from the tournament itself (`source: "tournament"`, kept
out of the validation); 19 player-editions with no record anywhere are Bronze with both skills
hidden, and the one squad that is mostly blank (Namibia standing in for Afghanistan 2012) is not
spun. Pool note: a squad holds the players who
appeared, so West Indies 2007 (two matches, one eleven) has 11 cards; official 15-man squads
remain a parked item. Open: whether the Elite thin-evidence cap should count career balls as well as
window balls (Livingstone 2021 sits first among 2021 batters but is capped at Gold on 78 window balls).

Still open: none blocking Phase 2. Tiers built 2026-10-30 (§5.6). **Ratings accepted by Yash
2026-10-30 as evidence-based**, without a name-by-name review; the known cases (Erasmus 2024 and
Sundar 2026 Elite, Kohli 2024 Silver) stay in the parked table with their triggers.

Resolved 2026-10-30 (engine review): **the simulation is not required to reproduce real results**
(who won which match, who reached the knockouts); the replay harness measures environment,
calibration and usage, not agreement with history, because real elevens were often not the best
eleven and the engine has its own momentum. **Anchor undervaluation (Kohli 2016 Gold, Kohli 2024
Silver) is accepted as a reflection of how T20 rewards scoring rate**; the hazard-credit item stays
parked without a trigger from Yash. Engine core and tournament layer accepted. Next: Phase 2b.

---

## 12. Appendix

### 12.1 Cricsheet attribution text (draft)

> Match data from Cricsheet (cricsheet.org), licensed under the Open Data Commons Attribution
> License v1.0. This is an unofficial fan project, not affiliated with or endorsed by the ICC,
> any cricket board, or any player. Player names and statistics are historical public record.

### 12.2 Measurement notes

- All *MEASURED* figures: men's T20 World Cup matches identified by event name in
  `t20s_male_json.zip` downloaded 2026-10-27; Afghanistan matches absent (withheld).
- "Complete innings" = 20 overs bowled, not a super over.
- Phase boundaries: powerplay = overs 1–6; death = overs 17–20 (16–20 where stated).
- Indices in §5.10 are team value / edition average over World Cup innings only; tenure-wide
  indices will replace them in Phase 1.

### 12.3 Afghanistan's slots per edition (withheld from the archive)

Derived by cross-checking Cricsheet group memberships (the group with a missing team) against
Wikipedia's *Afghanistan at the ICC Men's T20 World Cup*:

| Edition | Stage | Group | Other teams | Result |
|---|---|---|---|---|
| 2010 | First round | C | India, South Africa | Eliminated |
| 2012 | First round | A | England, India | Eliminated |
| 2014 | First round | A | Bangladesh, Hong Kong, Nepal | Eliminated |
| 2016 | First round → Super 10 | B → 1 | Scotland, Hong Kong, Zimbabwe → England, South Africa, Sri Lanka, West Indies | Won first round; 5th in Super 10 |
| 2021 | Super 12 | 2 | India, New Zealand, Pakistan, Namibia, Scotland | 4th |
| 2022 | Super 12 | 1 | Australia, England, New Zealand, Sri Lanka, Ireland | 6th (two washouts) |
| 2024 | Group → Super 8 → SF | C → 1 | New Zealand, West Indies, Uganda, PNG → India, Australia, Bangladesh | Semi-final (lost to South Africa) |
| 2026 | Group | D | New Zealand, South Africa, UAE, Canada | 3rd; eliminated |

**Replacement policy (*DECIDED* 2026-10-28):** keep the real schedule shape by inserting a
stand-in team in Afghanistan's slot: the team that lost that edition's qualifier final, or the
next team that would have qualified (by the qualification route used that year) had Afghanistan
been absent. The stand-in's lineup and philosophy come from its T20Is in the 24 months before
the edition, including qualifiers. Per-edition stand-ins are recorded in the editions config.

### 12.4 Scripts used during design

Ad-hoc Python over the scratchpad archive; rewritten as the Phase 0 pipeline. Measured
tables in §6–7 are the acceptance baselines for that pipeline.

---

## 13. Phase 0 review (2026-10-28)

A fresh-eyes pass over the pipeline and this document after Phase 0 landed. Items marked
**fixed** were corrected during the review; the rest are the backlog going into Phase 1.

### 13.1 Fixed during the review

- **First-innings average** included rain-shortened 18–19-over innings and excluded sides
  bowled out inside 18 overs. Now "natural" innings only (20 overs or all out). Averages fell by
  1–7 runs (2021: 146 → 139; 2024: 140 → 135).
- **Ties settled by super over or bowl-out** were treated as undecided in chase-win and
  toss-winner rates (35 such matches in the archive). The tie winner now counts.
- **Full-member status was static.** Ireland and Afghanistan became full members in 2017, so
  Ireland's 2009 win over Bangladesh is now an associate upset and Oman beating Ireland in 2016
  is not. Config carries a `since` year per member.
- **Card-roster name matching** pre-filled two players wrongly (e.g. "MR Kumar"); removed. The
  snapshot covers 891 of 903, and card↔person mapping will be its own reviewed file.
- **Keeper rule** implemented as decided: any evidence of ever keeping makes a player
  keeper-eligible in every edition; the three evidence columns remain for audit.
- Cricsheet's per-match `missing` flag is now surfaced (no World Cup match carries it).

### 13.2 Gaps that need pipeline work before Phase 2

1. **Stand-in squads.** Teams substituted for Afghanistan never played that edition, so they
   have no squad or XI in the archive. Build each stand-in's squad and default XI from its
   T20Is in the form window (most-used eleven). Affects UAE 2010/2021, Namibia 2012/2016,
   Scotland 2014, Papua New Guinea 2022, Zimbabwe 2024, Kenya 2026.
2. **Afghanistan's fixtures are withheld**, so the stand-in's dates and venues are unknown
   from data. Hand-enter Afghanistan's real fixture list per edition (~45 matches) from open
   sources so the stand-in inherits a faithful schedule.
3. **Two-slot cascades** (2021: Scotland up, UAE in; 2022: Sri Lanka up, PNG in) do not fit
   the single `standIn.team` field. Replace with structured `slotChanges` per edition.
4. **Team-period style and strength tables are missing.** Coach philosophy and captaincy
   wins-above-expectation both aggregate over tenures, which need (a) per team-month style
   metrics and (b) a team-strength timeline over all T20Is. Add both as Phase 0.5 outputs so
   tenure tables can be joined without re-parsing.
5. **Tournament formats are prose.** The engine needs structured rules per edition: groups,
   advancement counts, Super-stage composition, tiebreaks, and knockout pairing. *Resolved
   2026-10-28:* `wcdraft/data/config/formats.json` holds all ten. Two findings overturned
   assumptions: **no edition carried points forward** into its Super stage (the ODI World Cup
   did; the T20 World Cup never has), and the Super-stage groups of 2007, 2009, 2010, 2012, 2024
   and 2026 were **pre-seeded** (a group winner's next group was fixed by seeding, not by
   finishing position, so an upset qualifier inherited the eliminated seed's slot), whereas
   2014, 2016, 2021 and 2022 placed teams by position. The simulator must implement both.
6. **No day/night information.** The dew proxy mixes afternoon and evening matches. Approximate
   from same-day same-venue ordering (first match is the day game) or hand-enter start times
   for World Cup matches.
7. **Draft pools are "players who appeared", not official squads.** Non-playing squad members
   are absent. Optional: add official 15-man squads from open sources with zero data and a
   low-sample badge.
8. **2007 and 2009 form windows are nearly empty** (105 and 63 player-editions lacking data).
   Decision needed: use Cricsheet ODI data (same licence, small download) as a weak prior for
   early editions, or hand-rate.
9. **Reduced-overs innings distort phases.** Overs 6–9 of a 10-over innings are indexed as
   "middle". Mark reduced innings via `scheduledOvers` / `target.overs` and exclude them from
   phase vectors (≈5% of innings).
10. **Dismissals off wides** (stumped or run out off a wide) are not in the striker's per-ball
    vector because wides are skipped for batting. Count striker dismissals regardless of the
    wide flag, or track them separately.

### 13.3 Spec refinements

11. **Opposition-quality adjustment is missing from the ratings spec.** Associate form windows
    are earned against weaker attacks; Bandyopadhyay ranks opposition bowler among the top
    three context effects. Add an opponent-strength covariate (or at least full-member vs
    associate splits) to §5.2 and §5.4.
12. **Era normalisation target is wrong in §5.2.** Form windows span 24 months of mixed
    conditions, so normalise against the window's own population (per phase, per opposition
    tier), then transport into the destination edition's environment.
13. **The "16-0" framing does not fit World Cups.** A perfect run is 7 to 10 matches depending on
    edition and starting stage. The target must be dynamic ("9-0") and the leaderboard must
    normalise by path length, or first-round starters are penalised.
14. **The era penalty (§5.7) has no data behind it.** Label it game design, or replace it with a
    style-mismatch effect (intent vs era environment) that the data can price.
15. **Timeless (§5.6)** should be judged on form ratings at each edition, not tournament stats,
    and the three-edition requirement structurally excludes most associates; state that.
16. **Run-outs are asymmetric**: the batter vector counts them as `W`, the bowler vector does
    not. The engine must draw run-outs as a state event layered on the batter vector (as
    Davis–Perera–Swartz do) and never from the bowler vector. Document in §7.1.
17. **Identity reroll** is unspecified (coach 1, squad 2). Propose 1.
18. **Default XI for unplayed pairings.** Simulated brackets create matches that never happened;
    each CPU team-edition needs a default XI and order (the modal order from
    `lineup-deviation.json` is the starting point).
19. **Low-sample badge** rule still open; propose fewer than 60 form balls faced (or 72 bowled).
20. **Rule flags (§6.5) are unverified.** *Resolved 2026-10-28:*
    `wcdraft/data/config/rules-verification.json` quotes the official ICC playing conditions
    for 2021–2026 clause by clause and secondary sources for 2007–2016; the existing flags are
    consistent (free hit for all no-balls from 2016, DRS from 2021, stop clock from 2024).
    One open conflict: Wikipedia claims DRS debuted at the 2014 edition with one review per
    side, the ICC's 2021 announcement calls 2021 the debut; the ICC statement is followed and
    no review is recorded in the 2014 or 2016 archive data. Two further constants hold for
    every edition: a six-over powerplay with two fielders outside the circle, then five; and
    one bouncer per over.
21. **Host advantage** samples are 3–9 matches per edition; treat the measured value as a prior
    around the literature's ×1.03, not as a fact.
22. **The "dew proxy" is really a chase-uplift proxy**: second-innings scoring also reflects
    target knowledge and intent, not only dew. Rename in outputs and keep the venue split.
23. **First-innings SD varies 25–43 by edition**, so the acceptance target "≈ 28–30" in §9 must
    be per edition, not global.
24. **Per-team-edition usage norms** rest on 2–9 innings and are too noisy to drive the CPU;
    use edition norms for behaviour and team norms only as flavour text.
25. **Partnership pairs repeat across consecutive editions** because windows overlap; derive
    Dynamic Duo tags per edition, not globally.
26. **Snapshot staleness.** The biography snapshot is from March 2025: 12 unmatched 2026
    debutants, and playing role is empty for ~70% of players, so the career-keeper column
    undercounts; the all-time stumping column compensates.
27. **Credits** must name both Cricsheet (ODC-By) and the cricketdata snapshot.

### 13.4 Things that held up

The per-ball accumulation, phase definitions, squad and XI capture, usage and deviation norms,
venue mapping, and the snapshot join all reproduced the design-time numbers exactly where the
definitions were unchanged, and the whole build stays under three seconds, so adding the tables
above is cheap.

Ad-hoc Python over the scratchpad archive; to be rewritten as the Phase 0 pipeline. Measured
tables in §6–7 are the acceptance baselines for that pipeline.
