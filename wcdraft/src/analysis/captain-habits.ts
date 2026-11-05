/**
 * The captain's collapse habit (2026-11-05, `scripts/research/collapse-response.mts`): after an early
 * collapse (3 down by the end of over 6, 4 by over 8, 5 by over 10), how often a man who usually bats
 * lower comes in ahead of one who usually bats 6–7, the finisher held back for the end. Men's T20Is
 * since 2010, full 20-over innings with a full eleven; "usually" is the side-year's mean batting
 * position. It is the one collapse habit that follows the captain and not the coach: split-half
 * r 0.66 for the captain alone (0.57 with the coach held, the coach 0.08), a true spread of about
 * 4.5 points around a base near 5%.
 *
 * Per captain tenure (the tenure covering the year whose captain is in the eleven, the busier one when
 * several are): his entries' share less their years' shares, shrunk with `PRIOR_ENTRIES`. Zero for a
 * captain with no collapses on record.
 */

import { mainInnings, type Match } from "../cricsheet/match.js";

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
    const usualSum = new Map<string, Map<string, [number, number]>>();
    for (const r of this.innings) {
      const key = `${r.team}|${r.year}`;
      const u = usualSum.get(key) ?? usualSum.set(key, new Map()).get(key)!;
      r.order.forEach((id, i) => { const x = u.get(id) ?? [0, 0]; u.set(id, [x[0] + i + 1, x[1] + 1]); });
    }
    const usualOf = (team: string, year: string, id: string) => { const x = usualSum.get(`${team}|${year}`)?.get(id); return x ? x[0] / x[1] : 11; };
    const captainOf = (team: string, year: string, xi: string[]) => {
      const y = Number(year);
      const hits = tenures.filter((t) => t.team === team && y >= t.firstYear && y <= t.lastYear && xi.includes(t.personId))
        .sort((a, b) => b.matches / (b.lastYear - b.firstYear + 1) - a.matches / (a.lastYear - a.firstYear + 1));
      return hits.length ? `${team}|${hits[0]!.personId}` : null;
    };
    const rows: { cap: string; year: string; held: number }[] = [];
    for (const r of this.innings) {
      const cap = captainOf(r.team, r.year, r.xi);
      if (!cap) continue;
      for (let p = 3; p <= 8 && p <= r.order.length; p += 1) {
        const down = p - 2, over = r.arrived[p - 1]!;
        if (!((down >= 3 && over <= 5) || (down >= 4 && over <= 7) || (down >= 5 && over <= 9))) continue;
        const id = r.order[p - 1]!;
        const batted = new Set(r.order.slice(0, p - 1));
        const mine = usualOf(r.team, r.year, id);
        const held = r.xi.some((x) => !batted.has(x) && x !== id && (() => { const u = usualOf(r.team, r.year, x); return u >= 5.5 && u < 7.5 && u < mine - 0.5; })());
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
