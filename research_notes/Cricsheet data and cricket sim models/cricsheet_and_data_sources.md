# Cricsheet and free cricket data sources (state as of 11 October 2026)

All Cricsheet figures below were read from cricsheet.org on 2026-10-11; the site's download archives carry a `Last-Modified` of 7 October 2026 17:05–17:12 GMT, so counts reflect the 7 Oct 2026 site rebuild. Where I inspected files directly (people.csv, ipl_json.zip, all_csv2.zip) I say so.

## What exactly is in a Cricsheet ball-by-ball file (fields, formats)

### Takeaway
The JSON format (v1.3.0, the "official" and most complete format) gives, per delivery: batter, bowler, non-striker, runs (batter/extras/total, plus a `non_boundary` flag), typed extras (byes/legbyes/noballs/penalty/wides), a `wickets` array (kind, player_out, fielders), DRS `review`, and `replacements`; per match it gives dates, venue/city, toss, outcome (with method and margin), officials, event/stage, player lists per team, a name→ID `registry` for people and (since 7 Oct 2026) venues, powerplays, targets, and declared/forfeited/super-over flags. YAML is deprecated, the "Ashwin" CSV (v2.4.0) is the flattened beginner format, the "original" CSV and XML are experimental.

### Cited Findings
- JSON spec v1.3.0. `meta`: `data_version`, `created`, `revision`. `info` required: `balls_per_over`, `dates` (array, YYYY-MM-DD), `gender` ("male"/"female"), `match_type` (Test, ODI, T20, IT20, ODM, MDM), `outcome`, `players` (per team), `registry`, `season`, `supersubs`, `team_type` ("international"/"club"), `teams`, `toss`. Optional: `city`, `venue`, `event` (`name`, `match_number`, `group`, `stage`), `match_type_number`, `missing`, `officials` (`match_referees`, `reserve_umpires`, `tv_umpires`, `umpires`), `overs`, `player_of_match`, `bowl_out`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- `outcome` sub-fields: `winner`; `by` = `runs` | `wickets` | `innings`; `method` = `D/L`, `VJD`, `Awarded`, `1st innings score`, `Lost fewer wickets`; `result` = `draw` | `no result` | `tie`; `eliminator` (super-over winner); `bowl_out`. `toss`: `winner`, `decision` (`bat`/`field`), `uncontested` (bool, mainly County Championship 2016–2019). `registry.people` and `registry.venues` map names to 8-character hex IDs. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- `innings` object: `team`, `overs` (array of `{over, deliveries}`), `absent_hurt`, `penalty_runs` (`pre`/`post`), `declared`, `forfeited`, `super_over`, `powerplays` (`from`, `to`, `type` = batting/fielding/mandatory), `miscounted_overs`, `target` (`overs`, `runs`). — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Delivery object: `actual_delivery` (string; wides/no-balls do not advance the count; required since v1.2.0), `batter`, `bowler`, `non_striker`, `runs` {`batter`, `extras`, `total`, `non_boundary`}, `extras` {only present types among `byes`, `legbyes`, `noballs`, `penalty`, `wides`}, `replacements` {`match`: in/out/team/reason where reason ∈ concussion_substitute, covid_replacement, injury_substitute, national_callup, national_release, supersub, tactical_substitute, unknown; `role`: in/out/reason/role ∈ batter|bowler}, `review` {`by`, `batter`, `decision` = struck down|upheld, `umpire`, `umpires_call`}, `wickets` [{`kind`, `player_out`, `fielders`: [{`name`}]}]. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Spec-listed wicket kinds: bowled, caught, caught and bowled, lbw, stumped, run out, retired hurt, hit wicket, obstructing the field, hit the ball twice, handled the ball, timed out. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Direct inspection of all 1,243 IPL JSON files (ipl_json.zip, 2026-10-11): delivery-level keys present were `actual_delivery`, `batter`, `bowler`, `non_striker`, `runs` (295,732 deliveries each), `wickets` (14,705), `extras` (16,227), `replacements` (585), `review` (990). Wicket kinds observed: caught 9,321; bowled 2,460; run out 1,194; lbw 883; caught and bowled 410; stumped 388; hit wicket 20; retired hurt 19; retired out 6; obstructing the field 4. Note `retired out` appears in data though the format page summary did not list it. Fielder entries can carry a `substitute: true` flag (203 catches in IPL data). — my inspection of https://cricsheet.org/downloads/ipl_json.zip
- JSON format changelog: 1.0.0 initial; 1.1.0 added `toss.uncontested` and `innings.forfeited`; 1.2.0 made `actual_delivery` required; 1.3.0 added `venues` to `registry`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Format status (format index): JSON = "current and recommended… the official format and the most complete"; YAML = deprecated, superseded by JSON, "no new fields will be added, and it will eventually be removed, with at least 6 months' notice", but new matches are still published in YAML until then; XML = experimental, individual files only from the Sourcehut repo `https://git.sr.ht/~srushe/cricsheet-xml` with schema `xml/schema.xsd`; CSV "Ashwin" = "recommended for newcomers", fewer fields; CSV "Original" = experimental, loosely based on Retrosheet, rows of type version/info/ball. — [Cricsheet formats](https://cricsheet.org/format/)
- Current format version numbers after the 7 Oct 2026 venue-registry change: JSON 1.3.0; YAML and XML 0.94; CSV (Ashwin) 2.4.0; CSV (original) 1.9.0. — [Cricsheet article, 7 Oct 2026](http://cricsheet.org/article/licensing-and-venues-registry/)
- Ashwin CSV: two files per match, `<id>.csv` (ball-by-ball, one header row, match info repeated per row) and `<id>_info.csv` (headerless `info,<field>,<value>` rows). Ball columns: `match_id, season, start_date, venue, innings, ball, actual_delivery, batting_team, bowling_team, striker, non_striker, bowler, runs_off_bat, extras, wides, noballs, byes, legbyes, penalty, non_boundary, wicket_type, player_dismissed, other_wicket_type, other_player_dismissed, fielder_1, fielder_2, fielder_3`. Info fields include `balls_per_over, team, gender, team_type, season, date, match_id, match_type, venue, toss_winner, toss_decision, player, player_of_match, umpire, winner, winner_runs, winner_wickets, registry`, plus optional `declared, forfeited, super_over, target_overs`. — [Cricsheet CSV Ashwin format](https://cricsheet.org/format/csv_ashwin/)
- The "all" CSV2 archive (`all_csv2.zip`, 122,349,152 bytes zipped, 1,684,821,671 bytes uncompressed, 46,162 files) contains only `README.txt`, `LICENSE.txt` and per-match `<id>.csv`/`<id>_info.csv` pairs; there is no combined `all_matches.csv` in it as of 2026-10-11. — my inspection of https://cricsheet.org/downloads/all_csv2.zip
- Each zip ships a README.txt listing every match as `date - club|international - type - gender - id - Team A vs Team B`; the IPL zip README states its files are "version 1.2.0, and 1.3.0 files" (the 1,243 files I parsed all reported `data_version` 1.2.0). — my inspection of ipl_json.zip README.txt
- The XML is "not the official version of the Cricsheet data"; it is generated from YAML by a converter project. The GitHub mirror `cricsheet/cricsheet-xml` is archived (read-only, 6 Aug 2020) and states the project moved to Sourcehut over GitHub's ICE contract. — [cricsheet-xml README on GitHub](https://github.com/cricsheet/cricsheet-xml/blob/master/README.md)

### Inferences
- For rating derivation, the JSON format is the only one carrying `review`, `replacements`, `powerplays`, `target`, `non_boundary` and `miscounted_overs`; the Ashwin CSV is sufficient for basic batting/bowling aggregates (runs, balls, dismissals, extras typed) and up to three fielders per wicket.
- Because match IDs in JSON filenames are ESPNcricinfo match IDs (e.g. `1426261.json`, `1535465`), joining to Cricinfo scorecards for QA is trivial. (The ID origin is my inference from the numeric pattern; Cricsheet does not state it on the format page.)

### Gaps
- The format page's wicket-kind list does not include `retired out` but the data does; I could not find a changelog entry for it.
- I could not confirm whether any download ever contained an `all_matches.csv`; it is not present now and no format page mentions it. The brief's "all matches CSV" may refer to older Ashwin-format zips or to Kaggle re-packs; unverified.
- `/format/csv/` (original CSV page) returned 404 under that URL; the index links it as `/format/csv_original/`, which I did not fetch, so original-CSV column names are not listed here.

## Coverage: competitions, counts, earliest dates, update cadence

### Takeaway
23,080 matches as of 7 Oct 2026 (18,397 men's, 4,683 women's) covering 919 Tests, 3,203 ODIs, 5,775 T20Is and ~40 named club competitions (IPL 1,243; T20 Blast 1,570; County Championship 1,483; BBL 662; PSL 357; CPL 445; The Hundred 389; WBBL 519; WPL 88), from 2001 (men) / 2003 (women). 379 Afghanistan-related matches are withheld. Updates are effectively continuous (archives rebuilt the day of the last site change; "recently added" zips for 2/7/30-day windows exist), but no SLA is stated.

### Cited Findings
- Totals: 23,080 matches; 919 Tests; 17 other multi-day; 3,203 ODIs; 492 other one-day (ODM); 5,775 T20Is; 320 other international T20s; 110 countries, 298 club teams, 3 representative XIs; coverage "back to 2001 (men) and 2003 (women)". — [Cricsheet home](https://cricsheet.org/)
- Club/domestic counts (all genders): Afghanistan Premier League 0; Big Bash League 662; T20 Blaze 17; Bangladesh Premier League 469; Bob Willis Trophy 47; County Championship 1,483; Charlotte Edwards Cup 124; Caribbean Premier League 445; CSA T20 Challenge 314; European T20 Premier League 31; FairBreak Invitational 39; The Hundred 389; International League T20 134; Indian Premier League 1,243; Cricket Ireland Inter-Provincial LO Cup 90; Inter-Provincial T20 Trophy 111; Lanka Premier League 143; Major Clubs LO Tournament 160; Major Clubs T20 121; Major League Cricket 109; Major League Tournament 134; Mzansi Super League 56; Nepal Premier League 64; T20 Blast 1,570; One-Day Cup (Australia) 118; Plunket Shield 343; CSA Pro20 6; Pakistan Super League 357; Rachael Heyhoe Flint Trophy 189; One-Day Cup (England) 887; SA20 130; Super 50 8; Syed Mushtaq Ali Trophy 695; Sheffield Shield 209; Super Smash 467; WBBL 519; Women's CPL 33; ECB Women's One-Day Cup 130; Women's Premier League 88; Women's Cricket Super League 95; Women's T20 Blast 112; Women's T20 Challenge 13. — [Cricsheet home](https://cricsheet.org/); same numbers on [Downloads](https://cricsheet.org/downloads/)
- ICC event zips: Men's CWC 265 (24 withheld); Men's T20 WC 230 (29 withheld); Women's CWC 102; Women's T20 WC 168. Downloads total 23,080 = 4,683 women's + 18,397 men's, "379 matches withheld". Download groupings: recent (2/7/30 days, by gender), by match type, by club competition, by ICC event, by year 2001–2026, by country, by club team. — [Cricsheet downloads](https://cricsheet.org/downloads/)
- Afghanistan withholding (14 Nov 2024): all matches featuring the Afghanistan men's team plus Afghanistan Premier League removed (329 at the time) as a protest over the ICC's treatment of Afghan women's cricket; "These matches will hopefully be restored at some point, but only when I feel comfortable doing so." — [Cricsheet article](https://cricsheet.org/article/explanation-for-withholding-of-afghanistani-matches/)
- Practical consequences: "Afghanistan men's team queries return nothing, and head-to-heads, team records, venue stats, and career figures for other teams omit games against Afghanistan." — [cricket-mcp README](https://github.com/mavaali/cricket-mcp)
- Effective start dates per format in the data: Tests from ~Dec 2001, ODIs from ~Jun 2002, T20Is from ~Feb 2005, domestic T20 from ~Apr 2008; "all-time leaderboards are not comparable to official ICC records". — [cricket-mcp README](https://github.com/mavaali/cricket-mcp)
- IPL zip README (2026-10-11) lists matches up to 2026-05-31 (Gujarat Titans vs Royal Challengers Bengaluru, id 1535465), i.e. the complete IPL 2026 season is present. — my inspection of ipl_json.zip
- All archives checked had `Last-Modified: Wed, 07 Oct 2026` (all_json, all, all_csv2, all_male_json, all_female_json, tests_json, odis_json, t20s_json, ipl_json). — HTTP HEAD on https://cricsheet.org/downloads/ (2026-10-11)
- Known-missing matches are tracked on a dedicated page covering Tests, ODIs and selected club competitions only ("Other match types are excluded because they are too extensive to track easily"); examples include England v India women's Test 2002-01-14, Australia v South Africa men's Test 2001-12-14, 16 BBL and 9 CPL entries. — [Cricsheet missing](https://cricsheet.org/missing/)
- The blog is self-described as "infrequent"; latest post 7 Oct 2026. — [Cricsheet home](https://cricsheet.org/)

### Inferences
- Update cadence: the presence of "previous 2 days" zips and archives rebuilt on the day of the last blog post indicate the site is regenerated whenever matches are added, typically within days of play; nothing on the site promises this.
- For a game roster built around current international and franchise players, coverage is essentially complete post-2008 for T20 and post-2002 for ODIs/Tests, with the single large hole being anything involving Afghanistan (Rashid Khan, Mujeeb, Nabi etc. will have truncated or missing international records; their IPL/BBL/CPL league deliveries remain).

### Gaps
- Per-competition earliest/latest dates are not published on the downloads page; only the per-year grouping (2001–2026) and zip READMEs reveal them. I did not enumerate each zip.
- No official statement of update frequency exists; the "Temporary hiatus" page a search surfaced at `/format/changes.html` returned 404, so I could not verify whether a hiatus was ever announced.

## Licence: exact terms, commercial use, attribution, derived works, who runs it, funding

### Takeaway
As of 7 October 2026 the match data (all formats except XML) and both registers are under the Open Data Commons Attribution License v1.0 (ODC-By); XML is CC BY 4.0. Before that date the match data had never had a stated licence ("One major oversight of this project is that I've never previously indicated the license"). ODC-By permits sharing, creating works from, and adapting the database, including commercially, subject only to attribution and keeping notices. Run by Stephen Rushe since 2009; no funding information is published.

### Cited Findings
- Licensing page: "Most of the data is covered by the Open Data Commons Attribution License." and "the XML match data alone is available under the Creative Commons Attribution 4.0 International License." ODC summary quoted: "You must attribute any public use of the dataset, or works produced from the dataset," and you must "make clear to others the license of the dataset" and keep notices intact. Footer: "Site © 2009–2026 Cricsheet. All rights reserved." — [Cricsheet licensing](https://cricsheet.org/licensing/)
- 7 Oct 2026 announcement: "One major oversight of this project is that I've never previously indicated the license"; "Today I'm finally righting that wrong"; "Henceforth the match data (other than the aforementioned XML data)" is under ODC-By, "the same license used for the Register"; XML has "always been available" under CC BY 4.0; the change "isn't intended to change your existing use of the data" and the author would be "very surprised" if it blocked current use; zips now include `LICENSE.txt`. Attribution is "in the manner specified in the license" (no bespoke wording). — [Cricsheet article, 7 Oct 2026](http://cricsheet.org/article/licensing-and-venues-registry/)
- `LICENSE.txt` inside ipl_json.zip begins: "# ODC Attribution License (ODC-By) … The Open Data Commons Attribution License is a license agreement intended to allow users to freely share, modify, and use this Database subject only to the attribution requirements set out in Section 4." It also notes the licence "only governs the rights over the Database, and not the contents of the Database individually" and that other rights (contracts, trademark, privacy/data protection) may apply. — my inspection of ipl_json.zip LICENSE.txt (2026-10-11)
- ODC-By 1.0 human-readable summary: "To share: To copy, distribute and use the database." "To create: To produce works from the database." "To adapt: To modify, transform and build upon the database." Condition: "Attribute: You must attribute any public use of the database, or works produced from the database," and "you must make clear to others the license of the database and keep intact any notices on the original database." The summary says it "is not a license" and "has no legal value". — [ODC-By summary](https://opendatacommons.org/licenses/by/summary/)
- People register page states the data "is available under the Open Data Commons Attribution License." — [Cricsheet register](https://cricsheet.org/register/)
- Operator: Stephen Rushe "wrote the code that extracts and validates the data and built the website"; project began 2009, inspired by Moneyball, a Pappus blog post wishing for a cricket Retrosheet, and Aneesh's T20 files for Against the Spin; name is a tribute to Retrosheet. — [About Cricsheet](https://cricsheet.org/about/)
- Funding: not stated anywhere on home, about, register, licensing, or downloads pages (checked 2026-10-11). — [Cricsheet home](https://cricsheet.org/); [About](https://cricsheet.org/about/)
- The maintainer makes editorial decisions on the data (Afghanistan withholding) — [Cricsheet article](https://cricsheet.org/article/explanation-for-withholding-of-afghanistani-matches/)

### Inferences
- For a free non-commercial hobby game: the ODC-By licence imposes no non-commercial restriction, so both the hobby game and any later monetisation are permitted by the data licence as long as (a) Cricsheet is credited wherever the derived ratings/data are publicly used, (b) the ODC-By licence is named/linked, and (c) any Cricsheet notices are kept in redistributed copies. There is no share-alike clause (that is ODbL, not ODC-By), so derived rating tables may be released under any terms.
- The licence covers the database rights only; it says nothing about the real player names/likenesses. Use of real names in a game is a separate (personality/trademark) question Cricsheet cannot license, and the LICENSE.txt itself flags that "privacy rights / data protection rights" may apply to contents.
- No "last-modified" or effective date is in the licence page; treat 7 Oct 2026 as the effective date.

### Gaps
- I did not fetch the full ODC-By 1.0 legal text (Section 4 attribution wording) — the summary and the zip's LICENSE.txt preamble are quoted instead.
- No information on hosting costs, donations, or sponsorship was found; `/contact/` was not fetched.
- The site's `/faq/` URL returns 404; there is no FAQ page under that path.

## Player registry: stable IDs and people.csv with Cricinfo/Cricbuzz keys

### Takeaway
Yes. `people.csv` (18,623 rows on 2026-10-11) maps an 8-hex-char Cricsheet `identifier` to `name`, `unique_name` and keys for up to 12 external sites; 18,578 (99.8%) have a `key_cricinfo`, but only 50 have `key_cricbuzz` and 4,508 have `key_cricketarchive`. `names.csv` lists name variants. Match files carry the same IDs in `info.registry.people`. No formal ID-stability guarantee is written, but IDs are the join key the site itself depends on.

### Cited Findings
- Register sizes: 18,623 people, 28,528 identifiers from 12 sources, 8,818 name variations; venues register: 239 venues, 239 identifiers, 128 name variations. — [Cricsheet home](https://cricsheet.org/)
- `people.csv` columns: `identifier` (Cricsheet ID "used in Cricsheet match data"), `name` (can be shared by several people), `unique_name` ("guaranteed not to be used for another person"), and keys `key_bcci, key_bigbash, key_cricbuzz, key_cricheroes, key_crichq, key_cricingif, key_cricketarchive, key_cricketworld, key_cricinfo, key_nvplay, key_opta, key_pulse`. "Not every person has every ID. Only IDs needed by Cricsheet or the Cricket Scorecard Accuracy Project are included." Scope: every player and official in a Cricsheet match plus CSAP players. `names.csv` = `identifier,name`. Files are republished "when the site is rebuilt". — [Cricsheet register](https://cricsheet.org/register/)
- Actual header of people.csv (2026-10-11): `identifier,name,unique_name,key_bcci,key_bcci_2,key_bigbash,key_cricbuzz,key_cricheroes,key_crichq,key_cricinfo,key_cricinfo_2,key_cricinfo_3,key_cricingif,key_cricketarchive,key_cricketarchive_2,key_cricketworld,key_nvplay,key_nvplay_2,key_opta,key_opta_2,key_pulse,key_pulse_2` (i.e. secondary-ID columns exist for duplicates). Row counts with a non-empty key: cricinfo 18,578; cricketarchive 4,508; pulse 2,010; bcci 1,321; nvplay 1,142; bigbash 296; opta 67; cricbuzz 50. — my inspection of https://cricsheet.org/register/people.csv
- `registry.people` in each JSON match file maps every name used in that file to the 8-character ID. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- The venue register (added 7 Oct 2026) gives each venue a unique ID and alternate names; only matches added since then carry `registry.venues`, with backfill planned. — [Cricsheet article, 7 Oct 2026](http://cricsheet.org/article/licensing-and-venues-registry/)

### Inferences
- `key_cricinfo` is the practical bridge to any biographical source (cricketdata `player_meta`, Wikidata P2697), since it is nearly universal in the register; `key_cricbuzz` is useless for bulk joins.
- Names in delivery rows are display names (e.g. "TM Head", "Arshdeep Singh"), not IDs; always resolve through `registry.people` because `name` is not unique.

### Gaps
- No written guarantee that identifiers never change or that merged duplicates are redirected; I found no changelog of ID merges.

## Known limitations: what Cricsheet does not record, fielder gaps, quality

### Takeaway
Confirmed: no ball speed, line/length, shot type, wagon-wheel coordinates, pitch maps, field placements, or player attributes (handedness, bowling style) — the spec has no such fields and third-party users state the same. Fielder attribution is complete for catches in IPL data (0 of 9,321 catches lacked a fielder) but 15% of run-outs (182/1,194) have no fielder listed. The maintainer validates totals and batter aggregates by script; the main known-quality caveats are missing matches, the Afghanistan withholding, and start-date truncation.

### Cited Findings
- The full JSON spec contains no fields for delivery speed, line, length, shot, coordinates, or field settings; the only spatial/qualitative items are `runs.non_boundary`, `extras` types, `wickets.kind`, `fielders`, and `review`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- "Cricsheet doesn't include player attributes like batting hand or bowling style" — the cricket-mcp project enriches from a cricketdata CSV for that reason. — [cricket-mcp README](https://github.com/mavaali/cricket-mcp)
- IPL JSON (1,243 matches, 2026-10-11): caught 9,321 with 0 missing fielders; run out 1,194 with 182 (15.2%) lacking any fielder; 203 catches attributed to a substitute fielder (flag `substitute: true`). — my inspection of ipl_json.zip
- `info.missing` is an explicit per-match list of known-absent data (`player_of_match`, `umpires`, `reviews`, or specific powerplays). — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- In IPL data `city` was absent in 51 of 1,243 files and `player_of_match` in 9. — my inspection of ipl_json.zip
- Maintainer's accuracy process (2009 article): scripts verify innings totals and each batter's runs/balls against scorecards; early errors were "mostly from confusing players who shared a surname" and "every data file is now run through the scripts before release". — [How accurate is the data?](https://cricsheet.org/article/how-accurate-is-the-data/)
- Missing-match register exists only for Tests, ODIs and selected club competitions; T20Is and most domestic formats are not tracked for gaps. — [Cricsheet missing](https://cricsheet.org/missing/)
- Coverage truncation ("camera installed partway through the movie"): Tests from ~Dec 2001, ODIs ~Jun 2002, T20Is ~Feb 2005, domestic T20 ~Apr 2008. — [cricket-mcp README](https://github.com/mavaali/cricket-mcp)

### Inferences
- Ratings for fielding can be derived only from catch/stumping/run-out counts (and substitute flags), not from chances missed or ground fielding; run-out attribution will undercount by ~15%.
- Bowling "style" ratings (pace vs spin, economy by phase) must be approximated using `powerplays`/over number for phase and an external source for bowler type; batting-hand matchups likewise need an external source.
- Because `review` data exists only from when DRS was in use and `missing.reviews` is flagged, DRS-derived metrics are inconsistent across eras.

### Gaps
- I found no public issue tracker or user-compiled list of data-quality bugs; the WebSearch for fielder-attribution complaints returned nothing relevant. Error reports go through the site's contact page.
- I did not quantify fielder gaps for Tests/ODIs/other leagues; the 15% run-out figure is IPL-only.

## Player biographical data: not in Cricsheet; legal alternatives

### Takeaway
Cricsheet has no DOB, batting/bowling style, handedness, role or nationality fields. The cleanest legal sources are (1) the `player_meta` dataset bundled in the GPL-3 `cricketdata` R package (snapshot of "all players on ESPNCricinfo as at 24 March 2025", keyed by Cricinfo ID — same key as Cricsheet's `key_cricinfo`), and (2) Wikidata (CC0; 31,715 items with a Cricinfo player ID, but only 1,157 with a bowling-style statement and no batting-style property exists). Scraping ESPNcricinfo directly is prohibited by Disney's Terms of Use.

### Cited Findings
- Cricsheet `info.players` is just a list of names per team; no attributes. `gender` is the only person-level attribute, at match level. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- cricketdata `fetch_player_meta(playerid)` "Fetches player meta data from ESPNCricinfo" (one row per Cricinfo ID); the saved `player_meta` dataset holds "meta data for all players on ESPNCricinfo as at 24 March 2025" and "is usually simpler to use than fetching data live". `find_player_id()` looks up Cricinfo IDs. — [cricketdata reference: fetch_player_meta](https://pkg.robjhyndman.com/cricketdata/reference/fetch_player_meta.html)
- cricketdata (per its vignette, as surfaced in search) covers "player id, dob, batting/bowling hand, bowling type" for individual players. — [cricketdata vignette](https://pkg.robjhyndman.com/cricketdata/articles/cricketdata_R_pkg.html)
- cricket-mcp bundles `data/player_meta.csv` "taken from the cricketdata R package and covering about 16K players" with batting style, bowling style, playing role, country, used to enrich Cricsheet registry IDs. — [cricket-mcp README](https://github.com/mavaali/cricket-mcp)
- cricketdata on CRAN: version 0.3.0, published 2025-03-25, licence GPL-3, maintainer Rob Hyndman (Monash); imports rvest/xml2 (i.e. it scrapes Cricinfo HTML). Authors: Rob Hyndman, Charles Gray, Sayani Gupta, Timothy Hyndman, Hassan Rafique, Jacquie Tran. The package site asks users to "respect each site's terms of use". — [CRAN cricketdata](https://cran.r-project.org/package=cricketdata); [pkg site](https://pkg.robjhyndman.com/cricketdata/)
- Disney Terms of Use (last updated 24 May 2024) govern products "branded Disney, ABC, ESPN, Marvel…"; they prohibit users to "access, monitor, copy or extract the Disney Products using a robot, spider, script, or other automated means", expressly including "data mining or web scraping" (exception for search-engine indexing); the user licence is "for your personal, noncommercial use only". — [Disney Terms of Use](https://disneytermsofuse.com/english/)
- ESPNcricinfo's own legacy terms URL (`/ci/content/site/company/terms_use.html`) returned HTTP 403 on 2026-10-11, so I could not quote cricket-specific terms. — attempted fetch
- Wikidata properties: P2697 "Cricinfo player ID"; P2698 "CricketArchive player ID"; P2545 "bowling style"; P3572 "ESPNcricinfo playing ground ID"; a property search for "batting style" / "batting" returned no property. — [Wikidata wbsearchentities API](https://www.wikidata.org/w/api.php?action=wbsearchentities&search=bowling%20style&language=en&type=property&format=json)
- Wikidata SPARQL (2026-10-11): 31,715 items have a Cricinfo player ID (P2697); only 1,157 of those also have a bowling style (P2545). — [Wikidata Query Service](https://query.wikidata.org/)

### Inferences
- The join path for a hobby game is: Cricsheet `people.csv.key_cricinfo` → cricketdata `player_meta` (DOB, hand, bowling type, role, country) → optional Wikidata P2697 for nationality/DOB cross-check and images. Using the bundled snapshot CSV (rather than running the scraper) avoids personally hitting ESPNcricinfo in breach of Disney's ToS, though the snapshot's own provenance is a scrape; GPL-3 governs the package code, and the dataset's redistribution status is not separately stated.
- Wikidata is sufficient for DOB/nationality for well-known players but far too sparse for batting/bowling style.
- Date of birth is also needed for a career-mode ageing curve; `player_meta` is the only bulk source found with near-complete DOB coverage.

### Gaps
- I could not retrieve the exact column list of `player_meta` from the reference page (it is in the function's return value documentation, not the index); the fields DOB/batting style/bowling style/role/country are confirmed only via the cricket-mcp README and the vignette snippet.
- Whether the `player_meta` snapshot itself carries a data licence distinct from GPL-3 is not stated.
- Cricinfo-specific terms (as opposed to Disney's umbrella terms) could not be read (403).

## Alternative free sources and wrappers

### Takeaway
No official Cricsheet client library exists. The best-maintained wrapper is Rob Hyndman's `cricketdata` R package (GPL-3, CRAN 0.3.0, Mar 2025) with `fetch_cricsheet(type=bbb|match|player, gender, competition)`. Python options on PyPI (`cricsummary`, `python-cricket-scraper`, `yorkpy`) are small, third-party and partly YAML-era. Kaggle hosts many Cricsheet re-packs (IPL 2008–2026, ODI, T20I, BBL) of varying licence. Wikidata is CC0. I found no reliable free bulk source for ICC rankings or howstat.

### Cited Findings
- `fetch_cricsheet(type = c("bbb","match","player"), gender = c("female","male"), competition = "tests")` downloads Cricsheet CSV data as a tibble; `cricsheet_codes` lists competition codes; example `fetch_cricsheet(competition = "wbbl", type = "bbb")`. Other exports: `fetch_cricinfo()`, `fetch_player_data()`, `fetch_player_meta()`, `find_player_id()`, `update_player_meta()`, dataset `player_meta`. — [fetch_cricsheet reference](https://pkg.robjhyndman.com/cricketdata/reference/fetch_cricsheet.html); [reference index](https://pkg.robjhyndman.com/cricketdata/reference/index.html)
- PyPI: `cricsummary` (1.0.0 reads Cricsheet JSON; earlier versions YAML; scorecards, worm/Manhattan plots, CSV export); `python-cricket-scraper` (0.1.1; `CricSheet` class reads YAML → CSV, also scrapes ESPNcricinfo); `yorkpy` (T20 analysis on Cricsheet data, port of R `yorkr`). None is maintained by Cricsheet. — [cricsummary on PyPI](https://pypi.org/project/cricsummary/1.0.0); [python-cricket-scraper](https://pypi.org/project/python-cricket-scraper); [yorkpy on libraries.io](https://libraries.io/pypi/yorkpy)
- cricket-mcp (MIT): TypeScript/DuckDB ingest of the full Cricsheet JSON archive; loaded 23,080 matches, 11,667,961 deliveries, 15,245 players; star schema `players / matches / innings / deliveries`; incremental update via `recently_played_N_json.zip`. — [cricket-mcp on GitHub](https://github.com/mavaali/cricket-mcp)
- Kaggle re-packs of Cricsheet (via baselight mirror listings): IPL ball-by-ball 2008–2026 ("completely flattened, tabular"), IPL 2008–2023 (~239,693 rows × 35 cols), ODI match info + ball-by-ball (sourced from Cricsheet JSON), T20I ball-by-ball, BBL to 2017 (from YAML) and BBL 2010–21. — [Kaggle IPL 2008–2026](https://baselight.app/u/kaggle/dataset/lyc0riz_ipl_ball_by_ball_dataset_2008_2026); [Kaggle ODI](https://baselight.app/u/kaggle/dataset/subhrajyotinath_match_info_and_ball_by_ball_data_for_odis); [Kaggle T20I](https://baselight.app/u/kaggle/dataset/jamiewelsh2_ball_by_ball_it20); [Kaggle BBL](https://baselight.app/u/kaggle/dataset/patrickb1912_big_bash_league_complete_dataset_20112019)
- Wikidata provides Cricinfo and CricketArchive ID properties and a bowling-style property (counts above). — [Wikidata Query Service](https://query.wikidata.org/)
- The site also runs the related "Cricket Scorecard Accuracy Project", which shares the people register. — [Cricsheet home](https://cricsheet.org/)

### Inferences
- Kaggle re-packs are convenient but add a licence layer of their own (often "unknown" or CC0 chosen by the uploader) and are frozen snapshots; given the full Cricsheet archive is ~148 MB, pulling from source is simpler and keeps the ODC-By chain clean.
- For a TypeScript/Node project (this repo), cricket-mcp's ingest code is the closest reference implementation; otherwise parsing the JSON directly is a few dozen lines.

### Gaps
- Kaggle pages were only reachable via a mirror, so per-dataset licences were not verified.
- I did not research ICC rankings data access, howstat's terms, or CricketArchive (paywalled) in depth; no free, licensed bulk feed for ICC rankings was identified in this pass.
- Release dates/maintenance status of the PyPI packages were not confirmed.

## Practical: archive size and published per-player aggregates

### Takeaway
The complete JSON archive is 147.6 MB zipped (`all_json.zip`, 147,593,961 bytes, 7 Oct 2026); CSV2 is 122.3 MB zipped / 1.68 GB unzipped; men's JSON 126.3 MB, women's 21.3 MB; Tests 17.3 MB, ODIs 21.6 MB, T20Is 22.9 MB, IPL 5.2 MB. Nobody appears to publish a maintained, pre-aggregated per-player dataset derived from Cricsheet; the norm is to aggregate locally (cricket-mcp into DuckDB, cricketdata into tibbles).

### Cited Findings
- HEAD responses 2026-10-11: `all_json.zip` 147,593,961 B; `all.zip` (YAML) 143,945,962 B; `all_csv2.zip` 122,349,152 B; `all_male_json.zip` 126,268,772 B; `all_female_json.zip` 21,331,788 B; `tests_json.zip` 17,292,207 B; `odis_json.zip` 21,611,846 B; `t20s_json.zip` 22,934,250 B; `ipl_json.zip` 5,187,770 B; all `Last-Modified` 7 Oct 2026. — HTTP HEAD on https://cricsheet.org/downloads/
- Uncompressed sizes: `all_csv2.zip` → 1,684,821,671 B across 46,162 files; `ipl_json.zip` → 105,610,171 B across 1,245 files (≈20× compression). — my inspection
- cricket-mcp reports ~141 MB download and 11.67 M deliveries for the full archive. — [cricket-mcp README](https://github.com/mavaali/cricket-mcp)
- A targeted search found no standalone GitHub/Kaggle dataset of pre-aggregated per-player batting/bowling stats built from Cricsheet; the closest are tools that compute them on demand. — [search results summarised in WebSearch](https://pkg.robjhyndman.com/cricketdata/articles/cricketdata_R_pkg.html); [cricket-mcp](https://github.com/mavaali/cricket-mcp)

### Inferences
- Expect ~3 GB of JSON on disk if fully extracted (extrapolating the IPL 20× ratio to 147.6 MB); streaming the zip or ingesting into SQLite/DuckDB is the sane approach for a per-player ratings pipeline.
- Per-player rating derivation is feasible entirely from Cricsheet: batting (runs, balls, dismissals, boundary %, dot %, phase splits via over number/powerplays, by match_type and era), bowling (balls, runs conceded, wickets by kind, extras conceded, phase economy), fielding (catches/stumpings/run-out involvements), with sample-size shrinkage needed for domestic-only players; the missing inputs are bowling type and batting hand (from `player_meta`) and anything spatial.

### Gaps
- No published derived per-player aggregate from Cricsheet was found; if one exists on Kaggle under a different name it was not surfaced by the queries used.
