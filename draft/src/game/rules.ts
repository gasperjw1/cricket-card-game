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

/** Counts toward the overs meter: a bowler, an all-rounder, or anyone whose bowling record is shown. */
export function bowls(p: PoolPlayer): boolean {
  return p.role === "bowler" || p.role === "all-rounder" || p.bowlShown;
}

/**
 * Who keeps wicket (decided 2026-10-30): the keeper does not bowl, so when more than one keeper
 * is in the side the gloves go to one who does not bowl, keeping the other free to bowl. With a
 * single keeper who also bowls, he keeps and his bowling is lost.
 */
export function designatedKeeper(picks: (PoolPlayer | null)[]): PoolPlayer | null {
  const keepers = (picks.filter(Boolean) as PoolPlayer[]).filter((p) => p.keeper);
  return keepers.find((p) => !bowls(p)) ?? keepers[0] ?? null;
}

/** Players who can bowl in the eleven: everyone who bowls except the designated keeper. */
export function bowlerCount(picks: (PoolPlayer | null)[]): number {
  const keeper = designatedKeeper(picks);
  return (picks.filter(Boolean) as PoolPlayer[]).filter((p) => bowls(p) && p !== keeper).length;
}

/** Overs the eleven can cover at four a bowler, capped at 20 (the overs meter). */
export function oversCovered(picks: (PoolPlayer | null)[]): number {
  return Math.min(20, 4 * bowlerCount(picks));
}

/** What the eleven still needs: bowlers short of five (the keeper not counting), a keeper if none, and the open slots left. */
export function needs(picks: (PoolPlayer | null)[]): { bowlers: number; keeper: number; open: number } {
  const chosen = picks.filter(Boolean) as PoolPlayer[];
  return { bowlers: Math.max(0, 5 - bowlerCount(picks)), keeper: designatedKeeper(picks) ? 0 : 1, open: 11 - chosen.length };
}

/**
 * Whether a player may still be taken (decided 2026-10-30): once the open slots are down to what
 * the side still needs (five who bowl plus a keeper who does not), only players who reduce that
 * need are selectable. Tested by adding him: a lone keeper-bowler fills the gloves but not an over,
 * a second keeper frees the first to bowl. With one slot left and two needs the eleven is already
 * invalid, so anyone who reduces the shortfall stays selectable rather than locking the draft.
 */
export function eligible(p: PoolPlayer, picks: (PoolPlayer | null)[]): boolean {
  const n = needs(picks);
  if (n.open > n.bowlers + n.keeper) return true;
  const after = needs([...picks.filter(Boolean), p]);
  return after.bowlers + after.keeper < n.bowlers + n.keeper;
}

export function lineupProblems(picks: (PoolPlayer | null)[]): string[] {
  const problems: string[] = [];
  const filled = picks.filter(Boolean).length;
  if (filled < 11) problems.push(`${11 - filled} slot${11 - filled === 1 ? "" : "s"} still open`);
  if (!keeperCovered(picks)) problems.push("No wicketkeeper: at least one player must have kept in a T20I");
  if (oversCovered(picks) < 20) problems.push(`Only ${oversCovered(picks)} overs covered: you need five players who bowl besides the keeper`);
  const ids = picks.filter(Boolean).map((p) => p!.id);
  if (new Set(ids).size !== ids.length) problems.push("The same person appears twice");
  return problems;
}

/**
 * Every (team, edition) squad that exists, the spin space (uniform; decided 2026-10-28), minus the
 * squads whose cards are mostly blank (listed by the sync script; a stand-in side with no record).
 */
export function squadUniverse(squadsByEdition: Map<string, SquadOut[]>, blank: { editionId: string; team: string }[] = []): SquadRef[] {
  const skip = new Set(blank.map((b) => `${b.editionId}|${b.team}`));
  const out: SquadRef[] = [];
  for (const [editionId, squads] of squadsByEdition) for (const s of squads) if (!skip.has(`${editionId}|${s.team}`)) out.push({ team: s.team, editionId, standIn: s.standIn });
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
