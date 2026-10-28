# Afghanistan men's T20 World Cup fixtures (2010-2026)

Compiled 2026-10-28. Machine-readable output: `wcdraft/data/config/afghanistan-fixtures.json` (36 fixtures, ordered by date, with `venueId` mapped to `venues.json`).

## Per-edition counts

| Edition | Stage(s) | Group | Matches | W | L | NR | Tie-lost | Notes |
|---|---|---|---|---|---|---|---|---|
| 2010 | Group | C | 2 | 0 | 2 | 0 | 0 | Beausejour (Gros Islet), Kensington Oval |
| 2012 | Group | A | 2 | 0 | 2 | 0 | 0 | Both at R. Premadasa, Colombo, 19:30 D/N |
| 2014 | First Round | A | 3 | 1 | 2 | 0 | 0 | All 15:30 starts; eliminated by Nepal loss |
| 2016 | First Round + Super 10 | B then 1 | 7 | 4 | 3 | 0 | 0 | Won all 3 in Nagpur; beat WI in Super 10 |
| 2021 | Super 12 | 2 | 5 | 2 | 3 | 0 | 0 | Sharjah, Dubai, Abu Dhabi x3 |
| 2022 | Super 12 | 1 | 5 | 0 | 3 | 2 | 0 | Both MCG games abandoned without a toss |
| 2024 | Group + Super 8 + Semi Final | C then 1 | 8 | 5 | 3 | 0 | 0 | Brief expected 9; actual is 8 (4+3+1) |
| 2026 | Group | D | 4 | 2 | 1 | 0 | 1 | Tie v SA lost in a second super over |
| **Total** | | | **36** | **14** | **19** | **2** | **1** | Matches Wikipedia's record table (14 W, 20 L incl. tie-lost, 2 abandoned) |

## Field conventions in the JSON

- `date`: local match date, YYYY-MM-DD.
- `startTimeLocal` / `wikiDayNightMarker`: copied from the Wikipedia match box ("D/N", "N" or none).
- `dayNight`: derived rule, start >= 17:00 local -> `night`, else `day`. Note the 2016 India edition tagged its 15:00 starts as D/N (second innings under lights); those are `day` here but keep the `D/N` marker so the dew model can treat them separately if wanted.
- `opponent`: Cricsheet spellings ("United Arab Emirates", "Papua New Guinea", "Hong Kong", etc.).
- `venue`: Wikipedia ground + city; `venueId`: id in `venues.json`. Two city spellings differ from the config (Chittagong vs `chattogram`; Providence/Guyana and Tarouba/San Fernando both carried in the string).
- `afghanistanBattedFirst`: null for the two 2022 no-toss abandonments.
- `scores`: first-innings; second-innings summary for convenience, null when no play.

## Sources (all fetched directly, no proxy/cache)

- https://en.wikipedia.org/wiki/Afghanistan_at_the_ICC_Men%27s_T20_World_Cup (primary; every edition cross-checked)
- https://en.wikipedia.org/wiki/2010_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2012_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2014_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2016_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2021_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/2022_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/2024_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/2026_ICC_Men%27s_T20_World_Cup

Every fixture appears in both the Afghanistan summary page and the relevant edition page with matching date, venue, batting order and margin.

## Gaps and caveats

- No fetch failures; all pages were read directly in up to three 100k-character chunks.
- 2024 count: the brief expected 9, but Afghanistan played 8 (Group C had 5 teams so 4 group games, then 3 Super 8 games and the semi-final). Both sources agree on 8.
- Day/night for 14:00-15:30 starts: Wikipedia gives no marker for most, but the 2016 edition page marks its 15:00 starts D/N. The derived `dayNight` field uses the start-time rule, not the marker, so it is consistent across editions.
- The Afghanistan summary page's prose says "14 wins in 32 matches", which conflicts with its own record table (36 played); the table and the edition pages agree with each other and were used.
- Warm-up matches (2010 v Ireland/Nepal, 2012 v Sri Lanka A/West Indies, 2021 v SA/WI, 2022 v Bangladesh/Pakistan, 2024 v Oman/Scotland, 2026 v Scotland/West Indies) are deliberately excluded.
