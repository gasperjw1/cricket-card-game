/**
 * Innings and match simulation (design spec §7). Pure given its inputs and the seed.
 *
 * Rain (Phase 2b): a match may be a no-result, reduced before the start to N overs a side, or a
 * chase cut short and decided on the data-derived resource table (DLS-style par score). In a
 * reduced innings the situation tables are read at the equivalent 20-over position, so a 10-over
 * game has its powerplay, middle and death.
 */

import { phaseOf, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { streakBand } from "../analysis/situation.js";
import { OUTCOMES, RUNS } from "../ratings/model.js";
import { chooseBowler, type BowlerState } from "./allocation.js";
import { outcomeDistribution, type BallContext, type SituationModel } from "./ball.js";
import { ENGINE } from "./model.js";
import { Rng } from "./rng.js";
import { DISMISSAL_KINDS, type BallRecord, type BatterLine, type Dismissal, type DismissalKind, type EnginePlayer, type EngineTeam, type InningsResult, type MatchEnvironment, type MatchResult, type Partnership, type RainEvent } from "./types.js";

interface InningsOptions {
  index: 1 | 2;
  overs: number;
  target: number | null;
  /** Log-normal match effect shared by both innings. */
  matchEffect: number;
  /** Stop after this many legal balls (rain interrupts the innings). */
  cutAtBalls?: number;
}

/** Equivalent position in a 20-over innings, for the situation tables and phases. */
const equivalentOver = (over: number, overs: number): number => (overs >= 20 ? over : Math.min(19, Math.floor((over * 20) / overs)));

export function simulateInnings(batting: EngineTeam, bowling: EngineTeam, env: MatchEnvironment, situation: SituationModel, rng: Rng, opts: InningsOptions, log?: BallRecord[]): InningsResult {
  const byId = new Map(batting.players.map((p) => [p.id, p]));
  const order = batting.battingOrder.map((id) => byId.get(id)!).filter(Boolean);
  const lines = new Map<string, BatterLine>();
  const lineOf = (p: EnginePlayer, position: number) => {
    let l = lines.get(p.id);
    if (!l) lines.set(p.id, (l = { id: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, position }));
    return l;
  };
  const bowlers: BowlerState[] = bowling.players.map((p) => ({ player: p, overs: [], runsByOver: [] }));
  // Scorecard detail that does not feed back into play: bowler dots and extras, partnerships, and
  // how each wicket fell. Dismissal kinds come from the ground's fingerprint and fielders from the
  // bowling side (keeper for stumpings and a share of catches), on a forked stream so the match
  // itself is unchanged by them.
  const bowlStats = new Map<string, { dots: number; wides: number; noBalls: number }>();
  const statOf = (id: string) => bowlStats.get(id) ?? bowlStats.set(id, { dots: 0, wides: 0, noBalls: 0 }).get(id)!;
  const partnerships: Partnership[] = [];
  let stand = { batters: [order[0]!.id, order[1]!.id] as [string, string], runs: 0, balls: 0 };
  const dRng = rng.fork("dismissals");
  const keeper = bowling.players.find((p) => p.keeper) ?? null;
  // Off a no-ball or a free hit the striker can only be run out.
  const drawDismissal = (bowler: EnginePlayer, runOutOnly: boolean): Dismissal => {
    const kind = runOutOnly ? "run out" : DISMISSAL_KINDS[dRng.pick(DISMISSAL_KINDS.map((k) => env.dismissalMix[k]))]!;
    const ref = (p: EnginePlayer | null) => (p ? { id: p.id, name: p.name } : null);
    const pickFielder = (keeperShare: number): EnginePlayer => {
      if (keeper && dRng.chance(keeperShare)) return keeper;
      const pool = bowling.players.filter((p) => p.id !== bowler.id && p.id !== keeper?.id);
      return pool.length ? pool[Math.floor(dRng.next() * pool.length)]! : bowler;
    };
    const taken = (kind: DismissalKind, by: EnginePlayer | null, credited: EnginePlayer | null): Dismissal => ({ kind, bowler: ref(credited), fielder: ref(by), byKeeper: !!by && by.id === keeper?.id });
    switch (kind) {
      case "caught": return taken(kind, pickFielder(0.3), bowler);
      case "caught and bowled": return taken(kind, bowler, bowler);
      case "stumped": return taken(kind, keeper ?? pickFielder(0), bowler);
      case "run out": return taken(kind, pickFielder(0.15), null);
      default: return taken(kind, null, bowler);
    }
  };
  const phaseRuns = { pp: { runs: 0, balls: 0, wickets: 0 }, mid: { runs: 0, balls: 0, wickets: 0 }, death: { runs: 0, balls: 0, wickets: 0 } } as Record<Phase, { runs: number; balls: number; wickets: number }>;
  const fall: InningsResult["fallOfWickets"] = [];
  const outcomes: Record<OutcomeKey, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 };

  let runs = 0, wickets = 0, legalBalls = 0, extras = 0, byeBalls = 0, wides = 0, noBalls = 0, byes = 0;
  let nextIn = 2;
  let striker = order[0]!, nonStriker = order[1]!;
  lineOf(striker, 1);
  lineOf(nonStriker, 2);
  const inningsEffect = Math.exp(ENGINE.inningsEffectSd * rng.normal());
  // Good day / bad day: one log-normal scoring factor per batter and per bowler for this innings (mean 1).
  const dayFactor = (sd: number) => Math.exp(sd * rng.normal() - (sd * sd) / 2);
  const batDay = new Map(order.map((p) => [p.id, dayFactor(ENGINE.batterDaySd)]));
  const bowlDay = new Map(bowling.players.map((p) => [p.id, dayFactor(ENGINE.bowlerDaySd)]));
  const recent: number[] = [];
  const found = new Set<string>();
  let consecutiveDots = 0;
  const streakNow = () => streakBand(recent.length, recent.slice(-6).reduce((a, x) => a + x, 0));
  const chaseScale = opts.index === 2 ? 1 + env.chaseUplift / 2 : 1 - env.chaseUplift / 2;
  const scoringFactor = opts.matchEffect * inningsEffect * chaseScale;
  let previousBowler: string | null = null;
  const maxOvers = Math.max(1, Math.ceil(opts.overs / 5));
  const cut = opts.cutAtBalls ?? Infinity;
  const done = () => wickets >= 10 || (opts.target !== null && runs >= opts.target) || legalBalls >= cut;

  for (let over = 0; over < opts.overs && !done(); over += 1) {
    const eq = equivalentOver(over, opts.overs);
    const ph = phaseOf(eq);
    const intent = batting.intent?.[ph] ?? 0;
    const ctxBase: BallContext = { innings: opts.index, over: eq, wickets, strikerBalls: 0, requiredRpo: null, scoringFactor, playerFactor: 1, streak: streakNow(), ballInOver: 1, consecutiveDots, freeHit: false, intent };
    const b = chooseBowler({ over, eqOver: eq, oversInInnings: opts.overs, maxOvers, bowlers, previousBowler, batters: [striker, nonStriker], env, situation, ctx: ctxBase, captainZ: bowling.captainZ }, rng);
    b.overs.push(over);
    b.runsByOver.push(0);
    previousBowler = b.player.id;
    let ballsThisOver = 0, freeHit = false;
    while (ballsThisOver < 6 && !done()) {
      const ballsLeft = opts.overs * 6 - legalBalls;
      const requiredRpo = opts.target !== null ? ((opts.target - runs) * 6) / Math.max(1, ballsLeft) : null;
      // Extras first: a wide or no-ball does not count as a legal ball.
      if (rng.chance(env.extras[ph].wides)) {
        // A wide is one run plus, now and then, the runs the batters took off it (mean `runsPerWide`).
        const wideRuns = 1 + (rng.chance(Math.max(0, Math.min(1, (env.extras[ph].runsPerWide ?? 1) - 1))) ? 1 : 0);
        runs += wideRuns; extras += wideRuns; wides += wideRuns; stand.runs += wideRuns; b.runsByOver[b.runsByOver.length - 1]! += wideRuns; statOf(b.player.id).wides += 1; phaseRuns[ph].runs += wideRuns;
        log?.push({ innings: opts.index, over, ballInOver: ballsThisOver, striker: striker.id, nonStriker: nonStriker.id, bowler: b.player.id, outcome: "0", runsBatter: 0, extras: wideRuns, extraKind: "wide", wicket: false, dismissal: null, legal: false, runsAfter: runs, wicketsAfter: wickets });
        if (wideRuns % 2 === 0) [striker, nonStriker] = [nonStriker, striker];
        continue;
      }
      const noBall = rng.chance(env.extras[ph].noBalls);
      const sLine = lineOf(striker, lines.get(striker.id)?.position ?? nextIn);
      const ctx: BallContext = {
        innings: opts.index, over: eq, wickets, strikerBalls: sLine.balls, strikerFound: found.has(striker.id), requiredRpo, scoringFactor,
        playerFactor: (batDay.get(striker.id) ?? 1) * (bowlDay.get(b.player.id) ?? 1),
        streak: streakNow(), ballInOver: ballsThisOver + 1, consecutiveDots, freeHit: freeHit || noBall, intent,
      };
      const dist = outcomeDistribution(striker, b.player, env, situation, ctx);
      const outcome = OUTCOMES[rng.pick(OUTCOMES.map((k) => dist[k]))]!;
      let runsBatter = RUNS[outcome];
      let extraRuns = noBall ? 1 : 0;
      let extraKind: BallRecord["extraKind"] = noBall ? "no-ball" : null;
      // Byes and leg-byes: a dot ball sometimes yields a bye.
      if (outcome === "0" && !noBall && rng.chance(env.extras[ph].byes / Math.max(0.05, dist["0"]))) {
        extraRuns = 1; extraKind = "bye"; byeBalls += 1;
      }
      const wicket = outcome === "W";
      sLine.balls += 1; // A no-ball counts as a ball faced; only a wide does not.
      sLine.runs += runsBatter;
      if (outcome === "4") sLine.fours += 1;
      if (outcome === "6") sLine.sixes += 1;
      if (outcome === "4" || outcome === "6") found.add(striker.id);
      runs += runsBatter + extraRuns;
      extras += extraRuns;
      b.runsByOver[b.runsByOver.length - 1]! += runsBatter + (noBall ? 1 : 0);
      if (!noBall) { phaseRuns[ph].balls += 1; legalBalls += 1; ballsThisOver += 1; outcomes[outcome] += 1; }
      phaseRuns[ph].runs += runsBatter + extraRuns;
      const dismissal = wicket ? drawDismissal(b.player, noBall || freeHit) : null;
      const bs = statOf(b.player.id);
      if (noBall) { bs.noBalls += 1; noBalls += 1; }
      if (extraKind === "bye") byes += 1;
      if (!noBall && runsBatter === 0) bs.dots += 1;
      stand.runs += runsBatter + extraRuns;
      stand.balls += 1;
      log?.push({ innings: opts.index, over, ballInOver: ballsThisOver, striker: striker.id, nonStriker: nonStriker.id, bowler: b.player.id, outcome, runsBatter, extras: extraRuns, extraKind, wicket, dismissal, legal: !noBall, runsAfter: runs, wicketsAfter: wickets + (wicket ? 1 : 0) });
      freeHit = noBall;
      if (!noBall || wicket) recent.push(runsBatter);
      if (!noBall) consecutiveDots = runsBatter + extraRuns === 0 && !wicket ? consecutiveDots + 1 : 0;
      if (wicket) {
        sLine.out = true;
        sLine.dismissal = dismissal;
        wickets += 1;
        phaseRuns[ph].wickets += 1;
        fall.push({ runs, over, ball: ballsThisOver, batter: striker.id });
        partnerships.push({ ...stand, wicket: wickets });
        // Reset before the all-out check too, or the closing stand is booked twice.
        stand = { batters: [striker.id, nonStriker.id], runs: 0, balls: 0 };
        if (wickets >= 10 || nextIn >= order.length) break;
        striker = order[nextIn]!;
        lineOf(striker, nextIn + 1);
        nextIn += 1;
        stand = { batters: [striker.id, nonStriker.id], runs: 0, balls: 0 };
        continue;
      }
      // Non-striker run out (2026-11-01): drawn on the balls the striker scored 0–2 on, at the
      // measured per-ball rate for this innings and phase. The runs stand, the non-striker goes,
      // and the new batter comes in at that end.
      const nsoRate = ENGINE.nonStrikerRunOut[`${opts.index}|${ph}`];
      if (nsoRate && (outcome === "0" || outcome === "1" || outcome === "2") && rng.chance(nsoRate / ENGINE.nonStrikerRunOut.onOutcomes!)) {
        const nLine = lineOf(nonStriker, lines.get(nonStriker.id)?.position ?? nextIn);
        const d = { ...drawDismissal(b.player, true), nonStriker: true };
        nLine.out = true;
        nLine.dismissal = d;
        wickets += 1;
        phaseRuns[ph].wickets += 1;
        fall.push({ runs, over, ball: ballsThisOver, batter: nonStriker.id });
        partnerships.push({ ...stand, wicket: wickets });
        stand = { batters: [striker.id, nonStriker.id], runs: 0, balls: 0 };
        const last = log?.[log.length - 1];
        if (last) { last.wicket = true; last.dismissal = d; last.wicketsAfter = wickets; }
        if (wickets >= 10 || nextIn >= order.length) break;
        nonStriker = order[nextIn]!;
        lineOf(nonStriker, nextIn + 1);
        nextIn += 1;
        stand = { batters: [striker.id, nonStriker.id], runs: 0, balls: 0 };
      }
      const swap = (runsBatter + (extraKind === "bye" ? 1 : 0)) % 2 === 1;
      if (swap) [striker, nonStriker] = [nonStriker, striker];
    }
    [striker, nonStriker] = [nonStriker, striker];
  }

  return {
    index: opts.index,
    team: batting.name,
    captainId: batting.captainId ?? null,
    keeperId: batting.players.find((p) => p.keeper)?.id ?? null,
    scheduledOvers: opts.overs,
    runs,
    wickets,
    legalBalls,
    extras,
    batting: [...lines.values()].sort((a, b) => a.position - b.position),
    bowling: bowlers.filter((x) => x.overs.length).map((x) => {
      const s = statOf(x.player.id);
      return { id: x.player.id, name: x.player.name, balls: countLegalBalls(log, x.player.id, opts.index), runs: x.runsByOver.reduce((a, r) => a + r, 0), wickets: countWickets(log, x.player.id, opts.index), overs: x.overs, maidens: countMaidens(log, x.player.id, opts.index), dots: s.dots, wides: s.wides, noBalls: s.noBalls };
    }),
    fallOfWickets: fall,
    partnerships: stand.balls > 0 || stand.runs > 0 ? [...partnerships, { ...stand, wicket: null }] : partnerships,
    extrasDetail: { wides, noBalls, byes },
    phaseRuns,
    outcomes,
    byeBalls,
    target: opts.target,
  };
}

/** Legal balls the bowler actually delivered: an over cut short by a win, all out or rain is not six. */
function countLegalBalls(log: BallRecord[] | undefined, bowler: string, innings: 1 | 2): number {
  if (!log) return 0;
  let n = 0;
  for (const b of log) if (b.innings === innings && b.bowler === bowler && b.legal) n += 1;
  return n;
}

/** Wickets credited to the bowler (run outs are not). */
function countWickets(log: BallRecord[] | undefined, bowler: string, innings: 1 | 2): number {
  if (!log) return 0;
  let n = 0;
  for (const b of log) if (b.innings === innings && b.bowler === bowler && b.wicket && b.dismissal?.kind !== "run out") n += 1;
  return n;
}

/** Completed overs by the bowler with nothing charged to him (byes and leg-byes do not count). */
function countMaidens(log: BallRecord[] | undefined, bowler: string, innings: 1 | 2): number {
  if (!log) return 0;
  const overs = new Map<number, { legal: number; charged: number }>();
  for (const b of log) {
    if (b.innings !== innings || b.bowler !== bowler) continue;
    const o = overs.get(b.over) ?? overs.set(b.over, { legal: 0, charged: 0 }).get(b.over)!;
    if (b.legal) o.legal += 1;
    o.charged += b.runsBatter + (b.extraKind === "wide" || b.extraKind === "no-ball" ? b.extras : 0);
  }
  return [...overs.values()].filter((o) => o.legal >= 6 && o.charged === 0).length;
}

function emptyInnings(team: string, index: 1 | 2, overs: number, target: number | null): InningsResult {
  return { index, team, captainId: null, keeperId: null, scheduledOvers: overs, runs: 0, wickets: 0, legalBalls: 0, extras: 0, batting: [], bowling: [], fallOfWickets: [], partnerships: [], extrasDetail: { wides: 0, noBalls: 0, byes: 0 }, phaseRuns: { pp: { runs: 0, balls: 0, wickets: 0 }, mid: { runs: 0, balls: 0, wickets: 0 }, death: { runs: 0, balls: 0, wickets: 0 } }, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 }, byeBalls: 0, target };
}

export interface MatchOptions {
  seed: number | string;
  /** Force who bats first (replays); otherwise the toss decides. */
  battingFirst?: string;
  keepBallLog?: boolean;
  /** Override the environment's rain probability (tests, dry-weather modes). */
  rainProbability?: number;
}

/** Draw the rain event for a match, if any, before a ball is bowled. */
function drawRain(env: MatchEnvironment, situation: SituationModel, rng: Rng, pAffected: number): RainEvent | null {
  if (env.overs < 20 || !rng.chance(pAffected)) return null;
  const u = rng.next();
  if (u < env.rain.noResultShare) return { kind: "no-result", oversPerSide: env.overs, cutAtBalls: null, parScore: null };
  if (u < env.rain.noResultShare + (1 - env.rain.noResultShare) * ENGINE.rain.chaseCutShare) {
    const [lo, hi] = ENGINE.rain.chaseCut;
    const cut = Math.max(ENGINE.rain.minOvers * 6, Math.round(env.overs * 6 * (lo + (hi - lo) * rng.next())));
    return { kind: "chase-cut", oversPerSide: env.overs, cutAtBalls: cut, parScore: null };
  }
  // Reduced before the start: overs per side drawn from the archive's reduced first innings.
  const hist = Object.entries(situation.reducedOvers).map(([k, v]) => [Number(k), v] as const).filter(([o]) => o >= ENGINE.rain.minOvers && o < env.overs);
  const overs = hist.length ? hist[rng.pick(hist.map(([, v]) => v))]![0] : ENGINE.rain.minOvers + Math.floor(rng.next() * (env.overs - ENGINE.rain.minOvers));
  return { kind: "reduced", oversPerSide: overs, cutAtBalls: null, parScore: null };
}

export function simulateMatch(a: EngineTeam, b: EngineTeam, env: MatchEnvironment, situation: SituationModel, opts: MatchOptions): MatchResult {
  const rng = new Rng(opts.seed);
  const tossWinner = rng.chance(0.5) ? a : b;
  const drawnDecision: "bat" | "field" = rng.chance(env.tossFieldPct / 100) ? "field" : "bat";
  let first = drawnDecision === "bat" ? tossWinner : tossWinner === a ? b : a;
  if (opts.battingFirst) first = opts.battingFirst === a.name ? a : b;
  const second = first === a ? b : a;
  // A real match's batting order overrides the draw, so the decision has to agree with it.
  const tossDecision: "bat" | "field" = first === tossWinner ? "bat" : "field";
  const log: BallRecord[] = [];
  const matchEffect = Math.exp(ENGINE.matchEffectSd * rng.normal());
  const rain = drawRain(env, situation, rng.fork("rain"), opts.rainProbability ?? env.rain.pAffected);
  const base = { teams: [a.name, b.name] as [string, string], tossWinner: tossWinner.name, tossDecision, rain };

  if (rain?.kind === "no-result") {
    // Some play, then the weather wins: a partial first innings and no second.
    const played = Math.round(env.overs * 6 * (0.1 + 0.6 * rng.next()));
    const inn1 = simulateInnings(first, second, env, situation, rng.fork("inn1"), { index: 1, overs: env.overs, target: null, matchEffect, cutAtBalls: played }, log);
    return { ...base, innings: [inn1, emptyInnings(second.name, 2, env.overs, null)], tieBreak: null, winner: null, margin: null, balls: opts.keepBallLog ? log : [] };
  }

  const overs = rain?.kind === "reduced" ? rain.oversPerSide : env.overs;
  const matchEnv: MatchEnvironment = overs === env.overs ? env : { ...env, overs, maxOversPerBowler: Math.ceil(overs / 5) };
  const inn1 = simulateInnings(first, second, matchEnv, situation, rng.fork("inn1"), { index: 1, overs, target: null, matchEffect }, log);
  const target = inn1.runs + 1;
  const inn2 = simulateInnings(second, first, matchEnv, situation, rng.fork("inn2"), { index: 2, overs, target, matchEffect, cutAtBalls: rain?.kind === "chase-cut" ? rain.cutAtBalls ?? undefined : undefined }, log);

  let winner: string | null = null;
  let margin: MatchResult["margin"] = null;
  let tieBreak: MatchResult["tieBreak"] = null;
  const chaseFinished = inn2.runs >= target || inn2.wickets >= 10 || inn2.legalBalls >= overs * 6;
  if (rain?.kind === "chase-cut" && !chaseFinished) {
    // Decided on the resource table: par = runs the chasing side needed to have scored by now.
    const used = 1 - situation.resource(overs * 6 - inn2.legalBalls, inn2.wickets);
    const par = Math.round(inn1.runs * used);
    rain.parScore = par;
    if (inn2.runs > par) { winner = second.name; margin = { dls: true, runs: inn2.runs - par }; }
    else if (inn2.runs < par) { winner = first.name; margin = { dls: true, runs: par - inn2.runs }; }
  } else if (inn2.runs > inn1.runs) {
    winner = second.name;
    margin = { wickets: 10 - inn2.wickets, ballsLeft: overs * 6 - inn2.legalBalls };
  } else if (inn1.runs > inn2.runs) {
    winner = first.name;
    margin = { runs: inn1.runs - inn2.runs };
  }
  if (!winner) {
    if (env.tieBreak === "super-over") {
      tieBreak = superOver(first, second, env, situation, rng.fork("super-over"));
      winner = tieBreak.winner;
    } else {
      const w = rng.chance(0.5) ? first : second;
      tieBreak = { winner: w.name, method: env.tieBreak === "bowl-out" ? "bowl-out" : "coin" };
      winner = w.name;
    }
  }
  return { ...base, innings: [inn1, inn2], tieBreak, winner, margin, balls: opts.keepBallLog ? log : [] };
}

/** One-over eliminator: the chasing side bats first (ICC playing conditions), best three batters, best death bowler. */
function superOver(first: EngineTeam, second: EngineTeam, env: MatchEnvironment, situation: SituationModel, rng: Rng): NonNullable<MatchResult["tieBreak"]> {
  const pick = (t: EngineTeam): EngineTeam => {
    const top = [...t.players].sort((x, y) => y.battingDisplay - x.battingDisplay).slice(0, 3).map((p) => p.id);
    const bowler = [...t.players].filter((p) => p.canBowl).sort((x, y) => y.bowlingDisplay - x.bowlingDisplay)[0] ?? t.players.find((p) => !p.keeper)!;
    return { name: t.name, players: t.players.filter((p) => p.id === bowler.id || p.keeper || top.includes(p.id)), battingOrder: top };
  };
  const soEnv: MatchEnvironment = { ...env, overs: 1, maxOversPerBowler: 1 };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const matchEffect = 1;
    const s1 = simulateInnings(pick(second), pick(first), soEnv, situation, rng.fork(`so1-${attempt}`), { index: 1, overs: 1, target: null, matchEffect });
    const s2 = simulateInnings(pick(first), pick(second), soEnv, situation, rng.fork(`so2-${attempt}`), { index: 2, overs: 1, target: s1.runs + 1, matchEffect });
    if (s1.runs !== s2.runs) return { winner: s2.runs > s1.runs ? first.name : second.name, method: "super-over", innings: [s1, s2] };
  }
  return { winner: rng.chance(0.5) ? first.name : second.name, method: "coin" };
}

export type { OutcomeKey };
