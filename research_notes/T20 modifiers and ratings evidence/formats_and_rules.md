# Men's T20 World Cup: formats and playing-condition rules, 2007-2026

Researched 28 Oct 2026 for `wcdraft/data/config/formats.json` (Part A) and `wcdraft/data/config/rules-verification.json` (Part B). Access rule followed: direct fetches only (no proxies, mirrors, caches, no software installed). ESPNcricinfo and CricketArchive return HTTP 403 to direct fetches, so those pages are recorded as gaps and their content is taken only from search snippets, flagged as such.

Primary sources actually read:

- Wikipedia edition pages (format sections, seeding notes, group tables, knockout brackets) for all ten editions.
- Official ICC Playing Conditions PDFs (from icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions) for the 2021, 2022, 2024 and 2026 Men's T20 World Cups. WebFetch cannot read PDFs, but it saved the binaries; text was recovered locally by inflating the FlateDecode streams with Python's zlib (no packages installed). The 2010-11 ICC Playing Handbook PDF uses CID-encoded fonts and yielded no readable text, so there is no official document for 2007-2016.
- ICC press pages (Jan 2022 T20I changes; Oct 2022 changes), the ICC "Changes to Playing Regulations effective 5 July 2015" document (SACA mirror of the ICC PDF), Wisden (stop clock; 2026 seedings), Outlook India (2024 seedings), The Bridge (2021 DRS debut), Dawn/Reuters (2007 free hit), Wikipedia articles on Bowl-out, Super Over, Free hit, DRS, Twenty20.

## Part A: format, edition by edition

| Ed. | Teams | First stage | Super stage | How Super groups were formed | Points carried? | Knockout pairing | Afghanistan |
|---|---|---|---|---|---|---|---|
| 2007 | 12 | 4 groups of 3 (A: SA, WI, Ban; B: Aus, Eng, Zim; C: NZ, SL, Ken; D: Pak, Ind, Sco) | Super 8: E, F (3 matches each) | Pre-seeded. E = A1, B2, C1, D2 (SA, Eng, NZ, Ind); F = A2, B1, C2, D1 (WI, Aus, SL, Pak). Group finish irrelevant; a lower seed qualifying took the eliminated seed's slot (Ban took A2) | No (Super 8 tables show 3 matches only; not stated explicitly) | E2 v F1 (NZ v Pak, Cape Town); E1 v F2 (Ind v Aus, Durban) | absent |
| 2009 | 12 | 4 groups of 3 (A: Ind, Ban, Ire; B: Pak, Eng, Ned; C: Aus, SL, WI; D: NZ, SA, Sco) | Super 8: E, F | Pre-seeded on 2007 performance. E = A1, B2, C1, D2; F = A2, B1, C2, D1. Ire inherited A2 from Ban, WI inherited C1 from Aus | No ("No points from the Group stage will be carried forward to the Super Eight series", ESPNcricinfo format page, via snippet) | E1 v F2 (SA v Pak); F1 v E2 (SL v WI) | absent |
| 2010 | 12 | 4 groups of 3 (A: Pak, Aus, Ban; B: SL, NZ, Zim; C: SA, Ind, Afg; D: WI, Eng, Ire) | Super 8: E, F | Pre-seeded, "not affected by group stage results". E = top seed of A and C + second seed of B and D (Pak, SA, NZ, Eng); F = top seed of B and D + second seed of A and C (SL, WI, Aus, Ind) | No (3-match tables) | E1 v F2 (Eng v SL); F1 v E2 (Aus v Pak) | Group C, 3rd, out |
| 2012 | 12 | 4 groups of 3 (A: Eng, Ind, Afg; B: Aus, WI, Ire; C: SL, SA, Zim; D: Pak, NZ, Ban) | Super 8: Groups 1, 2 | Pre-seeded, same rule as 2010. G1 = A1, C1, B2, D2 (Eng, SL, WI, NZ); G2 = B1, D1, A2, C2 (Aus, Pak, Ind, SA) | No (3-match tables) | G1-1 v G2-2 (SL v Pak); G2-1 v G1-2 (Aus v WI) | Group A, 3rd, out |
| 2014 | 16 | First Round, 2 groups of 4 (A: Ban, Afg, Nep, HK; B: Ire, Zim, Ned, UAE); winner only advances | Super 10: G1 = SL, Eng, SA, NZ + FR-B winner (Ned); G2 = Ind, Pak, WI, Aus + FR-A winner (Ban); 4 matches | Full Members placed by T20I rankings at 8 Oct 2012; qualifier destinations pre-assigned | No (fresh 4-match table) | G1-1 v G2-2 (SL v WI); G2-1 v G1-2 (Ind v SA) | FR Group A, out |
| 2016 | 16 | First Round, 2 groups of 4 (A: Ban, Ned, Ire, Oman -> G2; B: Zim, Sco, HK, Afg -> G1) | Super 10: G1 = WI, Eng, SA, SL + FR-B winner (Afg); G2 = Ind, Pak, Aus, NZ + FR-A winner (Ban) | As 2014 | No | G2-1 v G1-2 (NZ v Eng, Delhi); G1-1 v G2-2 (WI v Ind, Mumbai) | FR Group B winner -> Super 10 G1, 5th |
| 2021 | 16 | First Round, 2 groups of 4 (A: SL, Ire, Ned, Nam; B: Ban, Sco, PNG, Oman); top 2 advance | Super 12: G1 = Eng, Aus, SA, WI + A1 + B2; G2 = Ind, Pak, NZ, Afg + B1 + A2; 5 matches | By first-round POSITION (ICC PC 16.10.2); direct entrants by rankings | No | G1-1 v G2-2 (Eng v NZ); G2-1 v G1-2 (Pak v Aus) | Super 12 G2 (seed 7), 4th |
| 2022 | 16 | First Round (A: SL, Nam, UAE, Ned; B: WI, Sco, Zim, Ire) | Super 12: G1 = Eng, NZ, Aus, Afg + A1 + B2; G2 = Ind, Pak, SA, Ban + B1 + A2 | By position (PC 16.10.2) | No | G1-1 v G2-2 (NZ v Pak, Sydney); G2-1 v G1-2 (Ind v Eng, Adelaide) | Super 12 G1 (seed 7), 6th |
| 2024 | 20 | 4 groups of 5 (A: Ind, Pak, Ire, Can, USA; B: Eng, Aus, Nam, Sco, Oman; C: NZ, WI, Afg, Uga, PNG; D: SA, SL, Ban, Ned, Nep); top 2 advance | Super 8: G1 = A1, B2, C1, D2; G2 = A2, B1, C2, D1; 3 matches | Pre-seeded (Ind A1, Pak A2, Eng B1, Aus B2, NZ C1, WI C2, SA D1, SL D2); a qualifying non-seed takes the eliminated seed's slot (USA->A2, Afg->C1, Ban->D2) | No ("No points are carried forward", PC 16.10.1) | G1-1 v G2-2 (Ind v Eng, Guyana, SF2); G2-1 v G1-2 (SA v Afg, Trinidad, SF1) | Group C (C3) -> won group -> Super 8 G1 as C1 -> 2nd -> SF1 lost to SA |
| 2026 | 20 | 4 groups of 5 (A: Ind, Pak, USA, Ned, Nam; B: Aus, SL, Ire, Zim, Oman; C: Eng, WI, Nep, Ita, Sco; D: NZ, SA, Afg, Can, UAE) | Super Eights: G1 = X1 Ind (A1), X2 Aus (B1), X3 WI (C2), X4 SA (D2); G2 = Y1 Eng (C1), Y2 NZ (D1), Y3 Pak (A2), Y4 SL (B2) | Pre-assigned (PC 16.10.1); Zim took Aus's X2. Net effect: all group winners in G1, all runners-up in G2 | No ("No points, wins or net run rate ... carried forward", PC 16.10.2) | G1-1 v G2-2 (SA v NZ, Kolkata); G2-1 v G1-2 (Eng v Ind, Mumbai) | Group D (D3), 3rd, out |

Tiebreakers:

- 2007, 2009, 2010, 2012 (Wikipedia, each page): points -> wins -> net run rate -> lower bowling strike rate -> head-to-head.
- 2014 (Wikipedia): most wins -> NRR -> head-to-head. 2016 assumed the same (no source found).
- 2021, 2022, 2024 (ICC PCs 16.10.5/16.10.6; 16.10.4/16.10.5): points -> wins -> NRR -> head-to-head (points, then NRR in that match) -> original seeding (2024 Super 8: T20I rankings).
- 2026 (PC 16.10.3): points -> wins -> NRR -> head-to-head -> ICC T20I rankings at 6 Feb 2026.

Pre-seeding corrections to note against memory/other notes:

- 2007 seeds in Group D were Pakistan D1, India D2 (so the E/F slot pattern A1-B2-C1-D2 / A2-B1-C2-D1 is the same as 2009).
- 2010 and 2012 used the pattern "top seed of A and C + second seed of B and D" for Group E/Group 1, i.e. A1, C1, B2, D2 (same set of slots as 2007/2009, just described differently).
- 2026 did NOT reuse the 2024 A1-B2-C1-D2 pattern. The official PC pre-assigns X1-X4 = A1, B1, C2, D2 and Y1-Y4 = C1, D1, A2, B2. The Latestly article's "Seed B2: Zimbabwe, Seed D2: South Africa..." labels are not the ICC's.
- 2021/2022 Super 12 placement was by first-round position, not by pre-tournament seed (the ICC dropped the planned Sri Lanka/Bangladesh seed-retention after Scotland topped Group B in 2021).

## Part B: rules

Verified from the official PCs (2021, 2022, 2024, 2026):

- Fielding restrictions, cl. 28.7.2-28.7.5: powerplay = first 6 overs; max 2 fielders outside the 30-yard circle during it; max 5 outside after. Reduced innings: 2021-2024 table in whole overs (5-8 overs -> 2 PP overs, 9-11 -> 3, 12-14 -> 4, 15-18 -> 5, 19-20 -> 6); 2026 table in overs.balls (5 -> 1.3, 6 -> 1.5, 7 -> 2.1, 8 -> 2.2, 9 -> 2.4, 10 -> 3.0, 11 -> 3.2, 12 -> 3.4, 13 -> 3.5, 14 -> 4.1, 15 -> 4.3, 16 -> 4.5, 17 -> 5.1, 18 -> 5.2, 19 -> 5.4).
- Bouncers, cl. 41.6.1.5 and 41.6.1.8: a fast short-pitched delivery passes above shoulder height; "In the event of a bowler bowling more than one fast short-pitched delivery in an over" the umpire calls No ball, i.e. one per over.
- Free hit, cl. 21.19.1: "the delivery following a No ball called (all modes of No ball) shall be a free hit".
- Tie, cl. 16.3.1.2: Super Over; "If the Super Over is a tie, then subsequent Super Overs shall be played until there is a winner."
- DRS, Appendix D 3.6.1: "In each innings, each team shall be allowed to make a maximum of two Player Review requests that are categorised as Unsuccessful"; one per innings in a Super Over (App. F para 12).
- Concussion Replacement, cl. 1.2.7 (all four editions). 2026 adds pre-match nomination of concussion replacement players.
- Over-rate fielder penalty, cl. 13.8 (2022, 2024, 2026): if the fielding side is not in position to bowl the first ball of the final over by the cessation time, no more than 4 fielders outside the circle for the remainder of the innings.
- Stop clock, cl. 41.9.4 (2024, 2026): 60 seconds between overs; two warnings then 5 penalty runs on the third and each subsequent breach. Absent from the 2021 and 2022 PCs.
- No impact / tactical substitute in any edition (cl. 1.2.1: no change to the XI after nomination other than a Concussion Replacement).
- Reserve days: semis + final in 2021 and 2022; in 2024 SF1 and final only (SF2 had 250 min extra time, no reserve day); 2026 both semis + final. Minimum overs for a result: 5 per side (10 in semis/final).

Secondary-sourced (2007-2016):

- 2007: bowl-out at all stages; used once (Ind v Pak, 3-0, 14 Sep 2007). Free hit for foot-fault no-balls only; Twenty20 had the free hit before ODIs adopted it in Oct 2007 (Reuters via Dawn, 2 Jun 2007: ODI proposal "copying the fast Twenty20 game which already has the rule"). No DRS.
- 2009: Super Over replaced the bowl-out after the 2008 ICC Annual Conference; first ever Super Over WI v NZ, 26 Dec 2008.
- 2012: two Super 8 Super Overs (SL v NZ; WI v NZ). ICC Standard T20I PCs in force from 1 Oct 2012.
- 2015-07-05: free hit extended to all no-balls (ICC changes document), so 2016 onwards = all no-balls; 2014 and earlier = foot-fault only.
- Fielding restrictions and the one-bouncer limit for 2007-2016 are taken from the Wikipedia Twenty20 article and continuity with the 2021 PCs; no ICC document from that era could be read.

## Uncertainties and gaps

1. DRS at 2014/2016: Wikipedia (2014 edition page and the DRS article) says DRS was first used in a T20I at the 2014 World Twenty20 with one review per team, after a Feb 2013 ICC agreement. The ICC's own Oct 2021 announcement (ESPNcricinfo, The Bridge) calls 2021 the men's T20 World Cup debut of DRS. The ICC statement is followed (drs=false for 2014 and 2016), matching the existing editions.json, but the Wikipedia claim is unresolved; an ESPNcricinfo 2014 report would settle it and is blocked (403).
2. Points carried over in 2007, 2010, 2012: no page states the rule explicitly; "false" is inferred from the Super 8 tables (3 matches per team) and the explicit 2009 ESPNcricinfo statement.
3. 2009 "no points carried forward" quote comes from a search snippet of an ESPNcricinfo page that returned 403 on direct fetch.
4. 2016 tiebreak order not found; assumed identical to 2014 (wins, NRR, head-to-head).
5. 2007-2016 fielding/bouncer/over-limits: continuity assumption; the ICC 2010-11 Playing Handbook PDF was fetched but is not text-extractable (CID fonts) and no 2012-era Standard T20I PCs PDF was found.
6. 2007 free hit: no ICC document; rests on Dawn/Reuters (June 2007) plus the Wikipedia Free hit and Twenty20 articles.
7. 2026 seed labels: media disagree (Wisden/Statesman X1-Y4 vs Latestly's A1/B2/...); the official PC (16.10.1) is used, which gives X1-X4 = A1, B1, C2, D2.
8. 2021 First Round -> Super 12 mapping: the PC says placement by position (A winner + B runner-up -> Group 1). Wikipedia notes the ICC initially intended Sri Lanka/Bangladesh to keep seeds A1/B1 and changed course; the positional rule is used.
9. 2007 semi-final pairing (E2 v F1, E1 v F2) and the E/F slot composition are reconstructed from the seed table and results; Wikipedia does not print the rule.
10. Not researched: exact 2007/2009 tied-match procedures in knockouts beyond "applies at all stages"; DLS vs D/L versions by edition (D/L through 2012; DLS from 2014 per Wikipedia 2016 page).

## Source list

- https://en.wikipedia.org/wiki/2007_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2009_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2010_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2012_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2014_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2016_ICC_World_Twenty20
- https://en.wikipedia.org/wiki/2021_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/2022_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/2024_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/2026_ICC_Men%27s_T20_World_Cup
- https://en.wikipedia.org/wiki/Bowl-out ; https://en.wikipedia.org/wiki/Super_Over ; https://en.wikipedia.org/wiki/Free_hit ; https://en.wikipedia.org/wiki/Decision_Review_System ; https://en.wikipedia.org/wiki/Twenty20
- https://images.icc-cricket.com/image/upload/prd/h54xnm2zg0vzf41bkrri.pdf (2021 PCs)
- https://images.icc-cricket.com/image/upload/prd/uxsawulpvf8kexuujcnn.pdf (2022 PCs)
- https://images.icc-cricket.com/image/upload/prd/euhohq8vpgzi0urumg3y.pdf (2024 PCs)
- https://images.icc-cricket.com/image/upload/prd/yyt7m8uh9c1uehrbvuwb.pdf (2026 PCs)
- https://images.icc-cricket.com/image/upload/prd/webeladxgaykq4opb6yi.pdf (2010-11 Playing Handbook; unreadable)
- https://saca.org.za/wp-content/uploads/2015/11/ICC-Regulations-changes-June-2015-1.pdf (ICC changes effective 5 Jul 2015)
- https://www.icc-cricket.com/news/changes-to-t20i-playing-conditions-come-into-effect (Jan 2022)
- https://www.icc-cricket.com/news/icc-announces-changes-to-playing-conditions (Oct 2022; via search summary)
- https://www.wisden.com/series/icc-mens-t20-world-cup-2024/cricket-news/stop-clock-becomes-permanent-in-cricket-playing-conditions-for-2024-t20-world-cup-announced
- https://www.wisden.com/series/icc-mens-t20-world-cup-2026/cricket-news/more-dead-rubbers-lopsided-groups-why-the-t20-world-cups-super-eights-pre-seedings-are-unfair
- https://outlookindia.com/sports/cricket/t20-world-cup-how-teams-are-grouped-for-super-8s-pre-tournament-seedings-explained
- https://thebridge.in/cricket/drs-first-time-men-t20-world-cup-25846
- https://www.espn.in/cricket/story/_/id/32408583/t20-world-cup-2021-faq
- https://www.dawn.com/news/249925
- https://www.onmanorama.com/sports/cricket/2019/07/19/icc-approves-concussion-substitutes.html (via search summary)
- Blocked (HTTP 403): https://www.espncricinfo.com/wt202009/content/page/407456.html ; https://www.espncricinfo.com/print/story/1282306 ; https://www.espncricinfo.com/story/akhtar-slams-new-no-ball-rule-301823 ; https://cricketarchive.com/Archive/Articles/7/7203.html
