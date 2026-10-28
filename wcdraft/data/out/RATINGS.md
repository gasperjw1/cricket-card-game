# World Cup Draft — ratings (Phase 1 prototype)

Generated 2026-10-28T18:26Z. Model: prior strength 50 balls, career prior 50, ODI prior 30, wicket cost 2.6 runs, display 40–99, low-sample badge < 60 balls faced / < 72 bowled.

Ratings are per-phase outcome vectors; the display number is the percentile of the phase-weighted value per 100 balls across every rated player-edition (so a 90 in 2009 and a 90 in 2026 mean the same thing relative to their eras).

## Validation

**Predictive validity** — correlation between the pre-tournament rating (form only; the tournament itself is excluded) and the player's raw value in that tournament, for player-editions with ≥ 60 balls faced / ≥ 72 bowled in both. Two targets: *edition* values the tournament against the whole edition's population; *adjusted* values it against the tournament's own population mixed over the opponent strengths (Elo bins) the player actually faced, which is the fairer target for an opposition-adjusted rating because associates mostly meet associates in the first round. Baselines use the same formula on raw form (no shrinkage, no tier), raw strike rate/economy, and career rate.

| Variant | Bat n | Model→edition | Model→adjusted | Raw form value | Raw SR | Career SR | Bowl n | Model→edition | Model→adjusted | Raw form value | Raw econ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEFAULT: hierarchical(150), bat two-way / bowl elo, linear transfer 300, c=50 (bowl ×2), hazard 1000, career 50 | 392 | 0.297 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.15 | 0.117 | 0.044 | 0.094 |
| venue normalisation off | 392 | 0.297 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.15 | 0.117 | 0.044 | 0.094 |
| venue normalisation half | 392 | 0.293 | 0.298 | 0.279 | 0.268 | 0.259 | 324 | 0.152 | 0.119 | 0.044 | 0.094 |
| bowl prior ×1 | 392 | 0.297 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.138 | 0.106 | 0.044 | 0.094 |
| bowl prior ×4 | 392 | 0.297 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.154 | 0.121 | 0.044 | 0.094 |
| two-way, full transfer (scale 0) | 392 | 0.287 | 0.291 | 0.279 | 0.268 | 0.259 | 324 | 0.118 | 0.081 | 0.044 | 0.094 |
| two-way, transfer 200 | 392 | 0.296 | 0.302 | 0.279 | 0.268 | 0.259 | 324 | 0.167 | 0.139 | 0.044 | 0.094 |
| two-way, transfer 450 | 392 | 0.296 | 0.302 | 0.279 | 0.268 | 0.259 | 324 | 0.138 | 0.104 | 0.044 | 0.094 |
| bat two-way / bowl two-way | 392 | 0.297 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.149 | 0.12 | 0.044 | 0.094 |
| bat two-way / bowl none | 392 | 0.297 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.135 | 0.1 | 0.044 | 0.094 |
| opposition none / none (control), transfer 300 | 392 | 0.292 | 0.296 | 0.279 | 0.268 | 0.259 | 324 | 0.135 | 0.1 | 0.044 | 0.094 |
| opposition none / none, full transfer | 392 | 0.279 | 0.283 | 0.279 | 0.268 | 0.259 | 324 | 0.097 | 0.057 | 0.044 | 0.094 |
| pooled phases | 392 | 0.288 | 0.294 | 0.279 | 0.268 | 0.259 | 324 | 0.159 | 0.131 | 0.044 | 0.094 |
| per-phase | 392 | 0.32 | 0.325 | 0.279 | 0.268 | 0.259 | 324 | 0.143 | 0.112 | 0.044 | 0.094 |
| phase prior 50 | 392 | 0.293 | 0.299 | 0.279 | 0.268 | 0.259 | 324 | 0.144 | 0.113 | 0.044 | 0.094 |
| hazard prior 50 (none extra) | 392 | 0.272 | 0.278 | 0.279 | 0.268 | 0.259 | 324 | 0.145 | 0.112 | 0.044 | 0.094 |
| hazard prior 300 | 392 | 0.285 | 0.291 | 0.279 | 0.268 | 0.259 | 324 | 0.149 | 0.117 | 0.044 | 0.094 |
| hazard prior 3000 | 392 | 0.305 | 0.311 | 0.279 | 0.268 | 0.259 | 324 | 0.151 | 0.119 | 0.044 | 0.094 |
| no career prior | 392 | 0.299 | 0.306 | 0.279 | 0.268 | 0.259 | 324 | 0.155 | 0.132 | 0.044 | 0.094 |
| career prior 150 | 392 | 0.302 | 0.307 | 0.279 | 0.268 | 0.259 | 324 | 0.156 | 0.126 | 0.044 | 0.094 |
| c=30 | 392 | 0.297 | 0.302 | 0.279 | 0.268 | 0.259 | 324 | 0.149 | 0.117 | 0.044 | 0.094 |
| c=80 | 392 | 0.298 | 0.303 | 0.279 | 0.268 | 0.259 | 324 | 0.15 | 0.118 | 0.044 | 0.094 |
| wicket cost 0 (diagnostic) | 392 | 0.303 | 0.309 | 0.279 | 0.268 | 0.259 | 324 | 0.152 | 0.12 | 0.044 | 0.094 |

**Components** — how well the model's runs-per-ball and dismissal-rate each predict the tournament's, against the raw-form equivalents.

| Variant | Bat runs: model | raw | Bat hazard: model | raw | Bowl runs: model | raw | Bowl hazard: model | raw |
|---|---|---|---|---|---|---|---|---|
| DEFAULT: hierarchical(150), bat two-way / bowl elo, linear transfer 300, c=50 (bowl ×2), hazard 1000, career 50 | 0.331 | 0.328 | 0.13 | 0.076 | 0.165 | 0.083 | 0.101 | 0.075 |
| venue normalisation off | 0.331 | 0.328 | 0.13 | 0.076 | 0.165 | 0.083 | 0.101 | 0.075 |
| venue normalisation half | 0.326 | 0.328 | 0.127 | 0.076 | 0.167 | 0.083 | 0.109 | 0.075 |
| bowl prior ×1 | 0.331 | 0.328 | 0.13 | 0.076 | 0.145 | 0.083 | 0.101 | 0.075 |
| bowl prior ×4 | 0.331 | 0.328 | 0.13 | 0.076 | 0.182 | 0.083 | 0.102 | 0.075 |
| two-way, full transfer (scale 0) | 0.314 | 0.328 | 0.137 | 0.076 | 0.132 | 0.083 | 0.078 | 0.075 |
| two-way, transfer 200 | 0.33 | 0.328 | 0.125 | 0.076 | 0.183 | 0.083 | 0.112 | 0.075 |
| two-way, transfer 450 | 0.329 | 0.328 | 0.133 | 0.076 | 0.153 | 0.083 | 0.093 | 0.075 |
| bat two-way / bowl two-way | 0.331 | 0.328 | 0.13 | 0.076 | 0.168 | 0.083 | 0.129 | 0.075 |
| bat two-way / bowl none | 0.331 | 0.328 | 0.13 | 0.076 | 0.148 | 0.083 | 0.099 | 0.075 |
| opposition none / none (control), transfer 300 | 0.305 | 0.328 | 0.113 | 0.076 | 0.148 | 0.083 | 0.099 | 0.075 |
| opposition none / none, full transfer | 0.298 | 0.328 | 0.117 | 0.076 | 0.109 | 0.083 | 0.075 | 0.075 |
| pooled phases | 0.361 | 0.328 | 0.124 | 0.076 | 0.194 | 0.083 | 0.11 | 0.075 |
| per-phase | 0.348 | 0.328 | 0.136 | 0.076 | 0.171 | 0.083 | 0.12 | 0.075 |
| phase prior 50 | 0.323 | 0.328 | 0.129 | 0.076 | 0.157 | 0.083 | 0.101 | 0.075 |
| hazard prior 50 (none extra) | 0.325 | 0.328 | 0.095 | 0.076 | 0.161 | 0.083 | 0.07 | 0.075 |
| hazard prior 300 | 0.327 | 0.328 | 0.117 | 0.076 | 0.163 | 0.083 | 0.094 | 0.075 |
| hazard prior 3000 | 0.334 | 0.328 | 0.126 | 0.076 | 0.168 | 0.083 | 0.115 | 0.075 |
| no career prior | 0.368 | 0.328 | 0.122 | 0.076 | 0.207 | 0.083 | 0.136 | 0.075 |
| career prior 150 | 0.346 | 0.328 | 0.13 | 0.076 | 0.185 | 0.083 | 0.101 | 0.075 |
| c=30 | 0.33 | 0.328 | 0.128 | 0.076 | 0.164 | 0.083 | 0.102 | 0.075 |
| c=80 | 0.332 | 0.328 | 0.13 | 0.076 | 0.167 | 0.083 | 0.101 | 0.075 |
| wicket cost 0 (diagnostic) | 0.331 | 0.328 | 0.13 | 0.076 | 0.165 | 0.083 | 0.101 | 0.075 |

**Stability** — correlation between a player's rating in one edition and in their next edition.

| Variant | Batting n | Model | Raw form SR | Bowling n | Model | Raw form economy |
|---|---|---|---|---|---|---|
| DEFAULT: hierarchical(150), bat two-way / bowl elo, linear transfer 300, c=50 (bowl ×2), hazard 1000, career 50 | 499 | 0.769 | 0.454 | 408 | 0.658 | 0.44 |
| venue normalisation off | 499 | 0.769 | 0.454 | 408 | 0.658 | 0.44 |
| venue normalisation half | 499 | 0.769 | 0.454 | 408 | 0.66 | 0.44 |
| bowl prior ×1 | 499 | 0.769 | 0.454 | 408 | 0.641 | 0.44 |
| bowl prior ×4 | 499 | 0.769 | 0.454 | 408 | 0.674 | 0.44 |
| two-way, full transfer (scale 0) | 499 | 0.734 | 0.454 | 408 | 0.637 | 0.44 |
| two-way, transfer 200 | 499 | 0.777 | 0.454 | 408 | 0.658 | 0.44 |
| two-way, transfer 450 | 499 | 0.761 | 0.454 | 408 | 0.656 | 0.44 |
| bat two-way / bowl two-way | 499 | 0.769 | 0.454 | 408 | 0.639 | 0.44 |
| bat two-way / bowl none | 499 | 0.769 | 0.454 | 408 | 0.674 | 0.44 |
| opposition none / none (control), transfer 300 | 499 | 0.741 | 0.454 | 408 | 0.674 | 0.44 |
| opposition none / none, full transfer | 499 | 0.721 | 0.454 | 408 | 0.671 | 0.44 |
| pooled phases | 499 | 0.723 | 0.454 | 408 | 0.617 | 0.44 |
| per-phase | 499 | 0.78 | 0.454 | 408 | 0.628 | 0.44 |
| phase prior 50 | 499 | 0.745 | 0.454 | 408 | 0.599 | 0.44 |
| hazard prior 50 (none extra) | 499 | 0.718 | 0.454 | 408 | 0.62 | 0.44 |
| hazard prior 300 | 499 | 0.753 | 0.454 | 408 | 0.645 | 0.44 |
| hazard prior 3000 | 499 | 0.775 | 0.454 | 408 | 0.66 | 0.44 |
| no career prior | 499 | 0.677 | 0.454 | 408 | 0.381 | 0.44 |
| career prior 150 | 499 | 0.749 | 0.454 | 408 | 0.607 | 0.44 |
| c=30 | 499 | 0.769 | 0.454 | 408 | 0.657 | 0.44 |
| c=80 | 499 | 0.769 | 0.454 | 408 | 0.664 | 0.44 |
| wicket cost 0 (diagnostic) | 499 | 0.766 | 0.454 | 408 | 0.659 | 0.44 |

## Evidence sources

| Skill | form | career | odi | population |
|---|---|---|---|---|
| bat | 1763 | 47 | 45 | 219 |
| bowl | 1296 | 79 | 41 | 658 |

Roles: batter 850, bowler 816, all-rounder 230, unknown 178. Positionless: 120. Low-sample batting: 935; bowling: 1060.

## Top ten batters and bowlers per edition (display rating, not low-sample)

**2007** — bat: Shahid Afridi (Pak) 85 +1.8, Younis Khan (Pak) 81 -5, A Symonds (Aus) 87 -3.3, MN Samuels (Wes) 81, RT Ponting (Aus) 81 -5, HH Gibbs (Sou) 78 -2.1, MEK Hussey (Aus) 74 -5, KP Pietersen (Eng) 76 +2.8, ML Hayden (Aus) 71 +1.5, AB de Villiers (Sou) 70 -3.3
  bowl: DR Smith (Wes) 83, SE Bond (New) 79 -2.7, Syed Rasel (Ban) 77 -1.4, JS Patel (New) 78, Abdur Razzak (Ban) 76 +0.4, TM Dilshan (Sri) 73, A Nel (Sou) 72, AB Agarkar (Ind) 69 -0.7, SM Pollock (Sou) 72 -4.8, CH Gayle (Wes) 70

**2009** — bat: Shahid Afridi (Pak) 96 -5, Yuvraj Singh (Ind) 92 -3.1, Mohammad Ashraful (Ban) 88, CH Gayle (Wes) 90 -3.4, ST Jayasuriya (Sri) 86 -5, DA Warner (Aus) 84 -3.4, SR Watson (Aus) 77, PD Collingwood (Eng) 84 -3.1, KP Pietersen (Eng) 84 +2.7, JDP Oram (New) 81 -5
  bowl: Umar Gul (Pak) 99 -2, J Botha (Sou) 98 -1, Shoaib Malik (Pak) 93 -2.1, MG Johnson (Aus) 97, M Morkel (Sou) 95, DL Vettori (New) 97 -0.8, DJG Sammy (Wes) 87 +1.3, RP Singh (Ind) 89, Shahid Afridi (Pak) 88 +0.9, DJ Hussey (Aus) 83

**2010** — bat: Yuvraj Singh (Ind) 91 -3.7, DA Warner (Aus) 90 +2.2, YK Pathan (Ind) 83 -0.6, SR Watson (Aus) 85 +1.5, Shahid Afridi (Pak) 86 -0.1, CH Gayle (Wes) 86 +0.3, EJG Morgan (Eng) 82 -4.6, Abdul Razzaq (Pak) 81 -3.6, BB McCullum (New) 84 -2.9, KP Pietersen (Eng) 82 -0.2
  bowl: DL Vettori (New) 99 -1.7, BAW Mendis (Sri) 99 -3.4, Abdul Razzaq (Pak) 91 -5, MG Johnson (Aus) 92 -0.2, RA Jadeja (Ind) 88 -5, M Morkel (Sou) 86 -2.3, P Utseya (Zim) 80, M Muralitharan (Sri) 89 -0.7, Harbhajan Singh (Ind) 90 -1.8, Shahid Afridi (Pak) 89 -5

**2012** — bat: RE Levi (Sou) 99 -5, SR Watson (Aus) 98 -1.7, CH Gayle (Wes) 92 +1.3, DR Smith (Wes) 90, KA Pollard (Wes) 88 -5, V Sehwag (Ind) 87 -4, Shahid Afridi (Pak) 90, Yuvraj Singh (Ind) 86 -4.1, BB McCullum (New) 86 +1.9, MJ Guptill (New) 83 -4.5
  bowl: Saeed Ajmal (Pak) 99 -3.1, BAW Mendis (Sri) 97 -1.6, DL Vettori (New) 95 -1.7, PJ Cummins (Aus) 88 -4.3, SP Narine (Wes) 85 +0.7, J Botha (Sou) 89 -1.5, JW Dernbach (Eng) 85 -5, SL Malinga (Sri) 86 -5, Shahid Afridi (Pak) 87 -1.9, Sohail Tanvir (Pak) 85 -0.9

**2014** — bat: AJ Finch (Aus) 99 -5, L Ronchi (New) 88, SR Watson (Aus) 94, CH Gayle (Wes) 89 -4.1, Yuvraj Singh (Ind) 88 -5, BB McCullum (New) 88 -0.5, GJ Bailey (Aus) 86 -3.4, DR Smith (Wes) 84 +0.7, Shahid Afridi (Pak) 84 +2.6, AD Hales (Eng) 82 +5
  bowl: SMSM Senanayake (Sri) 99 +2.1, Saeed Ajmal (Pak) 99 -2.2, SP Narine (Wes) 99 +3.8, Imran Tahir (Sou) 96 -2.4, MA Starc (Aus) 99 -3.3, S Badree (Wes) 99 -0.1, DW Steyn (Sou) 99 -1.6, GH Dockrell (Ire) 95 -4.1, AR Cusack (Ire) 92 -5, MR Swart (Net) 89 -3.9

**2016** — bat: C Munro (New) 99 -5, GJ Maxwell (Aus) 95 -5, CH Gayle (Wes) 92 +4.8, Shahid Afridi (Pak) 91 +0.3, AJ Finch (Aus) 91 -5, SR Watson (Aus) 89 -3.9, F du Plessis (Sou) 89 -5, DA Warner (Aus) 89 -4.4, RR Rossouw (Sou) 85, MJ Guptill (New) 86 +1.1
  bowl: Mustafizur Rahman (Ban) 99 -0.9, S Badree (Wes) 99 +0.2, JJ Bumrah (Ind) 94 -3.1, HMRKB Herath (Sri) 90 +1.2, R Ashwin (Ind) 93 -1.1, Imad Wasim (Pak) 88 -1, Imran Tahir (Sou) 85 +5, Taskin Ahmed (Ban) 81 +2.1, MJ Santner (New) 79 +2.1, DW Steyn (Sou) 83

**2021** — bat: LS Livingstone (Eng) 98, E Lewis (Wes) 99 -0.7, SA Yadav (Ind) 89, AD Russell (Wes) 92, GJ Maxwell (Aus) 93 -3.3, AJ Finch (Aus) 91 -1.5, GD Phillips (New) 86 -5, RG Sharma (Ind) 89 +4.4, AK Markram (Sou) 87 +0.6, MJ Guptill (New) 88 -0.6
  bowl: Nasum Ahmed (Ban) 95, JJ Bumrah (Ind) 96 +4.6, T Shamsi (Sou) 95 +1.2, MG Erasmus (Nam) 88, A Vala (Pap) 89, B Shikongo (Nam) 87, N Vanua (Pap) 89, PVD Chameera (Sri) 89 -3.5, AC Agar (Aus) 90, Sultan Ahmed (Uni) 88

**2022** — bat: T Stubbs (Sou) 98, SA Yadav (Ind) 99 +2.2, E Lewis (Wes) 99 -5, PD Salt (Eng) 92, RR Rossouw (Sou) 94 +5, FH Allen (New) 94 +5, AK Markram (Sou) 94 -1.6, LS Livingstone (Eng) 91, TH David (Aus) 92, DJ Hooda (Ind) 88
  bowl: MG Erasmus (Nam) 98, M Theekshana (Sri) 93 +3.6, PWH de Silva (Sri) 93 -0.5, B Shikongo (Nam) 87, AC Agar (Aus) 89, LH Ferguson (New) 87 -2.8, JJ Smit (Nam) 87 +1.8, DM de Silva (Sri) 82 +0.1, TJG Pringle (Net) 83 +2.2, B Muzarabani (Zim) 84 +1

**2024** — bat: SA Yadav (Ind) 99 +0.4, FH Allen (New) 99 +3.9, PD Salt (Eng) 97 +5, AD Russell (Wes) 94 +5, T Stubbs (Sou) 90 -5, TH David (Aus) 92 +5, GJ Maxwell (Aus) 92 +5, TM Head (Aus) 89 +5, JC Buttler (Eng) 92 +5, SE Rutherford (Wes) 85 +4.3
  bowl: MG Erasmus (Nam) 99 +0.8, WT Mubayiwa (Zim) 99, BJ Currie (Sco) 99, O Muzondo (Zim) 95, Kuldeep Yadav (Ind) 98 -0.6, AR Ramjani (Uga) 98, RL Chase (Wes) 91 +3.7, J Kariko (Pap) 93 +5, JJ Bumrah (Ind) 95 +5, Imad Wasim (Pak) 93 +5

**2026** — bat: Abhishek Sharma (Ind) 99 -5, FH Allen (New) 99 -5, TH David (Aus) 99, PD Salt (Eng) 99 -5, D Brevis (Sou) 96 -5, Ishan Kishan (Ind) 97 -0.9, SA Yadav (Ind) 99 -5, GJ Maxwell (Aus) 98 -5, JC Buttler (Eng) 97 -5, JP Inglis (Aus) 94 -5
  bowl: LH Ferguson (New) 99 -5, JJ Bumrah (Ind) 99 +1.2, BJ Currie (Sco) 98 +0.7, Salman Mirza (Pak) 97 +0.7, Nadeem Khan (Oma) 93 -4.6, B Muzarabani (Zim) 98 -2.4, Haider Ali (Uni) 95 -3, Washington Sundar (Ind) 95, S Lamichhane (Nep) 95 -4.4, Muhammad Arfan (Uni) 88 -3.2


## Timeless candidates (top decile in ≥ 3 editions spanning ≥ 8 years)

| Player | Skill | Editions | Span | Best display |
|---|---|---|---|---|
| GJ Maxwell | batting | 2016, 2021, 2022, 2024, 2026 | 10 | 98 |
| AJ Finch | batting | 2014, 2016, 2021, 2022 | 8 | 99 |
| DA Warner | batting | 2010, 2016, 2022, 2024 | 14 | 91 |
| JJ Bumrah | bowling | 2016, 2021, 2024, 2026 | 10 | 99 |

## Audit against the hand-rated card roster

222 cards matched to people by surname + initial (unique matches only). Mean display rating of the person's latest edition by card tier; Spearman rank correlation between tier and display: **0.286**.

| Tier | Cards matched | Mean display |
|---|---|---|
| Elite | 35 | 80.9 |
| Gold | 63 | 75.5 |
| Silver | 65 | 73.4 |
| Bronze | 59 | 68.9 |

Largest disagreements (card tier vs data rating):

| Card | Kind | Tier | Latest edition | Display |
|---|---|---|---|---|
| Colin Munro | batsman | Bronze | 2016 | 99 |
| Mashrafe Mortaza | bowler | Elite | 2016 | 46 |
| Salman Mirza | bowler | Bronze | 2026 | 97 |
| Rilee Rossouw | batsman | Bronze | 2022 | 94 |
| Ed Joyce | batsman | Gold | 2014 | 40 |
| Deepak Hooda | batsman | Bronze | 2022 | 88 |
| Tim David | batsman | Silver | 2026 | 99 |
| Reeza Hendricks | batsman | Bronze | 2024 | 87 |
| Lockie Ferguson | bowler | Silver | 2026 | 99 |
| Tom Banton | batsman | Bronze | 2026 | 86 |
| Johnson Charles | batsman | Bronze | 2024 | 86 |
| Jason Roy | batsman | Bronze | 2021 | 85 |
| Shai Hope | batsman | Bronze | 2026 | 84 |
| Rachin Ravindra | bowler | Bronze | 2026 | 84 |
| Sandeep Lamichhane | bowler | Silver | 2026 | 95 |
