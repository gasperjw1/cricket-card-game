# Methods for converting cricket statistics into numerical player ratings / simulation skill parameters

Scope: official rating systems (ICC), academic performance indices (Lemmer, Croucher, Lewis, Beaudoin-Swartz), Bayesian/hierarchical shrinkage (Stevenson-Brewer, Boys-Philipson, Swartz group), context/impact metrics (CricViz, ESPNcricinfo Smart Stats, Impact Index, expected-run-differential, Delta, RAE/DAR), Elo/Glicko/Bradley-Terry, batter-vs-bowler-type and phase interactions, ageing curves, recency weighting, archetype clustering, and Cricsheet-based simulator parameterisation. Formulas and parameter values are recorded wherever the source gives them. Where a source was paywalled or only an abstract was reachable, that is flagged as a gap.

---

## 1. The official ICC player ranking algorithm (Deloitte → PwC → Reliance → MRF Tyres)

### Takeaway
The ICC system is a scorecard-only, exponentially decayed ("moving") average of per-match performance scores on a 0–1000 scale, with multiplicative adjustments for opposition strength (circular: batters are rated against the bowlers' current ratings and vice versa), match scoring level, win bonus, and format-specific credit for strike rate / economy. Qualitative rules and the new-player damping schedule are published; the actual coefficients and the decay constant are not, so the method can be approximated but not reproduced exactly.

### Cited Findings
- Origin: proposed by Ted Dexter; the simulation and program were developed by Rob Eastaway (then at ICI) and Gordon Vince (Logica); Deloitte sponsored the Test ratings from the June 1987 launch; ODI rankings launched 1998; ICC acquired the rankings January 2005; T20I player rankings launched October 2011 under MRF Tyres — [ICC: A history of the ICC rankings](https://www.icc-cricket.com/news/a-history-of-the-icc-rankings)
- Core mechanism per Eastaway: a "decayed average" in which "every score is considered in the calculation, but as you go back in time, each value is discounted by a certain percentage." His worked illustration uses a 4% per-innings decay (weight 0.96 per step back): weighted total 489.96 / weight sum 9.04 ≈ 54.2 vs plain average 50. The system "adjusts each player's individual performance in a match, and then updates the player's overall decayed average". Proportional adjustments are made "for different opposition strengths and high- or low-scoring matches". Because batter and bowler ratings depend on each other, each player gets a provisional post-match rating used in the adjustments; Eastaway says the resulting errors are "second order". The full algorithm is "rather too lengthy to go into." — [Plus Magazine, Howzat (Eastaway)](https://plus.maths.org/howzat)
- An NRICH teaching article illustrates the same exponential average with a 10% per-match decay (×0.9 per step) — this is an illustration, not a documented ICC parameter — [NRICH 1385 via search summary](https://nrich.maths.org/1385) (page returned 404 on direct fetch; figure from search snippet)
- Scale and interpretation: 0–1000 points; 900+ "exceptional"/elite; 750+ top-ten level; 500+ "a good, solid rating". All-rounder index = batting points × bowling points / 1000 (e.g., 600 × 200 / 1000 = 120; 300+ is "world class"). Fielding and wicket-keeping are not rated. — [ICC Rankings FAQs](https://www.icc-cricket.com/rankings/faqs); [MRF Tyres ICC Player Rankings](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings)
- Batting inputs (Test): runs scored; strength of opposing bowling attack; run-scoring level of the match and of the team's innings total (runs in low-scoring matches earn more credit); a not-out bonus; a win bonus that is larger against higher-rated opponents — [MRF Tyres ICC Player Rankings](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings)
- Bowling inputs: wickets and runs conceded; ratings of the batters dismissed (a wicket is worth more when the batter's rating is higher); match run-scoring level (figures in high-scoring matches count for more); workload (overs bowled earns some credit even without wickets); win bonus; bowlers who do not bowl in a large opposition innings are penalised, but not if the opposition is bowled out for under 150 — [MRF Tyres ICC Player Rankings](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings); [ICC Rankings FAQs](https://www.icc-cricket.com/rankings/faqs)
- Scoring-level adjustment explained qualitatively: when both teams score 500, runs are "downgraded"; when scores are ~150 per innings, good scores "earn more credit"; "all the Ratings calculations are based purely on the information in the scorecard" — [ICC Rankings FAQs](https://www.icc-cricket.com/rankings/faqs)
- Recency: ratings "consider a player's whole career, but they put more emphasis on what he or she has done recently"; described as "a sophisticated moving average"; the latest match's weighted performance is combined with the previous rating and converted to points — [ICC Rankings FAQs](https://www.icc-cricket.com/rankings/faqs); [MRF Tyres page](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings); [ICC rankings explained](https://www.icc-cricket.com/about/cricket/icc-rankings)
- New-player damping (Tests): players start at 0; a batter with 10 Test innings receives 70% of computed rating, 100% at 40 innings; a bowler with 30 Test wickets receives 70%, 100% at 100 wickets. For limited-overs, displayed points for new batters start about 60% reduced and reach 100% after 20 innings (page does not say which format this applies to). — [MRF Tyres page](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings); Wikipedia states full rating after "about 20 Tests" — [Wikipedia ICC Men's Player Rankings](https://en.wikipedia.org/wiki/ICC_Men%27s_Player_Rankings)
- Missed-match penalties: Tests −1% of points per Test missed; ODIs −0.5% per match; T20Is −2% per match; a batter who does not bat keeps his rating unchanged — [MRF Tyres page](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings)
- Qualifying window to remain listed: ~12–15 months for Tests, ~9–12 months for ODIs and T20Is; lapsed players keep a rating that "slowly diminished as he missed matches" (Parthiv Patel example); retirement removes a player from that format's list; weekly updates since March 2021 — [ICC Rankings FAQs](https://www.icc-cricket.com/rankings/faqs)
- Format differences: in ODIs/T20Is batters get "significant credit for rapid scoring" and only small credit for not-outs; bowlers get significant credit for economy, "even more" in T20s; women's rankings use the same method with adjusted point scales — [MRF Tyres page](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings)
- History of the damping rule: originally a full ranking after 10 innings or 30 wickets; Narendra Hirwani's 16-wicket debut (1988) put him 4th, which triggered changes in early 1988 to slow new-player entry and add a penalty for missing matches (Carl Rackemann had stayed highly ranked while injured) — [ICC history page](https://www.icc-cricket.com/news/a-history-of-the-icc-rankings)
- Team rankings (different system, by David Kendix): points divided by match/series count, like a batting average; annual update ~1 May — [ICC rankings explained](https://www.icc-cricket.com/about/cricket/icc-rankings)
- Independent comparison: Davis-Perera-Swartz found their simulation-based E(D) correlates r = 0.56 with Reliance ICC batting ratings (pure batsmen), r = 0.61 with ICC bowling ratings, and r = −0.04 with ICC all-rounder ratings — [Davis, Perera & Swartz, Player evaluation in Twenty20 cricket (SFU preprint)](https://www.sfu.ca/~tswartz/papers/moneyball.pdf)

### Inferences
- A faithful reimplementation is: per-match score S_m ∈ [0,1000] = f(runs or wickets, opposition rating, match scoring level, result) → rating R_t = Σ w^(k) S_{t-k} / Σ w^(k) with w slightly below 1 (Eastaway's examples use 0.96 and 0.90 per match; the real constant is unpublished) → multiply by a damping factor ramping 0→0.7 at 10 innings/30 wkts → 1.0 at 40 innings/100 wkts → subtract a per-missed-match percentage.
- The circular opposition adjustment (batter credit scaled by bowler ratings and vice versa) is a fixed-point problem; Eastaway's "provisional rating" shortcut and the Misra-Rajaraman PageRank-style iteration (section 4) are two solutions to the same issue.

### Gaps
- No published source gives the actual per-match points formula, the opposition-strength scaling function, win-bonus size, or the decay constant. The ICC FAQ does not say whether the algorithm is published; all evidence indicates it is proprietary.
- Rob Eastaway's original paper (referenced in a Roar comment and the Mr Science Show podcast) was not located online.

---

## 2. Academic performance indices: Lemmer, Croucher, Barr-Kantor, Lewis, Beaudoin-Swartz

### Takeaway
The classical indices combine average and strike rate (batting) or average, strike rate and economy (bowling) via products, geometric/harmonic means, or power weightings; Lemmer adds not-out adjustment, match-relative strike-rate scaling (exponent 0.5), exponential weighting of recent innings, and wicket-quality weighting. Formulas are recoverable for Croucher, Basevi-Binoy, Barr-Kantor, CBR, and Lemmer's short-series measure; the exact BP/EWA and e26 formulas were not fully recoverable from accessible text.

### Cited Findings
**Batting**
- Croucher (2000) batting index: BI = AVE × SR, with AVE = R/out and SR = 100R/B; Basevi-Binoy CALC = R²/(out × B) = AVE × SR/100 = BI/100; Barr-Kantor criterion = AVE^(1−α) × SR^α, 0 ≤ α ≤ 1 (α = 0.5 reproduces CALC weighting; Lemmer finds the subjective α unattractive and concluded CALC weights SR too highly) — [Lemmer, JSSM 10(4):630, 2011](https://www.jssm.org/jssm-10-630.xml-Fulltext)
- Lemmer's measure for short series (2011): match strike rate MSR = 100R/B; global match strike rate GMSR = strike rate of all players in that match; relative strike rate RSR = MSR/GMSR; adjusted runs T = R × RSR^0.5 (exponent 0.5 explicit; worked example 60 × 1.24^0.5 ≈ 66.8); the final measure ET applies Lemmer's e26 not-out estimator to the T values; recommended minimum "at least eight" matches; example GMSRs: Centurion ODI 60.4, Port Elizabeth ODI 95.5 (a strike rate of 90 is adjusted by 1.22 and 0.97 respectively); r(R, MSR) = 0.57, r(R, RSR) = 0.51 — [Lemmer, JSSM 2011](https://www.jssm.org/jssm-10-630.xml-Fulltext)
- Lemmer's BP (batting performance) measure has three components: an exponentially weighted average (EWA) in which recent scores have higher weights, then adjusted up/down by consistency and by strike rate — [AJOL SAJRS listing (search summary)](https://www.ajol.info/index.php/sajrs/article/view/25876/0). The exact weights were not recoverable (abstract pages returned empty).
- Lemmer's not-out-adjusted average for Tests (secondhand description): Estimate = [ΣD + f × ΣNO] / n, where D = dismissal scores, NO = not-out scores, n = innings, and f = 2.2 − 0.01 × mean(NO) + 0.15 × proportion(NO); worked example: 66 × 2.205 = 145.5, + 213 = 358.5, / 47 = 7.63. Recommended when not-out proportion ≥ 23% (Tests) or ≥ 40% (ODIs). — [Cricketweb, Not Out Innings and Batting Averages Part III](https://www.cricketweb.net/?p=22053) (page returned 403 on direct fetch; formula from search snippet)
- Lemmer's e6 and e2 estimators bracket a "good" average estimator (e6 close to a "simple" estimator; good estimators lie between e6 and e2) — [Lemmer, JSSM 2011](https://www.jssm.org/jssm-10-630.xml-Fulltext)

**Bowling**
- Lemmer (2002) combined bowling rate: CBR = 3 / (1/A + 1/E + 1/S), the harmonic mean of bowling average A (runs per wicket), economy E (runs per over) and strike rate S (balls per wicket) — [Lemmer, SAJRS 2002 (AJOL)](https://www.ajol.info/index.php/sajrs/article/view/25839); restated in [Malhotra & Krishna, arXiv 1701.04438](https://arxiv.org/pdf/1701.04438)
- Refinement: replace W (wickets) with W* = sum of weights of wickets taken, so top-order wickets count more than tail-enders (Lemmer 2005–2007 adjusted CBR "by allocating suitable weights to the wickets dismissed") — [Bhattacharjee & Dhar, IJSS 24(2) 2024](https://www.banglajol.info/index.php/ijss/article/view/78223/51271); [AJOL search summary](https://www.ajol.info/index.php/sajrs/article/view/25839)
- Criticism: A, E, S have different units so their harmonic mean "does not seem reasonable"; Bhattacharjee & Saikia (2012) showed CBR fails an index-validity test — [Bhattacharjee & Dhar 2024](https://www.banglajol.info/index.php/ijss/article/view/78223/51271)
- Bhattacharjee & Dhar (2024) format-specific bowling measure: BPM_α = (x′)^α × (z′)^{β(1−α)}, with x′ = scaled bowling average, z′ = scaled economy rate after range/variance equalisation; "dismissal index" α fitted by minimising Kendall distance to ICC top-20 rankings gives α = 0.14 for T20 and α = 0.30 for ODI (i.e., economy dominates, more so in T20) — [Bhattacharjee & Dhar 2024](https://www.banglajol.info/index.php/ijss/article/view/78223/51271)
- ACS (UK) proposal: batting = geometric mean of average and strike rate; bowling = geometric mean of bowling average and economy — [ACS, Batting and Bowling Impact Indices (search summary)](https://acscricket.com/?p=5106)
- Malhotra & Krishna: grouping bowlers by speed (Fast >142 km/h, Fast-Medium 130–141, Medium-Fast 120–129; 62/168/55 bowlers), average and strike rate differ significantly by speed (e.g., average rises 4.51 Fast→FM, 10.50 Fast→MF; strike rate rises 11.44 and 22.94), but economy and CBR do not (CBR ANOVA F(2,282) = 0.675, p = 0.51); lower and middle order wickets/match decline with slower speed — [Malhotra & Krishna, arXiv 1701.04438](https://arxiv.org/pdf/1701.04438)

**Lewis (Duckworth/Lewis-based)**
- Lewis (2005), "Towards fairer measures of player performance in one-day cricket", JORS 56(7):804–815: proposes measures based on D/L resources so that when runs are scored/conceded and wickets taken/lost is reflected; batting and bowling become comparable on one scale; applicable to a match, series or career — [IAOR abstract](https://iaorifors.com/paper/51810)
- Lewis (2008), "Extending the range of player-performance measures in one-day cricket", JORS 59(6):729–742 — extends the 2005 measures to the longer term across series involving major nations — [IAOR abstract](https://iaorifors.com/paper/63277)

**Beaudoin & Swartz (2003)**
- Citation located: Beaudoin D, Swartz TB, "The best batsmen and bowlers in one day cricket", South African Statistical Journal 37 (2003) 203–222 — [reference list, JORS 2010](https://informahealthcare.com/doi/ref/10.1057/jors.2010.122)

### Inferences
- For a sim, the useful primitives from this literature are: (a) scale runs by match-relative scoring rate with a square-root exponent (Lemmer's T = R·RSR^0.5), (b) weight wickets by the dismissed batter's quality, (c) treat not-outs as censored rather than ignoring them, and (d) blend average/strike-rate with a format-dependent exponent (α ≈ 0.14 T20, 0.30 ODI for bowling per Bhattacharjee-Dhar).

### Gaps
- Lemmer's exact EWA weight, consistency adjustment, and the e26 estimator formula were not recoverable (AJOL abstract pages returned empty; JSSM text lost the equations).
- Lewis 2005/2008 and Beaudoin-Swartz 2003 full texts are paywalled/unavailable; only abstracts/citations were reachable, so their formulas are not recorded.

---

## 3. Bayesian / hierarchical shrinkage for small samples (Stevenson & Brewer, Boys & Philipson, Koulis et al., Swartz group)

### Takeaway
Stevenson & Brewer model a batter's effective average as μ(x) = μ₂ + (μ₁−μ₂)e^{−x/L} within an innings with hazard H(x) = 1/(μ(x)+1), censored (not-out) likelihood, log-normal/Beta priors, and later put a Gaussian process on log μ₂ across career innings; Boys & Philipson use a zero-inflated negative-binomial log-linear model with a per-player quadratic ageing curve and a hierarchical normal prior on ability. The Swartz group's T20 simulator uses Dirichlet empirical-Bayes shrinkage with prior sample size c = 60 and per-match decay r = 0.88. All give exact priors usable as defaults.

### Cited Findings
**Stevenson & Brewer (2017), Bayesian survival analysis of batsmen in Test cricket (JQAS)**
- Effective average: μ(x; μ₁, μ₂, L) = μ₂ + (μ₁ − μ₂)·exp(−x/L), constraints μ₁ ≤ μ₂, L ≤ μ₂; reparameterised μ₁ = Cμ₂, L = Dμ₂ with C, D ∈ [0,1]; hazard H(x) = 1/(μ(x)+1); likelihood for out score x: H(x)∏_{a<x}[1−H(a)]; not-out y: ∏_{a<y}[1−H(a)] — [ar5iv 1609.04078](https://ar5iv.labs.arxiv.org/html/1609.04078)
- Priors: μ₂ ~ Lognormal(median 25, σ_log = 0.75); C ~ Beta(1,2); D ~ Beta(1,5). Hierarchical (NZ openers): μ₂,i | ν, σ ~ LogNormal(ν, σ²), ν ~ U(1,100), σ ~ U(0,10); fitted by nested sampling (1000 particles, 1000 MCMC steps/iteration) — [ar5iv 1609.04078](https://ar5iv.labs.arxiv.org/html/1609.04078)
- Results: hyperparameters ν = 27.85 (+3.74/−3.55), σ = 0.54 (+0.11/−0.08); predicted next NZ opener μ₁ = 9.6, μ₂ = 27.7, L = 3.1; e.g., Steve Waugh μ₁ 13.2, μ₂ 58.5, L 3.1; Lara 15.1/61.8/6.1; Warne 5.3/21.2/1.3; headline: most players begin an innings at between a quarter and half of their eventual ability — [ar5iv 1609.04078](https://ar5iv.labs.arxiv.org/html/1609.04078); [arXiv abstract](https://arxiv.org/abs/1609.04078)

**Stevenson & Brewer (2021), Finding your feet (JRSS-C 70(2):481–506; arXiv 1908.11490)**
- μ(x,t) = [μ₂,t + (μ₁ − μ₂,t)e^{−x/L}] × ψ^{v_t} × φ^{i_t}, venue v ∈ {+1 home, 0 neutral, −1 away}, innings i ∈ {+1 first, −1 second}; only μ₂ varies by career innings t; log μ₂,t ~ GP(λ, K), K(t_j,t_k) = σ² exp(−|j−k|^α / ℓ^α), α ∈ [1,2], indexed by career innings number — [ar5iv 1908.11490](https://ar5iv.labs.arxiv.org/html/1908.11490)
- Priors: log λ ~ N(log 25, 0.75²); log σ ~ N(log 0.2, 1²); log ℓ ~ N(log 20, 1²) (innings); α ~ U(1,2); log ψ ~ N(0, 0.25²); log φ ~ N(0, 0.25²); C ~ Beta(1,2), D ~ Beta(1,5) — [ar5iv 1908.11490](https://ar5iv.labs.arxiv.org/html/1908.11490)
- Data: all players with a Test innings in the 21st century, 1018 players, 40,273 innings (Statsguru). Williamson posterior ℓ median ≈ 37 innings (95% ≈ 4.6–130); home multiplier ψ = 1.11 (0.93–1.32). Opposition strength and balls faced not modelled. — [ar5iv 1908.11490](https://ar5iv.labs.arxiv.org/html/1908.11490)
- Predictive test (LOO on each player's most recent out score, 913 players), MSE: GP 544.0; career average (SMA 100%) 589.1; SMA 25% 588.4; SMA 50% 608.2; SMA 10% 633.1; players with ≥ 50 innings: GP 785.8 vs 829.3. Mean log Bayes factor vs constant model 1.4. Comparison with ICC is qualitative only (e.g., Rohit Sharma 8th in GP vs 16th ICC; Stokes 17th vs 8th). No code release stated; an RShiny trajectory viewer exists. — [ar5iv 1908.11490](https://ar5iv.labs.arxiv.org/html/1908.11490); [RePEc record](https://ideas.repec.org/a/bla/jorssc/v70y2021i2p481-506.html)
- Earlier version (arXiv 1903.07218) used a squared-exponential kernel with priors m ~ Lognormal(log 25, 0.75²), σ ~ Exponential(10), ℓ ~ U(0,100); reports recent performance has "no significant effect" on near-future innings — [ar5iv 1903.07218](https://ar5iv.labs.arxiv.org/html/1903.07218)

**Boys & Philipson (2019), On the ranking of Test match batsmen (arXiv 1806.05496)**
- Model: X_ijk | λ_ijk ~ Po(λ_ijk) with log λ_ijk = θ_i + δ_year + f_i(age) + ζ_home/away + ν_match-innings + ξ_opposition + ω_opposition×decade; gamma random effect with Var = 1/η_i gives negative binomial marginally; not-outs treated as censored; zero-inflation component for excess ducks (~11% of innings are ducks; ~13% are not-outs); data: all Test batsmen, n = 2855 players, 141 years — [arXiv 1806.05496 PDF](https://arxiv.org/pdf/1806.05496)
- Ageing: f_i(a) = −α₂,i (a − α₁,i)², α₁ = peak age, α₂ = curvature; priors α₁,i ~ N(30, 4), α₂,i ~ LN(−3, 9) — [arXiv 1806.05496 PDF](https://arxiv.org/pdf/1806.05496)
- Hierarchical ability prior: θ_i ~ N(μ_θ, σ_θ²) with μ_θ ~ N(m_μ, s_μ²) and σ_θ² ~ IG(a_σ ≈ 3, b_σ ≈ 1); year effects δ follow a random-walk prior with σ_δ² ~ IG(2, 0.01); game-specific effects ~ N(0, 0.5²); η_i ~ LN(0,1); zero-inflation prior Beta(1, 9); fitted by MCMC — [arXiv 1806.05496 PDF](https://arxiv.org/pdf/1806.05496)
- exp(θ_i) is interpreted as expected runs per innings at peak age, at home, vs Australia, first innings; posterior peak ages "typically late twenties" (Table 2: Bradman 28.2, Smith 27.9, Sobers 27.8, Tendulkar 27.2, Kallis 28.6, Root 27.7, Sangakkara 28.9) — [arXiv 1806.05496 PDF](https://arxiv.org/pdf/1806.05496)

**Koulis, Muthukumarana & Briercliffe (2014), JQAS 10(1)**
- Batsman-specific hidden Markov model for ODI batting with a player-specific number K of hidden "form" states (expected runs per state), fitted by Gibbs sampling; also estimates availability, reliability and mean time to failure; requires explicit specification of what an out-of-form state is — [RePEc record](https://ideas.repec.org/a/bpj/jqsprt/v10y2014i1p1-13n2.html); description in [ar5iv 1903.07218](https://ar5iv.labs.arxiv.org/html/1903.07218)

**Davis, Perera & Swartz (2015), A simulator for Twenty20 cricket (SFU preprint)**
- Per-ball outcomes j ∈ {0,1,2,3,4,5,6, 7 = dismissal}; (X_iow0..7) ~ Multinomial(m_iow; p_iow0..7) for batter i, over o, wickets w; structural assumption p_iowj = τ_owj p_i70j / Σ_j τ_owj p_i70j, i.e., every batter's baseline (over 7, 0 wickets) is scaled by a common stage multiplier τ_owj; N = 384 batters → (19)(9)(7) + 384·7 = 3885 parameters; extras probability q₁ = 0.033 — [t20sim.pdf](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Shrinkage: Dirichlet(a₀..a₇) prior on baseline p_i70·; empirical-Bayes hyperparameters a_j = c × [Σ_{i,o,w} X_iowj/τ_owj] / [Σ_{i,o,w,k} X_iowk/τ_owk]; c acts as "prior sample size" (prior SD ∝ 1/√(c+1)); c = 60.0 chosen as producing realistic characteristics; more than 200 of 384 batters had faced < 40 balls — [t20sim.pdf](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Recency weighting: replace X_iowj by Σ_g r^g X_iowjg where g = games before the last game; r = 0.88 estimated by maximising the posterior — [t20sim.pdf](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Batter-vs-bowler synthesis: outcome probability for batter i₁ vs bowler i₂ = p_{i₁owj} + q_{i₂owj} − p̄_owj (additive on the probability scale; reduces to the bowler's vector if the batter is average and vice versa); home/away scaling 2(158.4)/(158.4+149.4) = 1.03 and 0.97 applied at the batter level; τ matrices estimated from adjacent-stage transition factors (over→over+1 and wicket→wicket+1), variance-weighted and smoothed — [t20sim.pdf](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)

**Ganesh (2026), simulation-based optimisation of T20 batting order / bowling plans (arXiv 2604.13861)**
- Cricsheet IPL 2008–2025 via yorkr (1,161 matches, 273,735 deliveries); outcomes {W,0,1,2,3,4,6}; per player per phase Laplace smoothing then blend p_i^φ = λ p̂_i^φ + (1−λ) p̄^φ with λ = n/(n+50) (n = player's deliveries in that phase); phases powerplay 0–5, middle 6–14, death 15–19 (0-indexed); batter and bowler profiles not combined (matchup not modelled); code at github.com/tvganesh/T20-MDP-optimisation (licence not stated) — [arXiv 2604.13861](https://arxiv.org/html/2604.13861)

**Bandyopadhyay (2026), Context-adjusted player evaluation for T20 (arXiv 2608.18020)** — shrinkage specifics
- Multiplier shrinkage γ_c = (n_c γ̂_c + κ_f)/(n_c + κ_f) with κ_f = Var(r)/(μ₀² τ_f²), τ_f² by DerSimonian-Laird; Var(r) = 2.578 (overdispersed), μ₀ = 1.2425 runs/ball; estimated κ_f from ≈ 67 (opposition-batter factor) to ≈ 1,249 (bowler-type factor); player scoring rate shrunk with pseudo-count κ_μ = 60 balls and dismissal hazard with κ_η = 40 — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)

**Empirical Bayes template (baseball, no cricket-specific source found)**
- Robinson's beta-binomial empirical Bayes: fit Beta prior on players with ≥ 500 AB (α ≈ 96.9, β ≈ 275), shrink each player toward league mean; caveat that playing time correlates with ability — [r-bloggers, Understanding empirical Bayes estimation](https://www.r-bloggers.com/2015/09/understanding-empirical-bayes-estimation-using-baseball-statistics/)

### Inferences
- Practical shrinkage defaults that appear independently across sources cluster around a prior sample size of ~40–60 balls (Swartz c = 60; Ganesh n/(n+50); Bandyopadhyay 60 for scoring, 40 for hazard). For innings-level averages, Stevenson-Brewer's Lognormal(25, 0.75) on the equilibrium average and Boys-Philipson's hierarchical normal on log-ability are the published priors.
- For a card-game sim that needs "runs per dismissal" and "runs per ball" per player: a gamma-Poisson (negative binomial) on runs with censoring for not-outs (Boys-Philipson) or a per-ball multinomial with Dirichlet shrinkage (Swartz) are the two reimplementable templates; the latter maps directly onto Cricsheet ball-by-ball data.

### Gaps
- Koulis et al. full specification (priors, number of states per player) is behind De Gruyter paywall.
- Stevenson's PhD thesis (Auckland, handle 2292/57434), which reportedly adds bowling career trajectories, form and contextual variables, and a match simulator, could not be fetched (page rendered empty).
- No cricket-specific empirical-Bayes paper for batting averages (beta/gamma priors) was found; the baseball template is the closest.

---

## 4. Context-adjusted / impact metrics (CricViz, Smart Stats, Impact Index, expected run differential, Delta, RAE/DAR)

### Takeaway
Proprietary systems (CricViz Match Impact, ESPNcricinfo Smart Stats/Luck Index, Impact Index) are documented only qualitatively; the reimplementable academic equivalents are Davis-Perera-Swartz's simulation-based expected run differential, Misra-Rajaraman's par-score Delta (with PageRank-style opposition adjustment) and Bandyopadhyay's RAE/DAR decomposition — all of which value each ball in runs against an expectation conditioned on state (balls left, wickets, phase, opposition).

### Cited Findings
**CricViz Match Impact**
- Defined by Freddie Wilde as "how much better or worse a player has performed compared to the expected performance of an average player appearing in the same position in the same match"; Test results expressed per over (McGrath +2.3 runs/over among ≥1,000 overs this century; Muralitharan +1.6/over but highest cumulative); explicitly "not illustrative of who the 'best' player is" — [Wisden, CricViz rates Murali MVP](https://www.wisden.com/cricket-news/cricviz-analysis-rates-murali-as-test-crickets-mvp-of-the-21st-century)
- T20 version: forecasts an expected total after every ball using current score, host country and venue; each ball's change in expected total is credited to batter, bowler and (where relevant) fielder; reported per match (e.g., Ben Dunk +8.00 batting impact/match, Naseem Shah +11 bowling impact/match, PSL 2020) — [Wisden, CricViz PSL 2020 team of the season](https://www.wisden.com/cricket-news/cricviz-analysis-psl-2020-team-of-the-season)

**ESPNcricinfo Superstats (Smart Stats, Luck Index, Forecaster; with IIT Madras / Gyan Data, 2019)**
- Each ball receives a pressure-index value for batter and bowler based on: batter and bowler identity, required run rate and wickets in hand, quality of batters to come, quality of bowlers who will bowl the remaining overs; runs scored/conceded are multiplied by that value → Smart Runs / Smart Runs Conceded; Smart Wickets value a wicket by batter quality, timing in innings and match situation; Smart SR = smart runs / balls; Smart ER = smart runs conceded / overs; Player Impact combines batting and bowling with wickets converted to runs (negative values possible; fielding excluded) — [ESPN, Superstats launch](https://www.espn.com/cricket/story/_/id/26312449)
- Luck Index: defines lucky events (drops, umpiring errors), identifies the beneficiary, values each event by constructing a counterfactual continuation of the innings; a dropped catch is costed by runs the batter added after the drop, adjusted for scoring rate vs conditions — [ESPNcricinfo stats editor talk (search summary)](https://scivideos.org/node/31353)

**Impact Index (Jaideep Varma, HoldingWilley; conceived March 2009, unveiled July 2009 at ICC Centenary Conference)**
- Measures each player relative to the other 21 players in the match; career assessment weights performances that affect series/tournament results — [Wikipedia, Impact Index](https://en.wikipedia.org/wiki/Impact_Index)
- Each match gets a "base figure" in runs from the match context; each performance is a ratio against that base, capped at 5 in career context; then weighted by the match's importance to the series; inputs "based entirely on the scorecard" — [Analytics India Magazine interview](https://www.analyticsindiamag.com/talk-impact-index-applying-analytics-cricket/); [Man's World India](https://www.mansworldindia.com/sports/vital-statistics-impact-index-jaideep-varma-cricket-analytics-system)

**Davis, Perera & Swartz — expected run differential (Journal of Sports Analytics 1(1), 2015; DOI 10.3233/JSA-150002)**
- E(D_s(l)) = E(R_s(l)) − E(R_s(t_bat)) (runs scored by lineup l vs typical lineup); E(D_c(l)) = E(R_c(l)) − E(R_c(t_bowl)); player metric E(D(i)) = E(D_s(l_bat,i)) − E(D_c(l_bowl,i)), i.e., insert player i into a typical lineup and simulate. Typical batting lineup = position-wise weighted average of characteristics across 448 batsmen; typical bowling lineup = five identical average bowlers (306 bowlers) each bowling 4 overs; bowler i's 4 overs drawn uniformly from the 20. — [moneyball.pdf](https://www.sfu.ca/~tswartz/papers/moneyball.pdf)
- Data: proprietary parser on ESPNcricinfo commentary, 282 full-member T20 matches Jan 2005–Aug 2014, 35,356 first-innings balls (single = 41.1%; 3s = 0.6%; 5s = 0.2%) — [moneyball.pdf](https://www.sfu.ca/~tswartz/papers/moneyball.pdf)
- Results: best pure batsman Ahmed Shehzad E(D) = 7.83; Chris Mpofu −11.45 (bowling); no pure batsman far below 0 (selection effect); best players contribute ~8–10 runs; career vs current-form E(D) correlations 0.77 (batsmen), 0.91 (bowlers), 0.68 (all-rounders) — [moneyball.pdf](https://www.sfu.ca/~tswartz/papers/moneyball.pdf); [IOS Press record](https://content.iospress.com/articles/journal-of-sports-analytics/jsa0002)

**Misra & Rajaraman (2026), Delta (Columbia / SF Unicorns)**
- Projected total T_k = s_k + g(120 − b_k, 10 − w_k); δ_bat = T_k − T_{k−1}, δ_bowl = −δ_bat (sum to zero per ball); match delta Δ_p = Σ δ_k; par-score g(b,w) = empirical mean of (final total − current score) over all first-innings observations of state (b,w) in IPL 2022–2025 (292 innings, ≈35,000 deliveries); sanity values g(120,10) = 183.2, g(60,7) = 96.8, g(24,4) = 40.4, g(6,3) = 11.3 — [delta-2026.pdf](https://www.cs.columbia.edu/~misra/delta-2026.pdf)
- Opposition adjustment: δ_p^k = T_k − T_{k−1} + δ̄_bowl,p and δ_q^k = T_{k−1} − T_k + δ̄_bat,q, where the bars are per-player average per-ball deltas, iterated to a fixpoint; in matrix form (x,y)^{(t+1)} = c + [[0,A],[B,0]](x,y)^{(t)} with A_pq = share of bowler p's balls to batter q; converges when spectral radius < 1; empirically stabilised within 0.07 runs/ball — [delta-2026.pdf](https://www.cs.columbia.edu/~misra/delta-2026.pdf)
- Invariance: ball delta is unchanged under g′ = g + c; phase split PP overs 1–6, middle 7–15, death 16–20; cohort minimum 10 matches and 200 balls faced; CI = Δ̄ ± 1.96·SD/√N; Spearman between all-innings and first-innings-only averages 0.44 (batters), 0.65 (bowlers); breakout bowlers regress sharply year-over-year; authors state the framework is reproducible end-to-end from Cricsheet, which they describe as "a free-to-use license" — [delta-2026.pdf](https://www.cs.columbia.edu/~misra/delta-2026.pdf)

**Bandyopadhyay (2026), RAE + DAR = Impact (arXiv 2608.18020, CC BY 4.0 paper)**
- Expected runs per legal ball: μ(x) = μ₀ γ^scen γ^era γ^wkt γ^type γ^ven γ^opp with factors: phase×innings, year×phase, phase×wickets(0–10), phase×bowler sub-type, ground×3-year bucket, opposition identity; μ₀ = 1.2425; fitted by iterated backfitting with cell ratio γ̂_c = Σ r_b / Σ e_b (conditional Poisson MLE), then empirical-Bayes shrunk toward 1 (see section 3); RAE_b = r_b − μ̂(x_b) — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)
- Dismissal-adjusted runs: value function V_e(m, w, i, j) over balls remaining, wickets, striker tier, non-striker tier (6 quality tiers by shrunk scoring rate), solved by a single backward Bellman expectation pass; wicket cost c(s) = [V_e(m,w,i,j) − V_e(m−1,w−1,ι(w),j) + δ_fresh]_+; DAR = Σ_b (W_b − h̄_{φ,e}) c(s_b) (mean-zero martingale residual); Impact_bat = Σ RAE − DAR_bat, Impact_bowl = −Σ RAE + DAR_bowl, both in runs — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)
- Data: 12,492 matches, 2,727,420 legal deliveries, 19 competitions, Feb 2005–May 2026, baseline tier "derived from public Cricsheet repositories" (+ ~17% with ball-tracking); death overs ≈ +18.8% above base (innings 1), powerplay 0–4% below; mean wicket cost ≈ 2.65 runs; RAE/ball correlates 0.82 with strike rate, −0.68 with economy; bowler DAR/ball correlates only 0.09 with runs saved; leaderboard cut-offs 300 balls (bowlers), 150 balls (batting seasons); author says cleaned data and Python code will be released on GitHub (licence unstated); the Regulus platform is proprietary — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)

### Inferences
- All three reimplementable approaches reduce to: build an expectation function of state (and optionally opposition), credit each ball's residual to batter (+) and bowler (−), shrink per-player averages. The Delta par-score table is the simplest (2D lookup), RAE/DAR the most complete (opposition, venue, era, phase, wicket cost), and E(D) the most expensive (full simulation per player).
- The weak correlation (0.09) between wicket-taking value and run-saving value in Bandyopadhyay's data supports keeping "strike" and "economy" as separate bowler skill parameters in a sim rather than one composite.

### Gaps
- CricViz, Smart Stats and Impact Index publish no formulas; the Smart Stats FAQ page (espncricinfo.com/ci/content/story/1178276.html) was not fetched. No numeric scale for the pressure index or for Impact Index's base figure was found.

---

## 5. Elo / Glicko / Bradley-Terry applied to cricket

### Takeaway
Peer-reviewed Bradley-Terry work exists at match level (Dewart & Gillard 2019, teams and players); a 2026 preprint adapts Glicko with margin of victory for Test teams; ball-level batter-vs-bowler Elo exists only as a hobby prototype (CricHub) with outcome-specific K-factors. No peer-reviewed per-ball Bradley-Terry batter-vs-bowler model was found.

### Cited Findings
- Dewart & Gillard (2019), IMA Journal of Management Mathematics 30(2):187–207, DOI 10.1093/imaman/dpx013: Bradley-Terry models for Test cricket producing a team ranking compared with the ICC's, match forecasts that "perform well compared to bookmaker predictions", and ratings of individual players used to predict recent results — [Cardiff ORCA record](https://orca.cardiff.ac.uk/107993/) (full text returned 403)
- Olesker-Taylor & Zanetti: under Bradley-Terry-Luce, P(i beats j) = w_i/(w_i + w_j); Elo learns the parameters at a rate competitive with the state of the art — [arXiv 1701.08055](https://arxiv.org/abs/1701.08055v1)
- 2026 preprint adapting Glicko to Test cricket with a margin-of-victory component, recalibrated scaling factor, home-ground and toss effects; team-level only — [arXiv 2603.02574](https://arxiv.org/html/2603.02574v1)
- ODI team Elo (Sportskeeda): start 1500, K = 16 (K = 24 "very similar"), ten full-member teams, no importance or margin adjustment — [Sportskeeda ODI upsets by Elo](https://sportskeeda.com/cricket/analysing-the-biggest-odi-upsets-by-elo-rating)
- CricHub per-ball Elo prototype: E_A = 1/(1 + 10^{(R_B − R_A)/400}); R′ = R + K(S − E); each run = win for batter / loss for bowler; dots and wickets = win for bowler / loss for batter; K-factors — wicket: batter 0.7, bowler 10; 1–3 runs: batter 2, bowler 0.08; boundaries: batter 3, bowler 0.1; dot: batter 0.06, bowler 0.4; no licence stated; author calls it a prototype — [CricHub Rating System docs](https://crichub.readthedocs.io/en/latest/Rating%20System.html)
- Independent team-rating project (Cricketweb): full weight for the previous 12 months, then monthly decay over the following 48 months at a rate of 0.97153194 — [Cricketweb, Should We Discount the Golden Oldies?](https://www.cricketweb.net/?p=22443)

### Inferences
- A per-ball pairwise model is most naturally an ordinal/multinomial extension of Bradley-Terry (batter strength minus bowler strength on a logit scale per outcome category), which is structurally what Bandyopadhyay's multiplicative opposition factors and Swartz's additive p + q − p̄ synthesis approximate. The CricHub K-factors are not validated and should be treated as a design sketch only.

### Gaps
- No academic paper estimating per-delivery batter-vs-bowler Bradley-Terry/Elo strengths was found; Dewart & Gillard's player-rating construction details (what counts as a contest, draw handling, time decay) are in the paywalled/403 PDF.

---

## 6. Batter-vs-bowler-type and phase interactions (pace vs spin, length/line, powerplay/middle/death)

### Takeaway
Phase-specific player parameters are standard in the T20 simulation literature (Swartz τ_owj by over×wicket; Ganesh per-phase vectors; Bandyopadhyay phase×bowler-type multipliers; Misra-Rajaraman phase-conditioned Delta). Pace-vs-spin batter skill is handled either as an opposition-type multiplier or left unmodelled because matchup cells are sparse; dedicated academic estimates of per-batter pace/spin skill were not found.

### Cited Findings
- Swartz simulator: stage multipliers τ_owj over 20 overs × 10 wicket states × 8 outcomes, with the explicit interaction (a batter is more aggressive in the 19th over with 2 wickets down than with 9); powerplay (first 6 overs) shows a visible drop in 4s afterwards; first two overs are an adjustment period — [t20sim.pdf](https://www.sfu.ca/~tswartz/papers/t20sim.pdf)
- Ganesh (2026): per-player per-phase outcome vectors with n/(n+50) shrinkage; batter×bowler matchups "not modelled here due to the sparsity of matchup-level data across phases"; suggests tensor decomposition over (bowler, batter, phase) — [arXiv 2604.13861](https://arxiv.org/html/2604.13861)
- Bandyopadhyay (2026): bowler-type × phase multipliers, e.g., leg-spin 1.056 in the powerplay vs 0.950 at the death; right-arm pace 1.016 (PP) → 1.033 (death); era × phase multipliers (2026 powerplay 1.137); opposition identity multiplier applied to the opponent's expectation — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)
- Misra & Rajaraman: phase-conditioned Delta separates roles — Kohli "near-pure powerplay accumulator", Klaasen middle-overs specialist, Stubbs death-overs finisher — [delta-2026.pdf](https://www.cs.columbia.edu/~misra/delta-2026.pdf)
- Malhotra & Krishna: bowling speed category affects average/strike rate but not economy/CBR; lower- and middle-order batters are more vulnerable to faster bowling (wickets/match differences significant) — [arXiv 1701.04438](https://arxiv.org/pdf/1701.04438)
- Blog analyses: a Gini-type "selection strength" over line-length cells correlates with batting average 0.40 vs pace and 0.52 vs spin — [Arnav J, Selectivity, Bazball and Kohli](https://arnavj.substack.com/p/selectivity-bazball-and-kohli); Jarrod Kimber's Good Areas piece on batters strong vs one type (paywalled) — [Good Areas](https://www.goodareas.co/p/who-hits-pace-and-spin-or-both-in)
- Misra (2026) within-batter fixed-effects design on 281,256 IPL deliveries, outcomes strike rate and dismissal hazard (linear models) — [set-batter-2026.pdf (search summary)](https://www.cs.columbia.edu/%7Emisra/set-batter-2026.pdf)
- 2021 study of 96 bowlers at the 2019 World Cup: wicket-taking death bowlers likely peak between 25–31 — [Univ. of Suffolk OARS](https://oars.uos.ac.uk/1916)

### Inferences
- A sim can carry per-player phase vectors (PP/middle/death) with ~50-ball shrinkage, plus a global bowler-type × phase multiplier (values above) rather than per-batter pace/spin skills, unless the player has several hundred balls against each type.

### Gaps
- No peer-reviewed paper estimating per-batter pace vs spin (or length/line) skill with shrinkage was located; practitioner work (CricViz, Weston) is proprietary or paywalled.

---

## 7. Ageing curves

### Takeaway
Across Test (Bayesian, 1877–2017), ODI (econometric, 1971–2000) and ICC-rating-peak analyses, batters peak in the late twenties (≈27–30) and bowlers earlier (≈22–26 in ODIs by wickets; ICC-rating peaks ≈29 for pace and ≈30.5 for spin); a practitioner rule of thumb is 28–31. Decline magnitudes are rarely quantified.

### Cited Findings
- Boys & Philipson: quadratic ageing f_i(a) = −α₂(a − α₁)²; posterior peak ages "typically late twenties" (Table 2 examples 27.0–29.6; Bradman 28.2, Smith 27.9, Tendulkar 27.2, Steve Waugh 29.6); prior α₁ ~ N(30,4) — [arXiv 1806.05496](https://arxiv.org/pdf/1806.05496)
- Frontiers in Behavioral Economics (2024), ODIs 1971–2000, 210 players (>25 matches, ≥5-year careers), 22,114 player-match observations: regression on Age, Age² with country/opponent/year dummies, workload, balls faced/overs, bowler type, all-rounder status, plus player fixed effects; peak 27–30 for batters (runs), 22–26 for bowlers (wickets); strike rate peaks ~30; implied peaks from coefficients (−b₁/2b₂) ≈ 29.3/29.2/27.0 (batters) and 25.4/25.8/22.2 (bowlers); fast-bowler dummy insignificant; cites a "thirty-three effect" (decline at 32–34 for several greats, Santhanam & Balasubramanian 2009) without testing it; no CIs or decline magnitudes reported — [Frontiers 10.3389/frbhe.2024.1492735](https://www.frontiersin.org/journals/behavioral-economics/articles/10.3389/frbhe.2024.1492735/full)
- ICC analysis of when players reached their highest Test rating: all 529 batsmen average 29 years 9 months; pace bowlers 29 years 2 months; spinners 30 years 6 months — [ICC, Reliance Mobile ICC Player Rankings](https://www.icc-cricket.com/news/reliance-mobile-icc-player-rankings)
- Stevenson & Brewer: age is not a model term; Williamson's posterior peak after ~60th innings (recently turned 30); Hussey (debut at 30) showed little "finding your feet" effect — [ar5iv 1908.11490](https://ar5iv.labs.arxiv.org/html/1908.11490)
- Dan Weston (Kent Senior Data Analyst): "the average player peaks between the ages of 28–31", varying by format and role — [Dan's Newsletter, Aug 2022](https://danweston.substack.com/p/whats-gone-wrong-with-england)

### Inferences
- A workable default ageing multiplier is quadratic in age with peak ≈ 28–29 (batters) and ≈ 26–29 (bowlers, earlier for pace), with the Boys-Philipson prior (curvature LN(−3, 9), i.e., median α₂ = e^{−3} ≈ 0.05 runs-log per year²) as the published scale; the ICC-peak data are confounded by rating lag and selection.

### Gaps
- No published age-performance curve from Cricsheet T20 data was found; Weston's curves are unpublished/paywalled. No source quantifies post-peak decline per year in runs or strike rate.

---

## 8. Form and recency weighting

### Takeaway
Published recency constants: ICC uses an unpublished exponential decay (Eastaway's illustrations use 0.96 and 0.90 per match); Swartz's simulator estimated r = 0.88 per match; a Cricketweb team system uses 12 months full weight then ×0.9715/month; Lemmer's BP uses an EWA. Evidence from Stevenson-Brewer and Davis-Perera-Swartz is that genuine form effects are small relative to career ability.

### Cited Findings
- ICC: more emphasis on recent performances; "sophisticated moving average"; missed-match decay 1%/0.5%/2% per match (Test/ODI/T20I) — [ICC FAQs](https://www.icc-cricket.com/rankings/faqs); [MRF Tyres page](https://www.icc-cricket.com/news/mrf-tyres-icc-player-rankings)
- Eastaway's decayed average illustration: 4% per innings (×0.96) — [Plus Magazine](https://plus.maths.org/howzat)
- Swartz group: per-match decay ratio r = 0.88 (posterior-maximised); career vs current-form E(D) correlation 0.77/0.91/0.68 — [t20sim.pdf](https://www.sfu.ca/~tswartz/papers/t20sim.pdf); [moneyball.pdf](https://www.sfu.ca/~tswartz/papers/moneyball.pdf)
- Stevenson & Brewer: short-term form enters only via GP covariance; "little evidence for strong short-term form effects for most players"; in LOO prediction, 25% recent-window averages (MSE 588.4) barely beat the career average (589.1), and 10% windows are worse (633.1) — [ar5iv 1908.11490](https://ar5iv.labs.arxiv.org/html/1908.11490); earlier paper reports recent performance has no significant effect on near-future innings — [ar5iv 1903.07218](https://ar5iv.labs.arxiv.org/html/1903.07218)
- Lemmer's BP uses an exponentially weighted average favouring recent scores — [AJOL SAJRS (search summary)](https://www.ajol.info/index.php/sajrs/article/view/25876/0)
- Cricketweb team ratings: previous 12 months full weight, then monthly decay 0.97153194 over 48 months — [Cricketweb](https://www.cricketweb.net/?p=22443)
- Misra & Rajaraman: breakout bowlers show "sharp regression" the season after a breakout (e.g., one bowler −60 → +85 → sharp drop) — [delta-2026.pdf](https://www.cs.columbia.edu/~misra/delta-2026.pdf)

### Inferences
- For a sim, a per-match decay of ~0.88–0.96 is the published range; the Bayesian evidence suggests keeping form as a small perturbation on a heavily-shrunk career ability rather than a large driver.

### Gaps
- The ICC's actual decay constant is unpublished.

---

## 9. Clustering players into archetypes from ball-by-ball data

### Takeaway
Several analyses k-means-cluster batters on ball-outcome shares (dot/1/2/4/6/out %) or tempo/consistency features, typically with 4–6 clusters and minimum-sample thresholds of 50–1,000 balls, yielding labels like accumulator, anchor/steady opener, power hitter/"man-beast", finisher, rotator.

### Cited Findings
- Criconometrics: k-means on each batter's outcome distribution (dots, singles, twos, fours, sixes, outs); IPL threshold ≥ 750 balls, ODI ≥ 1,000 balls in the last five years; k = 6 chosen for interpretability; IPL clusters: hard-hitting openers, steady openers, classicists, collectors, finishers, man-beasts; ODI clusters: pinch hitters, steady openers, hitters, accumulators, classicists, rotators; sub-threshold batters classified with the trained model — [Criconometrics, Balanced Lineups](https://criconometrics.substack.com/p/balanced-lineups)
- NHSJS 2026 IPL study: ~240,000 deliveries 2008–2023, 19 batting features (tempo, consistency, boundary frequency, dot-ball %), PCA then k-means, four archetypes (low baseline contributors, stable accumulators, explosive accelerators, solid contributors), player-seasons with ≥ 50 balls; team win% regression R² = 0.143 — [NHSJS, Batting Archetypes and Team Success](https://nhsjs.com/2026/batting-archetypes-and-team-success-analyzing-the-role-composition-of-teams-in-indian-premier-league-using-machine-learning/)
- Towards Data Science tutorial: IPL 2008–2020 player-level features (min 10 innings) comparing k-means, hierarchical and DBSCAN — [TDS](https://towardsdatascience.com/?p=154193)
- Kingston University: cluster T20I players, Random Forest to find separating features, PCA to form a role-based indicator — [Kingston research record](https://researchinnovation.kingston.ac.uk/en/publications/a-machine-learning-based-approach-to-analyse-player-performance-i-3/)
- Stats Perform: clusters batters by innings-progression (how scoring rate changes through an innings) using ODI data — [Stats Perform (page returned 403; from search summary)](https://www.statsperform.com/resource/identifying-batsman-archetypes/)
- Bandyopadhyay groups batters into 6 quality tiers by shrunk scoring rate for the value function — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)

### Inferences
- Outcome-share vectors are also exactly the multinomial parameters a per-ball sim needs, so clustering on them doubles as a way to assign archetype priors (cluster centroid as the shrinkage target instead of the global mean).

### Gaps
- None of the sources publish per-cluster centroid values (dot %, boundary %, dismissal %); those were in images not retrievable.

---

## 10. Practical Cricsheet-based derivations of per-player simulation parameters

### Takeaway
Open code that derives per-player parameters from Cricsheet exists (yorkr in R; the-archer/cricket-simulator in Python, AGPL-3.0; tvganesh/T20-MDP-optimisation), and two 2026 papers (Delta; RAE/DAR) are explicitly reproducible from Cricsheet; the most reimplementable published pipelines are Ganesh's per-phase multinomial with n/(n+50) shrinkage and Bandyopadhyay's backfitted multiplicative model.

### Cited Findings
- yorkr (CRAN, GitHub tvganesh/yorkr): analyses Cricsheet YAML/JSON for players and teams — [rdrr.io yorkr](https://rdrr.io/cran/yorkr)
- the-archer/cricket-simulator: Cricsheet ODI JSON → ball-by-ball CSV + player batting/bowling averages and strike rates → random-forest per-ball outcome classifier → match simulator; Python; AGPL-3.0 — [GitHub the-archer/cricket-simulator](https://github.com/the-archer/cricket-simulator); [Medium write-up](https://medium.com/@tejalnarkar/cricket-simulation-engine-using-machine-learning-a2758933b0a7)
- Ganesh (2026): Cricsheet IPL via yorkr; per-phase Laplace-smoothed outcome vectors blended with phase mean using λ = n/(n+50); Monte Carlo SE ≤ 0.22% at 50,000 sims; code at github.com/tvganesh/T20-MDP-optimisation (licence not stated); Cricsheet credited as Creative Commons Attribution — [arXiv 2604.13861](https://arxiv.org/html/2604.13861)
- Misra & Rajaraman: all required fields (match id, innings, over/ball, runs split legal/extras, wicket flag/type, striker, bowler, teams) are in Cricsheet; framework "reproducible end-to-end from public data" — [delta-2026.pdf](https://www.cs.columbia.edu/~misra/delta-2026.pdf)
- Bandyopadhyay: baseline tier derived from Cricsheet; code and cleaned data promised on GitHub — [arXiv 2608.18020](https://arxiv.org/html/2608.18020v2)
- CricCatapult (Python toolkit): Cricsheet download, batter/bowler feature extraction, match prediction (claims 58.5% accuracy; documentation examples inconsistent) — [CricCatapult docs](https://criccatapult.readthedocs.io/en/latest/)
- ODI howstat scrape + code: github.com/sadekar-onkar/cricket_public (run-inflation normalisation nf = ⟨team runs⟩_all / ⟨team runs⟩_year) — [arXiv 2401.15161](https://arxiv.org/html/2401.15161v2)
- Pinch Hitter Cricsim (forum): ratings from career stats, traits and form; not Cricsheet-based — [PlanetCricket forum](https://www.planetcricket.org/forums/threads/pinch-hitter-cricsim-ai-is-crazy-version-3-6.122832/latest)

### Inferences
- A minimal reproducible pipeline from the sources: (1) from Cricsheet, count per player × phase outcomes {W,0,1,2,3,4,6}; (2) shrink to phase (or archetype-cluster) means with pseudo-count ≈ 50–60; (3) apply bowler-type × phase and era multipliers (Bandyopadhyay values) and an opposition factor; (4) combine batter and bowler via p + q − p̄ (Swartz) or multiplicative γ_opp (Bandyopadhyay); (5) optionally weight matches by r^g with r ≈ 0.88; (6) apply an age multiplier with a quadratic peak near 28–29.

### Gaps
- No source was found that publishes a complete, validated set of per-player ratings derived from Cricsheet with out-of-sample reliability (season-to-season correlation) statistics; Delta reports only a first-innings-vs-all Spearman (0.44 batters, 0.65 bowlers) and Bandyopadhyay reports no stability tests.
