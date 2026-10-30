/**
 * Unbeaten-run rarity (design spec §8): simulate many tournaments with a drafted eleven in a
 * random identity's slot and measure how often the run finishes unbeaten, overall and by squad
 * quality decile. The spec's balancing target: under 3% of all runs and under 15% of runs with a
 * top-decile squad. Random drafts here follow the lineup slots (2 openers, 2 top, 2 middle,
 * 3 lower, 2 tail) and need five bowlers; the real draft client adds coach bonuses and rerolls.
 */

import type { BattingArchetype } from "../ratings/model.js";
import type { EditionData } from "./data.js";
import { Rng } from "./rng.js";
import { simulateTournament } from "./tournament.js";
import type { EnginePlayer, EngineTeam } from "./types.js";

const SLOTS: { archetype: BattingArchetype[]; count: number }[] = [
  { archetype: ["opener"], count: 2 },
  { archetype: ["top order"], count: 2 },
  { archetype: ["middle order"], count: 2 },
  { archetype: ["finisher"], count: 3 },
  { archetype: ["tail"], count: 2 },
];

/** Every rated player of the edition's real squads, one instance per person. */
export function draftPool(data: EditionData): EnginePlayer[] {
  const seen = new Set<string>();
  const pool: EnginePlayer[] = [];
  for (const squad of data.squads.values()) {
    if (squad.standIn) continue;
    for (const member of squad.players) {
      const p = data.players.get(`${squad.team}|${member.id}`);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      pool.push(p);
    }
  }
  return pool;
}

/** A uniformly random eleven that fits the lineup slots and has at least five bowlers. */
export function randomDraft(pool: EnginePlayer[], rng: Rng, name = "Drafted XI"): EngineTeam {
  const picked: EnginePlayer[] = [];
  const take = (candidates: EnginePlayer[]): EnginePlayer | null => {
    const free = candidates.filter((p) => !picked.includes(p));
    if (!free.length) return null;
    const p = free[Math.floor(rng.next() * free.length)]!;
    picked.push(p);
    return p;
  };
  for (const slot of SLOTS) {
    for (let i = 0; i < slot.count; i += 1) {
      const fits = pool.filter((p) => p.archetype.batting !== null && slot.archetype.includes(p.archetype.batting));
      take(fits) ?? take(pool);
    }
  }
  // Five bowlers: swap tail and finisher picks for bowlers until covered.
  let bowlers = picked.filter((p) => p.canBowl).length;
  for (let i = picked.length - 1; i >= 0 && bowlers < 5; i -= 1) {
    if (picked[i]!.canBowl) continue;
    const replacement = pool.filter((p) => p.canBowl && p.role === "bowler" && !picked.includes(p));
    if (!replacement.length) break;
    picked[i] = replacement[Math.floor(rng.next() * replacement.length)]!;
    bowlers += 1;
  }
  return { name, players: picked, battingOrder: picked.map((p) => p.id) };
}

export interface RaritySummary {
  editionId: string;
  runs: number;
  unbeatenPct: number;
  championPct: number;
  meanWinPct: number;
  /** By squad-quality decile (mean tier score of the eleven), 1 = weakest. */
  byDecile: { decile: number; runs: number; meanScore: number; unbeatenPct: number; championPct: number }[];
  /** The same measurement with every identity fielding its own default eleven (no draft). */
  real: { runs: number; unbeatenPct: number; championPct: number };
}

export function squadScore(team: EngineTeam): number {
  const scores = team.players.map((p) => Math.max(p.battingDisplay, p.bowlingDisplay));
  return +(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)).toFixed(1);
}

export function measureRarity(data: EditionData, opts: { sims: number; seed?: number; realSims?: number }): RaritySummary {
  const rng = new Rng(`rarity:${data.edition.id}:${opts.seed ?? 1}`);
  const pool = draftPool(data);
  const identities = [...data.squads.values()].filter((s) => !s.standIn).map((s) => s.team);
  const runs: { score: number; unbeaten: boolean; champion: boolean; winPct: number }[] = [];
  for (let i = 0; i < opts.sims; i += 1) {
    const team = identities[Math.floor(rng.next() * identities.length)]!;
    const xi = randomDraft(pool, rng.fork(`draft-${i}`), team);
    const r = simulateTournament(data, data.progression, { seed: `rarity:${data.edition.id}:${opts.seed ?? 1}:${i}`, identity: { team, xi } });
    const id = r.identity!;
    runs.push({ score: squadScore(xi), unbeaten: id.unbeaten, champion: id.champion, winPct: id.played ? id.won / id.played : 0 });
  }
  const sorted = [...runs].sort((a, b) => a.score - b.score);
  const byDecile = Array.from({ length: 10 }, (_, d) => {
    const slice = sorted.slice(Math.floor((d * sorted.length) / 10), Math.floor(((d + 1) * sorted.length) / 10));
    const pct = (f: (x: typeof slice[0]) => boolean) => (slice.length ? +((100 * slice.filter(f).length) / slice.length).toFixed(1) : 0);
    return { decile: d + 1, runs: slice.length, meanScore: +(slice.reduce((a, x) => a + x.score, 0) / Math.max(1, slice.length)).toFixed(1), unbeatenPct: pct((x) => x.unbeaten), championPct: pct((x) => x.champion) };
  });
  const realSims = opts.realSims ?? Math.min(opts.sims, 100);
  let realUnbeaten = 0, realChampion = 0;
  for (let i = 0; i < realSims; i += 1) {
    const team = identities[Math.floor(rng.next() * identities.length)]!;
    const r = simulateTournament(data, data.progression, { seed: `rarity-real:${data.edition.id}:${opts.seed ?? 1}:${i}` });
    // Without an identity, read the team's record from the fixtures.
    const played = r.stages.flatMap((s) => s.fixtures).filter((f) => f.teams.includes(team));
    const won = played.filter((f) => f.winner === team).length;
    const champion = r.champion === team;
    if (champion) realChampion += 1;
    if (champion && won === played.length) realUnbeaten += 1;
  }
  const pct = (n: number, d: number) => (d ? +((100 * n) / d).toFixed(1) : 0);
  return {
    editionId: data.edition.id,
    runs: runs.length,
    unbeatenPct: pct(runs.filter((x) => x.unbeaten).length, runs.length),
    championPct: pct(runs.filter((x) => x.champion).length, runs.length),
    meanWinPct: +((100 * runs.reduce((a, x) => a + x.winPct, 0)) / Math.max(1, runs.length)).toFixed(1),
    byDecile,
    real: { runs: realSims, unbeatenPct: pct(realUnbeaten, realSims), championPct: pct(realChampion, realSims) },
  };
}
