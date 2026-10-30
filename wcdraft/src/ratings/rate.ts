/**
 * Phase 1 ratings: one `PlayerRating` per player-edition.
 *
 * Batting (bowling is symmetric):
 *   1. Level-1 prior: the T20I career-to-date vector, shrunk toward the edition population
 *      (so a long career anchors a thin window).
 *   2. Level-2: form split by opposition tier. Each tier's counts are shrunk toward that tier's
 *      window population and expressed as a relative vector (player ÷ population), which removes
 *      the associate-circuit inflation. Tiers are blended by evidence weight.
 *   3. Fallbacks when T20 evidence is thin: an ODI-derived relative vector (2007/2009), then the
 *      population itself.
 *   4. Transport: relative × edition population → the vector the engine draws from.
 *   5. Scalar value per 100 balls vs the edition population; percentile across all rated
 *      player-editions → 40–99 display.
 */

import { resolve } from "node:path";
import type { OutcomeKey, Phase } from "../cricsheet/match.js";
import type { BuildResult } from "../pipeline/build.js";
import { ELO_BINS, eloBin, type EloBin } from "../analysis/team-strength.js";
import { paths, readJson } from "../util/io.js";
import { MODEL, OUTCOMES, PHASE_LIST, RUNS, type BattingArchetype, type BlockIn, type BowlingArchetype, type EditionPopulations, type PhaseVectors, type PlayerEditionIn, type PlayerRating, type SkillRating, type Tier as CardTier, type TierConfig, type Vector } from "./model.js";
import { rowMixtureInterp, smoothTwoWay, type TwoWayVectors } from "./two-way.js";
import { battingValue, blend, bowlingValue, expectedRuns, normalise, relative, shrink, shrinkWithHazard, toVector, transport, UNIFORM } from "./vectors.js";

type Tier = "full" | "associate";
type Skill = "bat" | "bowl";

export interface EditionContext {
  editionId: string;
  year: number;
  /** Edition population vectors by phase (batting outcomes), the transport destination. */
  editionPop: PhaseVectors;
  /** What bowlers conceded in the tournament itself, all bowlers pooled: the bowling value population. */
  editionBowlPop: PhaseVectors;
  /** Window population by tier and phase for batting and bowling. */
  window: Record<Skill, Record<Tier, PhaseVectors>>;
  /** Window population by opponent-Elo bin (bins with no balls fall back to the tier-"full" vector). */
  windowByElo: Record<Skill, Record<string, PhaseVectors>>;
  /** The tournament's own population by opponent-Elo bin, for the opposition-adjusted validation target. */
  tournamentByElo: Record<Skill, Record<string, PhaseVectors>>;
  /** Smoothed two-way tables (team bin × opponent bin), pooled over phases, from the form window. */
  twoWay: Record<Skill, TwoWayVectors>;
  /** Pooled batting relative vector of the edition's batters by position band (the prior centre for thin records); "all" is neutral. */
  bandCentre: Record<PriorBand | "all", Vector>;
  /** The edition's opponent mix: balls per opponent-Elo bin faced in the tournament (all teams). */
  editionOpponentMix: Record<Skill, Record<string, number>>;
  /** Scoring factor per venue string in the form window (1 = window average), shrunk toward 1. */
  windowVenueFactors: Record<string, number>;
  /** How the tournament's realised scoring compared with the window: > 1 = flatter than the form era. */
  editionConditionFactor: number;
  /** Mean Elo of the edition's strongest third of teams at its start (null when no team Elo is known). */
  topThirdElo: number | null;
  odiPop: { strikeRate: number; ballsPerOut: number } | null;
}

/** Exposure-weighted mixture of per-bin population vectors; falls back to `fallback` with no exposure. */
export function mixtureByExposure(byBin: Record<string, PhaseVectors>, exposure: Record<string, number>, fallback: PhaseVectors): PhaseVectors {
  const out = {} as PhaseVectors;
  for (const p of PHASE_LIST) {
    const parts = Object.entries(exposure)
      .filter(([bin, balls]) => balls > 0 && byBin[bin])
      .map(([bin, balls]) => ({ rel: byBin[bin]![p], weight: balls }));
    out[p] = parts.length ? normalise(blend(parts)) : fallback[p];
  }
  return out;
}

export function buildContexts(r: BuildResult): Map<string, EditionContext> {
  const out = new Map<string, EditionContext>();
  const teamElos = new Map<string, Map<string, number>>();
  for (const pe of r.playerEditions as unknown as PlayerEditionIn[]) {
    if (pe.teamElo === null) continue;
    (teamElos.get(pe.editionId) ?? teamElos.set(pe.editionId, new Map()).get(pe.editionId)!).set(pe.team, pe.teamElo);
  }
  for (const e of r.editions) {
    const elos = [...(teamElos.get(e.id)?.values() ?? [])].sort((a, b) => b - a);
    const top = elos.slice(0, Math.max(1, Math.ceil(elos.length / 3)));
    const topThirdElo = top.length ? +(top.reduce((a, b) => a + b, 0) / top.length).toFixed(1) : null;
    const pv = e.environment.populationVectors;
    const editionPop = Object.fromEntries(PHASE_LIST.map((p) => [p, toVector(pv[p], UNIFORM)])) as PhaseVectors;
    const w = r.windowPopulation[e.id];
    const t = r.windowPopulation[`${e.id}#tournament`];
    const tierVectors = (skill: "batting" | "bowling", tier: Tier): PhaseVectors =>
      Object.fromEntries(PHASE_LIST.map((p) => [p, toVector(w?.[skill][tier][p]?.p ?? null, editionPop[p])])) as PhaseVectors;
    const binVectors = (src: typeof w, skill: "battingByOppElo" | "bowlingByOppElo", fallback: PhaseVectors): Record<string, PhaseVectors> => {
      const result: Record<string, PhaseVectors> = {};
      for (const [bin, phases] of Object.entries(src?.[skill] ?? {})) {
        // Require a minimum sample per bin-phase; otherwise fall back so a thin bin cannot distort.
        result[bin] = Object.fromEntries(PHASE_LIST.map((p) => [p, (phases[p]?.balls ?? 0) >= 600 ? toVector(phases[p]!.p, fallback[p]) : fallback[p]])) as PhaseVectors;
      }
      return result;
    };
    const years = [e.year - 2, e.year - 1].map(String);
    const odi = years.map((y) => r.odiPopulationByYear[y]).filter(Boolean);
    const balls = odi.reduce((a, x) => a + x!.balls, 0);
    const runs = odi.reduce((a, x) => a + x!.runs, 0);
    const outs = odi.reduce((a, x) => a + x!.outs, 0);
    const window = {
      bat: { full: tierVectors("batting", "full"), associate: tierVectors("batting", "associate") },
      bowl: { full: tierVectors("bowling", "full"), associate: tierVectors("bowling", "associate") },
    };
    // Tournament bowling population: pool the full- and associate-batting-side vectors by balls.
    const editionBowlPop = Object.fromEntries(
      PHASE_LIST.map((p) => {
        const parts = (["full", "associate"] as Tier[])
          .map((tier) => ({ cell: t?.bowling[tier][p], tier }))
          .filter((x) => x.cell && x.cell.balls > 0)
          .map((x) => ({ rel: toVector(x.cell!.p, window.bowl.full[p]), weight: x.cell!.balls }));
        return [p, parts.length ? normalise(blend(parts)) : window.bowl.full[p]];
      }),
    ) as PhaseVectors;
    const mix = (src: typeof w, skill: "battingByOppElo" | "bowlingByOppElo"): Record<string, number> =>
      Object.fromEntries(Object.entries(src?.[skill] ?? {}).map(([bin, phases]) => [bin, PHASE_LIST.reduce((s, p) => s + (phases[p]?.balls ?? 0), 0)]));
    // Position-band prior centres: every batter in the edition pooled by where he bats (form window
    // and career to date, pre-tournament), observed ÷ context-expected, shrunk toward neutral.
    const bandCounts = Object.fromEntries(PRIOR_BANDS.map((b) => [b, { o: zeroCounts(), e: zeroCounts(), n: 0 }])) as Record<PriorBand, { o: Record<OutcomeKey, number>; e: Record<OutcomeKey, number>; n: number }>;
    for (const pe of r.playerEditions as unknown as PlayerEditionIn[]) {
      if (pe.editionId !== e.id) continue;
      const band = priorBand(pe);
      if (!band) continue;
      for (const block of [pe.form, pe.careerToDate]) for (const p of PHASE_LIST) {
        const pc = block.bat.phases[p];
        if (!pc) continue;
        bandCounts[band].n += pc.balls;
        for (const k of OUTCOMES) { bandCounts[band].o[k] += pc.outcomes[k]; bandCounts[band].e[k] += pc.expected?.[k] ?? 0; }
      }
    }
    const bandCentre = Object.fromEntries(PRIOR_BANDS.map((b) => [b, expectedRelative(bandCounts[b].o, bandCounts[b].e, bandCounts[b].n, UNIT, MODEL.positionPrior.strength, MODEL.positionPrior.strength)])) as Record<PriorBand | "all", Vector>;
    bandCentre.all = UNIT;
    out.set(e.id, {
      editionId: e.id,
      year: e.year,
      bandCentre,
      editionPop,
      editionBowlPop,
      window,
      windowByElo: { bat: binVectors(w, "battingByOppElo", window.bat.full), bowl: binVectors(w, "bowlingByOppElo", window.bowl.full) },
      tournamentByElo: { bat: binVectors(t, "battingByOppElo", editionPop), bowl: binVectors(t, "bowlingByOppElo", window.bowl.full) },
      twoWay: { bat: smoothTwoWay(w?.battingTwoWay ?? {}), bowl: smoothTwoWay(w?.bowlingTwoWay ?? {}) },
      editionOpponentMix: { bat: mix(t, "battingByOppElo"), bowl: mix(t, "bowlingByOppElo") },
      windowVenueFactors: Object.fromEntries(Object.entries(w?.venueFactors ?? {}).map(([v, f]) => [v, f.factor])),
      editionConditionFactor: +(expectedRuns(pooledPop(editionPop)) / Math.max(0.2, expectedRuns(pooledPop(window.bat.full)))).toFixed(3),
      topThirdElo,
      odiPop: balls > 0 && outs > 0 ? { strikeRate: (100 * runs) / balls, ballsPerOut: balls / outs } : null,
    });
  }
  return out;
}

const phaseCounts = (block: BlockIn, skill: Skill, phase: Phase) => block[skill].phases[phase] ?? { balls: 0, runs: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } };
const totalBalls = (block: BlockIn, skill: Skill) => PHASE_LIST.reduce((a, p) => a + phaseCounts(block, skill, p).balls, 0);

/** Balls per phase behind a rating: form window plus career-to-date. */
function phaseBalls(pe: PlayerEditionIn, skill: Skill): Record<Phase, number> {
  return Object.fromEntries(PHASE_LIST.map((p) => [p, phaseCounts(pe.form, skill, p).balls + phaseCounts(pe.careerToDate, skill, p).balls])) as Record<Phase, number>;
}

/**
 * Headline phase weights from the player's own exposure (spec §5.6): a No. 7 is valued over the
 * death overs he bats in, a new-ball bowler over the powerplay. The population weights act as a
 * prior of `MODEL.phaseWeightPrior` balls so thin records lean on the standard innings shape.
 */
function ownPhaseWeights(pe: PlayerEditionIn, skill: Skill): Record<Phase, number> {
  const balls = phaseBalls(pe, skill);
  const total = PHASE_LIST.reduce((a, p) => a + balls[p], 0);
  const k = MODEL.phaseWeightPrior;
  return Object.fromEntries(PHASE_LIST.map((p) => [p, +((balls[p] + k * MODEL.phaseWeights[p]) / (total + k)).toFixed(4)])) as Record<Phase, number>;
}

let tierConfigCache: TierConfig | null = null;
export function loadTierConfig(): TierConfig {
  return (tierConfigCache ??= readJson<TierConfig>(resolve(paths.config, "tiers.json")));
}

/**
 * ODI-derived relative vector: scale scoring outcomes by the player's ODI strike rate relative
 * to the era, and the dismissal cell by the era's balls-per-dismissal relative to the player's.
 * Crude by design; it carries only `odiPriorStrength` pseudo-balls of weight.
 */
function odiRelative(pe: PlayerEditionIn, ctx: EditionContext, skill: Skill): { rel: Vector; balls: number } | null {
  const s = pe.odiCareerToDate.summary;
  if (!ctx.odiPop) return null;
  if (skill === "bat") {
    if (s.bat.balls < MODEL.odiMinBalls || s.bat.strikeRate === null) return null;
    const outs = s.bat.innings > 0 && s.bat.average ? s.bat.runs / s.bat.average : 0;
    const bpo = outs > 0 ? s.bat.balls / outs : ctx.odiPop.ballsPerOut;
    const srRatio = s.bat.strikeRate / ctx.odiPop.strikeRate;
    const hazardRatio = ctx.odiPop.ballsPerOut / bpo;
    return { rel: { "0": 1 / Math.sqrt(srRatio), "1": 1, "2": srRatio, "3": srRatio, "4": srRatio, "6": srRatio, W: hazardRatio }, balls: s.bat.balls };
  }
  if (s.bowl.balls < 2 * MODEL.odiMinBalls || s.bowl.economy === null) return null;
  // ODI economy relative to a typical 5.0 and wickets per ball relative to a typical 1/36.
  const econRatio = s.bowl.economy / 5.0;
  const wpbRatio = s.bowl.wickets / s.bowl.balls / (1 / 36);
  return { rel: { "0": 1 / Math.sqrt(econRatio), "1": 1, "2": econRatio, "3": econRatio, "4": econRatio, "6": econRatio, W: wpbRatio }, balls: s.bowl.balls };
}

/** Sum outcome counts across phases. */
function pooledCounts(block: BlockIn, skill: Skill): { balls: number; outcomes: Record<OutcomeKey, number> } {
  const out = { balls: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } as Record<OutcomeKey, number> };
  for (const p of PHASE_LIST) {
    const c = phaseCounts(block, skill, p);
    out.balls += c.balls;
    for (const k of OUTCOMES) out.outcomes[k] += c.outcomes[k];
  }
  return out;
}

/** Population vector pooled across phases with the model's phase weights. */
function pooledPop(pv: PhaseVectors): Vector {
  return normalise(blend(PHASE_LIST.map((p) => ({ rel: pv[p], weight: MODEL.phaseWeights[p] }))));
}

/**
 * Relative vector for one "cell" of evidence (a phase, or all phases pooled): career-anchored
 * prior, then per-tier (or pooled-tier) form shrunk toward it and judged against the matching
 * population. Returns null when there is no form or career evidence at all.
 */
function cellRelative(
  counts: (block: BlockIn) => { balls: number; outcomes: Record<OutcomeKey, number> },
  pops: { destination: Vector; tier: Record<Tier, Vector>; elo: Vector },
  pe: PlayerEditionIn,
  opts: Required<RateOptions>,
  priorCentre: Vector | null,
  /** prior strength for this cell (pooled cells use priorStrength; hierarchical phase cells use phasePriorStrength) */
  c: number,
  skill: Skill,
): { rel: Vector; source: "form" | "career" } | null {
  const career = counts(pe.careerToDate);
  const centre = priorCentre ? transport(priorCentre, pops.destination) : pops.destination;
  // careerPriorStrength 0 disables the career anchor: the prior centre is the population (or pooled) vector.
  const careerPost = opts.careerPriorStrength > 0 ? shrinkWithHazard(career.outcomes, career.balls, centre, opts.careerPriorStrength, opts.hazardPriorStrength) : centre;
  const careerRel = relative(careerPost, pops.destination);
  // A long career makes a firmer prior: its strength grows with career balls (half weight, capped),
  // so a thin form window cannot overturn a thousand-ball record.
  const priorStrength = Math.max(c, Math.min(MODEL.careerPriorCap, 0.5 * career.balls));
  const parts: { rel: Vector; weight: number }[] = [];
  const addPart = (cnt: { balls: number; outcomes: Record<OutcomeKey, number> }, pop: Vector) => {
    if (cnt.balls === 0) return;
    const post = shrinkWithHazard(cnt.outcomes, cnt.balls, transport(careerRel, pop), priorStrength, opts.hazardPriorStrength);
    parts.push({ rel: relative(post, pop), weight: cnt.balls });
  };
  const tierMode = opts.tierMode[skill];
  if (tierMode === "split") {
    for (const tier of ["full", "associate"] as Tier[]) addPart(counts(pe.formByOpposition[tier]), pops.tier[tier]);
  } else if (tierMode === "elo" || tierMode === "twoWay") {
    addPart(counts(pe.form), pops.elo);
  } else if (tierMode === "mixture") {
    const nFull = counts(pe.formByOpposition.full).balls;
    const nAssoc = counts(pe.formByOpposition.associate).balls;
    const mix = nFull + nAssoc > 0 ? normalise(blend([{ rel: pops.tier.full, weight: nFull }, { rel: pops.tier.associate, weight: nAssoc }])) : pops.tier.full;
    addPart(counts(pe.form), mix);
  } else {
    addPart(counts(pe.form), pops.tier.full);
  }
  if (parts.length) return { rel: blend(parts), source: "form" };
  if (career.balls > 0) return { rel: careerRel, source: "career" };
  return null;
}

/** A skill rating before display mapping, plus the working vectors cohort centring needs. */
type PartialSkill = Omit<SkillRating, "percentile" | "display" | "displayByPhase" | "phaseEvidence" | "shown"> & {
  /** Relative vector after edge transfer, before cohort centring. */
  carried: PhaseVectors;
  /** The population the value is measured against (window population on the edition's opponent mix). */
  valuePop: PhaseVectors;
};

function rateSkill(pe: PlayerEditionIn, ctx: EditionContext, skill: Skill, options: RateOptions = {}): PartialSkill {
  const merged: Required<RateOptions> = { ...DEFAULT_OPTIONS, ...options };
  const m = skill === "bowl" ? merged.bowlPriorMultiplier : 1;
  const opts: Required<RateOptions> = { ...merged, priorStrength: merged.priorStrength * m, phasePriorStrength: merged.phasePriorStrength * m, careerPriorStrength: merged.careerPriorStrength * m };
  const c = opts.priorStrength;
  const windowPop = ctx.window[skill];
  const formBalls = totalBalls(pe.form, skill);
  const careerBalls = totalBalls(pe.careerToDate, skill);
  const domesticBalls = domesticCounts(pe, skill)?.n ?? 0;
  const odi = odiRelative(pe, ctx, skill);
  // The ODI prior carries full weight from `odiFullBalls`; below that, in proportion.
  const odiWeight = odi ? MODEL.odiPriorStrength * Math.min(1, odi.balls / MODEL.odiFullBalls) : 0;
  // Where a thin record rests: the position band's pooled vector for batting, neutral for bowling.
  const base0 = baseCentre(pe, ctx, skill);
  const vectors = {} as PhaseVectors;
  const rel = {} as PhaseVectors;
  const carriedAll = {} as PhaseVectors;
  const valueByPhase = {} as Record<Phase, number>;
  let source: SkillRating["evidence"]["source"] = "population";

  // Value is expressed against the window population projected onto the edition's opponent mix,
  // never the tournament's realised scoring (which inflated whole editions). The transport
  // destination is what an average player of the same team tier would do against that mix.
  const valuePop = mixtureByExposure(ctx.windowByElo[skill], ctx.editionOpponentMix[skill], windowPop.full);
  let destinations = valuePop;
  // Venue normalisation: the exposure-weighted scoring factor of the grounds this form was earned on.
  let venueFactor = 1;
  {
    let n = 0, s = 0;
    for (const [venue, balls] of Object.entries(pe.formVenueBalls[skill])) {
      const f = ctx.windowVenueFactors[venue];
      if (f === undefined || balls <= 0) continue;
      n += balls;
      s += balls * f;
    }
    if (n > 0) venueFactor = Math.pow(s / n, opts.venueNormalisation);
  }
  // The population the player's own form is judged against: mixed over the opponent strengths they faced.
  let eloPop = mixtureByExposure(ctx.windowByElo[skill], pe.formExposure[skill], windowPop.full);
  // Edge transfer: how much of the player's edge survives the step up to the edition's opposition.
  // Linear in the Elo gap (one measured point: ≈0.15 left at a ~250-point step), floored at 0.1,
  // and untouched for steps down or sideways.
  let transfer = 1;
  if (opts.transferScaleElo > 0) {
    const dest = opts.transferDestination === "topThird" ? ctx.topThirdElo : meanOpponentElo(ctx.editionOpponentMix[skill]);
    if (opts.transferDestination === "topThird" && dest !== null) {
      // Only the edge earned two or more bins below the cutoff is discounted, which is how the
      // transfer slope was measured; exposure in the cutoff bin and the one below carries in full.
      // (Before this split India's 2024 batters carried 77% of their edge because their 2022–24
      // opposition averaged below the top third, which made India weaker than Pakistan in the sim.)
      const cutoff = ELO_BINS.indexOf(eloBin(dest));
      let strong = 0, weak = 0, weakElo = 0;
      for (const [bin, balls] of Object.entries(pe.formExposure[skill])) {
        if (balls <= 0 || !(bin in BIN_CENTRE)) continue;
        if (ELO_BINS.indexOf(bin as EloBin) >= cutoff - 1) strong += balls;
        else { weak += balls; weakElo += balls * BIN_CENTRE[bin]!; }
      }
      if (weak > 0) {
        const own = weakElo / weak;
        const t = own < dest ? Math.max(0.1, 1 - (dest - own) / opts.transferScaleElo) : 1;
        transfer = (strong + weak * t) / (strong + weak);
      }
    } else {
      const own = meanOpponentElo(pe.formExposure[skill]);
      if (own !== null && dest !== null && dest > own) transfer = Math.max(0.1, 1 - (dest - own) / opts.transferScaleElo);
    }
  }
  // On the context-expected path the relative vector already contains the player's own team
  // strength, so shaping its destination by the team tier counts that strength twice; it is
  // optional there (`tierDestination`) and always on for the window path.
  if ((opts.evidence === "window" || opts.tierDestination) && opts.tierMode[skill] === "twoWay" && pe.teamElo !== null) {
    const own = rowMixtureInterp(ctx.twoWay[skill], pe.teamElo, pe.formExposure[skill]);
    const dest = rowMixtureInterp(ctx.twoWay[skill], pe.teamElo, ctx.editionOpponentMix[skill]);
    if (own && dest) {
      // Two-way tables are pooled over phases; keep the phase shape from the one-way mixtures.
      const shape = (pooled: Vector, phased: PhaseVectors): PhaseVectors => {
        const avg = pooledPop(phased);
        return Object.fromEntries(PHASE_LIST.map((p) => [p, normalise(transport(relative(phased[p], avg), pooled))])) as PhaseVectors;
      };
      eloPop = shape(own, eloPop);
      destinations = shape(dest, valuePop);
    }
  }

  // Pooled estimate across phases (used alone, or as the hierarchical prior centre).
  const pooled = opts.phasePooling === "none" ? null : cellRelative(
    (b) => pooledCounts(b, skill),
    { destination: pooledPop(destinations), tier: { full: pooledPop(windowPop.full), associate: pooledPop(windowPop.associate) }, elo: pooledPop(eloPop) },
    pe, opts, null, c, skill,
  );

  // Phase 1.5 path: context-expected evidence replaces the window-population normalisation.
  const expectedPath = opts.evidence === "expected" ? rateSkillExpected(pe, ctx, skill, opts) : null;

  for (const phase of PHASE_LIST) {
    let cell: { rel: Vector; source: "form" | "career" | "domestic" } | null;
    if (expectedPath) cell = expectedPath.source === "population" ? null : { rel: expectedPath.rel[phase], source: expectedPath.source };
    else if (opts.phasePooling === "pooled") cell = pooled;
    else cell = cellRelative(
      (b) => phaseCounts(b, skill, phase),
      { destination: destinations[phase], tier: { full: windowPop.full[phase], associate: windowPop.associate[phase] }, elo: eloPop[phase] },
      pe, opts, opts.phasePooling === "hierarchical" ? pooled?.rel ?? null : null,
      opts.phasePooling === "hierarchical" ? opts.phasePriorStrength : c,
      skill,
    );
    let phaseRel: Vector;
    if (cell) {
      phaseRel = cell.rel;
      if (cell.source === "form") source = "form";
      else if (source === "population") source = cell.source;
    } else if (odi) {
      phaseRel = blend([{ rel: odi.rel, weight: odiWeight }, { rel: base0, weight: c }]);
      if (source === "population") source = "odi";
    } else {
      phaseRel = base0;
    }
    // Thin form + usable ODI prior: let the ODI evidence pull the relative vector toward itself.
    if (odi && formBalls + careerBalls < c) {
      phaseRel = blend([{ rel: phaseRel, weight: formBalls + careerBalls + c }, { rel: odi.rel, weight: odiWeight }]);
      if (source !== "form") source = "odi";
    }
    // Venue normalisation: scoring cells earned on flatter grounds are deflated (and vice versa);
    // the dismissal cell is left alone.
    if (venueFactor !== 1) phaseRel = Object.fromEntries(OUTCOMES.map((k) => [k, k === "W" || k === "0" ? phaseRel[k] : phaseRel[k] / venueFactor])) as Vector;
    rel[phase] = phaseRel;
    // Carry only the transferable share of the edge (log-scaled) into stronger opposition.
    carriedAll[phase] = transfer === 1 ? phaseRel : (Object.fromEntries(OUTCOMES.map((k) => [k, Math.pow(phaseRel[k], transfer)])) as Vector);
    vectors[phase] = transport(carriedAll[phase], destinations[phase]);
    valueByPhase[phase] = skill === "bat" ? battingValue(vectors[phase], valuePop[phase], opts.wicketCost) : bowlingValue(vectors[phase], valuePop[phase], opts.wicketCost);
  }

  const phaseWeights = opts.phaseWeighting === "own" ? ownPhaseWeights(pe, skill) : MODEL.phaseWeights;
  const value = PHASE_LIST.reduce((a, p) => a + phaseWeights[p] * valueByPhase[p], 0);
  return {
    carried: carriedAll,
    valuePop,
    vectors,
    relative: rel,
    byBowlClass: skill === "bat" ? bowlClassSplit(pe) : null,
    value: +value.toFixed(2),
    valueByPhase: Object.fromEntries(PHASE_LIST.map((p) => [p, +valueByPhase[p].toFixed(2)])) as Record<Phase, number>,
    evidence: {
      formBalls,
      formBallsVsFull: totalBalls(pe.formByOpposition.full, skill),
      formBallsVsAssociate: totalBalls(pe.formByOpposition.associate, skill),
      careerBalls,
      odiBalls: skill === "bat" ? pe.odiCareerToDate.summary.bat.balls : pe.odiCareerToDate.summary.bowl.balls,
      domesticBalls,
      domesticRecentBalls: pe.domesticToDate?.recent[skill] ?? 0,
      source,
      transfer: +transfer.toFixed(3),
      venueFactor: +venueFactor.toFixed(3),
      selectionShift: 0,
      phaseWeights,
    },
    // The badge lifts when the form window is thin but a substantial ODI record stands in (2007/2009).
    // The badge lifts when the form window is thin but a substantial ODI or domestic T20 record stands in.
    lowSample: formBalls < (skill === "bat" ? MODEL.badge.batBalls : MODEL.badge.bowlBalls) && !(odi && odi.balls >= (skill === "bat" ? 600 : 900)) && domesticBalls < MODEL.domestic.liftBalls[skill],
  };
}

const UNIT: Vector = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };

/** Position bands for the batting prior (decided 2026-10-30): openers, 3–4, 5–7, 8–11. */
export type PriorBand = "1-2" | "3-4" | "5-7" | "8-11";
export const PRIOR_BANDS: PriorBand[] = ["1-2", "3-4", "5-7", "8-11"];
const zeroCounts = (): Record<OutcomeKey, number> => ({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 });

/** The band a player's pre-tournament batting positions put him in (form window first, then career); null with no innings. */
export function priorBand(pe: PlayerEditionIn): PriorBand | null {
  const src = Object.keys(pe.form.bat.positions).length ? pe.form.bat.positions : pe.careerToDate.bat.positions;
  const weighted = Object.entries(src).map(([pos, n]) => [Number(pos), n] as [number, number]).sort((a, b) => a[0] - b[0]);
  const total = weighted.reduce((a, [, n]) => a + n, 0);
  if (total === 0) return null;
  let acc = 0, median = weighted[weighted.length - 1]![0];
  for (const [pos, n] of weighted) { acc += n; if (acc >= total / 2) { median = pos; break; } }
  return median <= 2 ? "1-2" : median <= 4 ? "3-4" : median <= 7 ? "5-7" : "8-11";
}

/** The prior centre at the bottom of the shrinkage chain: the position band's pooled vector for batting, neutral for bowling. */
function baseCentre(pe: PlayerEditionIn, ctx: EditionContext, skill: Skill): Vector {
  if (skill !== "bat") return UNIT;
  return ctx.bandCentre[priorBand(pe) ?? "all"];
}

/**
 * Batting against pace and against spin: the player's pooled (form + career) relative vector by
 * bowler class, divided by his pooled overall vector over the same balls, each shrunk toward
 * neutral first, so a thin split sits at 1 and a real one shows. Clipped. Display is filled later.
 */
function bowlClassSplit(pe: PlayerEditionIn): NonNullable<SkillRating["byBowlClass"]> | null {
  const cfg = MODEL.bowlClassSplit;
  const sum = (pick: (b: BlockIn) => { balls: number; outcomes: Record<OutcomeKey, number>; expected?: Record<OutcomeKey, number> } | undefined) => {
    const o = zeroCounts(), e = zeroCounts();
    let n = 0;
    for (const block of [pe.form, pe.careerToDate]) {
      const pc = pick(block);
      if (!pc) continue;
      n += pc.balls;
      for (const k of OUTCOMES) { o[k] += pc.outcomes[k]; e[k] += pc.expected?.[k] ?? 0; }
    }
    return { o, e, n };
  };
  const classes = (["pace", "spin"] as const).map((cls) => ({ cls, counts: sum((b) => b.bat.byBowlClass?.[cls]) }));
  if (classes.every((c) => c.counts.n === 0)) return null;
  // The overall vector over the same (labelled) balls, so the residual is a within-player contrast.
  const all = { o: zeroCounts(), e: zeroCounts(), n: 0 };
  for (const c of classes) { all.n += c.counts.n; for (const k of OUTCOMES) { all.o[k] += c.counts.o[k]; all.e[k] += c.counts.e[k]; } }
  const allRel = expectedRelative(all.o, all.e, all.n, UNIT, cfg.priorStrength, cfg.hazardPriorStrength);
  const out = {} as NonNullable<SkillRating["byBowlClass"]>;
  for (const c of classes) {
    const rel = expectedRelative(c.counts.o, c.counts.e, c.counts.n, UNIT, cfg.priorStrength, cfg.hazardPriorStrength);
    out[c.cls] = {
      rel: Object.fromEntries(OUTCOMES.map((k) => [k, +Math.min(cfg.clip[1], Math.max(cfg.clip[0], allRel[k] > 0 ? rel[k] / allRel[k] : 1)).toFixed(4)])) as Vector,
      balls: c.counts.n,
      display: null,
    };
  }
  return out;
}

/** Log-edge of a class residual: scoring per ball up, hazard down (half weight), the number the card display shifts by. */
export function splitEdge(rel: Vector, pop: Vector): number {
  const runs = (v: Vector) => OUTCOMES.reduce((a, k) => a + RUNS[k] * v[k] * pop[k], 0);
  return Math.log(Math.max(0.2, runs(rel) / Math.max(1e-6, runs(UNIT)))) - 0.5 * Math.log(Math.max(0.2, rel.W));
}

function positionBand(pe: PlayerEditionIn): PlayerRating["position"] {
  // Tournament positions count double: they are the edition's own evidence.
  const weighted: [number, number][] = [];
  for (const [pos, n] of Object.entries(pe.form.bat.positions)) weighted.push([Number(pos), n]);
  for (const [pos, n] of Object.entries(pe.tournament.bat.positions)) weighted.push([Number(pos), 2 * n]);
  const total = weighted.reduce((a, [, n]) => a + n, 0);
  if (total === 0) return { median: null, band: null, positionless: false, innings: 0 };
  const sorted = weighted.sort((a, b) => a[0] - b[0]);
  const q = (frac: number) => {
    let acc = 0;
    for (const [pos, n] of sorted) {
      acc += n;
      if (acc >= frac * total) return pos;
    }
    return sorted[sorted.length - 1]![0];
  };
  const band: [number, number] = [q(0.25), q(0.75)];
  return { median: q(0.5), band, positionless: band[1] - band[0] >= MODEL.positionlessSpan, innings: total };
}

function tournamentForm(pe: PlayerEditionIn, ctx: EditionContext, batting: SkillRating, bowling: SkillRating): PlayerRating["tournamentForm"] {
  const calc = (skill: Skill, base: SkillRating, minBalls: number): { points: number; gated: boolean } => {
    const balls = totalBalls(pe.tournament, skill);
    if (balls < minBalls) return { points: 0, gated: true };
    // Tournament counts shrunk toward the player's own rating, then valued against the edition.
    let diff = 0;
    for (const phase of PHASE_LIST) {
      const c = phaseCounts(pe.tournament, skill, phase);
      const destination = skill === "bat" ? ctx.editionPop[phase] : ctx.window.bowl.full[phase];
      const post = shrinkWithHazard(c.outcomes, c.balls, base.vectors[phase], MODEL.priorStrength, MODEL.hazardPriorStrength);
      const v = skill === "bat" ? battingValue(post, destination) : bowlingValue(post, destination);
      diff += MODEL.phaseWeights[phase] * (v - base.valueByPhase[phase]);
    }
    const points = Math.max(-MODEL.tournamentForm.capPoints, Math.min(MODEL.tournamentForm.capPoints, diff * MODEL.tournamentForm.pointsPerValueUnit));
    return { points: +points.toFixed(1), gated: false };
  };
  const b = calc("bat", batting, MODEL.tournamentForm.minBatBalls);
  const w = calc("bowl", bowling, MODEL.tournamentForm.minBowlBalls);
  return { batting: b.points, bowling: w.points, gated: b.gated && w.gated };
}

function bowlingPhases(pe: PlayerEditionIn): Record<Phase, number> | null {
  const o = { pp: 0, mid: 0, death: 0 } as Record<Phase, number>;
  for (const block of [pe.form, pe.tournament]) for (const p of PHASE_LIST) o[p] += block.bowl.oversByPhase[p] ?? 0;
  const total = o.pp + o.mid + o.death;
  if (total === 0) return null;
  return { pp: +(o.pp / total).toFixed(3), mid: +(o.mid / total).toFixed(3), death: +(o.death / total).toFixed(3) };
}

/** Model knobs that experiments may override; the validation sweep picks the defaults. */
export interface RateOptions {
  priorStrength?: number;
  /**
   * none         — each phase estimated from its own counts (most detail, least evidence per cell)
   * pooled       — one relative vector from all phases, applied to every phase
   * hierarchical — phase-specific counts shrunk toward the pooled relative vector
   */
  phasePooling?: "none" | "pooled" | "hierarchical";
  /**
   * split   — estimate against full-member and associate attacks separately, blend by evidence
   * mixture — one pooled estimate, normalised against a population mixed in the player's own
   *           proportion of full-member vs associate opposition (adjusts without thinning evidence)
   * elo     — like mixture, but the population is mixed over opponent-Elo bins in the player's
   *           own exposure (continuous opposition quality)
   * twoWay  — judge the player against batters/bowlers from teams of the same strength facing
   *           the same opponent mix, then carry them through the tier-to-tier gap into the
   *           edition's opponent mix (the default: it is the only mode that handles associates)
   * none    — judge everyone against full-member norms (the control)
   */
  tierMode?: Record<"bat" | "bowl", "split" | "mixture" | "elo" | "twoWay" | "none">;
  /** Pseudo-balls of weight on the career-to-date block as the prior centre (0 = population centre). */
  careerPriorStrength?: number;
  /** Runs per wicket in the scalar value. */
  wicketCost?: number;
  /** Prior strength for the dismissal cell (separate, stronger shrink). */
  hazardPriorStrength?: number;
  /** Hierarchical mode: strength of the pooled vector as each phase's prior. */
  phasePriorStrength?: number;
  /** Edge-transfer scale in Elo points (see MODEL.transferScaleElo); 0 = full transfer. */
  transferScaleElo?: number;
  /** Multiplier on every bowling prior strength (bowlers vary less than batters, so they need more shrink). */
  bowlPriorMultiplier?: number;
  /** Venue normalisation exponent (1 = full, 0 = off). */
  venueNormalisation?: number;
  /**
   * window   — relative vectors from window populations (tier / Elo / two-way tables)
   * expected — Phase 1.5: observed ÷ context-expected counts accumulated per ball (period ×
   *            opponent strength × venue), career-anchored and hierarchically shrunk
   */
  evidence?: "window" | "expected";
  /** Selection prior weight (see MODEL.usage); 0 disables. */
  selectionWeight?: number;
  /** Form-window share at or above which being left out carries no information (1 = every miss counts). */
  selectionMaxShare?: number;
  /**
   * Cohort centring (Phase 1.5). The context expectation is "an average T20I player of the period
   * facing this opposition", and that average weakened as the T20I pool grew (World Cup squads
   * beat it by 5% in 2010 and 13% in 2026), which inflated whole editions. `top10` re-expresses
   * every relative vector against the evidence-weighted mean of the squads of the edition's ten
   * strongest teams (all teams for ten-team editions), so a rating means the same thing relative
   * to its era whatever the field size. `all` uses every squad; `none` disables.
   */
  cohortCentre?: "none" | "top10" | "all";
  /**
   * Shape the transport destination by the player's team tier (the two-way table) on the
   * context-expected path as well. In theory this counts team strength twice; the sweep decides
   * whether the extra tier gap earns its place.
   */
  tierDestination?: boolean;
  /**
   * The opposition the edge-transfer gap is measured to: the edition's balls-weighted opponent mix
   * (which first-round associate fixtures dilute) or the mean Elo of the edition's strongest third
   * (the sides an unbeaten run must beat).
   */
  transferDestination?: "mix" | "topThird";
  /** Headline phase weighting: the player's own exposure or the fixed population weights (see MODEL). */
  phaseWeighting?: "own" | "population";
}

/**
 * Defaults chosen by the validation sweep (RATINGS.md, 2026-10-28): hierarchical phases with a
 * 150-ball pooled prior, a 1,000-ball dismissal prior, career anchor 50, and the membership-tier
 * opposition adjustment for bowling only — it lowered batting prediction (associate-circuit
 * populations are too heterogeneous at membership granularity; an Elo-based version is planned).
 */
export const DEFAULT_OPTIONS: Required<RateOptions> = {
  priorStrength: MODEL.priorStrength,
  phasePooling: "hierarchical",
  // Bowling: the two-way table costs stability (0.30 vs 0.55) for no predictive gain; the one-way
  // Elo mixture (bowler judged against what all bowlers conceded to batting sides of the strengths
  // he faced) predicts best (0.10 / 0.13 vs 0.10 / 0.05 for the control) and stays stable (0.60).
  tierMode: { bat: "twoWay", bowl: "elo" },
  careerPriorStrength: MODEL.careerPriorStrength,
  wicketCost: MODEL.wicketCost,
  hazardPriorStrength: MODEL.hazardPriorStrength,
  phasePriorStrength: MODEL.phasePriorStrength,
  transferScaleElo: MODEL.transferScaleElo,
  bowlPriorMultiplier: MODEL.bowlPriorMultiplier,
  venueNormalisation: MODEL.venueNormalisation,
  evidence: MODEL.evidence,
  selectionWeight: MODEL.usage.selectionWeight,
  selectionMaxShare: MODEL.usage.selectionMaxShare,
  cohortCentre: MODEL.cohort.centre,
  tierDestination: MODEL.tierDestination,
  transferDestination: MODEL.transferDestination,
  phaseWeighting: MODEL.phaseWeighting,
};

const TIER_RANK: Record<CardTier, number> = { Bronze: 1, Silver: 2, Gold: 3, Elite: 4 };
const capTier = (tier: CardTier, cap: CardTier): CardTier => (TIER_RANK[tier] > TIER_RANK[cap] ? cap : tier);

/** Tier score (spec §5.6): the better skill percentile plus a bonus for a useful second skill. */
function tierScoreOf(batting: SkillRating, bowling: SkillRating, cfg: TierConfig): number {
  const pb = batting.percentile, pw = bowling.percentile;
  return +(Math.max(pb, pw) + cfg.allRoundBonus * Math.max(0, Math.min(pb, pw) - 0.5)).toFixed(3);
}

/**
 * Card tier: the role-relative score cut at percentile thresholds (so "Elite" reads as "top 8% of
 * the skill", whichever skill it is), then capped for thin evidence on the best skill. Cutting at
 * shares of the score distribution was tried and dropped: a specialist's score is one skill
 * percentile while most players' best-of-two sits higher, so a 55th-percentile pure batter (Kohli
 * 2024) fell into Bronze.
 */
function tierOf(batting: SkillRating, bowling: SkillRating, score: number, cfg: TierConfig): CardTier {
  const bestIsBat = batting.percentile >= bowling.percentile;
  const best = bestIsBat ? batting : bowling;
  const t = cfg.thresholds;
  let tier: CardTier = score >= t.elite ? "Elite" : score >= t.gold ? "Gold" : score >= t.silver ? "Silver" : "Bronze";
  if (best.lowSample) tier = capTier(tier, cfg.caps.lowSample);
  else if (best.evidence.formBalls < (bestIsBat ? cfg.caps.thin.batBalls : cfg.caps.thin.bowlBalls)) tier = capTier(tier, cfg.caps.thin.tier);
  return tier;
}

function archetypeOf(pe: PlayerEditionIn, position: PlayerRating["position"], bowling: SkillRating): PlayerRating["archetype"] {
  let batting: BattingArchetype | null = null;
  if (position.median !== null && position.innings >= 5) {
    const m = position.median;
    batting = m <= 2 ? "opener" : m <= 4 ? "top order" : m <= 6 ? "middle order" : m <= 8 ? "finisher" : "tail";
  }
  let bowlingArchetype: BowlingArchetype | null = null;
  if (!bowling.lowSample) {
    const o = { pp: 0, mid: 0, death: 0 } as Record<Phase, number>;
    for (const block of [pe.form, pe.careerToDate]) for (const p of PHASE_LIST) o[p] += block.bowl.oversByPhase[p] ?? 0;
    const total = o.pp + o.mid + o.death;
    if (total >= 10) {
      const s = { pp: o.pp / total, mid: o.mid / total, death: o.death / total };
      bowlingArchetype = s.pp >= 0.45 ? "new ball" : s.death >= 0.4 ? "death" : s.mid >= 0.55 ? "middle overs" : "all phases";
    }
  }
  return { batting, bowling: bowlingArchetype };
}

/** Share of the team's matches the player was picked for; null when the team played too few. */
export function usageShares(pe: PlayerEditionIn): PlayerRating["usage"] {
  const u = pe.usage;
  const formShare = u.formTeamMatches >= MODEL.usage.minTeamMatches ? +Math.min(1, u.formMatches / u.formTeamMatches).toFixed(3) : null;
  const tournamentShare = u.tournamentTeamMatches >= MODEL.usage.minTournamentTeamMatches ? +Math.min(1, u.tournamentMatches / u.tournamentTeamMatches).toFixed(3) : null;
  return { formShare, tournamentShare, squadPlayer: tournamentShare !== null && tournamentShare < MODEL.usage.squadPlayerShare };
}

/**
 * Phase 1.5 evidence path: relative vector from observed ÷ expected counts.
 * rel_k = (o_k + s·centre_k·q_k) / (e_k + s·q_k), q_k = e_k / n — shrinks toward `centre` with
 * strength `s` pseudo-balls; the dismissal cell uses `sHazard`.
 */
function expectedRelative(
  o: Record<OutcomeKey, number>,
  e: Record<OutcomeKey, number>,
  n: number,
  centre: Vector,
  s: number,
  sHazard: number,
): Vector {
  const out = {} as Vector;
  for (const k of OUTCOMES) {
    const q = n > 0 ? e[k] / n : 0;
    const strength = k === "W" ? sHazard : s;
    const num = o[k] + strength * centre[k] * q;
    const den = e[k] + strength * q;
    out[k] = den > 0 ? num / den : centre[k];
  }
  return out;
}

/**
 * Whether the backup records vouch for a skill the T20I record does not: a recent domestic T20
 * record, or an ODI record (batting in every edition; bowling only in the pre-league editions).
 */
function backupVouches(ev: Pick<SkillRating["evidence"], "domesticRecentBalls" | "odiBalls">, skill: Skill, editionId: string): boolean {
  const odiVouches = ev.odiBalls >= MODEL.shown.odiBalls[skill] && (skill === "bat" || MODEL.shown.odiBowlEditions.includes(editionId));
  return ev.domesticRecentBalls >= MODEL.domestic.shownBalls[skill] || odiVouches;
}

/** Domestic T20 career counts for a skill, pooled over phases (null when the player has none). */
function domesticCounts(pe: PlayerEditionIn, skill: Skill): { o: Record<OutcomeKey, number>; e: Record<OutcomeKey, number>; n: number } | null {
  const d = pe.domesticToDate?.[skill];
  if (!d) return null;
  const o = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } as Record<OutcomeKey, number>;
  const e = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } as Record<OutcomeKey, number>;
  let n = 0;
  for (const p of PHASE_LIST) {
    const pc = d[p];
    if (!pc) continue;
    n += pc.balls;
    for (const k of OUTCOMES) { o[k] += pc.outcomes[k]; e[k] += pc.expected[k]; }
  }
  return n > 0 ? { o, e, n } : null;
}

function rateSkillExpected(pe: PlayerEditionIn, ctx: EditionContext, skill: Skill, opts: Required<RateOptions>): { rel: PhaseVectors; source: "form" | "career" | "domestic" | "population" } {
  const c = opts.priorStrength;
  const zero = (): Record<OutcomeKey, number> => ({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 });
  const get = (block: BlockIn, phase: Phase | "all") => {
    const o = zero(), e = zero();
    let n = 0;
    for (const p of phase === "all" ? PHASE_LIST : [phase]) {
      const pc = block[skill].phases[p];
      if (!pc) continue;
      n += pc.balls;
      for (const k of OUTCOMES) {
        o[k] += pc.outcomes[k];
        e[k] += pc.expected?.[k] ?? 0;
      }
    }
    return { o, e, n };
  };
  // Level 1: career-to-date relative to context, shrunk toward neutral (1).
  // Level 0: the domestic T20 career (competition-relative), partially transferred, is the centre
  // the T20I career shrinks toward; neutral when the player has no domestic record.
  const dom = domesticCounts(pe, skill);
  // The bottom of the chain is the position-band centre for batting (a No. 10 with no record is
  // an average No. 10, not an average batter); neutral for bowling.
  const base = baseCentre(pe, ctx, skill);
  const domesticCentre = dom
    ? (() => {
        // The domestic record shrinks toward the band centre; only part of its edge over that centre carries.
        const d = expectedRelative(dom.o, dom.e, dom.n, base, MODEL.domestic.priorStrength, opts.hazardPriorStrength);
        return Object.fromEntries(OUTCOMES.map((k) => [k, base[k] * Math.pow(d[k] / base[k], MODEL.domestic.transfer)])) as Vector;
      })()
    : base;
  const careerAll = get(pe.careerToDate, "all");
  const careerRel = expectedRelative(careerAll.o, careerAll.e, careerAll.n, domesticCentre, opts.careerPriorStrength, opts.hazardPriorStrength);
  const priorStrength = Math.max(c, Math.min(MODEL.careerPriorCap, 0.5 * careerAll.n));
  // Level 2: pooled form, shrunk toward the career centre.
  const formAll = get(pe.form, "all");
  const pooled = expectedRelative(formAll.o, formAll.e, formAll.n, careerRel, priorStrength, opts.hazardPriorStrength);
  // Level 3: each phase, shrunk toward the pooled vector.
  const rel = {} as PhaseVectors;
  for (const p of PHASE_LIST) {
    const f = get(pe.form, p);
    rel[p] = opts.phasePooling === "pooled" ? pooled : expectedRelative(f.o, f.e, f.n, pooled, opts.phasePriorStrength, opts.hazardPriorStrength);
  }
  const source = formAll.n > 0 ? "form" : careerAll.n > 0 ? "career" : dom ? "domestic" : "population";
  return { rel, source };
}

/** Exposure-weighted mean opponent Elo, using bin centres. */
const BIN_CENTRE: Record<string, number> = { "<1400": 1350, "1400-1499": 1450, "1500-1599": 1550, "1600-1699": 1650, "1700-1799": 1750, "1800+": 1850 };
export function meanOpponentElo(exposure: Record<string, number>): number | null {
  let n = 0, s = 0;
  for (const [bin, balls] of Object.entries(exposure)) {
    if (!(bin in BIN_CENTRE) || balls <= 0) continue;
    n += balls;
    s += balls * BIN_CENTRE[bin]!;
  }
  return n > 0 ? s / n : null;
}

/** Rate every player-edition; percentiles are computed across all rated rows so eras are comparable. */
export function rateAll(r: BuildResult, opts: RateOptions = {}): PlayerRating[] {
  const contexts = buildContexts(r);
  const rows = r.playerEditions as unknown as PlayerEditionIn[];
  const partial = rows.map((pe) => {
    const ctx = contexts.get(pe.editionId)!;
    // A debutant with no pre-tournament record anywhere (no T20Is, no leagues, no ODIs) is rated
    // from the tournament's own balls rather than left at the population prior: Rohit 2007 and
    // Amir 2009 get a card. The source is labelled so the validation can leave them out.
    const rated = (skill: Skill): PartialSkill => {
      const s = rateSkill(pe, ctx, skill, opts);
      const noT20I = s.evidence.formBalls + s.evidence.careerBalls === 0;
      if (!noT20I || backupVouches(s.evidence, skill, pe.editionId) || totalBalls(pe.tournament, skill) === 0) return s;
      const debut: PlayerEditionIn = { ...pe, form: pe.tournament, formByOpposition: pe.tournamentByOpposition, formExposure: pe.tournamentExposure, formVenueBalls: { bat: {}, bowl: {} }, formByOppBin: {} };
      const t = rateSkill(debut, ctx, skill, opts);
      return { ...t, evidence: { ...t.evidence, source: "tournament" } };
    };
    return { pe, ctx, usage: usageShares(pe), bat: rated("bat"), bowl: rated("bowl") };
  });

  // Cohort centring (Phase 1.5): see RateOptions.cohortCentre. Vectors and values are re-expressed
  // against the reference cohort's evidence-weighted mean relative vector; `relative` stays raw.
  const cohortCentre = opts.cohortCentre ?? DEFAULT_OPTIONS.cohortCentre;
  if (cohortCentre !== "none") {
    const stats = new Map<Skill, { group: typeof partial; reference: Set<string> }[]>([["bat", []], ["bowl", []]]);
    const byEdition = new Map<string, typeof partial>();
    for (const x of partial) (byEdition.get(x.pe.editionId) ?? byEdition.set(x.pe.editionId, []).get(x.pe.editionId)!).push(x);
    for (const group of byEdition.values()) {
      const teamElo = new Map<string, number>();
      for (const x of group) if (x.pe.teamElo !== null && !x.pe.standIn) teamElo.set(x.pe.team, x.pe.teamElo);
      const ranked = [...teamElo].sort((a, b) => b[1] - a[1]).map(([team]) => team);
      const reference = new Set(cohortCentre === "top10" ? ranked.slice(0, MODEL.cohort.teams) : ranked);
      for (const skill of ["bat", "bowl"] as const) stats.get(skill)!.push({ group, reference });
    }
    // Scalar standardisation of the value only (dividing the vectors cell by cell changed
    // within-edition rankings: batting r fell 0.32 → 0.27). Each edition's reference cohort is
    // moved to mean 0 and to the evidence-weighted average spread of all editions' reference
    // cohorts, so an edition with a widened field (twenty teams, record scoring) does not fill the
    // top of a cross-era display scale on its own. Rankings within an edition and engine vectors
    // are untouched.
    for (const skill of ["bat", "bowl"] as const) {
      const moments = stats.get(skill)!.map(({ group, reference }) => {
        let w = 0, s1 = 0, s2 = 0;
        for (const x of group) {
          const s = x[skill];
          const weight = s.evidence.formBalls + s.evidence.careerBalls;
          if (s.lowSample || weight <= 0 || !reference.has(x.pe.team)) continue;
          w += weight; s1 += weight * s.value; s2 += weight * s.value * s.value;
        }
        const mean = w > 0 ? s1 / w : 0;
        const sd = w > 0 ? Math.sqrt(Math.max(0, s2 / w - mean * mean)) : 0;
        return { group, w, mean, sd };
      });
      const totalW = moments.reduce((a, m) => a + m.w, 0);
      const targetSd = totalW > 0 ? moments.reduce((a, m) => a + m.w * m.sd, 0) / totalW : 0;
      for (const { group, w, mean, sd } of moments) {
        if (w <= 0) continue;
        const scale = sd > 0 && targetSd > 0 ? targetSd / sd : 1;
        for (const x of group) {
          const s = x[skill];
          s.value = +((s.value - mean) * scale).toFixed(2);
          for (const p of PHASE_LIST) s.valueByPhase[p] = +((s.valueByPhase[p] - mean) * scale).toFixed(2);
        }
      }
    }
  }

  // Selection prior (Phase 1.5): selectors' revealed preference. A player picked for a share s of
  // the team's form-window matches who rates d above the team's median loses w·(1−s)·d. One-sided
  // and scalar-only: the engine vectors are what the balls say; the ranking also hears the selectors.
  const selectionWeight = opts.selectionWeight ?? DEFAULT_OPTIONS.selectionWeight;
  const selectionMaxShare = opts.selectionMaxShare ?? DEFAULT_OPTIONS.selectionMaxShare;
  if (selectionWeight > 0) {
    for (const skill of ["bat", "bowl"] as const) {
      const groups = new Map<string, number[]>();
      for (const x of partial) if (!x[skill].lowSample) (groups.get(`${x.pe.editionId}|${x.pe.team}`) ?? groups.set(`${x.pe.editionId}|${x.pe.team}`, []).get(`${x.pe.editionId}|${x.pe.team}`)!).push(x[skill].value);
      const median = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b);
        return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
      };
      const medians = new Map([...groups].filter(([, xs]) => xs.length >= 3).map(([k, xs]) => [k, median(xs)]));
      for (const x of partial) {
        const s = x.usage.formShare;
        const m = medians.get(`${x.pe.editionId}|${x.pe.team}`);
        if (s === null || s >= selectionMaxShare || m === undefined || x[skill].value <= m) continue;
        // Shortfall below the share at which selection stops being informative, rescaled to 0–1.
        const shortfall = (selectionMaxShare - s) / selectionMaxShare;
        const d = +(selectionWeight * shortfall * (x[skill].value - m)).toFixed(2);
        if (d <= 0) continue;
        x[skill].value = +(x[skill].value - d).toFixed(2);
        for (const p of PHASE_LIST) x[skill].valueByPhase[p] = +(x[skill].valueByPhase[p] - d).toFixed(2);
        x[skill].evidence.selectionShift = d;
      }
    }
  }

  // Display ranks a conservative value: shrunk toward 0 by the evidence behind it (winner's-curse guard).
  // Display ranks a conservative value: shrunk toward the median of the rated players by the
  // evidence behind it (winner's-curse guard). Toward the median, not zero: after cohort
  // standardisation the median rated player sits below zero, so shrinking toward zero printed an
  // unmeasured player at 76–78 (above the median) instead of at the middle.
  const medianValue = (skill: Skill) => {
    const xs = partial.filter((x) => !x[skill].lowSample).map((x) => x[skill].value).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)]! : 0;
  };
  const medians = { bat: medianValue("bat"), bowl: medianValue("bowl") };
  const conservative = (s: Pick<SkillRating, "value" | "evidence">, skill: Skill) => {
    const n = s.evidence.formBalls + s.evidence.careerBalls + (s.evidence.source === "odi" ? MODEL.odiPriorStrength : 0);
    const w = n / (n + MODEL.displayEvidenceStrength);
    return medians[skill] + (s.value - medians[skill]) * w;
  };
  // Display: percentile-anchored but linear in value, so the top is not compressed. The median
  // maps to 70, the 99th percentile to 99 and the 5th percentile to 45; values beyond those
  // anchors extrapolate linearly and clip to the display range.
  const toDisplay = (skill: Skill) => {
    const eligible = partial.filter((x) => !x[skill].lowSample).map((x) => conservative(x[skill], skill)).sort((a, b) => a - b);
    const q = (f: number) => eligible[Math.min(eligible.length - 1, Math.max(0, Math.floor(f * (eligible.length - 1))))] ?? 0;
    const median = q(0.5), top = q(0.99), low = q(0.05);
    return (value: number) => {
      let lo = 0, hi = eligible.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((eligible[mid] ?? 0) < value) lo = mid + 1;
        else hi = mid;
      }
      const pct = eligible.length ? lo / eligible.length : 0.5;
      const raw = value >= median ? 70 + (29 * (value - median)) / Math.max(1e-6, top - median) : 70 - (25 * (median - value)) / Math.max(1e-6, median - low);
      const display = Math.round(Math.min(MODEL.display.max, Math.max(MODEL.display.min, raw)));
      return { percentile: +pct.toFixed(3), display };
    };
  };
  const batDisplay = toDisplay("bat");
  const bowlDisplay = toDisplay("bowl");

  const tierConfig = loadTierConfig();
  const finish = ({ carried: _carried, valuePop: _valuePop, ...s }: PartialSkill, display: ReturnType<typeof toDisplay>, pe: PlayerEditionIn, skill: Skill): SkillRating => {
    const n = s.evidence.formBalls + s.evidence.careerBalls + (s.evidence.source === "odi" ? MODEL.odiPriorStrength : 0);
    const guard = n / (n + MODEL.displayEvidenceStrength);
    const balls = phaseBalls(pe, skill);
    const badge = skill === "bat" ? tierConfig.phaseBadge.batBalls : tierConfig.phaseBadge.bowlBalls;
    const ev = s.evidence;
    const formBar = ev.source === "tournament" ? MODEL.shown.tournamentBalls[skill] : MODEL.shown.formBalls[skill];
    const shown = ev.formBalls >= formBar || ev.careerBalls >= MODEL.shown.careerBalls[skill] || backupVouches(ev, skill, pe.editionId);
    const shownDisplay = display(conservative(s, skill));
    // Pace/spin numbers: the headline shifted by the class edge, once the player has faced enough of that class.
    const byBowlClass = s.byBowlClass && shown
      ? (Object.fromEntries((["pace", "spin"] as const).map((cls) => {
          const part = s.byBowlClass![cls];
          const shift = part.balls >= MODEL.bowlClassSplit.minBalls ? Math.round(MODEL.bowlClassSplit.displayScale * splitEdge(part.rel, _valuePop.mid)) : null;
          return [cls, { ...part, display: shift === null ? null : Math.max(MODEL.display.min, Math.min(MODEL.display.max, shownDisplay.display + shift)) }];
        })) as NonNullable<SkillRating["byBowlClass"]>)
      : s.byBowlClass;
    return {
      ...s,
      ...shownDisplay,
      byBowlClass,
      shown,
      // Phase numbers shrink toward the median exactly like the headline, so they agree.
      displayByPhase: Object.fromEntries(PHASE_LIST.map((p) => [p, display(medians[skill] + (s.valueByPhase[p] - medians[skill]) * guard).display])) as Record<Phase, number>,
      phaseEvidence: Object.fromEntries(PHASE_LIST.map((p) => [p, { balls: balls[p], thin: balls[p] < badge }])) as Record<Phase, { balls: number; thin: boolean }>,
    };
  };
  const finished = partial.map(({ pe, ctx, usage, bat, bowl }) => {
    const batting = finish(bat, batDisplay, pe, "bat");
    const bowling = finish(bowl, bowlDisplay, pe, "bowl");
    return { pe, ctx, usage, batting, bowling, tierScore: tierScoreOf(batting, bowling, tierConfig) };
  });
  return finished.map(({ pe, ctx, usage, batting: batting0, bowling: bowling0, tierScore }) => {
    const batBalls = batting0.evidence.formBalls + batting0.evidence.careerBalls;
    const bowlBalls = bowling0.evidence.formBalls + bowling0.evidence.careerBalls;
    // A role needs real evidence: a few career overs do not make a batter an all-rounder, and a
    // skill the player no longer shows (Kohli's 152 T20I bowling balls, none recent) does not count.
    const bowls = bowling0.shown && bowlBalls >= 150 && bowling0.display >= 60;
    const bats = batting0.shown && batBalls >= 150 && batting0.display >= 60;
    // Fallback when neither skill clears the evidence bar: the skill with evidence wins over a
    // prior-shaped number (a keeper with 49 batting is not a "bowler" because his unmeasured bowling
    // prints 73), then the skill with more balls, then the higher display.
    const fallback: PlayerRating["role"] =
      batBalls + bowlBalls === 0 ? "unknown"
      : batting0.lowSample !== bowling0.lowSample ? (batting0.lowSample ? "bowler" : "batter")
      : batBalls !== bowlBalls ? (batBalls > bowlBalls ? "batter" : "bowler")
      : batting0.display >= bowling0.display ? "batter" : "bowler";
    const role: PlayerRating["role"] = bats && bowls ? "all-rounder" : bowls ? "bowler" : bats ? "batter" : fallback;
    // The role's own skill is always shown (a bowler with eleven T20Is is still a bowler; the
    // low-sample badge says how thin the number is). The other skill needs the evidence bar.
    const batting = role === "batter" || role === "all-rounder" ? { ...batting0, shown: true } : batting0;
    const bowling = role === "bowler" || role === "all-rounder" ? { ...bowling0, shown: true } : bowling0;
    const top = Math.max(batting.display, bowling.display);
    const second = Math.min(batting.display, bowling.display);
    const overall = Math.min(MODEL.display.max, Math.round(top + (role === "all-rounder" ? 0.1 * (second - MODEL.display.min) : 0)));
    const position = positionBand(pe);
    return {
      personId: pe.personId,
      name: pe.name,
      editionId: pe.editionId,
      team: pe.team,
      standIn: pe.standIn,
      batting,
      bowling,
      overall,
      // No record anywhere, not even in the tournament: a Bronze card, not a median-shaped Silver.
      tier: batting.shown || bowling.shown ? tierOf(batting, bowling, tierScore, tierConfig) : "Bronze",
      tierScore,
      role,
      archetype: archetypeOf(pe, position, bowling),
      position,
      bowlingPhases: bowlingPhases(pe),
      tournamentForm: tournamentForm(pe, ctx, batting, bowling),
      usage,
      conditions: { editionConditionFactor: ctx.editionConditionFactor },
    };
  });
}

export type { EditionPopulations } from "./model.js";

/** The populations the engine needs per edition (Phase 2); see `EditionPopulations` in model.ts. */
export function editionPopulations(r: BuildResult): EditionPopulations[] {
  return [...buildContexts(r).values()].map((ctx) => ({
    editionId: ctx.editionId,
    valuePop: {
      bat: mixtureByExposure(ctx.windowByElo.bat, ctx.editionOpponentMix.bat, ctx.window.bat.full),
      bowl: mixtureByExposure(ctx.windowByElo.bowl, ctx.editionOpponentMix.bowl, ctx.window.bowl.full),
    },
    editionPop: ctx.editionPop,
    editionBowlPop: ctx.editionBowlPop,
  }));
}

/** Sanity helper used by tests and the report: the expected runs per ball of a vector. */
export { expectedRuns, normalise, OUTCOMES };
export type { OutcomeKey };
