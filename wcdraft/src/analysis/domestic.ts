/**
 * Domestic T20 backup evidence (decided 2026-10-30): per-person career-to-date outcome counts from
 * the franchise and domestic league archives, with the expected counts of the competition-season
 * population over the same balls, snapshotted at each World Cup edition's start. The ratings use
 * `observed ÷ expected` as the prior centre for a skill the player rarely shows in T20Is (a
 * bowler's batting, a batter's bowling); plenty of T20I evidence swamps it.
 *
 * Two passes, like the context population: the first collects competition × season × phase
 * populations, the second files each ball under its batter and bowler against that population.
 */

import { mainInnings, OUTCOME_KEYS, phaseOf, type Match, type OutcomeKey, type Phase } from "../cricsheet/match.js";

export interface DomesticPhase {
  balls: number;
  runs: number;
  outcomes: Record<OutcomeKey, number>;
  expected: Record<OutcomeKey, number>;
}

export interface DomesticBlock {
  matches: number;
  bat: Record<Phase, DomesticPhase>;
  bowl: Record<Phase, DomesticPhase>;
  /** Balls by competition code, batting and bowling together (provenance for the card detail). */
  competitions: Record<string, number>;
  /** Balls faced and bowled by season (calendar year), for the recency test behind `shown`. */
  seasons: Record<string, { bat: number; bowl: number }>;
}

/** Seasons (edition year and the ones before it) that count as "still does this" for the shown test. */
export const RECENT_SEASONS = 4;

const zero = (): Record<OutcomeKey, number> => ({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 });
const emptyPhase = (): DomesticPhase => ({ balls: 0, runs: 0, outcomes: zero(), expected: zero() });
const emptyBlock = (): DomesticBlock => ({ matches: 0, bat: { pp: emptyPhase(), mid: emptyPhase(), death: emptyPhase() }, bowl: { pp: emptyPhase(), mid: emptyPhase(), death: emptyPhase() }, competitions: {}, seasons: {} });

function outcomeKey(runs: number, wicket: boolean): OutcomeKey {
  if (wicket) return "W";
  if (runs >= 6) return "6";
  if (runs === 5) return "4";
  return String(runs) as OutcomeKey;
}

const MIN_CELL_BALLS = 600;

/** Phase counts with expected counts rounded for export. */
function phasesOut(ph: Record<Phase, DomesticPhase>): Record<Phase, DomesticPhase> {
  const round = (o: Record<OutcomeKey, number>) => Object.fromEntries(OUTCOME_KEYS.map((k) => [k, Math.round(o[k] * 100) / 100])) as Record<OutcomeKey, number>;
  return Object.fromEntries((["pp", "mid", "death"] as Phase[]).map((p) => [p, { balls: ph[p].balls, runs: ph[p].runs, outcomes: ph[p].outcomes, expected: round(ph[p].expected) }])) as Record<Phase, DomesticPhase>;
}

export class DomesticAnalysis {
  private readonly population = new Map<string, { bat: Record<OutcomeKey, number>; bowl: Record<OutcomeKey, number>; balls: number }>();
  private readonly probs = new Map<string, { bat: Record<OutcomeKey, number>; bowl: Record<OutcomeKey, number> }>();
  private readonly players = new Map<string, DomesticBlock>();
  private readonly snapshots = new Map<string, Map<string, DomesticBlock>>();
  /** Person → league balls after each edition's start, for projected cards (see `watchLater`). */
  private readonly watches = new Map<string, { editionId: string; until: string; target: number; block: DomesticBlock }[]>();
  private frozen = false;

  private static season(m: Match): string {
    return m.date.slice(0, 4);
  }

  /** First pass: competition × season × phase outcome populations. */
  addPopulation(m: Match, competition: string): void {
    for (const inn of mainInnings(m)) {
      if (inn.reduced || inn.superOver) continue;
      for (const b of inn.balls) {
        if (b.over >= 20) continue;
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (!(b.legal || strikerOut)) continue;
        const ph = phaseOf(b.over);
        for (const key of [`${competition}|${DomesticAnalysis.season(m)}|${ph}`, `${competition}|all|${ph}`, `all|all|${ph}`]) {
          const cell = this.population.get(key) ?? this.population.set(key, { bat: zero(), bowl: zero(), balls: 0 }).get(key)!;
          cell.balls += 1;
          cell.bat[outcomeKey(b.runsBatter, strikerOut)] += 1;
          if (b.legal) cell.bowl[outcomeKey(b.runsConceded, b.wickets.some((w) => w.bowlerCredited))] += 1;
        }
      }
    }
  }

  freeze(): void {
    for (const [key, c] of this.population) {
      const toP = (counts: Record<OutcomeKey, number>) => {
        const n = OUTCOME_KEYS.reduce((a, k) => a + counts[k], 0) || 1;
        return Object.fromEntries(OUTCOME_KEYS.map((k) => [k, counts[k] / n])) as Record<OutcomeKey, number>;
      };
      this.probs.set(key, { bat: toP(c.bat), bowl: toP(c.bowl) });
    }
    this.frozen = true;
  }

  private expected(competition: string, season: string, ph: Phase): { bat: Record<OutcomeKey, number>; bowl: Record<OutcomeKey, number> } | null {
    for (const key of [`${competition}|${season}|${ph}`, `${competition}|all|${ph}`, `all|all|${ph}`]) {
      const pop = this.population.get(key);
      if (pop && pop.balls >= MIN_CELL_BALLS) return this.probs.get(key) ?? null;
    }
    return null;
  }

  /** Second pass: each ball under its batter and bowler, observed and expected. */
  add(m: Match, competition: string): void {
    if (!this.frozen) throw new Error("DomesticAnalysis: call freeze() after the first pass");
    const season = DomesticAnalysis.season(m);
    const touched = new Set<string>();
    for (const inn of mainInnings(m)) {
      if (inn.reduced || inn.superOver) continue;
      for (const b of inn.balls) {
        if (b.over >= 20) continue;
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        if (!(b.legal || strikerOut)) continue;
        const ph = phaseOf(b.over);
        const e = this.expected(competition, season, ph);
        if (!e) continue;
        const bat = this.players.get(b.batter) ?? this.players.set(b.batter, emptyBlock()).get(b.batter)!;
        for (const block of [bat, ...this.openWatches(b.batter, "bat", m.date)]) {
          const bp = block.bat[ph];
          bp.balls += 1; bp.runs += b.runsBatter; bp.outcomes[outcomeKey(b.runsBatter, strikerOut)] += 1;
          for (const k of OUTCOME_KEYS) bp.expected[k] += e.bat[k];
        }
        bat.competitions[competition] = (bat.competitions[competition] ?? 0) + 1;
        (bat.seasons[season] ??= { bat: 0, bowl: 0 }).bat += 1;
        touched.add(b.batter);
        if (b.legal) {
          const bowl = this.players.get(b.bowler) ?? this.players.set(b.bowler, emptyBlock()).get(b.bowler)!;
          for (const block of [bowl, ...this.openWatches(b.bowler, "bowl", m.date)]) {
            const wp = block.bowl[ph];
            wp.balls += 1; wp.runs += b.runsConceded; wp.outcomes[outcomeKey(b.runsConceded, b.wickets.some((w) => w.bowlerCredited))] += 1;
            for (const k of OUTCOME_KEYS) wp.expected[k] += e.bowl[k];
          }
          bowl.competitions[competition] = (bowl.competitions[competition] ?? 0) + 1;
          (bowl.seasons[season] ??= { bat: 0, bowl: 0 }).bowl += 1;
          touched.add(b.bowler);
        }
      }
    }
    for (const id of touched) this.players.get(id)!.matches += 1;
  }

  /** From now on, keep these people's league balls for this edition until `until` or `target` balls per skill. */
  watchLater(editionId: string, people: Iterable<string>, until: string, target: number): void {
    for (const id of people) (this.watches.get(id) ?? this.watches.set(id, []).get(id)!).push({ editionId, until, target, block: emptyBlock() });
  }

  private openWatches(id: string, skill: "bat" | "bowl", date: string): DomesticBlock[] {
    const list = this.watches.get(id);
    if (!list) return [];
    const balls = (b: DomesticBlock) => b[skill].pp.balls + b[skill].mid.balls + b[skill].death.balls;
    return list.filter((w) => date < w.until && balls(w.block) < w.target).map((w) => w.block);
  }

  /** The league balls kept for a person at an edition (null when there are none). */
  laterFor(editionId: string, personId: string): Pick<DomesticBlock, "bat" | "bowl"> | null {
    const block = this.watches.get(personId)?.find((w) => w.editionId === editionId)?.block;
    if (!block) return null;
    const total = (["pp", "mid", "death"] as Phase[]).reduce((a, p) => a + block.bat[p].balls + block.bowl[p].balls, 0);
    return total > 0 ? { bat: phasesOut(block.bat), bowl: phasesOut(block.bowl) } : null;
  }

  /** Freeze the career-to-date blocks of the given people at an edition's start. */
  snapshot(editionId: string, people: Iterable<string>): void {
    const snap = new Map<string, DomesticBlock>();
    for (const id of people) {
      const b = this.players.get(id);
      if (b) snap.set(id, structuredClone(b));
    }
    this.snapshots.set(editionId, snap);
  }

  /** Pooled-over-phases export for a person at an edition (null when no domestic balls). */
  blockFor(editionId: string, personId: string): DomesticOut | null {
    const b = this.snapshots.get(editionId)?.get(personId);
    if (!b) return null;
    const editionYear = Number(editionId.slice(0, 4));
    const recent = { bat: 0, bowl: 0 };
    for (const [season, n] of Object.entries(b.seasons)) {
      const year = Number(season);
      if (year > editionYear - RECENT_SEASONS && year <= editionYear) { recent.bat += n.bat; recent.bowl += n.bowl; }
    }
    return { matches: b.matches, bat: phasesOut(b.bat), bowl: phasesOut(b.bowl), competitions: b.competitions, recent };
  }

  get playerCount(): number {
    return this.players.size;
  }
}

export interface DomesticOut {
  matches: number;
  bat: Record<Phase, DomesticPhase>;
  bowl: Record<Phase, DomesticPhase>;
  competitions: Record<string, number>;
  /** Balls faced and bowled in the edition year and the RECENT_SEASONS − 1 seasons before it. */
  recent: { bat: number; bowl: number };
}
