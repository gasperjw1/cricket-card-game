/**
 * The captain's collapse habit (2026-11-05, `scripts/research/collapse-response.mts`): after an early
 * collapse (`isCollapse`), how often a man who usually bats lower comes in ahead of one who usually
 * bats 6–7, the finisher held back for the end. Men's T20Is since 2010, full 20-over innings with a
 * full eleven; "usually" is the side-year's mean batting position. It is the one collapse habit that
 * follows the captain and not the coach: split-half r 0.66 for the captain alone (0.57 with the coach
 * held, the coach 0.08), a true spread of about 4.5 points around a base near 5%.
 *
 * Per captain tenure (`tenureOf`): his entries' share less their years' shares, shrunk with
 * `PRIOR_ENTRIES`. Zero for a captain with no collapses on record.
 */

import { mainInnings, type Match } from "../cricsheet/match.js";
import { UsualPositions, isCollapse, isFinisherPosition } from "./batting-order.js";
import { tenureOf } from "./captaincy.js";

const PRIOR_ENTRIES = 10;
const FROM = "2010-01-01";

interface InningsRecord { team: string; year: string; xi: string[]; order: string[]; arrived: number[] }

export interface CaptainTenureRef { personId: string; team: string; firstYear: number; lastYear: number; matches: number }

export class CaptainHabitAnalysis {
  private readonly innings: InningsRecord[] = [];

  add(m: Match): void {
    if (m.date < FROM || m.hasMissingData) return;
    for (const inn of mainInnings(m)) {
      if (inn.reduced || inn.superOver || inn.scheduledOvers !== 20) continue;
      const xi = m.xis[inn.team] ?? [];
      if (xi.length !== 11) continue;
      this.innings.push({ team: inn.team, year: m.date.slice(0, 4), xi, order: [...inn.battingOrder], arrived: inn.battingOrder.map((id) => inn.batters.get(id)?.arrivedOver ?? 0) });
    }
  }

  /** `${team}|${personId}` → the captain's shift in the share of collapse entries that hold a finisher back. */
  summary(tenures: CaptainTenureRef[]): Map<string, number> {
    const usual = new UsualPositions();
    for (const r of this.innings) usual.add(r.team, r.year, r.order);
    const rows: { cap: string; year: string; held: number }[] = [];
    for (const r of this.innings) {
      const t = tenureOf(tenures, r.team, r.year, r.xi);
      if (!t) continue;
      const cap = `${r.team}|${t.personId}`;
      for (let p = 3; p <= 8 && p <= r.order.length; p += 1) {
        if (!isCollapse(p - 2, r.arrived[p - 1]!)) continue;
        const id = r.order[p - 1]!;
        const batted = new Set(r.order.slice(0, p - 1));
        const mine = usual.of(r.team, r.year, id);
        const held = r.xi.some((x) => { if (batted.has(x) || x === id) return false; const u = usual.of(r.team, r.year, x); return isFinisherPosition(u) && u < mine - 0.5; });
        rows.push({ cap, year: r.year, held: held ? 1 : 0 });
      }
    }
    const byYear = new Map<string, { s: number; n: number }>();
    for (const r of rows) { const y = byYear.get(r.year) ?? byYear.set(r.year, { s: 0, n: 0 }).get(r.year)!; y.s += r.held; y.n += 1; }
    const byCap = new Map<string, { s: number; n: number }>();
    for (const r of rows) {
      const y = byYear.get(r.year)!;
      const c = byCap.get(r.cap) ?? byCap.set(r.cap, { s: 0, n: 0 }).get(r.cap)!;
      c.s += r.held - y.s / y.n; c.n += 1;
    }
    return new Map([...byCap].map(([k, c]) => [k, +(c.s / (c.n + PRIOR_ENTRIES)).toFixed(4)]));
  }
}
