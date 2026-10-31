/**
 * `PlayerBlock` is the unit of per-player accumulation. The same shape is used for a player's
 * World Cup record in an edition, their form window before it, and their career-to-date
 * snapshot at the edition's start, so downstream code reads all three identically.
 */

import { OUTCOME_KEYS, PHASES, phaseOf, type Innings, type OutcomeKey, type Phase } from "../cricsheet/match.js";

export type OutcomeCounts = Record<OutcomeKey, number>;

export interface PhaseCounts {
  balls: number;
  runs: number;
  outcomes: OutcomeCounts;
  /**
   * Phase 1.5: the sum over the same balls of what an average player would have done in each
   * ball's context (period × opponent strength × venue). `outcomes ÷ expected` is the player's
   * context-neutral relative vector; empty (all zero) when no context model was supplied.
   */
  expected: OutcomeCounts;
}

export interface BatBlock {
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highScore: number;
  highScoreNotOut: boolean;
  fifties: number;
  hundreds: number;
  ducks: number;
  /** batting position → innings count */
  positions: Record<string, number>;
  /** dismissal kind → count (striker or non-striker) */
  dismissals: Record<string, number>;
  /** run-outs while at the non-striker's end (not charged to the batting vector) */
  nonStrikerRunOuts: number;
  phases: Record<Phase, PhaseCounts>;
}

export interface BowlBlock {
  innings: number;
  balls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  dots: number;
  fours: number;
  sixes: number;
  best: { wickets: number; runs: number } | null;
  fourFors: number;
  /** overs bowled per phase */
  oversByPhase: Record<Phase, number>;
  /** conceded-outcome per legal ball; `W` = bowler-credited wicket */
  phases: Record<Phase, PhaseCounts>;
}

export interface FieldBlock {
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface PlayerBlock {
  matches: number;
  bat: BatBlock;
  bowl: BowlBlock;
  field: FieldBlock;
}

const emptyOutcomes = (): OutcomeCounts => ({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 });
const emptyPhases = (): Record<Phase, PhaseCounts> =>
  Object.fromEntries(PHASES.map((p) => [p, { balls: 0, runs: 0, outcomes: emptyOutcomes(), expected: emptyOutcomes() }])) as Record<Phase, PhaseCounts>;

/** Supplies, per ball, the context-expected outcome probabilities for the striker and the bowler. */
export interface BallContext {
  bat: (ball: { over: number }) => OutcomeCounts;
  bowl: (ball: { over: number }) => OutcomeCounts;
}

export function emptyBlock(): PlayerBlock {
  return {
    matches: 0,
    bat: {
      innings: 0, notOuts: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
      highScore: 0, highScoreNotOut: false, fifties: 0, hundreds: 0, ducks: 0,
      positions: {}, dismissals: {}, nonStrikerRunOuts: 0, phases: emptyPhases(),
    },
    bowl: {
      innings: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, dots: 0, fours: 0, sixes: 0,
      best: null, fourFors: 0,
      oversByPhase: { pp: 0, mid: 0, death: 0 }, phases: emptyPhases(),
    },
    field: { catches: 0, stumpings: 0, runOuts: 0 },
  };
}

export function cloneBlock(b: PlayerBlock): PlayerBlock {
  return structuredClone(b);
}

function outcomeKey(runs: number, wicket: boolean): OutcomeKey {
  if (wicket) return "W";
  if (runs >= 6) return "6";
  if (runs === 5) return "4"; // overthrows; fold into the boundary bucket
  return String(runs) as OutcomeKey;
}

/**
 * Add every player's contribution from one innings into `blocks` (person id → block).
 * `touched` collects the ids seen so callers can bump `matches` once per match.
 *
 * Phase outcome vectors are skipped for reduced innings (rain), because over indices no longer
 * map to powerplay/middle/death; innings-level figures (runs, wickets, averages) still count.
 */
export function addInnings(
  innings: Innings,
  blocks: (id: string) => PlayerBlock,
  touched: Set<string>,
  opts: { phaseVectors?: boolean; context?: BallContext } = {},
): void {
  // ODI innings pass phaseVectors: false — T20 phase boundaries mean nothing over 50 overs.
  const phaseVectors = (opts.phaseVectors ?? true) && !innings.reduced;

  // Ball-level: batting outcome vectors, bowling outcome vectors, fielding credits.
  for (const ball of innings.balls) {
    const ph = phaseOf(ball.over);
    const strikerOut = ball.wickets.some((w) => w.playerOut === ball.batter);
    const nonStrikerOut = ball.wickets.some((w) => w.playerOut === ball.nonStriker && w.playerOut !== ball.batter);

    // A wide is not a ball faced, but a dismissal off one (stumped, run out) is still a hazard
    // event for the striker, so it enters the vector as a dismissal "ball".
    if (phaseVectors && (!ball.wide || strikerOut)) {
      const bat = blocks(ball.batter).bat;
      const pc = bat.phases[ph];
      pc.balls += 1;
      pc.runs += ball.runsBatter;
      pc.outcomes[outcomeKey(ball.runsBatter, strikerOut)] += 1;
      const e = opts.context ? opts.context.bat(ball) : null;
      if (e) for (const k of OUTCOME_KEYS) pc.expected[k] += e[k];
      touched.add(ball.batter);
    }
    if (nonStrikerOut) {
      blocks(ball.nonStriker).bat.nonStrikerRunOuts += 1;
      touched.add(ball.nonStriker);
    }

    const bowl = blocks(ball.bowler).bowl;
    touched.add(ball.bowler);
    const credited = ball.wickets.some((w) => w.bowlerCredited);
    if (ball.legal && phaseVectors) {
      const pc = bowl.phases[ph];
      pc.balls += 1;
      pc.runs += ball.runsConceded;
      pc.outcomes[outcomeKey(ball.runsConceded, credited)] += 1;
      if (opts.context) {
        const e = opts.context.bowl(ball);
        for (const k of OUTCOME_KEYS) pc.expected[k] += e[k];
      }
    }
    if (ball.legal && ball.runsConceded === 0 && !credited) bowl.dots += 1;
    if (ball.isFour) bowl.fours += 1;
    if (ball.isSix) bowl.sixes += 1;

    for (const w of ball.wickets) {
      const f = w.fielders[0];
      if (!f) continue;
      const field = blocks(f).field;
      touched.add(f);
      if (w.kind === "caught") field.catches += 1;
      else if (w.kind === "stumped") field.stumpings += 1;
      else if (w.kind === "run out") field.runOuts += 1;
    }
  }

  // Innings-level batting figures.
  for (const bi of innings.batters.values()) {
    const bat = blocks(bi.id).bat;
    touched.add(bi.id);
    bat.innings += 1;
    bat.runs += bi.runs;
    bat.balls += bi.balls;
    bat.fours += bi.fours;
    bat.sixes += bi.sixes;
    if (!bi.out) bat.notOuts += 1;
    if (bi.out && bi.dismissalKind) bat.dismissals[bi.dismissalKind] = (bat.dismissals[bi.dismissalKind] ?? 0) + 1;
    if (bi.runs > bat.highScore || (bi.runs === bat.highScore && !bi.out && !bat.highScoreNotOut)) {
      bat.highScore = bi.runs;
      bat.highScoreNotOut = !bi.out;
    }
    if (bi.runs >= 100) bat.hundreds += 1;
    else if (bi.runs >= 50) bat.fifties += 1;
    if (bi.runs === 0 && bi.out) bat.ducks += 1;
    bat.positions[String(bi.position)] = (bat.positions[String(bi.position)] ?? 0) + 1;
  }

  // Innings-level bowling figures.
  for (const bw of innings.bowlers.values()) {
    const bowl = blocks(bw.id).bowl;
    bowl.innings += 1;
    bowl.balls += bw.balls;
    bowl.runs += bw.runs;
    bowl.wickets += bw.wickets;
    bowl.wides += bw.wides;
    bowl.noBalls += bw.noBalls;
    if (bw.wickets >= 4) bowl.fourFors += 1;
    if (!bowl.best || bw.wickets > bowl.best.wickets || (bw.wickets === bowl.best.wickets && bw.runs < bowl.best.runs)) {
      bowl.best = { wickets: bw.wickets, runs: bw.runs };
    }
    for (const o of bw.overs) bowl.oversByPhase[phaseOf(o)] += 1;
  }
}

/** Derived, display-ready summary of a block (averages, strike rates, economy). */
export function summariseBlock(b: PlayerBlock) {
  const outs = b.bat.innings - b.bat.notOuts;
  return {
    matches: b.matches,
    bat: {
      innings: b.bat.innings,
      runs: b.bat.runs,
      balls: b.bat.balls,
      average: outs > 0 ? +(b.bat.runs / outs).toFixed(2) : null,
      strikeRate: b.bat.balls > 0 ? +((100 * b.bat.runs) / b.bat.balls).toFixed(1) : null,
      highScore: b.bat.innings > 0 ? `${b.bat.highScore}${b.bat.highScoreNotOut ? "*" : ""}` : null,
      fifties: b.bat.fifties,
      hundreds: b.bat.hundreds,
      fours: b.bat.fours,
      sixes: b.bat.sixes,
    },
    bowl: {
      innings: b.bowl.innings,
      balls: b.bowl.balls,
      runs: b.bowl.runs,
      wickets: b.bowl.wickets,
      economy: b.bowl.balls > 0 ? +((6 * b.bowl.runs) / b.bowl.balls).toFixed(2) : null,
      strikeRate: b.bowl.wickets > 0 ? +(b.bowl.balls / b.bowl.wickets).toFixed(1) : null,
      average: b.bowl.wickets > 0 ? +(b.bowl.runs / b.bowl.wickets).toFixed(2) : null,
      best: b.bowl.best ? `${b.bowl.best.wickets}/${b.bowl.best.runs}` : null,
      fourFors: b.bowl.fourFors,
    },
    field: { ...b.field },
  };
}

/** Phase outcome vector as probabilities (null when no balls). */
export function phaseProbabilities(pc: PhaseCounts): Record<OutcomeKey, number> | null {
  if (pc.balls === 0) return null;
  const out = {} as Record<OutcomeKey, number>;
  for (const k of OUTCOME_KEYS) out[k] = +(pc.outcomes[k] / pc.balls).toFixed(4);
  return out;
}
