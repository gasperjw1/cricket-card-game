/**
 * Population outcome vectors for each edition's form window, split by the tier of the side
 * being faced. These are the shrinkage priors and normalisation targets for ratings:
 *
 *   batting[tier][phase]  — what batters in the window did against bowling attacks of `tier`
 *   bowling[tier][phase]  — what bowlers in the window conceded to batting sides of `tier`
 *
 * A batter's form against associate attacks is normalised against `batting.associate`, so an
 * associate-circuit strike rate is judged against associate-circuit norms rather than the
 * full-member ones (the opposition-quality adjustment from the Phase 0 review).
 */

import type { Config } from "../config.js";
import { OUTCOME_KEYS, PHASES, mainInnings, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";
import { getOrCreate, round } from "../util/stats.js";
import { ELO_BINS, eloBin, type EloBin } from "./team-strength.js";

type Tier = "full" | "associate";
type Counts = Record<Phase, { balls: number; outcomes: Record<OutcomeKey, number> }>;
/** Pre-match Elo of each side, keyed by team name. */
export type MatchElo = Record<string, number>;

const emptyCounts = (): Counts =>
  Object.fromEntries(PHASES.map((p) => [p, { balls: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } }])) as Counts;

function batKey(runs: number, out: boolean): OutcomeKey {
  return out ? "W" : runs >= 6 ? "6" : runs === 5 ? "4" : (String(runs) as OutcomeKey);
}

const emptyBins = (): Record<EloBin, Counts> => Object.fromEntries(ELO_BINS.map((b) => [b, emptyCounts()])) as Record<EloBin, Counts>;

type PooledCounts = { balls: number; outcomes: Record<OutcomeKey, number> };
const emptyPooled = (): PooledCounts => ({ balls: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } });
const emptyTwoWay = (): Record<EloBin, Record<EloBin, PooledCounts>> =>
  Object.fromEntries(ELO_BINS.map((b) => [b, Object.fromEntries(ELO_BINS.map((a) => [a, emptyPooled()]))])) as Record<EloBin, Record<EloBin, PooledCounts>>;

/**
 * `kind` separates the form window ("window") from the World Cup itself ("tournament"); the
 * latter gives the opponent-conditioned population for the validation target.
 */
export class WindowPopulationAnalysis {
  private readonly batting = new Map<string, Record<Tier, Counts>>();
  private readonly bowling = new Map<string, Record<Tier, Counts>>();
  private readonly battingByElo = new Map<string, Record<EloBin, Counts>>();
  private readonly bowlingByElo = new Map<string, Record<EloBin, Counts>>();
  /**
   * Two-way tables, pooled over phases: batting outcomes of batters from teams in bin B against
   * attacks in bin A (`battingTwoWay[B][A]`), and bowling outcomes of bowlers from teams in bin B
   * against batting sides in bin A (`bowlingTwoWay[B][A]`). These let a player be judged within
   * their own team tier and then carried through the tier-to-tier gap.
   */
  private readonly battingTwoWay = new Map<string, Record<EloBin, Record<EloBin, PooledCounts>>>();
  private readonly bowlingTwoWay = new Map<string, Record<EloBin, Record<EloBin, PooledCounts>>>();
  /** Per venue string: legal balls and runs in this window, for venue scoring factors. */
  private readonly venueRuns = new Map<string, Map<string, { balls: number; runs: number; matches: Set<string> }>>();
  private readonly matches = new Map<string, number>();

  constructor(private readonly config: Config) {}

  add(editionId: string, m: Match, elo: MatchElo, kind: "window" | "tournament" = "window"): void {
    const key = kind === "window" ? editionId : `${editionId}#tournament`;
    const year = Number(m.date.slice(0, 4));
    const tier = (team: string): Tier => (this.config.isFullMember(team, year) ? "full" : "associate");
    const bat = getOrCreate(this.batting, key, () => ({ full: emptyCounts(), associate: emptyCounts() }));
    const bowl = getOrCreate(this.bowling, key, () => ({ full: emptyCounts(), associate: emptyCounts() }));
    const batElo = getOrCreate(this.battingByElo, key, emptyBins);
    const bowlElo = getOrCreate(this.bowlingByElo, key, emptyBins);
    const batTwo = getOrCreate(this.battingTwoWay, key, emptyTwoWay);
    const bowlTwo = getOrCreate(this.bowlingTwoWay, key, emptyTwoWay);
    const venue = getOrCreate(getOrCreate(this.venueRuns, key, () => new Map()), m.venue ?? "unknown", () => ({ balls: 0, runs: 0, matches: new Set<string>() }));
    venue.matches.add(m.id);
    this.matches.set(key, (this.matches.get(key) ?? 0) + 1);

    for (const inn of mainInnings(m)) {
      if (inn.reduced) continue;
      const attackTier = tier(inn.bowlingTeam);
      const batsideTier = tier(inn.team);
      const attackBin = eloBin(elo[inn.bowlingTeam] ?? 1500);
      const batsideBin = eloBin(elo[inn.team] ?? 1500);
      const batCell = batTwo[batsideBin][attackBin];
      const bowlCell = bowlTwo[attackBin][batsideBin];
      for (const b of inn.balls) {
        const ph = phaseOf(b.over);
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (!b.wide || strikerOut) {
          const k = batKey(b.runsBatter, strikerOut);
          for (const c of [bat[attackTier][ph], batElo[attackBin][ph]]) {
            c.balls += 1;
            c.outcomes[k] += 1;
          }
          batCell.balls += 1;
          batCell.outcomes[k] += 1;
        }
        if (b.legal) {
          const credited = b.wickets.some((w) => w.bowlerCredited);
          const k = batKey(b.runsConceded, credited);
          for (const c of [bowl[batsideTier][ph], bowlElo[batsideBin][ph]]) {
            c.balls += 1;
            c.outcomes[k] += 1;
          }
          bowlCell.balls += 1;
          bowlCell.outcomes[k] += 1;
          venue.balls += 1;
          venue.runs += b.runsTotal;
        }
      }
    }
  }

  summary() {
    const prob = (c: Counts) =>
      Object.fromEntries(
        PHASES.map((p) => [
          p,
          c[p].balls === 0 ? null : { balls: c[p].balls, p: Object.fromEntries(OUTCOME_KEYS.map((k) => [k, round(c[p].outcomes[k] / c[p].balls, 4)])) },
        ]),
      );
    const bins = (byBin: Record<EloBin, Counts>) => Object.fromEntries(ELO_BINS.map((b) => [b, prob(byBin[b])]));
    // Two-way tables are emitted as raw counts; the ratings code smooths them (sparse cells).
    const twoWay = (t: Record<EloBin, Record<EloBin, PooledCounts>>) =>
      Object.fromEntries(ELO_BINS.map((b) => [b, Object.fromEntries(ELO_BINS.map((a) => [a, t[b][a]]))])) as Record<string, Record<string, PooledCounts>>;
    const out: Record<string, {
      matches: number;
      batting: Record<Tier, ReturnType<typeof prob>>;
      bowling: Record<Tier, ReturnType<typeof prob>>;
      battingByOppElo: Record<string, ReturnType<typeof prob>>;
      bowlingByOppElo: Record<string, ReturnType<typeof prob>>;
      battingTwoWay: Record<string, Record<string, PooledCounts>>;
      bowlingTwoWay: Record<string, Record<string, PooledCounts>>;
      /** Venue scoring factors: runs per ball at the ground ÷ runs per ball in the window, shrunk toward 1 with a 1,200-ball prior. */
      venueFactors: Record<string, { matches: number; balls: number; factor: number }>;
    }> = {};
    for (const [key, bat] of [...this.batting.entries()].sort()) {
      const bowl = this.bowling.get(key)!;
      const venues = this.venueRuns.get(key) ?? new Map();
      let allBalls = 0, allRuns = 0;
      for (const v of venues.values()) { allBalls += v.balls; allRuns += v.runs; }
      const windowRpb = allBalls ? allRuns / allBalls : 1;
      const VENUE_PRIOR_BALLS = 1200;
      const venueFactors: Record<string, { matches: number; balls: number; factor: number }> = {};
      for (const [name, v] of venues) {
        const raw = v.balls ? v.runs / v.balls / windowRpb : 1;
        const w = v.balls / (v.balls + VENUE_PRIOR_BALLS);
        venueFactors[name] = { matches: v.matches.size, balls: v.balls, factor: round(w * raw + (1 - w), 4) };
      }
      out[key] = {
        matches: this.matches.get(key) ?? 0,
        batting: { full: prob(bat.full), associate: prob(bat.associate) },
        bowling: { full: prob(bowl.full), associate: prob(bowl.associate) },
        battingByOppElo: bins(this.battingByElo.get(key)!),
        bowlingByOppElo: bins(this.bowlingByElo.get(key)!),
        battingTwoWay: twoWay(this.battingTwoWay.get(key)!),
        bowlingTwoWay: twoWay(this.bowlingTwoWay.get(key)!),
        venueFactors,
      };
    }
    return out;
  }
}
