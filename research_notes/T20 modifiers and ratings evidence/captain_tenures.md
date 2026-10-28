# Men's T20I captain tenures — source notes

Compiled 2026-10-28 for `wcdraft/data/config/captains.csv` (244 rows, 24 teams; Afghanistan skipped by request).

## Method

- All pages fetched directly with curl (Wikipedia and stats.espncricinfo.com). No proxy, reader, mirror or cache service was used; no software installed; tables parsed with a Python-stdlib HTML parser.
- Primary source: Wikipedia per-nation captain list pages, men's T20I captains table. Used verbatim (names, years, matches, won, lost, tied, no result) for 14 teams.
- Secondary source: ESPNcricinfo Statsguru "most matches as captain" records page per team (class=3 = T20I). Used as the row source for 10 associates whose Wikipedia list is missing or stale, and as a cross-check for every Wikipedia row. Where the two disagree, the Wikipedia value is kept and the Cricinfo value is written in `notes` ("Cricinfo differs: ...").
- Three captains present on Cricinfo but absent from the Wikipedia table were added as separate rows and labelled in `notes` (Towhid Hridoy, Qasim Akram, Kusal Mendis).
- Cricinfo gives initials (e.g. "MG Erasmus"). Full names were substituted and each is flagged in `notes` as confirmed or NOT confirmed on a fetched Wikipedia page. Two are unconfirmed: Italy "GRD Munasinghe" -> Gayashan Munasinghe, Uganda "D Muhumuza" -> Deusdedit Muhumuza.
- T20 World Cup squad pages (2007, 2009, 2010, 2012, 2014, 2016, 2021, 2022, 2024, 2026) were fetched and their "(c)" markers used to corroborate associate captains; they add no stats so they are not cited as `sourceUrl`.

## Caveats on the row model

- Both sources publish one aggregate row per captain, not per continuous tenure. A captain with two separate spells (e.g. Zimbabwe: Brendan Taylor 2011–2014 and 2021; Sikandar Raza 2015 and 2021–present) therefore appears once with aggregate stats and firstYear/lastYear spanning both spells; `notes` says so. Splitting would need match-level data and was not attempted.
- `firstMatchDate` / `lastMatchDate` are blank throughout: neither source gives dates in these tables.
- Wikipedia "present" was mapped to lastYear 2026 (pages are current to the 2026 T20 World Cup); flagged in `notes`.
- Ireland: Wikipedia gives William Porterfield's period as 2005–2007, which is plainly wrong for 56 matches; firstYear/lastYear use the Cricinfo span 2008–2017 and `notes` explains. Stats are Wikipedia's (identical to Cricinfo).
- Pakistan: Wikipedia row for Sahibzada Farhan (2026–) has no stats; cells left blank.
- Kenya 2007–2013 and the other associates' pre-2019 matches: Cricinfo counts only matches with T20I status, so these tables will not include e.g. USA's 2010–2015 WT20 Qualifier games (not T20Is).

## Per-team row counts and sources

| team | rows | row source | Wikipedia page | notes / gaps |
|---|---|---|---|---|
| Australia | 14 | Wikipedia list | [List_of_Australia_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Australia_national_cricket_captains) | Mitchell Marsh 35 M vs Cricinfo 42 (Wikipedia stale by one series); Wade/Head spans differ. |
| Bangladesh | 13 | Wikipedia list + 1 Cricinfo-only | [List_of_Bangladesh_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Bangladesh_national_cricket_captains) | Wikipedia table omits Towhid Hridoy (2026, 6 M) — added from Cricinfo. Wikipedia "Nurul Sohan" = Cricinfo "Nurul Hasan". |
| Canada | 8 | Wikipedia list | [List_of_Canada_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Canada_national_cricket_captains) | Current to 2026; Saad Bin Zafar "2022–Present" vs Cricinfo 2022–2024; Bagai 2008–2013 vs 2010–2013. |
| England | 13 | Wikipedia list | [List_of_England_cricket_captains](https://en.wikipedia.org/wiki/List_of_England_cricket_captains) | Harry Brook 24 M vs Cricinfo 27; Collingwood span 2007–2010 vs 2007–2011. |
| Hong Kong | 7 | Cricinfo (Wikipedia list missing/stale) | [List_of_Hong_Kong_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Hong_Kong_national_cricket_captains) | Wikipedia list stale: stops at 2014–16, every row "2014–Present", 32 matches total; omits Nizakat Khan (56 M) and Yasim Murtaza (40 M). Rows from Cricinfo. |
| India | 15 | Wikipedia list | [List_of_India_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_India_national_cricket_captains) | Shreyas Iyer 23 M vs Cricinfo 24; Suryakumar Yadav W 42 vs Cricinfo 40. |
| Ireland | 6 | Wikipedia list | [List_of_Ireland_cricket_captains](https://en.wikipedia.org/wiki/List_of_Ireland_cricket_captains) | Porterfield period typo corrected from Cricinfo (see caveats). Lorcan Tucker 2 M vs Cricinfo 4. |
| Italy | 8 | Cricinfo (Wikipedia list missing/stale) | [Italy_national_cricket_team](https://en.wikipedia.org/wiki/Italy_national_cricket_team) | No Wikipedia captains list page exists; team page has no captains section (current squad marks Wayne Madsen captain; 2026 squad page marks him (c)). Rows from Cricinfo. Munasinghe full name unconfirmed. |
| Kenya | 11 | Cricinfo (Wikipedia list missing/stale) | [List_of_Kenya_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Kenya_national_cricket_captains) | Wikipedia list stops in 2013 (4 captains); omits all 2019+ captains. Rows from Cricinfo (11). |
| Namibia | 5 | Cricinfo (Wikipedia list missing/stale) | [List_of_Namibia_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Namibia_national_cricket_captains) | Wikipedia list stale (Erasmus "2019", 40 M vs 91 on Cricinfo). Rows from Cricinfo. |
| Nepal | 5 | Wikipedia list | [List_of_Nepal_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Nepal_national_cricket_captains) | Current to 2026; Dipendra Singh Airee 6 M vs Cricinfo 8. |
| Netherlands | 5 | Wikipedia list | [List_of_Netherlands_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Netherlands_national_cricket_captains) | Matches Cricinfo except Seelaar end year (2022 vs 2021). |
| New Zealand | 13 | Wikipedia list | [List_of_New_Zealand_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_New_Zealand_national_cricket_captains) | Santner 56 M vs Cricinfo 59; Nick Kelly 1 vs 2. |
| Oman | 11 | Cricinfo (Wikipedia list missing/stale) | [List_of_Oman_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Oman_national_cricket_captains) | Wikipedia list stops 2023; omits Jatinder Singh (23 M) and 2025–26 stand-ins. Rows from Cricinfo. |
| Pakistan | 14 | Wikipedia list + 1 Cricinfo-only | [List_of_Pakistan_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Pakistan_national_cricket_captains) | Wikipedia table omits Qasim Akram (2023, 3 M) — added from Cricinfo. Several year spans differ from Cricinfo (Shoaib Malik 2007 vs 2007–2019; Misbah 2011–12 vs 2009–12; Sarfraz 2016–20 vs 2016–19); Salman Ali Agha 46 M vs Cricinfo 50 (Wikipedia stale by one series). Sahibzada Farhan has no stats. |
| Papua New Guinea | 4 | Cricinfo (Wikipedia list missing/stale) | [List_of_Papua_New_Guinea_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Papua_New_Guinea_national_cricket_captains) | Wikipedia list stale (Vala "2014–present", 61 M vs 67). Rows from Cricinfo. |
| Scotland | 7 | Cricinfo (Wikipedia list missing/stale) | [List_of_Scotland_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Scotland_national_cricket_captains) | Wikipedia list stale (Coetzer "2012–Present" 29 M vs 41; Berrington 2 M vs 37; omits Matthew Cross). Rows from Cricinfo. |
| South Africa | 18 | Wikipedia list | [List_of_South_Africa_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_South_Africa_national_cricket_captains) | Matches Cricinfo except Bavuma NR (0 vs 1). |
| Sri Lanka | 15 | Wikipedia list + 1 Cricinfo-only | [List_of_Sri_Lanka_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Sri_Lanka_national_cricket_captains) | Wikipedia table omits Kusal Mendis (2026, 6 M) — added from Cricinfo. Shanaka/Arachchige/Asalanka spans end earlier on Wikipedia than Cricinfo; Hasaranga 10 M vs Cricinfo 7. |
| Uganda | 9 | Cricinfo (Wikipedia list missing/stale) | [Uganda_national_cricket_team](https://en.wikipedia.org/wiki/Uganda_national_cricket_team) | No Wikipedia captains list page exists; team-page Captains table ends in 1971. 2024 squad page marks Brian Masaba (c). Rows from Cricinfo. Muhumuza full name unconfirmed. |
| United Arab Emirates | 11 | Cricinfo (Wikipedia list missing/stale) | [List_of_United_Arab_Emirates_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_United_Arab_Emirates_national_cricket_captains) | Wikipedia list stops 2019; omits Muhammad Waseem (73 M), CP Rizwan, Alishan Sharafu, Harpreet Singh Bhatia. Rows from Cricinfo. |
| United States of America | 4 | Cricinfo (Wikipedia list missing/stale) | [List_of_United_States_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_United_States_national_cricket_captains) | Wikipedia captains page has no T20I table (only an "ICC World Twenty20 Qualifier" table of non-T20I matches); team-page "Captains" section is empty; infobox and 2024/2026 squad pages confirm Monank Patel. Rows from Cricinfo. |
| West Indies | 17 | Wikipedia list | [List_of_West_Indies_cricket_captains](https://en.wikipedia.org/wiki/List_of_West_Indies_cricket_captains) | Matches Cricinfo except Rovman Powell end year (2025 vs 2024). |
| Zimbabwe | 11 | Wikipedia list | [List_of_Zimbabwe_national_cricket_captains](https://en.wikipedia.org/wiki/List_of_Zimbabwe_national_cricket_captains) | Two captains with non-continuous spells kept as single aggregate rows (see caveats). Stats match Cricinfo. |

**Total: 244 rows.** Rows from Wikipedia tables: 164; rows from Cricinfo: 80.

## Pages fetched

- Wikipedia list pages (24 attempts; 404 for England/Ireland/West Indies under "national cricket captains", found under "List_of_England_cricket_captains" etc.; 404 for Italy and Uganda under any list title).
- Wikipedia team pages: Hong Kong, Kenya, Namibia, Oman, Scotland, UAE, USA, PNG, Canada, Nepal, Netherlands, Italy, Uganda.
- Wikipedia squad pages: 2007/2009/2010/2012/2014/2016 ICC World Twenty20 squads; 2021/2022/2024 ICC Men's T20 World Cup squads; 2026 Men's T20 World Cup squads.
- ESPNcricinfo: `https://stats.espncricinfo.com/ci/engine/records/individual/most_matches_as_captain.html?class=3;id=<team id>;type=team` for ids 2,25,17,1,19,6,29,31,26,28,32,15,5,37,7,20,30,3,8,34,27,11,4,9 (Nepal is id 32; id 33 is France). Rate-limited (HTTP 429) on the first pass; retried with spacing until all 24 returned 200 with the correct team in the page title.
