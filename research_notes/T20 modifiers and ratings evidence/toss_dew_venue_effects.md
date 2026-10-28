# Contextual effects in T20 cricket: toss/chasing, dew, home advantage, venue, pitch, rain/DLS, chase pressure

Scope note: these are research notes for a ball-by-ball T20 simulator. Each section gives the best published magnitude, the covariates and modelling used, sample sizes, and a label of **[peer-reviewed]**, **[working paper / preprint]**, **[industry/analyst]** or **[blog/media]**. Where the only evidence is media counts, that is stated. Primary PDFs from Tim Swartz's SFU page and the IIMB paper were text-extracted locally and quoted from the extracted text; page references are approximate.

Implementation-ready summary table (details and caveats in the sections below):

| Effect | Best estimate | Units | Source quality |
|---|---|---|---|
| Winning the toss (T20, all levels) | +1.27 pct-pts win prob; CI includes 0 | win-probability points | peer-reviewed-style preprint (Sood & Willis 2016), ~41k matches all formats |
| Winning the toss (T20, DL-invoked) | +3.9 pct-pts vs +1.17 non-DL | win-probability points | same |
| Winning the toss (T20I, 2019-24, home team) | odds ratio 1.003 (negligible) | odds ratio on home win | peer-reviewed (Kumar et al. 2026), n=209 T20Is |
| Batting second, generic T20 | ~49% for chasers (51% bat-first) in 1,628 non-DL games | win % | media/academic op-ed (Woodcock, UTS) |
| Batting second, DL-affected T20 | ~61% for chasers (39% bat-first) in 84 games | win % | same |
| Batting second, UAE night T20 (2021 WC, dewy) | 9/9 Dubai night games; 21/27 Dubai+Abu Dhabi | counts | media (ESPNcricinfo stats) |
| Home advantage, T20I run multiplier | ×1.03 home / ×0.97 away on each batter's runs | multiplier | peer-reviewed (Davis, Perera & Swartz 2015), 250 T20Is |
| Home advantage, T20I raw win rate 2019-24 | 54.9% home wins | win % | peer-reviewed (Kumar et al. 2026) |
| Home advantage, ODI (older benchmark) | ~16 runs at equal strength | runs | peer-reviewed (de Silva, Pond & Swartz 2001, cited in DPS 2015) |
| DL resource table vs T20-specific table | T20 table ~5% lower in late-overs/many-wickets corner; ~3% higher in last 7 overs with 0 wkts | resource % points | peer-reviewed (Perera & Swartz 2013), 388 first innings |
| Share of T20 matches needing DL | 84/1,712 ≈ 4.9%; 4/89 ≈ 4.5% (intl 2005-09) | proportion | Woodcock; BGS 2011 |
| Chase pressure index | PI = (CRRR/IRRR)·½·[e^(RU/100) + e^(Σw/11)] | index | peer-reviewed (Bhattacharjee & Lemmer 2016) |

---

## Key Question 1: Toss and chasing — win-probability effect of winning the toss and of batting second in T20, and variation by venue/day-night/dew

### Takeaway
The best large-sample estimate puts the T20 toss effect at about +1.3 win-probability points and statistically indistinguishable from zero, smaller than in Tests or ODIs, with no day/night difference in T20 but a larger effect (+3.9 points) when Duckworth-Lewis is invoked. Batting second is roughly neutral in aggregate T20 data (~49-51%) but becomes a very large edge in specific dewy night venues (Dubai 2021: 9/9), so the chase/toss effect should be modelled as a venue-and-session-conditional parameter rather than a global constant.

### Cited Findings

**Sood & Willis, "Fairly Random: The Impact of Winning the Toss on the Probability of Winning" (arXiv 1605.08753, 2016) [preprint; large-sample]**
- Analysis sample 41,060 matches across all formats (after excluding 1,019 abandoned, 1,376 missing bat/bowl data, 769 insufficient overs); abstract cites 44,224 matches. Toss winners win 2.8% more often overall — [ar5iv HTML](https://ar5iv.labs.arxiv.org/html/1605.08753)
- By format: multi-day/Test ≈ +2.6% (≈ +4.5% counting only decisive results); List A/ODI ≈ +3.3% raw; **T20 and T20I ≈ +1.27%**, "cannot be statistically distinguished from zero"; international T20s show a larger advantage than domestic T20 — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- Day/night: one-day day/night +5.92% vs day-only +2.89%; **T20 shows no distinguishable day/night difference** — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- DL-invoked: one-day 5.35% (DL) vs 3.17% (non-DL); **T20 3.9% (DL) vs 1.17% (non-DL)**, probability the two are equal ≈ 10% — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- Toss effect is largest when teams are closely matched (rating difference near 0, ICC rating points, data to 2013); no point estimates given — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- Country-level toss effect (internationals): Sri Lanka 3.85%, India 3.09%, England 2.29%, Australia/Pakistan/West Indies ~1-1.5%, New Zealand negative; authors say CIs too wide to conclude any team reliably capitalises — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- Identification: relies on randomness of the toss, deliberately does not condition on the bat/bowl decision (treated as post-treatment); team strength handled by binning on rating difference, not a regression — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- Conditional on winning, T20 toss winners vs losers: wickets in hand 6.21 vs 6.37; runs margin mean 37.60 vs 34.50; balls remaining mean 16.41 vs 18.69 — i.e. no meaningful margin difference — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- Home team won the toss in 2,892 of 5,684 internationals (50.87%); with home umpires only, 51.9% of 2,965 — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- ESPNcricinfo write-up of the same study (April 2016) exists but returned HTTP 403 — [ESPNcricinfo blog](https://www.espncricinfo.com/blogs/content/story/997931.html); search summary: T20 showed the smallest toss benefit of the three formats — [Search result summary](https://arxiv.org/pdf/1605.08753)

**Kumar et al., "Home team advantage in international cricket: Impact of pitches, rank and toss on the match outcome", IIMB Management Review (2026, in press, DOI 10.1016/j.iimb.2026.100661) [peer-reviewed]**
- Data: ICC pitch/outfield ratings, toss, home/away and rankings for 273 ODIs, 179 Tests and 209 T20Is, 2019-2024 (descriptive table shows 215 T20I outcomes — minor internal inconsistency) — [JGU repository PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- Model: binary logit (T20I, ODI) and multinomial logit (Test) with home win vs away win as outcome; covariates: toss (1 if away team wins toss), pitch rating dummies (ref = Average), outfield rating dummies, rank location (home team higher ranked), rank difference — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- T20I toss result: "the toss is significant at a 5% level. The positive coefficient and RRR of 1.003 indicate a positive but negligible increase in the odds of the Home team winning the match when the toss is won by the Home team"; ODI toss RRR 1.370-1.384 (p<0.05) — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- Descriptives: T20I home win 118 (54.88%) vs away 97 (45.12%); home won the toss 115 (53.49%) of T20Is; Cramér's V for toss vs match win in T20I = 0.221 (weak) — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)

**Dawson, Morley, Paton & Thomas (2009), "To bat or not to bat: an examination of match outcomes in day-night limited overs cricket", JORS 60(12):1786-1793 [peer-reviewed; ODI, not T20]**
- Logit models of match outcome controlling for home advantage and relative team quality; finding: winning the toss and batting first increases win probability, winning the toss and bowling first does not — [UEA repository](https://ueaeprints.uea.ac.uk/37005/)
- 2008 working-paper version: day-night internationals 1979-2005, conditional logit; "winning the toss and batting increases the probability of winning by 31%" (units — relative vs percentage points — not stated on the page) — [EconPapers RePEc:spe:wpaper:0801](https://econpapers.repec.org/RePEc:spe:wpaper:0801)

**Davis, Perera & Swartz (2015), "A simulator for Twenty20 cricket" (Aust. & NZ J. Statistics; SFU preprint) [peer-reviewed]**
- Dataset: all T20 matches 2005 to end-2013 between the 10 ICC full members, 250 matches, ball-by-ball parsed from ESPNcricinfo commentary — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Batting second: with "optimal" incremental aggression in the chase, the simulator gave P(SL wins | SL bats first) = 0.46 vs P(SL wins | India bats first) = 0.61 for an SL–India match, i.e. a 15-point swing favouring the chaser — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- They note this conflicts with empirical studies (de Silva & Swartz 1997; Saikia & Bhattacharjee 2010) suggesting "batting second confers at most a minor advantage"; reconciled by assuming teams delay increasing aggression — when the aggression trigger is scaled by 0.8 (team must be 20% further behind, ≈30 runs in a 150 chase, before changing style) the probabilities become 0.51 / 0.55 — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Analogy cited: MLB home teams (batting last) win roughly 54% (Stefani 2008) — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)

**Woodcock & McBride (UTS), "We need a fairer system for deciding rain-affected games in Twenty20 cricket", The Conversation (2016) [academic op-ed; no significance tests]**
- ~1,712 recent T20 matches (World T20 since 2007 plus leagues), excluding ties/abandoned: 1,628 non-DL games, team batting first won ~51% ("insufficient statistical evidence to reject ... unbiased"); 84 DL-affected games, team batting first won "barely more than 39%" — [The Conversation](https://theconversation.com/we-need-a-fairer-system-for-deciding-rain-affected-games-in-twenty20-cricket-54328); mirrored at [BoomLive](https://www.boomlive.in/do-we-need-a-fairer-system-for-deciding-rain-affected-games-in-t20-cricket)

**2021 Men's T20 World Cup, UAE (dewy night conditions) [media counts, ESPNcricinfo stats desk]**
- Toss winners won 29 of 44 matches (65.9%); toss winners won 10 of 12 matches in Dubai — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup)
- Chasers won 21 of 27 matches across Abu Dhabi and Dubai; all 9 Dubai night matches; 18 of 23 Full-Member Super 12 games including 9/9 in Dubai — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup)
- Under lights, seamers bowling second took 8 wickets in 9 games and conceded almost 10 runs an over — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup)
- Chasers won 7 of 8 T20 WC knockouts since 2014; five of previous six finals won by toss winner — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup)
- A later tournament-end count: toss winner won 30 of 45 (66.6%); among Full Member games 18 won by chasers, 15 by toss winner — [The News (Pakistan)](https://thenews.com.pk/tns/detail/910295-toss-and-the-t20-world-cup); Finch said the toss "did play a big factor" — [Daily Star](https://www.thedailystar.net/sports/sports-special/t20-world-cup-2021/news/it-was-fate-finch-admits-toss-big-factor-world-cup-win-2230386)
- One analysis (unverified, fetch failed) reported Dubai fielding-first teams won 83% overall and 89% at night — [Cricket.com](https://www.cricket.com/news/win-the-toss-chase-to-win-flurry-of-wickets-in-pp-dubais-dual-nature-and-many-more-1636982321761)

**IPL chase/toss aggregates [blogs/media; methods not published]**
- Across 1,000+ IPL matches 2008-2024, toss winners who chose to chase won ~53% vs ~48% for those batting first — [Mystery Cricket blog](https://mysterycricket.com/blogs/cricket/how-much-does-winning-the-toss-matter-in-ipl)
- ESPNcricinfo (2020): teams opting to chase won 57.5% of IPL matches since 2015 — [ESPNcricinfo](https://www.espncricinfo.com/print/story/1230614)
- Delhi venue analysis: night-only IPL sample of 73 matches, toss winner won 38 (52.1%); 84% of captains chose to chase under lights over five seasons — [InsideSport](https://www.insidesport.in/?p=1215769)
- Day games: chasers 54.54% (2024, n=11), 41.66% (2025, n=12), 9/9 early in 2026 — [Mr Cricket UAE](https://www.mrcricketuae.com/opinion/ipl-2026-batting-first-becomes-cardinal-sin-as-expert-predictions-go-haywire/)
- Pre-2014 IPL: teams were wary of dew, driving a chase preference in 8pm games early on — [ESPNcricinfo 2013](https://www.espncricinfo.com/print/story/1182799)

### Inferences
- For a simulator: a global toss multiplier is not justified by the evidence (T20 effect ≈ +1.3 points, CI includes zero). The actionable modelling is (a) the bat/bowl decision rule by venue/session, and (b) a venue-session chase bonus. Encode as `chase_edge[venue][day|night]` with default 0 and venue-specific overrides (e.g., Dubai night ≈ large positive), with the toss itself only mattering via who gets to choose.
- The DL-invoked uplift (+3.9 vs +1.17 points) suggests the "toss effect" partly proxies for rain-affected matches where DL favours the chaser (see Q6).
- Confounding: toss, dew, venue and day/night are collinear in tournament data (2021 UAE). Sood & Willis separate toss from strength by randomisation; Kumar et al. separate home from toss via regression; nobody in this set has a venue-fixed-effects regression with a dew covariate for T20.

### Gaps
- No peer-reviewed T20-only logistic regression of win probability with venue fixed effects plus day/night plus toss was found.
- Units of Dawson et al.'s "31%" (relative odds vs percentage points) could not be confirmed; full text is paywalled.
- Kumar et al. report the toss RRR for the home team but no marginal effect in win-probability points.

---

## Key Question 2: Dew — quantitative studies of second-innings scoring, economy, or wide/no-ball changes attributable to dew

### Takeaway
No peer-reviewed or rigorous quantitative study isolating dew was found; evidence is tournament-level counts (2021 UAE: seamers bowling second under lights ≈10 runs/over, 8 wickets in 9 games) and player testimony. A developer should treat dew as a venue × night-session parameter calibrated from Cricsheet second-vs-first innings differentials, not from a published coefficient.

### Cited Findings
- 2021 T20 WC, Dubai under lights: seamers bowling in the second innings took 8 wickets in 9 games and conceded almost 10 runs per over; chasers 9/9 — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup)
- Mechanism as described by analysts: dew wets the ball and quickens the surface/outfield, reduces spinners' grip and turn, and helps the ball skid onto the bat, which is why chasers gain on batting-friendly surfaces — [Faugy Strategy substack](https://faugystrategy.substack.com/p/a-miss-between-the-cup-and-the-slip); [MyKhel IPL 2026 venue analysis](https://www.mykhel.com/cricket/how-dew-and-the-toss-shaped-ipl-2026-venue-by-venue-analysis-438585.html) [blog/media]
- Player testimony: Bumrah (2021 WC) said India deliberately sought extra runs as a cushion because dew makes the second innings much easier to bat in — [Sportskeeda](https://sportskeeda.com/cricket/news-t20-world-cup-2021-jasprit-bumrah-explains-dew-factor-dictated-india-s-batting-approach); Bumrah: once you lose the toss the wicket changes in the second innings — [Times of Oman](https://timesofoman.com/article/108775-t20-wc-we-know-once-you-lose-toss-wicket-changes-in-second-innings-says-bumrah)
- IPL 2024 testimony: du Plessis said the pitch got better in the second innings with dew; Chakaravarthy said the seam was wet and he could not grip the ball in the second innings — [The Quint](https://www.thequint.com/amp/story/indian-premier-league-ipl/ipl-2024-rr-vs-rcb-faf-du-plessis-says-virat-kohli-batted-well-pitch-better-2nd-innings); [Cricket.com](https://cricket.com/news/we-could-have-assessed-the-pitch-better-varun-chakaravarthy-492024-1712644163318)
- Counter-example: 2026 Rajkot T20I where expected dew never arrived and Rashid went at 3.80 rpo — single-match datum — [Asianet](https://newsable.asianetnews.com/cricket-sports/dew-didn-t-set-in-varun-chakravarthy-analyses-rajkot-pitch-after-india-s-defeat-to-england-in-3rd-t20i-hrd-squ3z0)
- Related but not dew-specific: IPL 2008-2020 study found spinners have better economy than pacers overall and better average/economy when defending a total (i.e. bowling second) — contrary to the naive dew story but not split by day/night — [ISI Digital Commons](https://digitalcommons.isical.ac.in/journal-articles/3298) [peer-reviewed]
- Commercial "Dew Impact Score" (humidity, temperature–dew-point spread, sunset vs match time) is a methodology description with no validation — [PillarLab](https://pillarlab-web.pages.dev/pillars/dew-factor-environmental-impact) [promotional]

### Inferences
- The 2021 Dubai numbers imply roughly a 1.5–2.5 runs/over uplift for the chasing side against pace at that venue under lights, but this is a tournament count confounded by toss-winner captains choosing to chase, so it is an upper bound.
- Dew effects should be split into (i) spin economy/turn penalty, (ii) pace grip/yorker penalty (plausibly more wides/full tosses — unquantified), (iii) outfield speed (more 4s). None has a published coefficient.

### Gaps
- No study quantifies wide/no-ball rate changes in dewy conditions.
- No ball-by-ball regression with a dew indicator (humidity or sunset-relative start time) was found; the natural path is Cricsheet second-minus-first innings run-rate by venue × start time.
- The Chennai vs Wankhede "dew-free vs dewy" venue classification circulates in blogs without data.

---

## Key Question 3: Home advantage — estimates in T20I and franchise cricket, including Davis–Perera–Swartz ×1.03/×0.97

### Takeaway
Davis, Perera & Swartz (2015) implement home advantage as a ×1.03 (home) / ×0.97 (away) multiplier on each batter's runs, derived from mean first-innings scores of 158.4 (home) vs 149.4 (away) in 250 T20Is; Kumar et al. (2026) find T20I home teams won 54.9% in 2019-24 and that pitch rating has minimal effect in T20Is while outfield rating has a large effect. No regression-based franchise-league estimate was found.

### Cited Findings

**Davis, Perera & Swartz (2015) [peer-reviewed]**
- Mechanism quote: "the average number of first innings runs scored by the home team was 158.4 and ... by the away team was 149.4. Therefore, in the simulator, we scale the number of runs scored by the home team by the factor 2(158.4)/(158.4+149.4) = 1.03, and we scale the number of runs scored by the away team by the factor 2(149.4)/(158.4+149.4) = 0.97. This is done at the individual batsmen level ... At the end, we round the total number of runs scored. In a match played at a neutral site, no adjustment is made" — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Implied raw home edge: 9 runs per first innings, ≈ 0.45 runs/over, on 250 matches 2005-2013 — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- They cite de Silva, Pond & Swartz (2001): ODI home advantage ≈ 16 runs at equal team strength (Model D) — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- They cite Swartz & Arce (2014): no strong case for differential home advantage among teams in the same league (hockey, basketball), supporting a single league-wide multiplier — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Practical caveat: they excluded Bangladesh from the 2014 WC application partly because they "did not want to introduce a home team effect for Bangladesh" given thin data — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Validation: 10,000 simulated first innings per team; win probabilities agreed "fairly strongly" with sportsbook odds for 2014 WC matches — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)

**Kumar et al. (2026), IIMB Management Review [peer-reviewed]**
- T20I 2019-24: home wins 118 (54.88%), away 97 (45.12%); ODI home wins 64.84%; Test home 54.19%, draw 15.08% — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- T20I pitch rating effect minimal: Very Good / Good / Below Average pitches RRR 0.873 / 0.869 / 0.868 vs Average (p<0.01) — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- T20I outfield rating: Very Good and Good outfields raise home-win odds, RRR 1.881 and 1.738 (p<0.01) — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- Rank: higher-ranked home team RRR 1.216 (Test); each unit of rank difference raises home-win odds (RRR >1.139) — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)
- Literature reviewed there: significant home advantage for India and New Zealand; home advantage more pronounced when the home team is stronger; some studies found home advantage did not matter — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf)

**Other**
- Hindustan Times (2018) analysis of internationals: in T20 the home/visitor win split is "close to 50% for both" — [PressReader](https://www.pressreader.com/india/hindustan-times-chandigarh/20180907/282394105335602) [media]
- IPL logistic regression (IIFT): home ground and toss positive at aggregate level but significant at 90% only for some matches — [IIFT](https://publication.iift.ac.in/Articles/268.pdf) [working paper]
- IPL venue records (media): RR 76% at Jaipur, CSK 66% at home — [CricTracker](https://www.crictracker.com/stats-highest-home-venue-win-percentage-in-t20-cricket); another blog says IPL home teams win ~55% — [dev.to](https://dev.to/10sports2025/10sports-insights-home-vs-away-advantage-in-ipl-2025-3i4d) [blog]
- Sood & Willis: home team won 50.87% of international tosses (2,892/5,684), so the toss is not a home-advantage channel — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)

### Inferences
- The ×1.03/×0.97 multiplier equals a ±3% scaling of expected runs, consistent with a ~9-run T20 margin and about half the ODI 16-run estimate scaled by overs (16 × 20/50 ≈ 6.4). For a simulator: apply symmetric ±3% to run-scoring outcomes (not dismissal) for home/away, zero at neutral venues, and do not vary by team unless data supports it (Swartz & Arce).
- Kumar et al. suggest the "home" effect in T20I is not operating through pitch type (pitch ratings have RRR <1 and tiny) but possibly through outfield/ground familiarity and team strength; this argues for modelling pitch familiarity as a venue-type × squad-composition effect rather than a flat home bonus.
- The 54.9% T20I home win rate (2019-24) exceeds the ~50% reported for earlier T20I eras, but neither is strength-adjusted.

### Gaps
- No regression-based home-advantage estimate for IPL/BBL/CPL was found in a journal; franchise figures are media win rates.
- Nothing separates crowd from pitch familiarity quantitatively in T20.

---

## Key Question 4: Venue effects — par scores, boundary size, altitude, venue-specific spin vs pace; how CricViz/ESPNcricinfo describe venue models

### Takeaway
Public descriptions of CricViz's par model say venue par is estimated from recent results at each ground and fed into WinViz/PredictViz, with PitchViz using ball-tracking percentiles; the only open-method venue work is a 2017 blog that estimates ground effects on expected runs from ≥600 first-innings deliveries per ground (96 grounds) and reports balls-per-six ranging from ~13 (Seddon Park) to >30 (Grace Road). Altitude has no quantitative study.

### Cited Findings
- CricViz: "Historical venue data is built in to our predictor models, so PredictViz and WinViz have an idea of what a par score is at each ground, based on recent data there"; ball-tracking used to characterise pitch behaviour and find similar past matches — [Swarajya interview](https://swarajyamag.com/sports/swarajya-speaks-to-cricviz-the-team-behind-the-data-intelligence-models-for-cricket-world-cup-2019) [industry]
- PitchViz: "CricViz's advanced measure for evaluating pitch traits", reported as global percentiles from ball-tracking — [Datawrapper PitchViz table](https://datawrapper.dwcdn.net/Q7ZYr/1) [industry]
- ESPNcricinfo: par score "is not the average score at a venue" — [ESPNcricinfo](https://www.espncricinfo.com/story/_/id/26270455/redefining-par-scores-mean-odis) [media]
- Blog ground-effects method (2017): ball-by-ball DB of 150+ grounds over five years; analysed 96 grounds with ≥600 first-innings deliveries (~5 innings); author adjusts expected runs by ground in batting/bowling ratings; balls-per-six first innings: Seddon Park 12.9, Central Broward 14.6, Eden Park 14.6, Chinnaswamy 15.0, Wanderers 15.0, Canterbury 24.0 (rank 41/96), Beausejour 21.5, Grace Road >30 vs both spin and pace; Providence (Guyana) very low average first-innings score; Chinnaswamy and Warner Park allow sixes off all bowling types, Visakhapatnam and Pune show sixes much harder off spin, Gabba and SSC favour big hits off pace — [thsportdw blog](https://thsportdw.blogspot.com/2017/02/the-effect-of-different-grounds-in-t20.html) [blog]
- Venue spin/pace splits (media): at the Gabba the pace economy (8.65) vs spin (6.85) gap was the largest among venues examined and the ground had the lowest wristspin economy — [ESPNcricinfo stats](https://www.espncricinfo.com/ci/content/story/1337927.html); in the 2021 WC pace at Sheikh Zayed (Abu Dhabi) was the most effective style of any venue while spin was influential in Dubai — [ESPNcricinfo](https://www.espncricinfo.com/print/story/1286448) [media; fetch returned 403, from search snippet]
- Venue-level Bayesian target revision (ODI): Samad & Sen (arXiv 2007.05894), 1,117 ODIs at ten venues; teams batting first and winning show a substantially high scoring advantage; they warn venue-specific models are unreliable at low sample sizes and a pooled model has high variance — [arXiv abs](https://arxiv.org/abs/2007.05894) [preprint]
- Boundary geometry: a sports-analytics page proposes Boundary Ratio = straight/square boundary length, <1.15 flagged six-friendly, no validation — [PillarLab](https://pillarlab-web.pages.dev/pillars/venue-boundary-dimensions-analysis) [promotional]; ICC boundary limits quoted on a blog as 59.43–82.29 m (unverified) — [blog](https://mahimasingh11032001.blogspot.com/2025/06/icc-cricket-world-cup-2019-boundary.html)
- Altitude: only anecdotal claims (Chinnaswamy elevation adds carry) — [blog](https://thefutureofthings.com/21038-short-boundaries-big-scores-a-guide-to-high-scoring-ipl-stadiums/)
- Ball-tracking wicket model (IPL): wicket probability modelled as a smooth function of line and length; bowlers choose line/length strategically so venue/style comparisons are observational, not causal — [NHSJS](https://nhsjs.com/2026/does-good-length-outside-off-really-work-a-ball-tracking-study-of-wickets-in-the-ipl/) [student journal]
- Kumar et al.: ICC pitch rating has minimal effect on T20I outcome (RRR ≈ 0.87), outfield rating large (RRR 1.74–1.88) — [JGU PDF](https://pure.jgu.edu.in/id/eprint/11404/1/Home%20team%20advantage%20in%20international%20cricket.pdf) [peer-reviewed]

### Inferences
- A defensible venue model is a shrinkage (hierarchical) estimate of venue run-rate and venue × bowling-type (spin/pace) boundary and dismissal rates, with a prior pulling toward the global mean when a ground has <600 deliveries (the blog's threshold) — consistent with Samad & Sen's small-sample caution and with Swartz's hierarchical Bayesian borrowing across scenarios.
- Balls-per-six ranging 13–30+ across grounds implies a ~2.3× spread in six probability per ball; that is the single largest venue lever and should be encoded per venue, ideally split by spin vs pace.

### Gaps
- No peer-reviewed estimate of boundary-length or altitude effects on runs.
- CricViz/ESPNcricinfo par-score formulae are not public; only qualitative descriptions exist.
- Venue spin/pace economy tables are media snippets without sample sizes.

---

## Key Question 5: Pitch deterioration within a T20 or across double-headers; day-night effects on batting first vs second

### Takeaway
No quantitative study of within-match pitch change or double-header second-game effects in T20 was found; the evidence is anecdotal (players reporting second-innings slowing/turning or dew freshening the surface). Day-night effects are entangled with dew (Q1/Q2): aggregate T20 toss/chase effects show no day/night difference (Sood & Willis), while specific night venues show extreme chase bias.

### Cited Findings
- Sood & Willis: no distinguishable day/night difference in the T20 toss effect, versus one-day 5.92% (D/N) vs 2.89% (day) — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753) [preprint]
- 2021 WC: chasers 9/9 in Dubai night games; "the 2014 and 2016 editions showed similar patterns" with even better chase success in night games then — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup) [media]
- IPL day games: chasers 54.5% (2024, n=11), 41.7% (2025, n=12) — [Mr Cricket UAE](https://www.mrcricketuae.com/opinion/ipl-2026-batting-first-becomes-cardinal-sin-as-expert-predictions-go-haywire/) [blog]
- IPL 2024 Qualifier 2: Samson said "the wicket started behaving differently in the second innings", turning more — [The Quint](https://www.thequint.com/amp/story/indian-premier-league-ipl/ipl-2024-qualifier-2-sanju-samson-says-pitch-behaved-differently-second-innings-rr-lost-vs-srh); du Plessis said the pitch got better in the second innings with dew — [The Quint](https://www.thequint.com/amp/story/indian-premier-league-ipl/ipl-2024-rr-vs-rcb-faf-du-plessis-says-virat-kohli-batted-well-pitch-better-2nd-innings) [media]
- IPL 2026 double-header contrast: one Sunday double-header aggregate 986 runs across 2 games vs another with combined strike rate 136, attributed to Chennai/Lucknow surfaces (not to being the second game) — [WION](https://wionews.com/cricket/ipl-2026-what-went-wrong-how-delhi-capitals-went-from-264-2-to-75-all-out-in-span-of-two-days-at-home-ground-1777359984434) [media]
- Mechanism claim: a pitch expected to slow and crumble in the second innings "freshens up" when dew settles — [Sportskeeda](https://sportskeeda.com/cricket/ill-effects-dew-game-cricket) [media]
- Stern (2009): second-innings resource usage is more heavily weighted to very early and very late overs than first innings (ODI data, >1,100 internationals), i.e. the innings-2 scoring profile differs structurally — [ANU repository](https://openresearch-repository.anu.edu.au/items/d93135fd-e567-4b53-b0cc-ca26adc7d49b) [peer-reviewed]

### Inferences
- Two opposing second-innings mechanisms exist: dry-day deterioration (slower, more turn → favours bat-first) and night dew (faster, less grip → favours chase). A simulator should carry a signed `innings2_pitch_delta[venue][session]` rather than a single global innings-2 effect.
- Because aggregate T20 data (~49–51% chase) nets these out, calibrating from pooled data would wrongly set the delta to zero everywhere.

### Gaps
- No ball-by-ball study quantifying over-by-over change in dismissal or run rate attributable to pitch wear in T20.
- No study of second-game-of-double-header effects (same surface or adjacent strip).

---

## Key Question 6: Rain and DLS in T20 — frequency, Standard Edition resources for 20-over matches, and critiques (BGS 2011; Perera & Swartz 2013)

### Takeaway
About 4.5–5% of T20 matches are DL-affected (84/1,712 in Woodcock's sample; 4 of 89 internationals 2005-09 in BGS), and in those games the chaser wins ~61%. The DL Standard Edition treats a full 20-over innings as 56.6% of ODI resources; T20-specific tables (BGS 2011, n=85; Perera & Swartz 2013, n=388) differ from the rescaled DL table by about −5 percentage points in the late-overs/many-wickets corner and +3 points in the last 7 overs with no wickets lost, with Perera & Swartz concluding there are "meaningful differences" in scoring patterns.

### Cited Findings
- Frequency: 84 DL-affected of 1,712 T20s (≈4.9%); batting first won ~39% of DL games vs ~51% of non-DL — [The Conversation](https://theconversation.com/we-need-a-fairer-system-for-deciding-rain-affected-games-in-twenty20-cricket-54328) [academic op-ed]
- BGS 2011: of international T20s between ICC nations Feb 17 2005 – Nov 9 2009, 85 used after excluding "the 4 shortened matches where the Duckworth-Lewis method was applied" (≈4.5%) — [SFU PDF](https://www.sfu.ca/~tswartz/papers/twenty20.pdf) [peer-reviewed, JORS 62(11):1951-1957]
- Duckworth (2010): about 70 T20 cases with a D/L revised target or result, only two complaints — [Mail & Guardian](https://mg.co.za/2010-05-05-duckworth-leaps-to-defence-of-system-after-criticism/) [media]; Duckworth said the ICC should examine whether a 5-over minimum is appropriate after England's loss chasing 60 from 6 overs — [Mail & Guardian](https://mg.co.za/2010-05-05-duckworth-leaps-to-defence-of-system-after-criticism/)
- Sood & Willis: toss advantage in T20 rises from 1.17% (non-DL) to 3.9% (DL-invoked) — [ar5iv](https://ar5iv.labs.arxiv.org/html/1605.08753)
- DL SE scaled to T20: "when 20 overs and 10 wickets are available ... 56.6% of the batting team's resources" remain in an ODI, so the T20 table is the SE table divided by 0.566; e.g. 12 overs available, 0 wickets lost = 66.4% of T20 resources — [Perera & Swartz SFU PDF](https://www.sfu.ca/~tswartz/papers/perera.pdf); BGS gives the same rescaling (Table 2 = SE entries ÷ 0.566) — [BGS SFU PDF](https://www.sfu.ca/~tswartz/papers/twenty20.pdf)
- BGS method: first-innings data only (second-innings tactics depend on match state); raw nonparametric resource matrix from mean runs-to-come at each (overs available, wickets lost) over mean first-innings total; monotonicity imposed by isotonic regression within a Gibbs sampler; raw cell for 19 overs/2 wickets = 110.2% (two matches), kept because the smoothing is robust — [BGS SFU PDF](https://www.sfu.ca/~tswartz/papers/twenty20.pdf)
- BGS stated concerns with DL in T20: powerplay is the first 6 overs (30% of innings) vs first 10 of 50 (20%) in ODIs; wickets are "more highly valued" differently given aggressive batting; SE table's last two wicket columns have many identical entries — [BGS SFU PDF](https://www.sfu.ca/~tswartz/papers/twenty20.pdf); [Perera PDF](https://www.sfu.ca/~tswartz/papers/perera.pdf)
- Perera & Swartz 2013 (IMA J. Management Mathematics 24(3):337-347): dataset = 146 international first innings (Feb 2005 – Jun 1 2011, shortened innings excluded) + 242 IPL first innings (first four seasons incl. playoffs) = 388; pooling test: of 88 (overs, wickets) cells with ≥10 observations in both sources, only 4 rejected equal means at 5%, so IPL and international data were pooled — [SFU PDF](https://www.sfu.ca/~tswartz/papers/perera.pdf) [peer-reviewed]
- Perera & Swartz discrepancies vs DL-for-T20: (1) top rows (many overs left, several wickets down) BGS > DL, rarely relevant, and the (20 overs, 9 wickets) cell = 18.1% is "nonsensical" (max should be 10%); (2) "bottom right corner ... BGS entries ... are roughly 5% less than in the Duckworth-Lewis table" — a realistic scenario; (3) "last 7 overs when zero wickets are lost ... roughly 3% larger than the Duckworth-Lewis table"; same pattern seen in BGS (2010) with n=85 — [SFU PDF](https://www.sfu.ca/~tswartz/papers/perera.pdf)
- Perera & Swartz then propose a model using individual-match variability rather than aggregate cell means; Gibbs estimates stabilised after 50,000 iterations — [SFU PDF](https://www.sfu.ca/~tswartz/papers/perera.pdf); abstract: the alternative table "suggests that there exist meaningful differences in the scoring patterns between one-day cricket and T20" — [IAOR listing](https://iaorifors.com/paper/81359)
- Stern (2009, JORS): tests DL's single-table-for-both-innings assumption on >1,100 internationals (989 uninterrupted, 61 DL-decided); Tobit regression and random-walk boundary crossing; second-innings resource use weighted to very early/very late overs; a beta-CDF transform of second-innings resources predicts result reversals in 5 of the 61 DL matches — [ANU repository](https://openresearch-repository.anu.edu.au/items/d93135fd-e567-4b53-b0cc-ca26adc7d49b) [peer-reviewed]
- Criticism that DLS preserves resources, not win probability, and that it uses a combined ODI+T20I database, revived at the 2022 WC — [Quint/Stern interview](https://www.thequint.com/sports/cricket/dls-method-rain-affected-cricket-modify-steven-stern-answers); [Quartz](https://qz.com/india/634805/dump-duckworth-lewis-twenty20-cricket-needs-a-new-system-for-rain-hit-matches) [media]
- Stern's 2016 DLS update published in JORS — [Warwick poster](https://text.www2.warwick.ac.uk/fac/sci/statistics/staff/research_students/jewson/dl_poster_asru_nocricket.pdf)

### Inferences
- For a simulator: implement rain as a ~5% per-match hazard (venue/season adjustable), use the DL SE table rescaled by 1/0.566 for targets (what the real game uses), and expect the chaser to win ~60% of DL games — i.e. the simulator should not "correct" DL's bias if it aims to mimic real outcomes.
- The −5 point late-innings discrepancy means DL overvalues remaining resources when many wickets are down late, which is exactly where interrupted T20 chases sit; this is the mechanism behind the 61% chaser win rate.

### Gaps
- Full numeric cells of the BGS/Perera T20 tables could not be extracted from the PDFs (tables rendered as graphics/layout); only the headline discrepancies are available.
- No T20I-only DLS frequency for recent years (post-2016 DLS) was found; the 4.5–4.9% figures are 2005–2016 era.

---

## Key Question 7: Pressure in chases — Bhattacharjee & Lemmer's pressure index and work on required run rate, shot selection and dismissal hazard

### Takeaway
Bhattacharjee & Lemmer (2016) define a ball-by-ball Pressure Index PI = (CRRR/IRRR) × ½[e^(RU/100) + e^(Σwᵢ/11)] using required-run-rate ratio, DL resources used and weighted wickets lost; Bandyopadhyay & Bhattacharjee (2025) tabulate chase win rates by PI band over 6,537 T20 chases (e.g., PI 2–2.5 in the middle overs: ~29% home / ~22% away win), and Davis–Perera–Swartz model required-rate pressure as a shift to more aggressive batting characteristics that raise both runs and dismissal probability.

### Cited Findings
- Citation: Bhattacharjee, D. & Lemmer, H.H. (2016), "Quantifying the pressure on the teams batting or bowling in the second innings of limited overs cricket matches", International Journal of Sports Science & Coaching 11(5):683-692 — [arXiv HTML 2505.01849v2](https://arxiv.org/html/2505.01849v2) [peer-reviewed original; formula as restated in preprint]
- Formula (Eq. 6-8 in the 2025 preprint): PI = (CRRR/IRRR) × ½ × [e^(RU/100) + e^(Σwᵢ/11)], where IRRR = 6T/B (target T, balls B), CRRR = 6(T−R′)/(B−B′), RU = % resources used from the DL table, Σwᵢ = sum of Lemmer (2015) weights of wickets fallen by batting position: 1.30, 1.35, 1.40, 1.45, 1.38, 1.18, 0.98, 0.79, 0.59, 0.39, 0.19; PI = 1 at chase start, 0 when target reached, rises steeply in failing chases — [arXiv HTML](https://arxiv.org/html/2505.01849v2)
- Bandyopadhyay & Bhattacharjee (2025) dataset: 6,537 men's T20 matches with complete ball-by-ball data (from 8,241 identified), 13 Jun 2003 – 15 Oct 2025, ESPNcricinfo + Cricsheet; inclusion: chaser won after >18 overs or lost by ≤10 runs; higher-order Markov chains on second innings — [arXiv HTML](https://arxiv.org/html/2505.01849v2) [preprint]
- Win rates by PI band (home / away chasers): PI [0,0.5): 100% all phases. Powerplay: [0.5,1) 73.7/62.2; [1,1.5) 70.6/61.8; [1.5,2) 68.2/58.5; [2,2.5) 42.7/36.6; [2.5,3) 14.6/11.1. Middle overs: [1,1.5) 75.7/70.7; [1.5,2) 51.3/43.8; [2,2.5) 28.8/22.1; [2.5,3) 12.4/12.1. Death: [1,1.5) 94.4/94.3; [2,2.5) 67.5/60.2; [3,3.5) 36.4/14.7; [3.5,4) 25.9/11.1 — [arXiv HTML](https://arxiv.org/html/2505.01849v2)
- End of over 18 with PI [3,3.5): 34.8% home / 20% away; end of over 19 with PI [2.5,3): 61.5% / 47.5%; entering over 20 with PI > 3.5: 19.1% win (13.6% to 2021); Brier 0.0184 for PI<0.5 band, 0.0245 for [0.5,3.5); recommendation to keep PI within [0.5, 3.5] or below 0.5 as early as possible — [arXiv HTML](https://arxiv.org/html/2505.01849v2)
- Home/away gap in the PI tables (e.g., 36.4% vs 14.7% at death with PI 3-3.5) is a direct home-advantage-under-pressure estimate — [arXiv HTML](https://arxiv.org/html/2505.01849v2)
- Mallawa Arachchi, Manage & Scariano (2024), "A pressure index for the team batting second in T20I cricket", Journal of Sports Analytics (DOI 10.3233/JSA-240792): differential-equation model where pressure changes at a rate tied to its level, required run rate adjusted for remaining resources; parameters fitted on T20Is from 2017, 2018, 2019, 2021 for major Test nations; yields win probability at any point and batter contribution under pressure (full text 403) — [SAGE](https://journals.sagepub.com/doi/10.3233/JSA-240792) [peer-reviewed]
- Lemmer & Bhattacharjee (2018, SAJRSPER): spectator tension driven mainly by progress toward target and fall of wickets — [AJOL](https://ajol.info/index.php/sajrs/article/view/180193/169542) [peer-reviewed]
- Davis, Perera & Swartz (2015) chase mechanics: "higher target scores force the second innings batting team to be more aggressive. When they are more aggressive, they score more runs but are more likely to be dismissed"; aggression modelled by substituting batting characteristics the batter displays at other (later) match stages, so it stays within observed behaviour; validation suggests real teams delay increasing aggression (0.8 factor) — [SFU PDF](https://www.sfu.ca/~tswartz/papers/t20sim.pdf) [peer-reviewed]
- Empirical late-chase hazard: in T20Is with ball-by-ball data, teams needing 50-60 from the last four overs won only 14 of 146 (9.6%) — [ESPN](https://africa.espn.com/cricket/story/_/id/32620380/aus-vs-nz-t20-world-cup-2021-final-stats-trivia-trends-winning-tosses-winning-titles-t20-world-cup) [media]

### Inferences
- PI gives a ready-made scalar for a simulator's chase-aggression dial: map PI bands to an aggression level that scales both boundary probability and dismissal probability (Swartz's mechanism), with the 2025 win-rate table as a calibration target (e.g., a simulated chaser at PI 2–2.5 in the middle overs should win ~25%).
- The exponential wicket term (e^(Σw/11)) means losing top-order wickets (weights 1.30-1.45) raises pressure more than tail wickets (0.19-0.59), consistent with resource-based thinking; this is a cheap way to encode batting-depth effects.

### Gaps
- No paper directly estimates dismissal hazard as a function of required run rate at the ball level (the PI papers model win rates by PI band, not per-ball dismissal probability). The Swartz simulator implies the link but reports no coefficient.
- Mallawa Arachchi et al.'s fitted parameter values are behind a paywall.
