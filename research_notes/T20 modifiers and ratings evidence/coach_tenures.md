# Men's national-team head-coach tenures, 2005–present (T20 World Cup nations)

Compiled 2026-10-28 for `wcdraft/data/config/coaches.csv`. Covers the 24 nations that have played a men's T20 World Cup (2007–2026), excluding Afghanistan as instructed.

## Method and access

- All pages were fetched directly from `en.wikipedia.org` (raw wikitext via `?action=raw`, titles located with the on-site search API). No proxy, reader, mirror or cache service was used; nothing was installed.
- Primary sources, in order of preference: the dedicated "List of … coaches" page (exists only for Australia, India, England); the "Coaching history"/"Coaches" section of the national-team article; the per-edition squad pages (which name each team's coach, except 2007); individual coach biographies for month/day precision and for the seven nations whose team article has no coaching history (Zimbabwe, Scotland, Namibia, UAE, Oman, Canada, Italy).
- `worldCupsCoached` was derived from the tenure dates against the edition windows (2007: 11–24 Sep; 2009: 5–21 Jun; 2010: 30 Apr–16 May; 2012: 18 Sep–7 Oct; 2014: 16 Mar–6 Apr; 2016: 8 Mar–3 Apr; 2021: 17 Oct–14 Nov; 2022: 16 Oct–13 Nov; 2024: 1–29 Jun; 2026: 7 Feb–8 Mar) and cross-checked against the squad pages' "Coach:" lines for 2009–2026. Each participating team has exactly one credited coach per edition, except the two documented conflicts below.
- Date precision: most Wikipedia coaching lists give years only. Where only the year is known the cell holds `YYYY`; `YYYY-MM` where the month is known; full dates where given. Blank `fromDate`/`toDate` means the source gave nothing (not "current") **except** where the notes say so; every blank `toDate` that is *not* a current coach carries the note "End date not found - NOT current".
- `role`: `head coach`, `T20I head coach` (a separate white-ball/T20 appointment while someone else coached Tests), or `interim` (includes acting/transitional appointments).

## Per-team row counts (235 rows total)

| Team | Rows | Team | Rows |
|---|---|---|---|
| Australia | 6 | Netherlands | 8 |
| Bangladesh | 15 | New Zealand | 7 |
| Canada | 8 | Oman | 1 |
| England | 10 | Pakistan | 19 |
| Hong Kong | 9 | Papua New Guinea | 14 |
| India | 13 | Scotland | 9 |
| Ireland | 7 | South Africa | 11 |
| Italy | 1 | Sri Lanka | 17 |
| Kenya | 14 | Uganda | 14 |
| Namibia | 3 | United Arab Emirates | 6 |
| Nepal | 9 | United States of America | 8 |
| West Indies | 14 | Zimbabwe | 12 |

## Sources used

Dedicated list pages: List of Australia national cricket coaches; List of India national cricket coaches; List of England cricket team coaches.

Team-article coaching sections: Bangladesh (Head coach history), Hong Kong, Ireland, Kenya, Nepal, Netherlands (Coaches table with months), New Zealand, Pakistan, Papua New Guinea, South Africa, Sri Lanka, Uganda (Coaches table with months), United States, West Indies.

Squad pages: 2007 World Twenty20 squads (no coach lines), 2009/2010/2012/2014/2016 World Twenty20 squads, 2021/2022/2024/2026 Men's T20 World Cup squads.

Biographies (for dates or for nations without a coaching list): Kevin Curran, Robin Brown, Walter Chawaguta, Alan Butcher, Andy Waller, Dav Whatmore, Makhaya Ntini, Heath Streak, Lalchand Rajput, David Houghton; Peter Drinnen, Peter Steindl, Grant Bradburn, Shane Burger, Doug Watson, Paul Collingwood; Pierre de Bruyn; Kabir Khan, Aaqib Javed, Owais Shah, Dougie Brown, Robin Singh; Duleep Mendis, Sulakshan Kulkarni; Andy Pick, Pubudu Dassanayake, Gus Logie, Henry Osinde, Monty Desai; John Davison (Canadian cricketer); Roger Harper; Carl Sandri; Tim Nielsen; Jamie Siddons; Daren Sammy; Rob Walter; Heinrich Malan; Gary Wilson; Ashley Noffke. Board pages: Cricket Scotland (Watson/Dawkins dates), Cricket Canada (Logie hire, current coach).

## Edition-by-edition notes on associates and other judgement calls

- **2007 (no coach lines on the squad page).** Attributions rest on tenure dates: Scotland – Peter Steindl (Drinnen resigned July 2007, Steindl took over on an interim basis before being made coach; often mis-credited to Drinnen). Zimbabwe – Robin Brown (appointed 28 Aug 2007; Curran's bio says he served "until September 2007", a one-month conflict). Kenya – Roger Harper (Jan 2006–2007). Bangladesh – Shaun Williams (interim between Whatmore and Siddons, 28 Oct 2007). India – Lalchand Rajput (titled cricket manager). Pakistan – Geoff Lawson; West Indies – John Dyson; England – Peter Moores; Sri Lanka – Trevor Bayliss; Australia – Tim Nielsen (all year-only in source but unambiguous given the predecessors left after the April 2007 ODI World Cup).
- **2009.** Zimbabwe did not play; Scotland's coach (Steindl) is confirmed by his bio because the squad page's Scotland section carries no coach line.
- **2012 – South Africa conflict.** Team page: "Gary Kirsten (Test, ODI) and Russell Domingo (T20I) 2012–2013"; squad page names Kirsten. Both rows carry `2012`; pick Domingo if you want the T20I-specific coach.
- **2016 – India.** Squad page names no coach, only "Team Director: Ravi Shastri" (Fletcher's contract ended after the 2015 World Cup). Shastri's 2014–2016 Team Director row is credited.
- **2022 – Bangladesh.** Squad page names Sridharan Sriram (BCB's T20I "technical consultant"); Russell Domingo remained head coach. Sriram is recorded as `T20I head coach` and credited with 2022; Domingo with 2021 only.
- **2022 – Netherlands conflict.** Squad page names Ryan Campbell; the team page's coaches table credits Ryan Cook ("initially acting", from Nov 2022) with the 2022 T20 World Cup because Cook ran the side during Campbell's illness. Both rows carry `2022`.
- **2022 – Ireland.** Squad page's coach field is blank; Heinrich Malan (appointed Jan 2022) is credited from his tenure dates.
- **2024 – West Indies.** Daren Sammy was white-ball head coach from May 2023 while Andre Coley coached Tests; recorded as `T20I head coach` from 2023-05 (Coley's 2023–2025 row is Test-only and uncredited).
- **2024 – Pakistan.** Gary Kirsten (ODI & T20I, resigned 28 Oct 2024); Jason Gillespie (Test coach, temporary white-ball) and Aaqib Javed (interim from 18 Nov 2024) follow; Mike Hesson is `T20I head coach` from 2025 and sole head coach from 2026.
- **2026.** All 20 coaches taken from the 2026 squads page; the Canada (Ingleton Liburd), Zimbabwe (Justin Sammons), Namibia (Craig Williams) and Oman (Duleep Mendis) rows depend on it because those nations lack coaching lists.

## Gaps (cells left blank or year-only)

1. **Canada** – no coaching history on Wikipedia. Gus Logie (hired May 2012): end date unknown. Davy Jacobs: start date unknown. Henry Osinde (interim 2017): end unknown. Pubudu Dassanayake's second stint (2022–): end unknown. Ingleton Liburd (2026 World Cup coach): start unknown; Cricket Canada's page lists Monty Desai and the team infobox lists Tejinderpal Singh as current coach – three conflicting current-coach claims, unresolved.
2. **Zimbabwe** – no coaching history on Wikipedia. Andy Waller's head-coach dates (2013–2014) are year-level inferences bounded by Butcher's exit and Mangongo's sacking; Stephen Mangongo's start is unknown (no article); Dave Houghton's end and Justin Sammons's start (no article) are unknown.
3. **Namibia** – only de Bruyn (Dec 2018–) is dated; his end and Craig Williams's start are unknown; Dee Thakur's start is unknown. Pre-2018 Namibia coaches were not researched (Namibia's first T20 World Cup was 2021).
4. **Oman** – Duleep Mendis's appointment date is not on Wikipedia (in post by 2015). Team infobox lists Sulakshan Kulkarni as current coach, but the staff table still says Mendis, the 2026 squad page names Mendis, and Kulkarni's bio never mentions Oman – unresolved. Pre-2015 Oman coaches not researched.
5. **United Arab Emirates** – coaches 2005–Oct 2010 not found; Dougie Brown's end (2017–?) and Robin Singh's end (2020–?) unknown; the 2022–Feb 2024 gap between Singh and Rajput is unresolved.
6. **Scotland** – Andy Moles's start date unknown (left Jan 2006). Doug Watson's 2023 start is year-only.
7. **Netherlands** – Ashley Noffke appears only in the infobox (undated); Ryan Cook's end date is unknown.
8. **Italy** – only John Davison (2025–) recorded; earlier Italy coaches were not researched (Italy's only edition is 2026).
9. **United States of America** – team-page list starts in 2012 (Robin Singh); 2005–2011 not found (USA's first edition was 2024).
10. **Kenya** – the pre-Harper interim is given as Alfred Njuguna (team page) but Mudassar Nazar (Harper bio); Lameck Onyango's 2023–present listing overlaps Dodda Ganesh's 2023–2024.
11. **Papua New Guinea** – Api Leka is "c. 2007" with no end date.
12. **Full Members** – the Australia, England, India, New Zealand, South Africa, Sri Lanka, West Indies, Bangladesh and most Pakistan rows are year-only because the Wikipedia lists give years; month/day precision was added only where a biography supplied it (Nielsen, Siddons, Whatmore, Bradburn, Kirsten/Aaqib Javed 2024, Walter, Collingwood, Malan, Streak, Rajput, Houghton, Butcher, Brown, Curran). Two bios returned redirect stubs under the titles tried (Geoff Lawson, John Dyson) and were not pursued because the team pages already date those tenures.
13. **Pages not fetched** – the per-nation coach navbox templates ("Template:<Nation> national cricket team coaches") do not exist on en.wikipedia; the red-linked "List of coaches of the Scottish/Dutch national cricket team" pages referenced in bios do not exist either.
