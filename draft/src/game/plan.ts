/**
 * The plan in force for each of the side's matches (2026-11-03): every plan up to that match, a
 * later one's settings over an earlier one's, so a captain named before match 1 still leads after a
 * tempo is set before match 3. The engine's eleven and the paper's "Before the next match" box both
 * read it from here.
 */

import type { MatchPlan } from "./simulate.ts";

export function planAt(plans: (MatchPlan | undefined)[], n: number): MatchPlan {
  let plan: MatchPlan = {};
  for (let i = 0; i <= n; i += 1) if (plans[i]) plan = { ...plan, ...plans[i] };
  return plan;
}
