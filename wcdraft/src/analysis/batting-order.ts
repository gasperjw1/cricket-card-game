/**
 * Batting-order definitions shared by the pipeline (`captain-habits.ts`), the engine's floater
 * (`engine/match.ts`) and the research scripts (2026-11-05 review: each carried its own copy, so a
 * change in one would have left the others measuring a different event).
 */

/**
 * An early collapse: 3 down by the end of over 6, 4 by over 8, 5 by over 10. `over` is the 0-based
 * index of the over the man came in (the wicket fell) in a 20-over innings.
 */
export function isCollapse(wicketsDown: number, over: number): boolean {
  return (wicketsDown >= 3 && over <= 5) || (wicketsDown >= 4 && over <= 7) || (wicketsDown >= 5 && over <= 9);
}

/** A side's usual batting positions each year: each man's mean position over its innings that year. */
export class UsualPositions {
  private readonly sums = new Map<string, Map<string, [number, number]>>();

  /** One innings' order (ids from No. 1) for this side and year. */
  add(team: string, year: string, order: readonly string[]): void {
    const key = `${team}|${year}`;
    const u = this.sums.get(key) ?? this.sums.set(key, new Map()).get(key)!;
    order.forEach((id, i) => { const x = u.get(id) ?? [0, 0]; u.set(id, [x[0] + i + 1, x[1] + 1]); });
  }

  /** His usual position for that side that year; 11 if he never batted for it then. */
  of(team: string, year: string, id: string): number {
    const x = this.sums.get(`${team}|${year}`)?.get(id);
    return x ? x[0] / x[1] : 11;
  }
}

/** A man who usually bats 6–7, the finisher the collapse habit holds back. */
export const isFinisherPosition = (usual: number): boolean => usual >= 5.5 && usual < 7.5;
