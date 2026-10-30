/**
 * Scoring-environment accumulator shared by the edition and venue profiles.
 * Feed it World Cup matches; read back runs per over, dot/boundary rates, dismissal
 * fingerprint, dew proxy, toss norms, rain and DRS counts.
 */

import { OUTCOME_KEYS, PHASES, isNaturalFirstInnings, mainInnings, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { mean, pct, ratio, round, stddev } from "../util/stats.js";
import { bowlClassOf } from "./matchups.js";

interface PhaseTotals {
  balls: number;
  runs: number;
  outcomes: Record<OutcomeKey, number>;
}

interface BowlTotals {
  balls: number;
  runs: number;
  wickets: number;
}

/** Bowling-type lookup (Cricinfo code by person id) for the pace/spin split; set once by the build from the labels file. */
let bowlingTypeOf: (personId: string) => string | undefined = () => undefined;
export function setBowlingTypeLookup(fn: (personId: string) => string | undefined): void {
  bowlingTypeOf = fn;
}

export class EnvironmentAccumulator {
  matches = 0;
  decided = 0;
  legalBalls = 0;
  runs = 0;
  dots = 0;
  fours = 0;
  sixes = 0;
  wickets = 0;
  wides = 0;
  noBalls = 0;
  extras = 0;
  byPhase: Record<Phase, PhaseTotals> = Object.fromEntries(
    PHASES.map((p) => [p, { balls: 0, runs: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } }]),
  ) as Record<Phase, PhaseTotals>;
  /** Legal balls per phase from full innings only, the denominator for `populationVectors`. */
  vectorBalls: Record<Phase, number> = { pp: 0, mid: 0, death: 0 };
  reducedInnings = 0;
  firstInningsTotals: number[] = [];
  inn1 = { balls: 0, runs: 0 };
  inn2 = { balls: 0, runs: 0 };
  chaseWins = 0;
  chaseDecided = 0;
  tossField = 0;
  tossWinnerWon = 0;
  dismissalKinds = new Map<string, number>();
  reviews = { total: 0, upheld: 0, umpiresCall: 0, byBattingSide: 0 };
  dlFinishes = 0;
  noResults = 0;
  ties = 0;
  /** Legal balls faced by batting position (index 0 = opener 1 … 10 = No. 11) and phase: what a slot actually faces. */
  positionPhase: Record<Phase, number>[] = Array.from({ length: 11 }, () => ({ pp: 0, mid: 0, death: 0 }));
  /** Bowling by pace and spin (balls legal, runs charged to the bowler, wickets credited), unknown types apart. */
  byBowlClass: Record<"pace" | "spin" | "unknown", BowlTotals> = { pace: { balls: 0, runs: 0, wickets: 0 }, spin: { balls: 0, runs: 0, wickets: 0 }, unknown: { balls: 0, runs: 0, wickets: 0 } };

  add(m: Match): void {
    this.matches += 1;
    if (m.tossDecision === "field") this.tossField += 1;
    if (m.method && /D\/?L/i.test(m.method)) this.dlFinishes += 1;
    if (m.result === "tie") this.ties += 1;
    const inns = mainInnings(m);
    // A tie settled by super over or bowl-out counts as decided for the side that won it.
    const winner = m.winner ?? m.tieWinner;
    if (!winner) {
      if (m.result === "no result" || inns.length < 2) this.noResults += 1;
    } else {
      this.decided += 1;
      if (winner === m.tossWinner) this.tossWinnerWon += 1;
      if (inns.length >= 2) {
        this.chaseDecided += 1;
        if (winner === inns[1]?.team) this.chaseWins += 1;
      }
    }

    inns.forEach((inn, idx) => {
      if (inn.reduced) this.reducedInnings += 1;
      if (idx === 0 && isNaturalFirstInnings(inn)) this.firstInningsTotals.push(inn.total);
      const side = idx === 0 ? this.inn1 : this.inn2;
      // Batting order by first appearance at either end (Cricsheet gives no explicit position).
      const order: string[] = [];
      for (const b of inn.balls) {
        for (const id of [b.batter, b.nonStriker]) if (!order.includes(id)) order.push(id);
        const cls = bowlClassOf(bowlingTypeOf(b.bowler));
        const bowlTotals = this.byBowlClass[cls === null ? "unknown" : cls.startsWith("pace") ? "pace" : "spin"];
        bowlTotals.runs += b.runsConceded;
        if (b.legal) {
          bowlTotals.balls += 1;
          if (b.wickets.some((w) => w.bowlerCredited)) bowlTotals.wickets += 1;
          const pos = Math.min(11, order.indexOf(b.batter) + 1);
          this.positionPhase[pos - 1]![phaseOf(b.over)] += 1;
        }
        this.extras += b.runsExtras;
        if (b.wide) this.wides += 1;
        if (b.noBall) this.noBalls += 1;
        for (const w of b.wickets) {
          if (w.kind === "retired hurt" || w.kind === "retired not out") continue;
          this.wickets += 1;
          this.dismissalKinds.set(w.kind, (this.dismissalKinds.get(w.kind) ?? 0) + 1);
        }
        if (b.review) {
          this.reviews.total += 1;
          if (b.review.decision === "upheld") this.reviews.upheld += 1;
          if (b.review.umpiresCall) this.reviews.umpiresCall += 1;
          if (b.review.byBattingSide) this.reviews.byBattingSide += 1;
        }
        if (b.isFour) this.fours += 1;
        if (b.isSix) this.sixes += 1;
        // Runs count on every delivery (wides and no-balls included); only legal balls count as balls,
        // so runs-per-over matches scorecard run rates.
        this.runs += b.runsTotal;
        side.runs += b.runsTotal;
        const ph = this.byPhase[phaseOf(b.over)];
        ph.runs += b.runsTotal;
        if (!b.legal) continue;
        this.legalBalls += 1;
        side.balls += 1;
        if (b.runsTotal === 0) this.dots += 1;
        ph.balls += 1;
        // Population outcome vectors come from full innings only (see Innings.reduced).
        if (inn.reduced) continue;
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        const key: OutcomeKey = strikerOut ? "W" : b.runsBatter >= 6 ? "6" : b.runsBatter === 5 ? "4" : (String(b.runsBatter) as OutcomeKey);
        this.vectorBalls[phaseOf(b.over)] += 1;
        ph.outcomes[key] += 1;
      }
    });
  }

  summary() {
    const rpo = (runs: number, balls: number) => ratio(6 * runs, balls, 2);
    const fingerprint: Record<string, number> = {};
    for (const [k, v] of [...this.dismissalKinds.entries()].sort((a, b) => b[1] - a[1])) fingerprint[k] = pct(v, this.wickets);
    const populationVectors = {} as Record<Phase, Record<OutcomeKey, number> | null>;
    for (const p of PHASES) {
      const ph = this.byPhase[p];
      const n = this.vectorBalls[p];
      populationVectors[p] = n === 0 ? null : (Object.fromEntries(OUTCOME_KEYS.map((k) => [k, round(ph.outcomes[k] / n, 4)])) as Record<OutcomeKey, number>);
    }
    return {
      matches: this.matches,
      decided: this.decided,
      legalBalls: this.legalBalls,
      runsPerOver: rpo(this.runs, this.legalBalls),
      dotPct: pct(this.dots, this.legalBalls),
      fourPct: pct(this.fours, this.legalBalls),
      sixPct: pct(this.sixes, this.legalBalls),
      ballsPerWicket: ratio(this.legalBalls, this.wickets, 1),
      powerplayRpo: rpo(this.byPhase.pp.runs, this.byPhase.pp.balls),
      middleRpo: rpo(this.byPhase.mid.runs, this.byPhase.mid.balls),
      deathRpo: rpo(this.byPhase.death.runs, this.byPhase.death.balls),
      firstInningsAvg: mean(this.firstInningsTotals, 1),
      firstInningsSd: stddev(this.firstInningsTotals, 1),
      chaseWinPct: pct(this.chaseWins, this.chaseDecided, 0),
      tossFieldPct: pct(this.tossField, this.matches, 0),
      tossWinnerWinPct: pct(this.tossWinnerWon, this.decided, 0),
      /**
       * 2nd-innings RPO minus 1st-innings RPO. Positive = chasing scored faster. Reflects dew
       * where present, but also target knowledge and chase intent, hence "uplift" not "dew".
       */
      chaseUplift: round(rpo(this.inn2.runs, this.inn2.balls) - rpo(this.inn1.runs, this.inn1.balls), 2),
      reducedInnings: this.reducedInnings,
      widesPerOver: ratio(6 * this.wides, this.legalBalls, 2),
      noBallsPerOver: ratio(6 * this.noBalls, this.legalBalls, 3),
      extrasPerOver: ratio(6 * this.extras, this.legalBalls, 2),
      dismissalFingerprintPct: fingerprint,
      reviews: {
        total: this.reviews.total,
        upheldPct: pct(this.reviews.upheld, this.reviews.total, 0),
        umpiresCallPct: pct(this.reviews.umpiresCall, this.reviews.total, 0),
        byBattingSidePct: pct(this.reviews.byBattingSide, this.reviews.total, 0),
      },
      rain: { dlFinishes: this.dlFinishes, noResults: this.noResults },
      ties: this.ties,
      populationVectors,
      /** Legal balls faced by batting position ("1" … "11") and phase: the overs a slot actually bats in. */
      positionPhaseBalls: Object.fromEntries(this.positionPhase.map((row, i) => [String(i + 1), { ...row }])) as Record<string, Record<Phase, number>>,
      /** Pace against spin at this ground / in this edition (bowling types from the labels file). */
      paceSpin: {
        pace: { balls: this.byBowlClass.pace.balls, rpo: rpo(this.byBowlClass.pace.runs, this.byBowlClass.pace.balls), ballsPerWicket: ratio(this.byBowlClass.pace.balls, this.byBowlClass.pace.wickets, 1), sharePct: pct(this.byBowlClass.pace.balls, this.legalBalls, 0) },
        spin: { balls: this.byBowlClass.spin.balls, rpo: rpo(this.byBowlClass.spin.runs, this.byBowlClass.spin.balls), ballsPerWicket: ratio(this.byBowlClass.spin.balls, this.byBowlClass.spin.wickets, 1), sharePct: pct(this.byBowlClass.spin.balls, this.legalBalls, 0) },
        unknownPct: pct(this.byBowlClass.unknown.balls, this.legalBalls, 0),
      },
    };
  }
}

export type EnvironmentSummary = ReturnType<EnvironmentAccumulator["summary"]>;
