# World Cup Draft — ratings (Phase 1.5)

Generated 2026-10-30T06:32Z. Model: expected evidence, prior strength 100 balls (bowling ×2), phase prior 300, hazard prior 2000, career prior 50, ODI prior 30, transfer scale 300 Elo to the strongest third, cohort centre top10, wicket cost 2.6 runs, display 40–99, low-sample badge < 60 balls faced / < 72 bowled.

Ratings are per-phase outcome vectors; the display number maps the phase-weighted value (per cent of population expected runs, standardised per edition against the squads of its ten strongest teams) onto 40–99 across every rated player-edition, so a 90 in 2009 and a 90 in 2026 mean the same thing relative to their eras.

## Validation

**Predictive validity** — correlation between the pre-tournament rating (form only; the tournament itself is excluded) and the player's raw value in that tournament, for player-editions with ≥ 60 balls faced / ≥ 72 bowled in both. Two targets: *edition* values the tournament against the whole edition's population; *adjusted* values it against the tournament's own population mixed over the opponent strengths (Elo bins) the player actually faced, which is the fairer target for an opposition-adjusted rating because associates mostly meet associates in the first round. Baselines use the same formula on raw form (no shrinkage, no tier), raw strike rate/economy, and career rate.

The **within-edition** columns demean every edition first and are the primary metric: the pooled correlation also rewards matching each edition's *level*, which depends on the field's composition (ten strong teams in 2009, twenty teams in 2024) rather than on player skill.

| Variant | Bat n | Within: model | raw form value | raw SR | Pooled: model→edition | model→adjusted | raw form value | raw SR | career SR | Bowl n | Within: model | raw form value | raw econ | Pooled: model→edition | model→adjusted | raw form value | raw econ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DEFAULT (Phase 1.5): context-expected evidence, hierarchical(300), c=100 (bowl ×2), hazard 2000, career 50, linear transfer 300 | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.19** | 0.087 | 0.102 | 0.18 | 0.171 | 0.044 | 0.094 |
| Phase 1 default: window evidence (bat two-way / bowl elo), hierarchical(150), c=50, hazard 1000 | 392 | **0.309** | 0.272 | 0.268 | 0.29 | 0.302 | 0.279 | 0.268 | 0.259 | 324 | **0.166** | 0.087 | 0.102 | 0.154 | 0.13 | 0.044 | 0.094 |
| Phase 1 window evidence with the Phase 1.5 priors | 392 | **0.314** | 0.272 | 0.268 | 0.296 | 0.307 | 0.279 | 0.268 | 0.259 | 324 | **0.167** | 0.087 | 0.102 | 0.156 | 0.131 | 0.044 | 0.094 |
| context-expected, Phase 1 priors (c=50, phase 150, hazard 1000) | 392 | **0.321** | 0.272 | 0.268 | 0.3 | 0.31 | 0.279 | 0.268 | 0.259 | 324 | **0.183** | 0.087 | 0.102 | 0.172 | 0.164 | 0.044 | 0.094 |
| context-expected, pooled phases | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.316 | 0.279 | 0.268 | 0.259 | 324 | **0.194** | 0.087 | 0.102 | 0.185 | 0.175 | 0.044 | 0.094 |
| context-expected, per-phase (no pooling) | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.19** | 0.087 | 0.102 | 0.18 | 0.171 | 0.044 | 0.094 |
| context-expected, no career prior | 392 | **0.322** | 0.272 | 0.268 | 0.302 | 0.313 | 0.279 | 0.268 | 0.259 | 324 | **0.18** | 0.087 | 0.102 | 0.171 | 0.16 | 0.044 | 0.094 |
| context-expected, career prior 100 | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.192** | 0.087 | 0.102 | 0.182 | 0.173 | 0.044 | 0.094 |
| cohort centre: none | 392 | **0.325** | 0.272 | 0.268 | 0.318 | 0.323 | 0.279 | 0.268 | 0.259 | 324 | **0.197** | 0.087 | 0.102 | 0.185 | 0.175 | 0.044 | 0.094 |
| cohort centre: all squads | 392 | **0.323** | 0.272 | 0.268 | 0.318 | 0.326 | 0.279 | 0.268 | 0.259 | 324 | **0.189** | 0.087 | 0.102 | 0.178 | 0.166 | 0.044 | 0.094 |
| full transfer (scale 0) | 392 | **0.302** | 0.272 | 0.268 | 0.289 | 0.297 | 0.279 | 0.268 | 0.259 | 324 | **0.157** | 0.087 | 0.102 | 0.146 | 0.128 | 0.044 | 0.094 |
| transfer 200 | 392 | **0.324** | 0.272 | 0.268 | 0.302 | 0.312 | 0.279 | 0.268 | 0.259 | 324 | **0.197** | 0.087 | 0.102 | 0.189 | 0.184 | 0.044 | 0.094 |
| transfer 450 | 392 | **0.323** | 0.272 | 0.268 | 0.303 | 0.313 | 0.279 | 0.268 | 0.259 | 324 | **0.178** | 0.087 | 0.102 | 0.167 | 0.154 | 0.044 | 0.094 |
| transfer to the strongest third | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.19** | 0.087 | 0.102 | 0.18 | 0.171 | 0.044 | 0.094 |
| transfer to the strongest third, scale 450 | 392 | **0.323** | 0.272 | 0.268 | 0.303 | 0.313 | 0.279 | 0.268 | 0.259 | 324 | **0.178** | 0.087 | 0.102 | 0.167 | 0.154 | 0.044 | 0.094 |
| transfer to the strongest third, scale 600 | 392 | **0.319** | 0.272 | 0.268 | 0.302 | 0.311 | 0.279 | 0.268 | 0.259 | 324 | **0.172** | 0.087 | 0.102 | 0.161 | 0.146 | 0.044 | 0.094 |
| tier destination on (two-way shape on the expected path) | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.19** | 0.087 | 0.102 | 0.18 | 0.171 | 0.044 | 0.094 |
| tier destination on, transfer to the strongest third | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.19** | 0.087 | 0.102 | 0.18 | 0.171 | 0.044 | 0.094 |
| tier destination on, cohort centre none | 392 | **0.325** | 0.272 | 0.268 | 0.318 | 0.323 | 0.279 | 0.268 | 0.259 | 324 | **0.197** | 0.087 | 0.102 | 0.185 | 0.175 | 0.044 | 0.094 |
| selection prior 0.5 (every miss counts) | 392 | **0.324** | 0.272 | 0.268 | 0.302 | 0.312 | 0.279 | 0.268 | 0.259 | 324 | **0.186** | 0.087 | 0.102 | 0.175 | 0.164 | 0.044 | 0.094 |
| selection prior 0.5, shares below 0.5 only | 392 | **0.321** | 0.272 | 0.268 | 0.3 | 0.31 | 0.279 | 0.268 | 0.259 | 324 | **0.191** | 0.087 | 0.102 | 0.18 | 0.17 | 0.044 | 0.094 |
| selection prior 1.0, shares below 0.5 only | 392 | **0.315** | 0.272 | 0.268 | 0.294 | 0.304 | 0.279 | 0.268 | 0.259 | 324 | **0.189** | 0.087 | 0.102 | 0.178 | 0.166 | 0.044 | 0.094 |
| c=50 | 392 | **0.325** | 0.272 | 0.268 | 0.304 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.188** | 0.087 | 0.102 | 0.177 | 0.168 | 0.044 | 0.094 |
| c=150 | 392 | **0.328** | 0.272 | 0.268 | 0.307 | 0.317 | 0.279 | 0.268 | 0.259 | 324 | **0.192** | 0.087 | 0.102 | 0.183 | 0.174 | 0.044 | 0.094 |
| phase prior 150 | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.187** | 0.087 | 0.102 | 0.177 | 0.168 | 0.044 | 0.094 |
| phase prior 600 | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.192** | 0.087 | 0.102 | 0.182 | 0.173 | 0.044 | 0.094 |
| hazard prior 1000 | 392 | **0.322** | 0.272 | 0.268 | 0.301 | 0.311 | 0.279 | 0.268 | 0.259 | 324 | **0.188** | 0.087 | 0.102 | 0.178 | 0.17 | 0.044 | 0.094 |
| hazard prior 4000 | 392 | **0.329** | 0.272 | 0.268 | 0.308 | 0.318 | 0.279 | 0.268 | 0.259 | 324 | **0.191** | 0.087 | 0.102 | 0.181 | 0.171 | 0.044 | 0.094 |
| bowl prior ×1 | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.182** | 0.087 | 0.102 | 0.172 | 0.163 | 0.044 | 0.094 |
| bowl prior ×4 | 392 | **0.326** | 0.272 | 0.268 | 0.305 | 0.315 | 0.279 | 0.268 | 0.259 | 324 | **0.198** | 0.087 | 0.102 | 0.189 | 0.181 | 0.044 | 0.094 |
| wicket cost 0 (diagnostic) | 392 | **0.33** | 0.272 | 0.268 | 0.31 | 0.321 | 0.279 | 0.268 | 0.259 | 324 | **0.19** | 0.087 | 0.102 | 0.18 | 0.17 | 0.044 | 0.094 |
| window evidence, opposition none / none (control) | 392 | **0.303** | 0.272 | 0.268 | 0.297 | 0.305 | 0.279 | 0.268 | 0.259 | 324 | **0.156** | 0.087 | 0.102 | 0.146 | 0.12 | 0.044 | 0.094 |
| window evidence, window-averaged venue normalisation on | 392 | **0.302** | 0.272 | 0.268 | 0.284 | 0.295 | 0.279 | 0.268 | 0.259 | 324 | **0.178** | 0.087 | 0.102 | 0.166 | 0.146 | 0.044 | 0.094 |

**Components** — how well the model's runs-per-ball and dismissal-rate each predict the tournament's, against the raw-form equivalents.

| Variant | Bat runs: model | raw | Bat hazard: model | raw | Bowl runs: model | raw | Bowl hazard: model | raw |
|---|---|---|---|---|---|---|---|---|
| DEFAULT (Phase 1.5): context-expected evidence, hierarchical(300), c=100 (bowl ×2), hazard 2000, career 50, linear transfer 300 | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| Phase 1 default: window evidence (bat two-way / bowl elo), hierarchical(150), c=50, hazard 1000 | 0.338 | 0.328 | 0.134 | 0.076 | 0.193 | 0.083 | 0.122 | 0.075 |
| Phase 1 window evidence with the Phase 1.5 priors | 0.342 | 0.328 | 0.133 | 0.076 | 0.199 | 0.083 | 0.133 | 0.075 |
| context-expected, Phase 1 priors (c=50, phase 150, hazard 1000) | 0.378 | 0.328 | 0.139 | 0.076 | 0.207 | 0.083 | 0.11 | 0.075 |
| context-expected, pooled phases | 0.384 | 0.328 | 0.132 | 0.076 | 0.222 | 0.083 | 0.123 | 0.075 |
| context-expected, per-phase (no pooling) | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| context-expected, no career prior | 0.378 | 0.328 | 0.134 | 0.076 | 0.197 | 0.083 | 0.121 | 0.075 |
| context-expected, career prior 100 | 0.383 | 0.328 | 0.135 | 0.076 | 0.224 | 0.083 | 0.125 | 0.075 |
| cohort centre: none | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| cohort centre: all squads | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| full transfer (scale 0) | 0.362 | 0.328 | 0.143 | 0.076 | 0.17 | 0.083 | 0.084 | 0.075 |
| transfer 200 | 0.376 | 0.328 | 0.136 | 0.076 | 0.233 | 0.083 | 0.133 | 0.075 |
| transfer 450 | 0.381 | 0.328 | 0.138 | 0.076 | 0.202 | 0.083 | 0.11 | 0.075 |
| transfer to the strongest third | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| transfer to the strongest third, scale 450 | 0.381 | 0.328 | 0.138 | 0.076 | 0.202 | 0.083 | 0.11 | 0.075 |
| transfer to the strongest third, scale 600 | 0.379 | 0.328 | 0.14 | 0.076 | 0.193 | 0.083 | 0.103 | 0.075 |
| tier destination on (two-way shape on the expected path) | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| tier destination on, transfer to the strongest third | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| tier destination on, cohort centre none | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| selection prior 0.5 (every miss counts) | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| selection prior 0.5, shares below 0.5 only | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| selection prior 1.0, shares below 0.5 only | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| c=50 | 0.381 | 0.328 | 0.134 | 0.076 | 0.212 | 0.083 | 0.12 | 0.075 |
| c=150 | 0.384 | 0.328 | 0.135 | 0.076 | 0.222 | 0.083 | 0.126 | 0.075 |
| phase prior 150 | 0.38 | 0.328 | 0.134 | 0.076 | 0.214 | 0.083 | 0.124 | 0.075 |
| phase prior 600 | 0.383 | 0.328 | 0.135 | 0.076 | 0.22 | 0.083 | 0.125 | 0.075 |
| hazard prior 1000 | 0.381 | 0.328 | 0.139 | 0.076 | 0.217 | 0.083 | 0.113 | 0.075 |
| hazard prior 4000 | 0.383 | 0.328 | 0.125 | 0.076 | 0.219 | 0.083 | 0.135 | 0.075 |
| bowl prior ×1 | 0.382 | 0.328 | 0.134 | 0.076 | 0.203 | 0.083 | 0.119 | 0.075 |
| bowl prior ×4 | 0.382 | 0.328 | 0.134 | 0.076 | 0.235 | 0.083 | 0.127 | 0.075 |
| wicket cost 0 (diagnostic) | 0.382 | 0.328 | 0.134 | 0.076 | 0.218 | 0.083 | 0.124 | 0.075 |
| window evidence, opposition none / none (control) | 0.29 | 0.328 | 0.116 | 0.076 | 0.18 | 0.083 | 0.121 | 0.075 |
| window evidence, window-averaged venue normalisation on | 0.331 | 0.328 | 0.128 | 0.076 | 0.202 | 0.083 | 0.135 | 0.075 |

**Stability** — correlation between a player's rating in one edition and in their next edition.

| Variant | Batting n | Model | Raw form SR | Bowling n | Model | Raw form economy |
|---|---|---|---|---|---|---|
| DEFAULT (Phase 1.5): context-expected evidence, hierarchical(300), c=100 (bowl ×2), hazard 2000, career 50, linear transfer 300 | 499 | 0.761 | 0.454 | 408 | 0.586 | 0.44 |
| Phase 1 default: window evidence (bat two-way / bowl elo), hierarchical(150), c=50, hazard 1000 | 499 | 0.805 | 0.454 | 408 | 0.65 | 0.44 |
| Phase 1 window evidence with the Phase 1.5 priors | 499 | 0.821 | 0.454 | 408 | 0.696 | 0.44 |
| context-expected, Phase 1 priors (c=50, phase 150, hazard 1000) | 499 | 0.75 | 0.454 | 408 | 0.551 | 0.44 |
| context-expected, pooled phases | 499 | 0.777 | 0.454 | 408 | 0.615 | 0.44 |
| context-expected, per-phase (no pooling) | 499 | 0.761 | 0.454 | 408 | 0.586 | 0.44 |
| context-expected, no career prior | 499 | 0.763 | 0.454 | 408 | 0.58 | 0.44 |
| context-expected, career prior 100 | 499 | 0.759 | 0.454 | 408 | 0.58 | 0.44 |
| cohort centre: none | 499 | 0.76 | 0.454 | 408 | 0.588 | 0.44 |
| cohort centre: all squads | 499 | 0.754 | 0.454 | 408 | 0.585 | 0.44 |
| full transfer (scale 0) | 499 | 0.701 | 0.454 | 408 | 0.558 | 0.44 |
| transfer 200 | 499 | 0.765 | 0.454 | 408 | 0.554 | 0.44 |
| transfer 450 | 499 | 0.748 | 0.454 | 408 | 0.589 | 0.44 |
| transfer to the strongest third | 499 | 0.761 | 0.454 | 408 | 0.586 | 0.44 |
| transfer to the strongest third, scale 450 | 499 | 0.748 | 0.454 | 408 | 0.589 | 0.44 |
| transfer to the strongest third, scale 600 | 499 | 0.738 | 0.454 | 408 | 0.584 | 0.44 |
| tier destination on (two-way shape on the expected path) | 499 | 0.761 | 0.454 | 408 | 0.586 | 0.44 |
| tier destination on, transfer to the strongest third | 499 | 0.761 | 0.454 | 408 | 0.586 | 0.44 |
| tier destination on, cohort centre none | 499 | 0.76 | 0.454 | 408 | 0.588 | 0.44 |
| selection prior 0.5 (every miss counts) | 499 | 0.761 | 0.454 | 408 | 0.576 | 0.44 |
| selection prior 0.5, shares below 0.5 only | 499 | 0.762 | 0.454 | 408 | 0.584 | 0.44 |
| selection prior 1.0, shares below 0.5 only | 499 | 0.759 | 0.454 | 408 | 0.575 | 0.44 |
| c=50 | 499 | 0.761 | 0.454 | 408 | 0.569 | 0.44 |
| c=150 | 499 | 0.763 | 0.454 | 408 | 0.601 | 0.44 |
| phase prior 150 | 499 | 0.752 | 0.454 | 408 | 0.566 | 0.44 |
| phase prior 600 | 499 | 0.767 | 0.454 | 408 | 0.598 | 0.44 |
| hazard prior 1000 | 499 | 0.759 | 0.454 | 408 | 0.586 | 0.44 |
| hazard prior 4000 | 499 | 0.761 | 0.454 | 408 | 0.584 | 0.44 |
| bowl prior ×1 | 499 | 0.761 | 0.454 | 408 | 0.553 | 0.44 |
| bowl prior ×4 | 499 | 0.761 | 0.454 | 408 | 0.637 | 0.44 |
| wicket cost 0 (diagnostic) | 499 | 0.756 | 0.454 | 408 | 0.579 | 0.44 |
| window evidence, opposition none / none (control) | 499 | 0.757 | 0.454 | 408 | 0.66 | 0.44 |
| window evidence, window-averaged venue normalisation on | 499 | 0.805 | 0.454 | 408 | 0.646 | 0.44 |

**Edge transfer against the strongest third** — for players with enough form balls against both the weak bins (two or more below the edition's top-third cutoff bin) and the strong bins (the cutoff bin and above), the log edge in each group is actual ÷ context-expected runs net of the wicket cost, from the per-ball context model. The slope of strong on weak is the share of an edge earned against weak opposition that shows up against strong opposition (1 = all of it).

| Skill | n | Slope | r | Mean edge vs weak | Mean edge vs strong | Min balls per group |
|---|---|---|---|---|---|---|
| bat | 31 | 0.054 | 0.07 | 0.226 | 0.066 | 120 |
| bowl | 31 | 0.115 | 0.152 | 0.097 | 0.054 | 120 |
| bat | 112 | 0.228 | 0.283 | 0.24 | 0.021 | 60 |
| bowl | 115 | 0.053 | 0.103 | 0.167 | 0.081 | 60 |

## Evidence sources

| Skill | form | career | odi | population |
|---|---|---|---|---|
| bat | 1763 | 49 | 43 | 219 |
| bowl | 1296 | 79 | 41 | 658 |

Roles: batter 870, bowler 835, all-rounder 191, unknown 178. Positionless: 120. Low-sample batting: 935; bowling: 1060. Squad Player tag (picked for under 25% of the tournament): 76. Selection prior applied (batting / bowling): 0 / 0.

## Top ten batters and bowlers per edition (display rating, not low-sample)

**2007** — bat: Shahid Afridi (Pak) 89 +0.4, A Symonds (Aus) 92 -2, MN Samuels (Wes) 88, Younis Khan (Pak) 83 -4, Nazimuddin (Ban) 86, RT Ponting (Aus) 86 -3.1, Mohammad Ashraful (Ban) 82 +3.2, HH Gibbs (Sou) 83 +0.3, ML Hayden (Aus) 79 +2.6, Aftab Ahmed (Ban) 79 -0.1
  bowl: SE Bond (New) 86 +1.5, TM Dilshan (Sri) 82, JS Patel (New) 85, DR Smith (Wes) 84, Abdur Razzak (Ban) 81 +3.3, SL Malinga (Sri) 77 +3.2, DJ Bravo (Wes) 76, CH Gayle (Wes) 76, Syed Rasel (Ban) 77 +2.5, A Symonds (Aus) 78 -0.7

**2009** — bat: Shahid Afridi (Pak) 97 -0.2, Yuvraj Singh (Ind) 98 +0.6, DA Warner (Aus) 96 +0.1, Mohammad Ashraful (Ban) 93, ST Jayasuriya (Sri) 92 -0.9, CH Gayle (Wes) 90 +1.5, DJ Hussey (Aus) 88 +2.7, JDP Oram (New) 88 -0.1, KP Pietersen (Eng) 88 +4.8, SR Watson (Aus) 82
  bowl: Umar Gul (Pak) 96 +5, DL Vettori (New) 93 +5, J Botha (Sou) 86 +5, MG Johnson (Aus) 86, M Morkel (Sou) 85, Shahid Afridi (Pak) 85 +5, Harbhajan Singh (Ind) 83 +5, DJ Hussey (Aus) 81, Shoaib Malik (Pak) 80 +5, B Lee (Aus) 81 +3.6

**2010** — bat: DA Warner (Aus) 98 +1.8, Yuvraj Singh (Ind) 97 -1.1, SR Watson (Aus) 91 +2.7, CH Gayle (Wes) 91 +1.7, Shahid Afridi (Pak) 90 +1.7, YK Pathan (Ind) 85 +1.7, DJ Bravo (Wes) 86 +0.7, EJG Morgan (Eng) 86 -0.1, TM Dilshan (Sri) 87 -0.2, DJ Hussey (Aus) 86 -0.3
  bowl: DL Vettori (New) 99 +5, Shahid Afridi (Pak) 93 +1.3, BAW Mendis (Sri) 89 +3, Saeed Ajmal (Pak) 89 +2.9, M Morkel (Sou) 85 +2.7, MG Johnson (Aus) 86 +4.6, Harbhajan Singh (Ind) 86 +3.1, RA Jadeja (Ind) 83 -2.6, GP Swann (Eng) 83 +3.8, SE Bond (New) 83 +2.2

**2012** — bat: RE Levi (Sou) 99 -4.1, SR Watson (Aus) 99 +0.5, KA Pollard (Wes) 98 -2.4, DR Smith (Wes) 97, CH Gayle (Wes) 98 +1.9, Yuvraj Singh (Ind) 93 -0.5, V Sehwag (Ind) 91 -0.2, Shahid Afridi (Pak) 90, SK Raina (Ind) 89 +0.1, DA Warner (Aus) 90 -0.1
  bowl: Saeed Ajmal (Pak) 96 +2.7, DL Vettori (New) 94 +3.6, BAW Mendis (Sri) 90 +3.3, PJ Cummins (Aus) 86 +1.5, DW Steyn (Sou) 86 +5, SP Narine (Wes) 83 +5, GP Swann (Eng) 86 +3.6, SR Watson (Aus) 86 +1.2, SL Malinga (Sri) 84, DJ Hussey (Aus) 82

**2014** — bat: AJ Finch (Aus) 99 -2, Yuvraj Singh (Ind) 96 -2.5, BB McCullum (New) 96 +1.6, CH Gayle (Wes) 95 -0.6, SR Watson (Aus) 95, L Ronchi (New) 90, MJ Lumb (Eng) 91 +3.1, DR Smith (Wes) 91 +2.6, GJ Bailey (Aus) 90 +1.1, AD Hales (Eng) 90 +5
  bowl: Imran Tahir (Sou) 99 +4, DW Steyn (Sou) 99 +3.4, Saeed Ajmal (Pak) 97 +3.3, SP Narine (Wes) 95 +5, S Badree (Wes) 94 +5, SMSM Senanayake (Sri) 92 +5, MA Starc (Aus) 92 +2.5, Mohammad Hafeez (Pak) 85, P Utseya (Zim) 83 +4.2, BAW Mendis (Sri) 82

**2016** — bat: GJ Maxwell (Aus) 99 -5, C Munro (New) 99 -4.9, Shahid Afridi (Pak) 99 +2, DA Warner (Aus) 98 -0.6, DJG Sammy (Wes) 95, AJ Finch (Aus) 96 -0.8, F du Plessis (Sou) 93 -1.7, SR Watson (Aus) 93 +0.4, CH Gayle (Wes) 91 +5, V Kohli (Ind) 91 +0.7
  bowl: S Badree (Wes) 99 +3.3, R Ashwin (Ind) 99 +1.2, Mustafizur Rahman (Ban) 95 +2.4, JJ Bumrah (Ind) 92 +0.9, HMRKB Herath (Sri) 90 +3.3, AF Milne (New) 89 +2.4, Imad Wasim (Pak) 86 +2.2, MJ Santner (New) 84 +4, Imran Tahir (Sou) 86 +5, Mohammad Amir (Pak) 85 +2.3

**2021** — bat: LS Livingstone (Eng) 99, SA Yadav (Ind) 94, GD Phillips (New) 97 +3.5, MJ Guptill (New) 98 +4.4, E Lewis (Wes) 95 +5, AK Markram (Sou) 94 +5, AD Russell (Wes) 91, DP Conway (New) 90 +5, GJ Maxwell (Aus) 90 +5, JDS Neesham (New) 88 +5
  bowl: JJ Bumrah (Ind) 99 +5, T Shamsi (Sou) 96 +3.6, PVD Chameera (Sri) 92, PWH de Silva (Sri) 92 +5, MJ Santner (New) 91 +4.4, AC Agar (Aus) 91, CH Gayle (Wes) 88, Mustafizur Rahman (Ban) 88 -0.4, PJ Cummins (Aus) 86 +4.7, MD Shanaka (Sri) 84 +3.4

**2022** — bat: TH David (Aus) 99, T Stubbs (Sou) 94, RR Rossouw (Sou) 98 +5, SA Yadav (Ind) 96 +5, PD Salt (Eng) 92, DA Warner (Aus) 95, MS Chapman (New) 93, LS Livingstone (Eng) 92, AK Markram (Sou) 93 +5, JC Buttler (Eng) 94 +5
  bowl: PWH de Silva (Sri) 99, M Theekshana (Sri) 99 +3.1, DM de Silva (Sri) 91 +0.8, AJ Hosein (Wes) 96 +0.3, MJ Santner (New) 92 +1.8, AC Agar (Aus) 91, T Shamsi (Sou) 90 +2.6, Iftikhar Ahmed (Pak) 87, TA Boult (New) 89 +1, R Ashwin (Ind) 89 +0.4

**2024** — bat: TH David (Aus) 99 +5, FH Allen (New) 99 +5, TM Head (Aus) 97 +5, AD Russell (Wes) 97 +5, JC Buttler (Eng) 98 +5, GJ Maxwell (Aus) 96 +5, SA Yadav (Ind) 96 +5, PD Salt (Eng) 94 +5, J Charles (Wes) 93 +5, MR Marsh (Aus) 92 +5
  bowl: RL Chase (Wes) 99 +2.9, Kuldeep Yadav (Ind) 99 +1.3, MG Erasmus (Nam) 99 +2.5, M Theekshana (Sri) 97 +2.8, Iftikhar Ahmed (Pak) 94, MJ Santner (New) 96 +4.4, DM de Silva (Sri) 91, Imad Wasim (Pak) 92 +5, JJ Bumrah (Ind) 92 +5, LH Ferguson (New) 90 +5

**2026** — bat: Abhishek Sharma (Ind) 99 +4.2, Ishan Kishan (Ind) 99 +5, TH David (Aus) 99, PD Salt (Eng) 96 +4.9, SA Yadav (Ind) 96 -0.6, TM Head (Aus) 95 +4.9, GJ Maxwell (Aus) 95 +1.9, JC Buttler (Eng) 95 +3.4, FH Allen (New) 92 +5, SV Samson (Ind) 92 +5
  bowl: LH Ferguson (New) 99 -3.5, JJ Bumrah (Ind) 99 +2.8, Abrar Ahmed (Pak) 93 +0.9, Salman Mirza (Pak) 91 +2.6, Washington Sundar (Ind) 89, PWH de Silva (Sri) 88, Mohammad Nawaz (Pak) 88 +0.9, AU Rashid (Eng) 88 +0.8, BJ Currie (Sco) 85 +3.3, MJ Humphreys (Ire) 85 +1.7


## Timeless candidates (top decile in ≥ 3 editions spanning ≥ 8 years)

| Player | Skill | Editions | Span | Best display |
|---|---|---|---|---|
| DA Warner | batting | 2009, 2010, 2012, 2016, 2022, 2024 | 15 | 98 |
| Shahid Afridi | batting | 2007, 2009, 2010, 2012, 2016 | 9 | 99 |
| GJ Maxwell | batting | 2016, 2021, 2024, 2026 | 10 | 99 |
| JJ Bumrah | bowling | 2016, 2021, 2024, 2026 | 10 | 99 |
| MJ Santner | bowling | 2016, 2021, 2022, 2024 | 8 | 96 |

## Audit against the hand-rated card roster

222 cards matched to people by surname + initial (unique matches only). Mean display rating of the person's latest edition by card tier; Spearman rank correlation between tier and display: **0.294**.

| Tier | Cards matched | Mean display |
|---|---|---|
| Elite | 35 | 79.4 |
| Gold | 63 | 73.7 |
| Silver | 65 | 68.4 |
| Bronze | 59 | 66.7 |

Largest disagreements (card tier vs data rating):

| Card | Kind | Tier | Latest edition | Display |
|---|---|---|---|---|
| Colin Munro | batsman | Bronze | 2016 | 99 |
| Rilee Rossouw | batsman | Bronze | 2022 | 98 |
| Johnson Charles | batsman | Bronze | 2024 | 93 |
| Salman Mirza | bowler | Bronze | 2026 | 91 |
| Josh Little | bowler | Elite | 2026 | 53 |
| Jason Roy | batsman | Bronze | 2021 | 90 |
| Mashrafe Mortaza | bowler | Elite | 2016 | 54 |
| Curtis Campher | bowler | Gold | 2026 | 44 |
| Tim David | batsman | Silver | 2026 | 99 |
| Corey Anderson | batsman | Gold | 2024 | 45 |
| Lockie Ferguson | bowler | Silver | 2026 | 99 |
| Ryan ten Doeschate | batsman | Elite | 2021 | 60 |
| Tom Banton | batsman | Bronze | 2026 | 83 |
| Reeza Hendricks | batsman | Bronze | 2024 | 83 |
| Paul Stirling | batsman | Elite | 2026 | 62 |
