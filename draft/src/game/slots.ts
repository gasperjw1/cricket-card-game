/**
 * Batting out of position (asked 2026-10-30): the engine applies a batter's per-phase vectors ball
 * by ball, so a No. 3 moved to No. 7 is judged on his death-overs numbers instead of his powerplay
 * ones. These helpers put that on the card: the phase mix each slot actually faces, from the
 * archive, and the player's batting number re-weighted to it.
 */

import type { EditionOut } from "../../../wcdraft/src/engine/data.ts";
import type { PoolPlayer } from "./types.ts";

export interface PhaseWeights {
  pp: number;
  mid: number;
  death: number;
}

/** Below this many balls faced from a position in the edition itself, every edition is pooled. */
const MIN_OWN_BALLS = 300;

/** Phase mix a batting position (1–11) faces: the edition's own balls when there are enough, else every edition pooled. */
export function slotWeights(editions: EditionOut[], editionId: string, position: number): PhaseWeights {
  const key = String(position);
  const own = editions.find((e) => e.id === editionId)?.environment.positionPhaseBalls?.[key];
  const all: PhaseWeights = { pp: 0, mid: 0, death: 0 };
  for (const e of editions) {
    const r = e.environment.positionPhaseBalls?.[key];
    if (r) { all.pp += r.pp; all.mid += r.mid; all.death += r.death; }
  }
  const pick = own && own.pp + own.mid + own.death >= MIN_OWN_BALLS ? own : all;
  const n = pick.pp + pick.mid + pick.death;
  return n ? { pp: pick.pp / n, mid: pick.mid / n, death: pick.death / n } : { pp: 1 / 3, mid: 1 / 3, death: 1 / 3 };
}

/**
 * The player's batting number if he bats in this slot: his headline shifted by how his phase
 * numbers differ between the overs the slot faces and the overs he actually batted in. A player
 * whose batting is not shown keeps his (prior-shaped) headline.
 */
export function batInSlot(p: PoolPlayer, slot: PhaseWeights): number {
  if (!p.batShown) return p.bat;
  const own = p.batWeights ?? slot;
  const shift = (slot.pp - own.pp) * p.batPhases.pp + (slot.mid - own.mid) * p.batPhases.mid + (slot.death - own.death) * p.batPhases.death;
  return Math.max(40, Math.min(99, Math.round(p.bat + shift)));
}

/** Short wording of the slot's overs for a tooltip: "faces 61% powerplay, 35% middle, 4% death". */
export function describeWeights(w: PhaseWeights): string {
  const f = (x: number) => `${Math.round(100 * x)}%`;
  return `faces ${f(w.pp)} powerplay, ${f(w.mid)} middle, ${f(w.death)} death overs`;
}
