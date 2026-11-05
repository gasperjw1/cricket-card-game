/**
 * Captains (2026-11-05, Yash). A player who has led his country in a men's T20I carries a Captain
 * tag. The eleven needs a captain: when it has captains, he is one of them (the user chooses when
 * there are several); when it has none, the user marks one. What a captain brings is his measured
 * collapse habit (`collapseHold`, played by the engine's floater); the old captaincy rating does
 * nothing and is no longer shown (docs/wc-draft-captains-2026-11-04.md).
 */

import type { CaptainOut, LeaderOut } from "../../../wcdraft/src/engine/data.ts";
import type { PoolPlayer } from "./types.ts";

/**
 * How often an average captain's side holds a finisher back after a collapse, as the engine plays
 * it: 7.6% (`floater-check.mts`, 2026-11-05 review; real World Cups 7.5%). The engine plays a
 * captain's habit one for one on top (`ENGINE.floater.holdScale`), so base + habit is his share.
 */
export const HOLD_BASE = 0.076;

export interface Captaincy {
  /** Led his country in men's T20Is: matches as captain over every tenure, rated or stand-in. */
  matches: Map<string, number>;
  /** His collapse habit from his busiest rated tenure; absent for stand-ins. */
  hold: Map<string, number>;
}

export function captaincyOf(captains: CaptainOut[], leaders: LeaderOut[]): Captaincy {
  const matches = new Map<string, number>();
  // A tenure can be in both lists (rated captains are leaders too): count the larger, once per team and years.
  const seen = new Map<string, number>();
  for (const t of [...captains, ...leaders]) {
    const k = `${t.personId}|${t.team}|${t.firstYear}`;
    seen.set(k, Math.max(seen.get(k) ?? 0, t.matches));
  }
  for (const [k, n] of seen) { const id = k.split("|")[0]!; matches.set(id, (matches.get(id) ?? 0) + n); }
  const hold = new Map<string, number>();
  for (const c of [...captains].sort((a, b) => a.matches - b.matches)) hold.set(c.personId, c.collapseHold ?? 0);
  return { matches, hold };
}

/** Who may captain this eleven: those who have captained, or anyone when none has. */
export function captainChoices(picks: (PoolPlayer | null)[], c: Captaincy): PoolPlayer[] {
  const xi = picks.filter(Boolean) as PoolPlayer[];
  const tagged = xi.filter((p) => c.matches.has(p.id));
  return tagged.length ? tagged : xi;
}

/**
 * The captain: the chosen one while he is still a choice; otherwise the most experienced captain in
 * the eleven; null when nobody in it has captained, so the user must mark one.
 */
export function captainFor(picks: (PoolPlayer | null)[], chosen: string | null, c: Captaincy): string | null {
  const choices = captainChoices(picks, c);
  if (chosen && choices.some((p) => p.id === chosen)) return chosen;
  const tagged = choices.filter((p) => c.matches.has(p.id)).sort((a, b) => c.matches.get(b.id)! - c.matches.get(a.id)!);
  return tagged[0]?.id ?? null;
}

/**
 * The captain who leads in the engine, and whom the pages name: `captainFor`'s pick, or, for a run
 * shared before captains were required that names nobody valid, the side's best player. The engine
 * and the between-match lever both resolve him here, so the page never names one captain while the
 * match is played under another (2026-11-05 review).
 */
export function playingCaptain(picks: (PoolPlayer | null)[], chosen: string | null, c: Captaincy): string | null {
  const xi = picks.filter(Boolean) as PoolPlayer[];
  return captainFor(picks, chosen, c) ?? [...xi].sort((a, b) => Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl))[0]?.id ?? null;
}

/** The share of collapses in which his side holds a finisher back, as the engine plays it. */
export function holdShare(id: string | null, c: Captaincy): number {
  return Math.max(0, HOLD_BASE + (id ? c.hold.get(id) ?? 0 : 0));
}
