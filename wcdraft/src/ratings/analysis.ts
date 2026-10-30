/**
 * Validation and derived lists for the ratings:
 *   - predictive validity: does the pre-tournament rating predict what happened in the tournament?
 *   - stability: does a player's rating persist from one edition to the next?
 *   - prior-strength sweep over both
 *   - Timeless candidates
 *   - audit against the hand-rated card roster
 */

import { existsSync } from "node:fs";
import type { Phase } from "../cricsheet/match.js";
import { ELO_BINS, eloBin, type EloBin } from "../analysis/team-strength.js";
import type { BuildResult } from "../pipeline/build.js";
import { paths, readJson } from "../util/io.js";
import { MODEL, OUTCOMES, PHASE_LIST, RUNS, type PhaseVectors, type PlayerEditionIn, type PlayerRating, type Vector } from "./model.js";
import { buildContexts, DEFAULT_OPTIONS, mixtureByExposure, rateAll, type RateOptions } from "./rate.js";
import { battingValue, bowlingValue, expectedRuns, normalise, toVector } from "./vectors.js";

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? +(sxy / Math.sqrt(sxx * syy)).toFixed(3) : null;
}

export function spearman(xs: number[], ys: number[]): number | null {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j += 1;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) r[idx[k]![1]] = avg;
      i = j + 1;
    }
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

interface RawValue {
  /** valued against the edition population (what actually happened in the World Cup) */
  edition: number | null;
  /** valued against the population of the tier faced, innings by innings (opposition-adjusted) */
  tiered: number | null;
  balls: number;
  /** components of the edition target: runs per ball and dismissal rate, pooled over phases */
  runsPerBall: number | null;
  hazard: number | null;
}

/** Pooled runs per ball and dismissal rate of a block (for component diagnostics). */
function components(block: { phases: Record<string, { balls: number; outcomes: Record<string, number> }> }): { runsPerBall: number | null; hazard: number | null; balls: number } {
  let balls = 0, runs = 0, outs = 0;
  for (const p of PHASE_LIST) {
    const pc = block.phases[p];
    if (!pc) continue;
    balls += pc.balls;
    outs += pc.outcomes["W"] ?? 0;
    for (const [k, n] of Object.entries(pc.outcomes)) runs += (k === "W" ? 0 : Number(k)) * n;
  }
  return { runsPerBall: balls ? runs / balls : null, hazard: balls ? outs / balls : null, balls };
}

/** Phase-weighted runs per ball and dismissal rate of a model's vectors. */
function modelComponents(v: PhaseVectors): { runsPerBall: number; hazard: number } {
  let r = 0, h = 0;
  for (const p of PHASE_LIST) {
    r += MODEL.phaseWeights[p] * expectedRuns(v[p]);
    h += MODEL.phaseWeights[p] * v[p].W;
  }
  return { runsPerBall: r, hazard: h };
}

/** Raw (unshrunk) value of a block's phase counts against a population per phase. */
function rawValue(
  block: { phases: Record<string, { balls: number; outcomes: Record<string, number> }> },
  pops: PhaseVectors,
  skill: "bat" | "bowl",
  wicketCost = MODEL.wicketCost,
): { value: number | null; balls: number } {
  let balls = 0, v = 0;
  for (const p of PHASE_LIST) {
    const pc = block.phases[p];
    if (!pc || pc.balls === 0) continue;
    const vec = normalise(toVector(Object.fromEntries(Object.entries(pc.outcomes).map(([k, n]) => [k, n / pc.balls])), pops[p]));
    v += pc.balls * (skill === "bat" ? battingValue(vec, pops[p], wicketCost) : bowlingValue(vec, pops[p], wicketCost));
    balls += pc.balls;
  }
  return { value: balls ? v / balls : null, balls };
}

/** Raw tournament values (targets) and raw form values (like-for-like baselines) per player-edition. */
function rawValues(r: BuildResult): Map<string, { target: Record<"bat" | "bowl", RawValue>; formBaseline: Record<"bat" | "bowl", number | null> }> {
  const ctx = buildContexts(r);
  const out = new Map<string, { target: Record<"bat" | "bowl", RawValue>; formBaseline: Record<"bat" | "bowl", number | null> }>();
  for (const pe of r.playerEditions as unknown as PlayerEditionIn[]) {
    const c = ctx.get(pe.editionId)!;
    const per = (skill: "bat" | "bowl") => {
      // Same value population as the model (the edition's own batting / bowling outcomes), so a
      // per-edition level shift cannot masquerade as predictive signal across editions.
      const dest = skill === "bat" ? c.editionPop : c.editionBowlPop;
      const edition = rawValue(pe.tournament[skill], dest, skill);
      // Opposition-adjusted target: the tournament record valued against the tournament's own
      // population mixed over the opponent strengths this player actually faced.
      const adjustedPop = mixtureByExposure(c.tournamentByElo[skill], pe.tournamentExposure[skill], dest);
      const tiered = rawValue(pe.tournament[skill], adjustedPop, skill).value;
      // Baseline: raw form valued the same way the model's target is (edition population), no shrinkage, no tier.
      const formRaw = rawValue(pe.form[skill], dest, skill);
      const comp = components(pe.tournament[skill]);
      return { target: { edition: edition.value, tiered, balls: edition.balls, runsPerBall: comp.runsPerBall, hazard: comp.hazard }, formBaseline: formRaw.value };
    };
    const b = per("bat"), w = per("bowl");
    out.set(`${pe.personId}|${pe.editionId}`, { target: { bat: b.target, bowl: w.target }, formBaseline: { bat: b.formBaseline, bowl: w.formBaseline } });
  }
  return out;
}

/** Pearson correlation after removing each edition's mean from both series (ranking skill, free of level alignment). */
export function withinEdition(xs: number[], ys: number[], editions: string[]): number | null {
  const sums = new Map<string, { n: number; x: number; y: number }>();
  for (let i = 0; i < editions.length; i += 1) {
    const s = sums.get(editions[i]!) ?? sums.set(editions[i]!, { n: 0, x: 0, y: 0 }).get(editions[i]!)!;
    s.n += 1; s.x += xs[i]!; s.y += ys[i]!;
  }
  const dx: number[] = [], dy: number[] = [];
  for (let i = 0; i < editions.length; i += 1) {
    const s = sums.get(editions[i]!)!;
    if (s.n < 5) continue;
    dx.push(xs[i]! - s.x / s.n);
    dy.push(ys[i]! - s.y / s.n);
  }
  return pearson(dx, dy);
}

export interface PredictiveCell {
  n: number;
  /**
   * Within-edition correlations (each edition demeaned first): the primary ranking metric, because
   * the pooled correlation also rewards matching each edition's level, which depends on the field's
   * composition rather than on player skill.
   */
  within: { model: number | null; rawFormValue: number | null; rawFormRate: number | null };
  /** model rating vs tournament value against the edition population */
  model: number | null;
  /** model rating vs tournament value against the tier faced (opposition-adjusted target) */
  modelTiered: number | null;
  /** raw form value (same formula, no shrinkage, no tier) vs the edition target */
  rawFormValue: number | null;
  /** raw form strike rate / economy vs the edition target */
  rawFormRate: number | null;
  /** career strike rate / economy vs the edition target */
  careerRate: number | null;
  /** component diagnostics: model runs-per-ball vs tournament runs-per-ball, model hazard vs tournament hazard, and the raw-form equivalents */
  runs: { model: number | null; rawForm: number | null };
  hazard: { model: number | null; rawForm: number | null };
}

export interface ValidationRow {
  variant: string;
  options: Required<RateOptions>;
  predictive: { batting: PredictiveCell; bowling: PredictiveCell };
  stability: { batting: { n: number; model: number | null; rawFormSR: number | null }; bowling: { n: number; model: number | null; rawFormEconomy: number | null } };
}

const base = (o: Partial<RateOptions>): Required<RateOptions> => ({ ...DEFAULT_OPTIONS, ...o });

type TM = "split" | "mixture" | "elo" | "twoWay" | "none";
const tiers = (bat: TM, bowl: TM) => ({ bat, bowl });

/** The Phase 1 defaults, for the like-for-like comparison rows. */
const PHASE1 = { evidence: "window" as const, priorStrength: 50, phasePriorStrength: 150, hazardPriorStrength: 1000 };

export const VALIDATION_VARIANTS: { variant: string; options: Required<RateOptions> }[] = [
  { variant: "DEFAULT (Phase 1.5): context-expected evidence, hierarchical(300), c=100 (bowl ×2), hazard 2000, career 50, linear transfer 300", options: base({}) },
  { variant: "Phase 1 default: window evidence (bat two-way / bowl elo), hierarchical(150), c=50, hazard 1000", options: base(PHASE1) },
  { variant: "Phase 1 window evidence with the Phase 1.5 priors", options: base({ evidence: "window" }) },
  // Context-expected path: structure
  { variant: "context-expected, Phase 1 priors (c=50, phase 150, hazard 1000)", options: base({ priorStrength: 50, phasePriorStrength: 150, hazardPriorStrength: 1000 }) },
  { variant: "context-expected, pooled phases", options: base({ phasePooling: "pooled" }) },
  { variant: "context-expected, per-phase (no pooling)", options: base({ phasePooling: "none" }) },
  { variant: "context-expected, no career prior", options: base({ careerPriorStrength: 0 }) },
  { variant: "context-expected, career prior 100", options: base({ careerPriorStrength: 100 }) },
  // Cohort centring
  { variant: "cohort centre: none", options: base({ cohortCentre: "none" }) },
  { variant: "cohort centre: all squads", options: base({ cohortCentre: "all" }) },
  // Edge transfer and tier destination
  { variant: "full transfer (scale 0)", options: base({ transferScaleElo: 0 }) },
  { variant: "transfer 200", options: base({ transferScaleElo: 200 }) },
  { variant: "transfer 450", options: base({ transferScaleElo: 450 }) },
  { variant: "transfer to the strongest third", options: base({ transferDestination: "topThird" }) },
  { variant: "transfer to the strongest third, scale 450", options: base({ transferDestination: "topThird", transferScaleElo: 450 }) },
  { variant: "transfer to the strongest third, scale 600", options: base({ transferDestination: "topThird", transferScaleElo: 600 }) },
  { variant: "tier destination on (two-way shape on the expected path)", options: base({ tierDestination: true }) },
  { variant: "tier destination on, transfer to the strongest third", options: base({ tierDestination: true, transferDestination: "topThird" }) },
  { variant: "tier destination on, cohort centre none", options: base({ tierDestination: true, cohortCentre: "none" }) },
  // Selection prior (usage): the sweep set the default weight to 0 — see the spec's Phase 1.5 results.
  { variant: "selection prior 0.5 (every miss counts)", options: base({ selectionWeight: 0.5 }) },
  { variant: "selection prior 0.5, shares below 0.5 only", options: base({ selectionWeight: 0.5, selectionMaxShare: 0.5 }) },
  { variant: "selection prior 1.0, shares below 0.5 only", options: base({ selectionWeight: 1, selectionMaxShare: 0.5 }) },
  // Shrinkage strengths around the default
  { variant: "c=50", options: base({ priorStrength: 50 }) },
  { variant: "c=150", options: base({ priorStrength: 150 }) },
  { variant: "phase prior 150", options: base({ phasePriorStrength: 150 }) },
  { variant: "phase prior 600", options: base({ phasePriorStrength: 600 }) },
  { variant: "hazard prior 1000", options: base({ hazardPriorStrength: 1000 }) },
  { variant: "hazard prior 4000", options: base({ hazardPriorStrength: 4000 }) },
  { variant: "bowl prior ×1", options: base({ bowlPriorMultiplier: 1 }) },
  { variant: "bowl prior ×4", options: base({ bowlPriorMultiplier: 4 }) },
  { variant: "wicket cost 0 (diagnostic)", options: base({ wicketCost: 0 }) },
  // Window-evidence controls kept for the record
  { variant: "window evidence, opposition none / none (control)", options: base({ ...PHASE1, tierMode: tiers("none", "none") }) },
  { variant: "window evidence, window-averaged venue normalisation on", options: base({ ...PHASE1, venueNormalisation: 1 }) },
];

/**
 * Predictive validity: pre-tournament rating (built from form, which excludes the tournament)
 * against raw tournament value, for player-editions with enough tournament balls.
 * Stability: rating at edition n vs rating at the person's next edition.
 */
export function validate(r: BuildResult, variants = VALIDATION_VARIANTS): ValidationRow[] {
  const raw = rawValues(r);
  const rows = r.playerEditions as unknown as PlayerEditionIn[];
  const byPerson = new Map<string, PlayerEditionIn[]>();
  for (const pe of rows) (byPerson.get(pe.personId) ?? byPerson.set(pe.personId, []).get(pe.personId)!).push(pe);

  return variants.map(({ variant, options }) => {
    const ratings = rateAll(r, options);
    const byKey = new Map(ratings.map((x) => [`${x.personId}|${x.editionId}`, x]));
    const pe = new Map(rows.map((x) => [`${x.personId}|${x.editionId}`, x]));

    // Predictive
    const cell = () => ({
      ed: [] as string[],
      model: [] as number[], modelT: [] as number[], rawValue: [] as number[], rawRate: [] as number[], career: [] as number[], target: [] as number[], targetT: [] as number[],
      mRuns: [] as number[], mHaz: [] as number[], fRuns: [] as number[], fHaz: [] as number[], tRuns: [] as number[], tHaz: [] as number[],
    });
    const pb = cell(), pw = cell();
    for (const [key, v] of raw) {
      const rt = byKey.get(key)!, x = pe.get(key)!;
      const tb = v.target.bat, tw = v.target.bowl;
      if (tb.edition !== null && tb.tiered !== null && tb.balls >= 60 && x.form.summary.bat.balls >= 60 && x.form.summary.bat.strikeRate !== null && v.formBaseline.bat !== null) {
        pb.ed.push(x.editionId);
        pb.model.push(rt.batting.value); pb.modelT.push(rt.batting.value); pb.rawValue.push(v.formBaseline.bat); pb.rawRate.push(x.form.summary.bat.strikeRate);
        pb.career.push(x.careerToDate.summary.bat.strikeRate ?? x.form.summary.bat.strikeRate); pb.target.push(tb.edition); pb.targetT.push(tb.tiered);
        const mc = modelComponents(rt.batting.vectors), fc = components(x.form.bat);
        pb.mRuns.push(mc.runsPerBall); pb.mHaz.push(mc.hazard); pb.fRuns.push(fc.runsPerBall ?? 0); pb.fHaz.push(fc.hazard ?? 0); pb.tRuns.push(tb.runsPerBall ?? 0); pb.tHaz.push(tb.hazard ?? 0);
      }
      if (tw.edition !== null && tw.tiered !== null && tw.balls >= 72 && x.form.summary.bowl.balls >= 72 && x.form.summary.bowl.economy !== null && v.formBaseline.bowl !== null) {
        pw.ed.push(x.editionId);
        pw.model.push(rt.bowling.value); pw.modelT.push(rt.bowling.value); pw.rawValue.push(v.formBaseline.bowl); pw.rawRate.push(-x.form.summary.bowl.economy);
        pw.career.push(-(x.careerToDate.summary.bowl.economy ?? x.form.summary.bowl.economy)); pw.target.push(tw.edition); pw.targetT.push(tw.tiered);
        const mc = modelComponents(rt.bowling.vectors), fc = components(x.form.bowl);
        pw.mRuns.push(mc.runsPerBall); pw.mHaz.push(mc.hazard); pw.fRuns.push(fc.runsPerBall ?? 0); pw.fHaz.push(fc.hazard ?? 0); pw.tRuns.push(tw.runsPerBall ?? 0); pw.tHaz.push(tw.hazard ?? 0);
      }
    }
    const predictiveCell = (c: ReturnType<typeof cell>): PredictiveCell => ({
      n: c.target.length,
      within: { model: withinEdition(c.model, c.target, c.ed), rawFormValue: withinEdition(c.rawValue, c.target, c.ed), rawFormRate: withinEdition(c.rawRate, c.target, c.ed) },
      model: pearson(c.model, c.target),
      modelTiered: pearson(c.modelT, c.targetT),
      rawFormValue: pearson(c.rawValue, c.target),
      rawFormRate: pearson(c.rawRate, c.target),
      careerRate: pearson(c.career, c.target),
      runs: { model: pearson(c.mRuns, c.tRuns), rawForm: pearson(c.fRuns, c.tRuns) },
      hazard: { model: pearson(c.mHaz, c.tHaz), rawForm: pearson(c.fHaz, c.tHaz) },
    });
    // Stability
    const sb = { model: [] as number[], raw: [] as number[], next: [] as number[], rawNext: [] as number[] };
    const sw = { model: [] as number[], raw: [] as number[], next: [] as number[], rawNext: [] as number[] };
    for (const list of byPerson.values()) {
      const sorted = [...list].sort((a, b) => a.editionId.localeCompare(b.editionId));
      for (let i = 0; i + 1 < sorted.length; i += 1) {
        const a = sorted[i]!, b = sorted[i + 1]!;
        const ra = byKey.get(`${a.personId}|${a.editionId}`)!, rb = byKey.get(`${b.personId}|${b.editionId}`)!;
        if (a.form.summary.bat.balls >= 60 && b.form.summary.bat.balls >= 60 && a.form.summary.bat.strikeRate !== null && b.form.summary.bat.strikeRate !== null) {
          sb.model.push(ra.batting.value); sb.next.push(rb.batting.value); sb.raw.push(a.form.summary.bat.strikeRate); sb.rawNext.push(b.form.summary.bat.strikeRate);
        }
        if (a.form.summary.bowl.balls >= 72 && b.form.summary.bowl.balls >= 72 && a.form.summary.bowl.economy !== null && b.form.summary.bowl.economy !== null) {
          sw.model.push(ra.bowling.value); sw.next.push(rb.bowling.value); sw.raw.push(a.form.summary.bowl.economy); sw.rawNext.push(b.form.summary.bowl.economy);
        }
      }
    }
    return {
      variant,
      options,
      predictive: { batting: predictiveCell(pb), bowling: predictiveCell(pw) },
      stability: {
        batting: { n: sb.model.length, model: pearson(sb.model, sb.next), rawFormSR: pearson(sb.raw, sb.rawNext) },
        bowling: { n: sw.model.length, model: pearson(sw.model, sw.next), rawFormEconomy: pearson(sw.raw, sw.rawNext) },
      },
    };
  });
}

export interface TransferGap {
  skill: "bat" | "bowl";
  /** Player-editions with ≥ minBalls in both the weak and the strong group. */
  n: number;
  /** OLS slope of the strong-opposition log edge on the weak-opposition log edge (1 = full transfer, 0 = none). */
  slope: number | null;
  correlation: number | null;
  /** Mean log edge in each group (0 = exactly what the context expected). */
  meanEdgeWeak: number | null;
  meanEdgeStrong: number | null;
  minBalls: number;
}

/**
 * Edge transfer against the strongest third (Phase 1.5). For each edition the "strong" group is
 * the Elo bins at or above the bin of the team ranked in the edition's top third by Elo at the
 * start; the "weak" group is every bin at least two below that. A player's edge in each group is
 * the log ratio of actual to context-expected runs net of the wicket cost, from the per-ball
 * context model (so weak and strong are already judged against their own baselines, and any
 * residual slope below 1 is genuine non-transfer rather than scoring-level difference).
 */
export function transferGaps(r: BuildResult, minBalls = 120): TransferGap[] {
  const rows = r.playerEditions as unknown as PlayerEditionIn[];
  const teamElos = new Map<string, Map<string, number>>();
  for (const pe of rows) if (pe.teamElo !== null) (teamElos.get(pe.editionId) ?? teamElos.set(pe.editionId, new Map()).get(pe.editionId)!).set(pe.team, pe.teamElo);
  const strongIndex = new Map<string, number>();
  for (const [ed, byTeam] of teamElos) {
    const elos = [...byTeam.values()].sort((a, b) => b - a);
    const threshold = elos[Math.ceil(elos.length / 3) - 1] ?? elos[0]!;
    strongIndex.set(ed, ELO_BINS.indexOf(eloBin(threshold)));
  }
  const net = (c: Record<string, number>) => OUTCOMES.reduce((a, k) => a + (k === "W" ? -MODEL.wicketCost : RUNS[k]) * (c[k] ?? 0), 0);
  return (["bat", "bowl"] as const).map((skill) => {
    const weak: number[] = [], strong: number[] = [];
    for (const pe of rows) {
      const si = strongIndex.get(pe.editionId);
      if (si === undefined) continue;
      const group = (pick: (i: number) => boolean) => {
        let balls = 0;
        const o: Record<string, number> = {}, e: Record<string, number> = {};
        for (const [bin, counts] of Object.entries(pe.formByOppBin)) {
          if (!pick(ELO_BINS.indexOf(bin as EloBin))) continue;
          balls += counts[skill].balls;
          for (const k of OUTCOMES) {
            o[k] = (o[k] ?? 0) + counts[skill].outcomes[k];
            e[k] = (e[k] ?? 0) + counts[skill].expected[k];
          }
        }
        if (balls < minBalls) return null;
        const a = net(o), x = net(e);
        if (a <= 0 || x <= 0) return null;
        return skill === "bat" ? Math.log(a / x) : Math.log(x / a);
      };
      const w = group((i) => i <= si - 2), s = group((i) => i >= si);
      if (w === null || s === null) continue;
      weak.push(w);
      strong.push(s);
    }
    const n = weak.length;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    let slope: number | null = null;
    if (n >= 3) {
      const mw = mean(weak)!, ms = mean(strong)!;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < n; i += 1) {
        sxy += (weak[i]! - mw) * (strong[i]! - ms);
        sxx += (weak[i]! - mw) ** 2;
      }
      slope = sxx > 0 ? +(sxy / sxx).toFixed(3) : null;
    }
    const round = (x: number | null) => (x === null ? null : +x.toFixed(3));
    return { skill, n, slope, correlation: n >= 3 ? round(pearson(weak, strong)) : null, meanEdgeWeak: round(mean(weak)), meanEdgeStrong: round(mean(strong)), minBalls };
  });
}

export interface TimelessCandidate {
  personId: string;
  name: string;
  skill: "batting" | "bowling";
  editions: string[];
  spanYears: number;
  bestDisplay: number;
}

/** Top-decile (by display) in ≥ 3 editions spanning ≥ 8 years. Yash curates the final list. */
export function timelessCandidates(ratings: PlayerRating[], editionYears: Map<string, number>): TimelessCandidate[] {
  const out: TimelessCandidate[] = [];
  for (const skill of ["batting", "bowling"] as const) {
    const threshold = 1 - MODEL.timeless.topFraction;
    const byPerson = new Map<string, PlayerRating[]>();
    for (const x of ratings) if (!x[skill].lowSample && x[skill].percentile >= threshold) (byPerson.get(x.personId) ?? byPerson.set(x.personId, []).get(x.personId)!).push(x);
    for (const [personId, list] of byPerson) {
      const editions = [...new Set(list.map((x) => x.editionId))].sort();
      const years = editions.map((e) => editionYears.get(e) ?? 0);
      const span = Math.max(...years) - Math.min(...years);
      if (editions.length >= MODEL.timeless.minEditions && span >= MODEL.timeless.minSpanYears) {
        out.push({ personId, name: list[0]!.name, skill, editions, spanYears: span, bestDisplay: Math.max(...list.map((x) => x[skill].display)) });
      }
    }
  }
  return out.sort((a, b) => b.editions.length - a.editions.length || a.name.localeCompare(b.name));
}

export interface CardAuditRow {
  card: string;
  kind: "batsman" | "bowler";
  tier: string;
  personId: string;
  name: string;
  latestEdition: string;
  display: number;
}

/** Match card names to people by surname + initial (unique matches only) and compare tier with latest display. */
export function auditCards(ratings: PlayerRating[]): { rows: CardAuditRow[]; byTier: Record<string, { n: number; meanDisplay: number }>; spearman: number | null } {
  const empty = { rows: [], byTier: {}, spearman: null };
  if (!existsSync(paths.cardsJson)) return empty;
  const cards = readJson<{ batsmen: { name: string; tier: string }[]; bowlers: { name: string; tier: string }[] }>(paths.cardsJson);
  const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const latest = new Map<string, PlayerRating>();
  for (const x of ratings) {
    if (x.standIn) continue;
    const cur = latest.get(x.personId);
    if (!cur || x.editionId > cur.editionId) latest.set(x.personId, x);
  }
  const people = [...latest.values()];
  const rows: CardAuditRow[] = [];
  const tierRank: Record<string, number> = { Elite: 4, Gold: 3, Silver: 2, Bronze: 1 };
  for (const kind of ["batsman", "bowler"] as const) {
    for (const card of kind === "batsman" ? cards.batsmen : cards.bowlers) {
      const parts = norm(card.name).split(/\s+/);
      const surname = parts[parts.length - 1] ?? "", initial = parts[0]?.[0] ?? "";
      const hits = people.filter((p) => {
        const pp = norm(p.name).split(/\s+/);
        return pp[pp.length - 1] === surname && pp[0]?.[0] === initial;
      });
      if (hits.length !== 1) continue;
      const p = hits[0]!;
      rows.push({ card: card.name, kind, tier: card.tier, personId: p.personId, name: p.name, latestEdition: p.editionId, display: kind === "batsman" ? p.batting.display : p.bowling.display });
    }
  }
  const byTier: Record<string, { n: number; meanDisplay: number }> = {};
  for (const t of Object.keys(tierRank)) {
    const list = rows.filter((x) => x.tier === t);
    if (list.length) byTier[t] = { n: list.length, meanDisplay: +(list.reduce((a, x) => a + x.display, 0) / list.length).toFixed(1) };
  }
  return { rows, byTier, spearman: spearman(rows.map((x) => tierRank[x.tier] ?? 0), rows.map((x) => x.display)) };
}

export type { Phase };
