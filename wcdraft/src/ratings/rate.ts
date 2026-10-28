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

import type { OutcomeKey, Phase } from "../cricsheet/match.js";
import type { BuildResult } from "../pipeline/build.js";
import { MODEL, OUTCOMES, PHASE_LIST, type BlockIn, type PhaseVectors, type PlayerEditionIn, type PlayerRating, type SkillRating, type Vector } from "./model.js";
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
  /** The edition's opponent mix: balls per opponent-Elo bin faced in the tournament (all teams). */
  editionOpponentMix: Record<Skill, Record<string, number>>;
  /** Scoring factor per venue string in the form window (1 = window average), shrunk toward 1. */
  windowVenueFactors: Record<string, number>;
  /** How the tournament's realised scoring compared with the window: > 1 = flatter than the form era. */
  editionConditionFactor: number;
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
  for (const e of r.editions) {
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
    out.set(e.id, {
      editionId: e.id,
      year: e.year,
      editionPop,
      editionBowlPop,
      window,
      windowByElo: { bat: binVectors(w, "battingByOppElo", window.bat.full), bowl: binVectors(w, "bowlingByOppElo", window.bowl.full) },
      tournamentByElo: { bat: binVectors(t, "battingByOppElo", editionPop), bowl: binVectors(t, "bowlingByOppElo", window.bowl.full) },
      twoWay: { bat: smoothTwoWay(w?.battingTwoWay ?? {}), bowl: smoothTwoWay(w?.bowlingTwoWay ?? {}) },
      editionOpponentMix: { bat: mix(t, "battingByOppElo"), bowl: mix(t, "bowlingByOppElo") },
      windowVenueFactors: Object.fromEntries(Object.entries(w?.venueFactors ?? {}).map(([v, f]) => [v, f.factor])),
      editionConditionFactor: +(expectedRuns(pooledPop(editionPop)) / Math.max(0.2, expectedRuns(pooledPop(window.bat.full)))).toFixed(3),
      odiPop: balls > 0 && outs > 0 ? { strikeRate: (100 * runs) / balls, ballsPerOut: balls / outs } : null,
    });
  }
  return out;
}

const phaseCounts = (block: BlockIn, skill: Skill, phase: Phase) => block[skill].phases[phase] ?? { balls: 0, runs: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } };
const totalBalls = (block: BlockIn, skill: Skill) => PHASE_LIST.reduce((a, p) => a + phaseCounts(block, skill, p).balls, 0);

/**
 * ODI-derived relative vector: scale scoring outcomes by the player's ODI strike rate relative
 * to the era, and the dismissal cell by the era's balls-per-dismissal relative to the player's.
 * Crude by design; it carries only `odiPriorStrength` pseudo-balls of weight.
 */
function odiRelative(pe: PlayerEditionIn, ctx: EditionContext, skill: Skill): { rel: Vector; balls: number } | null {
  const s = pe.odiCareerToDate.summary;
  if (!ctx.odiPop) return null;
  if (skill === "bat") {
    if (s.bat.balls < 300 || s.bat.strikeRate === null) return null;
    const outs = s.bat.innings > 0 && s.bat.average ? s.bat.runs / s.bat.average : 0;
    const bpo = outs > 0 ? s.bat.balls / outs : ctx.odiPop.ballsPerOut;
    const srRatio = s.bat.strikeRate / ctx.odiPop.strikeRate;
    const hazardRatio = ctx.odiPop.ballsPerOut / bpo;
    return { rel: { "0": 1 / Math.sqrt(srRatio), "1": 1, "2": srRatio, "3": srRatio, "4": srRatio, "6": srRatio, W: hazardRatio }, balls: s.bat.balls };
  }
  if (s.bowl.balls < 600 || s.bowl.economy === null) return null;
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

function rateSkill(pe: PlayerEditionIn, ctx: EditionContext, skill: Skill, options: RateOptions = {}): Omit<SkillRating, "percentile" | "display"> {
  const merged: Required<RateOptions> = { ...DEFAULT_OPTIONS, ...options };
  const m = skill === "bowl" ? merged.bowlPriorMultiplier : 1;
  const opts: Required<RateOptions> = { ...merged, priorStrength: merged.priorStrength * m, phasePriorStrength: merged.phasePriorStrength * m, careerPriorStrength: merged.careerPriorStrength * m };
  const c = opts.priorStrength;
  const windowPop = ctx.window[skill];
  const formBalls = totalBalls(pe.form, skill);
  const careerBalls = totalBalls(pe.careerToDate, skill);
  const odi = odiRelative(pe, ctx, skill);
  const vectors = {} as PhaseVectors;
  const rel = {} as PhaseVectors;
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
    const own = meanOpponentElo(pe.formExposure[skill]);
    const dest = meanOpponentElo(ctx.editionOpponentMix[skill]);
    if (own !== null && dest !== null && dest > own) transfer = Math.max(0.1, 1 - (dest - own) / opts.transferScaleElo);
  }
  if (opts.tierMode[skill] === "twoWay" && pe.teamElo !== null) {
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

  for (const phase of PHASE_LIST) {
    let cell: { rel: Vector; source: "form" | "career" } | null;
    if (opts.phasePooling === "pooled") cell = pooled;
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
      else if (source === "population") source = "career";
    } else if (odi) {
      phaseRel = blend([{ rel: odi.rel, weight: MODEL.odiPriorStrength }, { rel: UNIT, weight: c }]);
      if (source === "population") source = "odi";
    } else {
      phaseRel = UNIT;
    }
    // Thin form + usable ODI prior: let the ODI evidence pull the relative vector toward itself.
    if (odi && formBalls + careerBalls < c) {
      phaseRel = blend([{ rel: phaseRel, weight: formBalls + careerBalls + c }, { rel: odi.rel, weight: MODEL.odiPriorStrength }]);
      if (source !== "form") source = "odi";
    }
    // Venue normalisation: scoring cells earned on flatter grounds are deflated (and vice versa);
    // the dismissal cell is left alone.
    if (venueFactor !== 1) phaseRel = Object.fromEntries(OUTCOMES.map((k) => [k, k === "W" || k === "0" ? phaseRel[k] : phaseRel[k] / venueFactor])) as Vector;
    rel[phase] = phaseRel;
    // Carry only the transferable share of the edge (log-scaled) into stronger opposition.
    const carried = transfer === 1 ? phaseRel : (Object.fromEntries(OUTCOMES.map((k) => [k, Math.pow(phaseRel[k], transfer)])) as Vector);
    vectors[phase] = transport(carried, destinations[phase]);
    valueByPhase[phase] = skill === "bat" ? battingValue(vectors[phase], valuePop[phase], opts.wicketCost) : bowlingValue(vectors[phase], valuePop[phase], opts.wicketCost);
  }

  const value = PHASE_LIST.reduce((a, p) => a + MODEL.phaseWeights[p] * valueByPhase[p], 0);
  return {
    vectors,
    relative: rel,
    value: +value.toFixed(2),
    valueByPhase: Object.fromEntries(PHASE_LIST.map((p) => [p, +valueByPhase[p].toFixed(2)])) as Record<Phase, number>,
    evidence: {
      formBalls,
      formBallsVsFull: totalBalls(pe.formByOpposition.full, skill),
      formBallsVsAssociate: totalBalls(pe.formByOpposition.associate, skill),
      careerBalls,
      odiBalls: skill === "bat" ? pe.odiCareerToDate.summary.bat.balls : pe.odiCareerToDate.summary.bowl.balls,
      source,
      transfer: +transfer.toFixed(3),
      venueFactor: +venueFactor.toFixed(3),
    },
    // The badge lifts when the form window is thin but a substantial ODI record stands in (2007/2009).
    lowSample: formBalls < (skill === "bat" ? MODEL.badge.batBalls : MODEL.badge.bowlBalls) && !(odi && odi.balls >= (skill === "bat" ? 600 : 900)),
  };
}

const UNIT: Vector = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "6": 1, W: 1 };

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
};

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
    return { pe, ctx, bat: rateSkill(pe, ctx, "bat", opts), bowl: rateSkill(pe, ctx, "bowl", opts) };
  });

  // Display ranks a conservative value: shrunk toward 0 by the evidence behind it (winner's-curse guard).
  const conservative = (s: Omit<SkillRating, "percentile" | "display">) => {
    const n = s.evidence.formBalls + s.evidence.careerBalls + (s.evidence.source === "odi" ? MODEL.odiPriorStrength : 0);
    return s.value * (n / (n + MODEL.displayEvidenceStrength));
  };
  // Display: percentile-anchored but linear in value, so the top is not compressed. The median
  // maps to 70, the 99th percentile to 99 and the 5th percentile to 45; values beyond those
  // anchors extrapolate linearly and clip to the display range.
  const toDisplay = (skill: Skill) => {
    const eligible = partial.filter((x) => !x[skill].lowSample).map((x) => conservative(x[skill])).sort((a, b) => a - b);
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

  return partial.map(({ pe, ctx, bat, bowl }) => {
    const batting: SkillRating = { ...bat, ...batDisplay(conservative(bat)) };
    const bowling: SkillRating = { ...bowl, ...bowlDisplay(conservative(bowl)) };
    const batBalls = bat.evidence.formBalls + bat.evidence.careerBalls;
    const bowlBalls = bowl.evidence.formBalls + bowl.evidence.careerBalls;
    // A role needs real evidence: a few career overs do not make a batter an all-rounder.
    const bowls = bowlBalls >= 150 && bowling.display >= 60;
    const bats = batBalls >= 150 && batting.display >= 60;
    const role: PlayerRating["role"] = bats && bowls ? "all-rounder" : bowls ? "bowler" : bats ? "batter" : batBalls + bowlBalls === 0 ? "unknown" : batting.display >= bowling.display ? "batter" : "bowler";
    const top = Math.max(batting.display, bowling.display);
    const second = Math.min(batting.display, bowling.display);
    const overall = Math.min(MODEL.display.max, Math.round(top + (role === "all-rounder" ? 0.1 * (second - MODEL.display.min) : 0)));
    return {
      personId: pe.personId,
      name: pe.name,
      editionId: pe.editionId,
      team: pe.team,
      standIn: pe.standIn,
      batting,
      bowling,
      overall,
      role,
      position: positionBand(pe),
      bowlingPhases: bowlingPhases(pe),
      tournamentForm: tournamentForm(pe, ctx, batting, bowling),
      conditions: { editionConditionFactor: ctx.editionConditionFactor },
    };
  });
}

/** Sanity helper used by tests and the report: the expected runs per ball of a vector. */
export { expectedRuns, normalise, OUTCOMES };
export type { OutcomeKey };
