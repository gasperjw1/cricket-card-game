/**
 * Draft rules (design spec §8 and §11 decisions): spins uniform over every squad that exists, one
 * instance per real person, eleven batting slots, at least one keeper, five bowlers' worth of
 * overs, reroll budgets. Pure functions over plain data so they are testable without React.
 */

import type { Rng } from "../../../wcdraft/src/engine/rng.ts";
import type { CoachOut, SquadOut } from "../../../wcdraft/src/engine/data.ts";
import { BUDGET, SLOTS, type PoolPlayer, type Slot, type SlotKind } from "./types.ts";

export interface SquadRef {
  team: string;
  editionId: string;
  standIn: boolean;
}

/** Slot kinds a batting archetype fits; unknown archetypes and positionless players fit anywhere. */
export function fits(player: PoolPlayer, kind: SlotKind): boolean {
  const a = player.archetype.batting;
  if (!a || player.positionless) return true;
  switch (kind) {
    case "opener": return a === "opener";
    case "top": return a === "top order" || a === "opener";
    case "middle": return a === "middle order" || a === "top order" || a === "finisher";
    case "lower": return a === "finisher" || a === "middle order" || a === "tail";
    case "tail": return a === "tail" || a === "finisher" || player.role === "bowler";
  }
}

/** Open slots this player fits naturally; every open slot when none fits. */
export function slotsFor(player: PoolPlayer, picks: (PoolPlayer | null)[]): { slots: Slot[]; natural: boolean } {
  const open = SLOTS.filter((s) => !picks[s.index]);
  const natural = open.filter((s) => fits(player, s.kind));
  return natural.length ? { slots: natural, natural: true } : { slots: open, natural: false };
}

export function keeperCovered(picks: (PoolPlayer | null)[]): boolean {
  return picks.some((p) => p?.keeper);
}

export function bowls(p: PoolPlayer): boolean {
  return p.role === "bowler" || p.role === "all-rounder" || !p.bowlLow;
}

/** Overs the eleven can cover at four a bowler, capped at 20 (the overs meter). */
export function oversCovered(picks: (PoolPlayer | null)[]): number {
  return Math.min(20, 4 * picks.filter((p) => p && bowls(p)).length);
}

export function lineupProblems(picks: (PoolPlayer | null)[]): string[] {
  const problems: string[] = [];
  const filled = picks.filter(Boolean).length;
  if (filled < 11) problems.push(`${11 - filled} slot${11 - filled === 1 ? "" : "s"} still open`);
  if (!keeperCovered(picks)) problems.push("No wicketkeeper: at least one player must have kept in a T20I");
  if (oversCovered(picks) < 20) problems.push(`Only ${oversCovered(picks)} overs covered: you need five players who bowl`);
  const ids = picks.filter(Boolean).map((p) => p!.id);
  if (new Set(ids).size !== ids.length) problems.push("The same person appears twice");
  return problems;
}

/** Every (team, edition) squad that exists, the spin space (uniform; decided 2026-10-28). */
export function squadUniverse(squadsByEdition: Map<string, SquadOut[]>): SquadRef[] {
  const out: SquadRef[] = [];
  for (const [editionId, squads] of squadsByEdition) for (const s of squads) out.push({ team: s.team, editionId, standIn: s.standIn });
  return out.sort((a, b) => a.editionId.localeCompare(b.editionId) || a.team.localeCompare(b.team));
}

export function drawSquad(universe: SquadRef[], rng: Rng): SquadRef {
  return universe[Math.floor(rng.next() * universe.length)]!;
}

/** The spun squad's players with the people already drafted removed (one instance per real person), best first. */
export function spinPlayers(pool: PoolPlayer[], team: string, taken: Set<string>): PoolPlayer[] {
  return pool.filter((p) => p.team === team && !taken.has(p.id)).sort((a, b) => b.tierScore - a.tierScore);
}

/** Coaches who took a side to a World Cup and have enough style data to carry tags. */
export function coachPool(coaches: CoachOut[]): CoachOut[] {
  return coaches.filter((c) => c.worldCups.length > 0 && c.innings >= 20);
}

export function drawCoachPanel(pool: CoachOut[], rng: Rng, size: number = BUDGET.coachPanel): CoachOut[] {
  const copy = [...pool];
  const out: CoachOut[] = [];
  while (out.length < size && copy.length) out.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]!);
  return out;
}

/** Mean best-skill display of the eleven, the squad rating shown beside the performance score. */
export function squadRating(picks: (PoolPlayer | null)[]): number | null {
  const xs = picks.filter(Boolean).map((p) => Math.max(p!.bat, p!.bowl));
  return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null;
}

export { BUDGET, SLOTS };
