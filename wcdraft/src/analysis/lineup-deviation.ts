/**
 * Batting-order behaviour: each team-edition's modal batting order from its World Cup innings,
 * and how often the batter who walked in at positions 3–8 was not the modal one, split by the
 * phase in which the wicket fell. This is the evidence base for coach-driven in-match reordering.
 */

import type { Innings } from "../cricsheet/match.js";
import { bump, getOrCreate, pct } from "../util/stats.js";

type EntryPhase = "pp" | "mid" | "death";

interface OrderRecord {
  /** position (1-based) → { id, arrivedOver } */
  entries: { position: number; id: string; arrivedOver: number }[];
}

class TeamEditionOrders {
  readonly innings: OrderRecord[] = [];

  add(inn: Innings): void {
    this.innings.push({
      entries: inn.battingOrder.map((id, i) => ({ position: i + 1, id, arrivedOver: inn.batters.get(id)?.arrivedOver ?? 0 })),
    });
  }

  modalOrder(): Map<number, { id: string; count: number }> {
    const counts = new Map<number, Map<string, number>>();
    for (const inn of this.innings) for (const e of inn.entries) bump(getOrCreate(counts, e.position, () => new Map()), e.id);
    const modal = new Map<number, { id: string; count: number }>();
    for (const [pos, m] of counts) {
      const [id, count] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]!;
      modal.set(pos, { id, count });
    }
    return modal;
  }

  /** phase → [entries, deviations] for positions 3–8 where the modal batter has ≥ 2 appearances. */
  deviations(): Map<EntryPhase, [number, number]> {
    const modal = this.modalOrder();
    const out = new Map<EntryPhase, [number, number]>();
    for (const inn of this.innings) {
      for (const e of inn.entries) {
        if (e.position < 3 || e.position > 8) continue;
        const md = modal.get(e.position);
        if (!md || md.count < 2) continue;
        const over1 = e.arrivedOver + 1;
        const phase: EntryPhase = over1 <= 6 ? "pp" : over1 <= 15 ? "mid" : "death";
        const d = getOrCreate(out, phase, () => [0, 0] as [number, number]);
        d[0] += 1;
        if (e.id !== md.id) d[1] += 1;
      }
    }
    return out;
  }
}

export class LineupDeviationAnalysis {
  private readonly teams = new Map<string, TeamEditionOrders>();

  add(editionId: string, inn: Innings): void {
    if (inn.superOver || inn.battingOrder.length < 3) return;
    getOrCreate(this.teams, `${editionId}|${inn.team}`, () => new TeamEditionOrders()).add(inn);
  }

  summary(names: Map<string, string>) {
    const byEdition = new Map<string, Map<EntryPhase, [number, number]>>();
    const byTeamEdition = [];
    for (const [key, rec] of [...this.teams.entries()].sort()) {
      const [editionId, team] = key.split("|") as [string, string];
      const dev = rec.deviations();
      const agg = getOrCreate(byEdition, editionId, () => new Map());
      for (const [ph, [n, d]] of dev) {
        const a = getOrCreate(agg, ph, () => [0, 0] as [number, number]);
        a[0] += n;
        a[1] += d;
      }
      byTeamEdition.push({
        editionId,
        team,
        innings: rec.innings.length,
        modalOrder: [...rec.modalOrder().entries()].sort((a, b) => a[0] - b[0]).map(([position, m]) => ({ position, id: m.id, name: names.get(m.id) ?? m.id, count: m.count })),
        deviationPctByEntryPhase: fmt(dev),
      });
    }
    return {
      byEdition: Object.fromEntries([...byEdition.entries()].map(([e, m]) => [e, fmt(m)])),
      byTeamEdition,
    };
  }
}

function fmt(m: Map<EntryPhase, [number, number]>) {
  return Object.fromEntries((["pp", "mid", "death"] as EntryPhase[]).map((ph) => [ph, { entries: m.get(ph)?.[0] ?? 0, deviationPct: pct(m.get(ph)?.[1] ?? 0, m.get(ph)?.[0] ?? 0, 0) }]));
}
