/**
 * Ratings model constants and shared types (design spec §5, Phase 1).
 *
 * Ratings are per-ball outcome vectors, not scalars. The scalar display rating is derived from
 * the vectors so the engine and the draft screen never disagree.
 */

import type { OutcomeKey, Phase } from "../cricsheet/match.js";

export const OUTCOMES: OutcomeKey[] = ["0", "1", "2", "3", "4", "6", "W"];
export const RUNS: Record<OutcomeKey, number> = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "6": 6, W: 0 };
export const PHASE_LIST: Phase[] = ["pp", "mid", "death"];

export const MODEL = {
  /**
   * Evidence path (Phase 1.5, 2026-10-28). `expected`: every ball is compared with what an average
   * player would have done in that ball's context (period × opponent strength × phase, plus the
   * ground's scoring factor for bowling), so career, form and tournament blocks are all
   * context-neutral before any shrinkage. `window`: the Phase 1 path (window populations by tier /
   * Elo bin / two-way table), kept for comparison in the validation sweep.
   */
  evidence: "expected" as "expected" | "window",
  /**
   * Dirichlet prior strength in pseudo-balls for the form window over the career centre (the
   * literature's 40–60 is for a raw rate; the context-neutral ratios tolerate a stronger prior —
   * the sweep preferred 100 over 50 on both prediction and stability).
   */
  priorStrength: 100,
  /** Pseudo-balls of weight given to the T20I career-to-date block as the level-1 prior. */
  careerPriorStrength: 50,
  /** The career-anchored prior's strength over the form window grows with career balls (×0.5), up to this cap. */
  careerPriorCap: 300 as number,
  /** Bowling priors are this many times stronger than batting priors (set by the validation sweep). */
  bowlPriorMultiplier: 2 as number,
  /**
   * Window-averaged venue normalisation of form (the Phase 1 version): 1 = divide scoring outcomes
   * by the exposure-weighted venue factor; 0 = off. Superseded by the per-ball ground factor inside
   * the context expectation (`CONTEXT_VENUE` in the build), which the sweep keeps for bowling only:
   * it raised bowling prediction (0.167 → 0.175) and lowered batting (0.311 → 0.306).
   */
  venueNormalisation: 0 as number,
  /** Pseudo-balls of weight given to the ODI-derived prior when T20 evidence is thin (2007/2009); scaled by ODI balls ÷ odiFullBalls. */
  odiPriorStrength: 30,
  /** ODI balls at which the ODI prior carries its full weight; it is usable from odiMinBalls (decided 2026-10-30: 2007/2009 bowlers' batting). */
  odiFullBalls: 300,
  odiMinBalls: 120,
  /**
   * Domestic T20 backup (decided 2026-10-30): the career-to-date relative vector from the league
   * archives, shrunk toward neutral with `priorStrength` balls and raised to `transfer` (only part
   * of a domestic edge carries to internationals), is the prior centre under the T20I career. Plenty
   * of T20I evidence swamps it; a bowler who has faced 30 T20I balls but 800 in the IPL gets his IPL
   * batting. `shownBalls` is the evidence at which a skill is displayed at all, counted over the
   * last RECENT_SEASONS league seasons only (Kohli's 2008–13 IPL overs do not make him a bowler in
   * 2024); `liftBalls` lifts the low-sample badge like the ODI prior does.
   */
  domestic: { priorStrength: 100, transfer: 0.7, shownBalls: { bat: 150, bowl: 180 }, liftBalls: { bat: 300, bowl: 360 } },
  /**
   * A skill is shown on a card when the window, the career, the recent domestic record or the ODI
   * record clears these (decided 2026-10-30: no bowling numbers for batters who rarely bowl, and
   * vice versa). The ODI record vouches for batting in every edition (a bowler's batting does not
   * go away) but for bowling only in `odiBowlEditions`, the editions before the league archives
   * are deep enough; later, a lifetime of occasional ODI overs (Kohli's 662 balls) does not make a
   * bowler.
   */
  shown: { formBalls: { bat: 60, bowl: 96 }, careerBalls: { bat: 120, bowl: 180 }, odiBalls: { bat: 120, bowl: 240 }, odiBowlEditions: ["2007", "2009"] as readonly string[] },
  /** Runs a wicket costs a batting side in T20, from the expected-runs literature (≈2.4–3.1 by over band). */
  wicketCost: 2.6 as number,
  /**
   * Prior strength for the dismissal cell alone. Dismissal rates barely stabilise at World Cup
   * sample sizes (validation: r ≈ 0.09 for any estimator), so they are shrunk far harder than
   * scoring outcomes. Baseball's BABIP needs ~800 balls in play to reach r = 0.7.
   */
  hazardPriorStrength: 2000 as number,
  /** Hierarchical phase model: how strongly each phase is held to the player's pooled vector. */
  phasePriorStrength: 300 as number,
  /**
   * Edge transfer: a player's edge over their own tier against opposition of mean Elo E_own is
   * raised to the power max(0.1, 1 − (E_dest − E_own)/transferScaleElo) when carried to stronger
   * opposition. Measured 2026-10-28: for players with ≥120 balls against both associate and
   * full-member attacks, the slope of log(edge vs strong) on log(edge vs weak) was ≈ 0.14
   * (n = 44), i.e. an edge earned ~250 Elo below barely transfers; 300 puts ≈0.17 at that gap.
   * 0 disables (full transfer).
   */
  transferScaleElo: 300 as number,
  /**
   * Winner's-curse guard for the display scalar only: the value is multiplied by n/(n + c)
   * before ranking, so a thin sample cannot top the list on noise. Engine vectors are unaffected.
   */
  displayEvidenceStrength: 100 as number,
  /** Phase weights for the headline scalar: population share of balls by phase in a 20-over innings. */
  phaseWeights: { pp: 0.3, mid: 0.45, death: 0.25 } as Record<Phase, number>,
  /**
   * Headline phase weighting (spec §5.6, 2026-10-30). `own`: the player's own phase exposure
   * (form + career balls, with the population weights as a `phaseWeightPrior`-ball prior), so a
   * finisher is valued over the death overs he bats in and a new-ball bowler over the powerplay.
   * `population`: the fixed weights above (the Phase 1 headline).
   */
  phaseWeighting: "own" as "own" | "population",
  phaseWeightPrior: 60,
  /** Display scale (decided 2026-10-28). */
  display: { min: 40, max: 99 },
  /** Low-sample badge thresholds (decided 2026-10-28). */
  badge: { batBalls: 60, bowlBalls: 72 },
  /** Tournament Form: era-locked bonus, capped, gated by minimum tournament balls. */
  tournamentForm: { capPoints: 5, minBatBalls: 30, minBowlBalls: 48, pointsPerValueUnit: 0.5 },
  /** Timeless: top decile in ≥ 3 editions spanning ≥ 8 years (candidate list; Yash curates). */
  timeless: { topFraction: 0.1, minEditions: 3, minSpanYears: 8 },
  /** Positionless tag: inter-quartile batting position span of at least this many places. */
  positionlessSpan: 3,
  /**
   * Usage / selection (Phase 1.5). `selectionWeight` w: a player picked for share s of the team's
   * form-window matches, rating above the team median by d, loses w·(1−s)·d of value (one-sided:
   * not being picked is evidence against a high rating, not for one). Set by the validation sweep.
   * Squad Player tag: tournament share below `squadPlayerShare`.
   */
  usage: { selectionWeight: 0 as number, selectionMaxShare: 1 as number, minTeamMatches: 5, squadPlayerShare: 0.25, minTournamentTeamMatches: 4 },
  /**
   * Cohort centring (Phase 1.5): relative vectors are re-expressed against the evidence-weighted
   * mean of the squads of the edition's `teams` strongest sides, because the context expectation's
   * reference (the average T20I player of the period) weakened as the pool grew and inflated the
   * later editions (mean batting value 11 in 2026 vs ≈2 before 2022; twelve 99s).
   */
  cohort: { centre: "top10" as "none" | "top10" | "all", teams: 10 },
  /**
   * Shape the transport destination by team tier on the context-expected path (see RateOptions).
   * Sweep 2026-10-28: within-edition batting prediction 0.32 with it vs 0.28 without; the extra
   * tier gap is empirically earned even though it looks like double counting.
   */
  tierDestination: true as boolean,
  /** Opposition the edge-transfer gap is measured to (see RateOptions). Sweep: strongest third 0.283 vs mix 0.266 (batting within-edition). */
  transferDestination: "topThird" as "mix" | "topThird",
} as const;

export type Vector = Record<OutcomeKey, number>;
export type PhaseVectors = Record<Phase, Vector>;

/**
 * The populations the engine needs per edition: the value populations the rating vectors live in
 * (window population projected onto the edition's opponent mix, batting and bowling) and the
 * edition's realised population. Defined here, away from the Node-only rating pipeline, so the
 * browser client can import the type.
 */
export interface EditionPopulations {
  editionId: string;
  valuePop: Record<"bat" | "bowl", PhaseVectors>;
  editionPop: PhaseVectors;
  editionBowlPop: PhaseVectors;
}

export const TIERS = ["Bronze", "Silver", "Gold", "Elite"] as const;
export type Tier = (typeof TIERS)[number];

/** `data/config/tiers.json` (spec §5.6). */
export interface TierConfig {
  /** Percentile thresholds on the tier score (Elite = top 8% of the skill at 0.92): the rarity dial. */
  thresholds: { elite: number; gold: number; silver: number };
  allRoundBonus: number;
  caps: { lowSample: Tier; thin: { batBalls: number; bowlBalls: number; tier: Tier } };
  phaseBadge: { batBalls: number; bowlBalls: number };
}

export type BattingArchetype = "opener" | "top order" | "middle order" | "finisher" | "tail";
export type BowlingArchetype = "new ball" | "middle overs" | "death" | "all phases";

export interface PhaseCountsOut {
  balls: number;
  runs: number;
  outcomes: Record<OutcomeKey, number>;
  /** Context-expected outcome counts over the same balls (Phase 1.5); zeros when unavailable. */
  expected?: Record<OutcomeKey, number>;
}

/** The slice of a player-edition row the ratings code reads. */
export interface BlockIn {
  summary: {
    matches: number;
    bat: { innings: number; runs: number; balls: number; average: number | null; strikeRate: number | null };
    bowl: { innings: number; balls: number; runs: number; wickets: number; economy: number | null };
    field: { catches: number; stumpings: number; runOuts: number };
  };
  bat: { positions: Record<string, number>; phases: Record<string, PhaseCountsOut> };
  bowl: { oversByPhase: Record<Phase, number>; phases: Record<string, PhaseCountsOut> };
}

export interface PlayerEditionIn {
  personId: string;
  name: string;
  editionId: string;
  team: string;
  standIn: boolean;
  tournamentMatches: number;
  tournament: BlockIn;
  tournamentByOpposition: { full: BlockIn; associate: BlockIn };
  form: BlockIn;
  formByOpposition: { full: BlockIn; associate: BlockIn };
  careerToDate: BlockIn;
  /** Balls per opponent-Elo bin (keys from ELO_BINS) in the form window and the tournament. */
  formExposure: { bat: Record<string, number>; bowl: Record<string, number> };
  tournamentExposure: { bat: Record<string, number>; bowl: Record<string, number> };
  teamElo: number | null;
  formVenueBalls: { bat: Record<string, number>; bowl: Record<string, number> };
  /** Pooled form counts per opponent-Elo bin (keys from ELO_BINS; absent bins had no balls). */
  formByOppBin: Record<string, Record<"bat" | "bowl", PooledCountsIn>>;
  usage: { formMatches: number; formTeamMatches: number; tournamentMatches: number; tournamentTeamMatches: number };
  odiCareerToDate: { summary: BlockIn["summary"] };
  /** Domestic T20 career to the edition's start (observed and competition-expected counts per phase), or null. */
  domesticToDate: { matches: number; bat: Record<Phase, PooledCountsIn>; bowl: Record<Phase, PooledCountsIn>; competitions: Record<string, number>; recent: { bat: number; bowl: number } } | null;
}

export interface PooledCountsIn {
  balls: number;
  runs: number;
  outcomes: Record<OutcomeKey, number>;
  expected: Record<OutcomeKey, number>;
}

export interface SkillRating {
  /** Per-phase outcome vectors transported into the edition's environment (engine input). */
  vectors: PhaseVectors;
  /** Per-phase relative vectors (player ÷ population), era-free (what moves between editions). */
  relative: PhaseVectors;
  /**
   * Scalar value: percentage of population expected runs per ball gained (batting) or saved
   * (bowling), net of the wicket cost, against the window population projected onto the
   * edition's opponent mix; phase-weighted; scale-free across eras. Positive = better.
   */
  value: number;
  valueByPhase: Record<Phase, number>;
  /** Evidence behind the rating. */
  evidence: {
    formBalls: number;
    formBallsVsFull: number;
    formBallsVsAssociate: number;
    careerBalls: number;
    odiBalls: number;
    /** Domestic T20 balls behind the prior centre (0 when none). */
    domesticBalls: number;
    /** Domestic T20 balls in the last RECENT_SEASONS seasons (the recency test behind `shown`). */
    domesticRecentBalls: number;
    source: "form" | "career" | "domestic" | "odi" | "population";
    /** Share of the player's edge carried into the edition's opposition (1 = all of it). */
    transfer: number;
    /** Exposure-weighted scoring factor of the grounds the form was earned on (1 = window average). */
    venueFactor: number;
    /**
     * Selection prior: value points removed because the player was picked for only a share of
     * the team's form-window matches while rating above the team's median (0 when not applied).
     */
    selectionShift: number;
    /** Phase weights behind `value` (the player's own exposure by default; see MODEL.phaseWeighting). */
    phaseWeights: Record<Phase, number>;
  };
  /** Percentile among rated player-editions (0–1) and the 40–99 display value. */
  percentile: number;
  display: number;
  lowSample: boolean;
  /**
   * Whether the card shows this skill at all: false for a skill the player has barely shown in
   * T20Is, his domestic career or ODIs (a specialist batter's bowling). The engine still carries
   * the vectors, which are then almost pure prior.
   */
  shown: boolean;
  /** Per-phase 40–99 display numbers (same map as the headline) and the evidence behind each. */
  displayByPhase: Record<Phase, number>;
  phaseEvidence: Record<Phase, { balls: number; thin: boolean }>;
}

export interface PlayerRating {
  personId: string;
  name: string;
  editionId: string;
  team: string;
  standIn: boolean;
  batting: SkillRating;
  bowling: SkillRating;
  /** Headline display: the better of batting and bowling, with a small all-round bonus. */
  overall: number;
  /**
   * Card tier (spec §5.6): role-relative, from the better skill percentile plus an all-round bonus,
   * capped for thin evidence. `tierScore` is the value the thresholds cut.
   */
  tier: Tier;
  tierScore: number;
  role: "batter" | "bowler" | "all-rounder" | "unknown";
  /** Where the player is used: batting from the position band, bowling from own phase shares. */
  archetype: { batting: BattingArchetype | null; bowling: BowlingArchetype | null };
  position: { median: number | null; band: [number, number] | null; positionless: boolean; innings: number };
  /** Bowling phase shares in the form window + tournament (powerplay / middle / death). */
  bowlingPhases: Record<Phase, number> | null;
  /** Era-locked Tournament Form modifier in display points (0 when gated out). */
  tournamentForm: { batting: number; bowling: number; gated: boolean };
  /**
   * Selection evidence. `formShare` = matches picked ÷ team matches in the form window (null when
   * the team played fewer than `usage.minTeamMatches`); `tournamentShare` likewise for the World
   * Cup itself. `squadPlayer` is the era-locked tag: picked for under a quarter of the tournament.
   */
  usage: { formShare: number | null; tournamentShare: number | null; squadPlayer: boolean };
  /**
   * Conditions context for the projected modifier (kept separate from the neutral overall):
   * how the tournament's realised scoring compared with the form era. Per-venue projection
   * for the identity team's fixtures is a Phase 2 engine concern.
   */
  conditions: { editionConditionFactor: number };
}
