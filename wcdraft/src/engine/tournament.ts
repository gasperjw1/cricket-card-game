/**
 * Tournament simulation (design spec §7.6): the edition's real structure, real fixtures and
 * venues where the pairing happened, generated fixtures where it did not, standings with net run
 * rate and the edition's tie-breakers, seed-slot progression and the real knockout pairings. An
 * identity team may be replaced by a drafted eleven; everyone else fields the eleven they really
 * fielded against that opponent, or their default eleven.
 */

import { simulateMatch } from "./match.js";
import { matchEnvironment, teamFromDefault, teamFromMatch, type EditionData, type SquadMatchOut } from "./data.js";
import type { GroupsStage, KnockoutStage, Progression } from "./progression.js";
import { Rng } from "./rng.js";
import type { EngineTeam, MatchResult } from "./types.js";

export interface Fixture {
  stageId: string;
  stageLabel: string;
  group: string | null;
  teams: [string, string];
  venueId: string | null;
  date: string | null;
  /** The real match this fixture reproduces, if the pairing happened. */
  realId: string | null;
}

export interface FixtureResult extends Fixture {
  winner: string | null;
  scores: [string, string];
  margin: MatchResult["margin"];
  tieBreak: MatchResult["tieBreak"];
  rain: MatchResult["rain"];
  /** Full innings (scorecards) when kept; see `TournamentOptions.keepIdentityDetails`. */
  innings?: MatchResult["innings"];
  tossWinner?: string;
  tossDecision?: "bat" | "field";
}

export interface StandingRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  nrr: number;
}

export interface StageResult {
  id: string;
  label: string;
  groups: Record<string, StandingRow[]> | null;
  fixtures: FixtureResult[];
  /** Slot label → team after this stage (seed slots or finish positions; knockout winners as W1, W2). */
  slots: Record<string, string>;
}

export interface TournamentResult {
  editionId: string;
  seed: string;
  stages: StageResult[];
  champion: string | null;
  identity: { team: string; played: number; won: number; lost: number; exit: string; unbeaten: boolean; champion: boolean } | null;
}

export interface TournamentOptions {
  seed: number | string;
  /** Replace this team's eleven in every fixture (the drafted side). */
  identity?: { team: string; xi: EngineTeam };
  keepBallLogs?: boolean;
  /** Keep the full scorecards of the identity team's fixtures (the result screen). */
  keepIdentityDetails?: boolean;
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** Index of real matches by stage group and pairing, from the squads' match lists. */
function realIndex(data: EditionData): { byPair: Map<string, { match: SquadMatchOut; team: string; other: SquadMatchOut; otherTeam: string }>; byGroup: Map<string, SquadMatchOut[]> } {
  const sides = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) {
    if (squad.standIn) continue;
    for (const m of squad.matches) (sides.get(m.id) ?? sides.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m });
  }
  const byPair = new Map<string, { match: SquadMatchOut; team: string; other: SquadMatchOut; otherTeam: string }>();
  const byGroup = new Map<string, SquadMatchOut[]>();
  for (const list of sides.values()) {
    if (list.length !== 2) continue;
    const [x, y] = list as [typeof list[0], typeof list[0]];
    const label = groupLabel(x.match);
    byPair.set(`${label}|${pairKey(x.team, y.team)}`, { match: x.match, team: x.team, other: y.match, otherTeam: y.team });
    (byGroup.get(label) ?? byGroup.set(label, []).get(label)!).push(x.match);
  }
  return { byPair, byGroup };
}

/** Real matches carry stage "Semi Final" / "Final" or a group letter / number. */
function groupLabel(m: SquadMatchOut): string {
  if (m.stage && /semi/i.test(m.stage)) return "semi-finals";
  if (m.stage && /final/i.test(m.stage)) return "final";
  return m.group ?? "?";
}

function emptyRow(team: string): StandingRow {
  return { team, played: 0, won: 0, lost: 0, noResult: 0, points: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0 };
}

/** Net run rate: a side bowled out is charged its full quota of overs (ICC playing conditions). */
function nrrOf(r: StandingRow): number {
  const forRate = r.ballsFaced ? (6 * r.runsFor) / r.ballsFaced : 0;
  const againstRate = r.ballsBowled ? (6 * r.runsAgainst) / r.ballsBowled : 0;
  return +(forRate - againstRate).toFixed(3);
}

/** Group table order: points, wins, net run rate, head-to-head, original seeding. */
export function rankGroup(rows: StandingRow[], results: FixtureResult[], seedOrder: string[]): StandingRow[] {
  const h2h = (a: string, b: string): number => {
    const f = results.find((x) => x.teams.includes(a) && x.teams.includes(b));
    if (!f || !f.winner) return 0;
    return f.winner === a ? -1 : 1;
  };
  return [...rows].sort((a, b) => b.points - a.points || b.won - a.won || b.nrr - a.nrr || h2h(a.team, b.team) || seedOrder.indexOf(a.team) - seedOrder.indexOf(b.team));
}

export function simulateTournament(data: EditionData, progression: Progression, opts: TournamentOptions): TournamentResult {
  const rng = new Rng(opts.seed);
  const real = realIndex(data);
  const identity = opts.identity ?? null;
  const defaultTeams = new Map<string, EngineTeam>();
  const teamFor = (name: string, label: string, opponent: string): EngineTeam => {
    if (identity && name === identity.team) return identity.xi;
    const r = real.byPair.get(`${label}|${pairKey(name, opponent)}`);
    if (r) {
      const m = r.team === name ? r.match : r.other;
      const t = teamFromMatch(data, name, m);
      if (t.players.length === 11) return t;
    }
    let d = defaultTeams.get(name);
    if (!d) defaultTeams.set(name, (d = teamFromDefault(data, name)));
    return d;
  };
  const venuePool = (label: string): string[] => (real.byGroup.get(label) ?? []).map((m) => m.venueId).filter(Boolean);
  const standInFixtures = data.afghanistanFixtures;

  const stages: StageResult[] = [];
  let slots: Record<string, string> = {};
  let previousKnockoutWinners: string[] = [];
  const identityRecord = identity ? { team: identity.team, played: 0, won: 0, lost: 0, exit: "group stage", unbeaten: true, champion: false } : null;

  const play = (fixture: Fixture): FixtureResult => {
    const [a, b] = fixture.teams;
    const label = fixture.group ?? fixture.stageId;
    const teamA = teamFor(a, label, b), teamB = teamFor(b, label, a);
    const r = real.byPair.get(`${label}|${pairKey(a, b)}`);
    const battingFirst = r ? (r.match.battedFirst ? r.team : r.otherTeam) : undefined;
    const env = matchEnvironment(data, fixture.venueId);
    const result = simulateMatch(teamA, teamB, env, data.situation, { seed: `${opts.seed}:${fixture.stageId}:${a}:${b}`, battingFirst, keepBallLog: opts.keepBallLogs });
    if (identityRecord && (a === identityRecord.team || b === identityRecord.team)) {
      identityRecord.played += 1;
      if (result.winner === identityRecord.team) identityRecord.won += 1;
      else if (result.winner) { identityRecord.lost += 1; identityRecord.unbeaten = false; }
      // A no-result is neither a win nor a loss; an unbeaten run survives it.
    }
    const score = (i: 0 | 1) => `${result.innings[i].runs}/${result.innings[i].wickets} (${Math.floor(result.innings[i].legalBalls / 6)}.${result.innings[i].legalBalls % 6})`;
    const first = result.innings[0].team;
    const keep = opts.keepIdentityDetails && identity && (a === identity.team || b === identity.team);
    return {
      ...fixture, winner: result.winner, scores: first === a ? [score(0), score(1)] : [score(1), score(0)], margin: result.margin, tieBreak: result.tieBreak, rain: result.rain,
      ...(keep ? { innings: result.innings, tossWinner: result.tossWinner, tossDecision: result.tossDecision } : {}),
      _result: result,
    } as FixtureResult & { _result: MatchResult };
  };

  const realFixture = (a: string, b: string, label: string): { venueId: string | null; date: string | null; realId: string | null } | null => {
    const r = real.byPair.get(`${label}|${pairKey(a, b)}`);
    return r ? { venueId: r.match.venueId || null, date: r.match.date, realId: r.match.id } : null;
  };

  for (const stage of progression.stages) {
    if (stage.type === "groups") {
      const res = playGroups(stage, slots, play, venuePool, realFixture, standInFixtures, progression.standIn, rng);
      stages.push(res.stage);
      slots = res.slots;
      if (identityRecord && res.stage.fixtures.some((f) => f.teams.includes(identityRecord.team))) {
        // Only stages the side actually played in can be where it went out; qualifying slots only
        // (the `#` entries record every team's finish position).
        const advanced = Object.entries(res.slots).some(([slot, team]) => !slot.endsWith("#") && team === identityRecord.team);
        identityRecord.exit = advanced ? "advanced" : stage.label;
      }
    } else {
      const res = playKnockout(stage, slots, previousKnockoutWinners, play, venuePool);
      stages.push(res.stage);
      previousKnockoutWinners = res.winners;
      if (identityRecord) {
        const played = res.stage.fixtures.find((f) => f.teams.includes(identityRecord.team));
        if (played) identityRecord.exit = played.winner === identityRecord.team ? "advanced" : stage.label;
      }
    }
  }
  const finalStage = stages[stages.length - 1]!;
  const champion = finalStage.fixtures[0]?.winner ?? null;
  if (identityRecord) {
    identityRecord.champion = champion === identityRecord.team;
    if (identityRecord.champion) identityRecord.exit = "champion";
    else if (identityRecord.exit === "advanced") identityRecord.exit = finalStage.label;
    identityRecord.unbeaten = identityRecord.unbeaten && identityRecord.champion;
  }
  for (const s of stages) for (const f of s.fixtures) delete (f as FixtureResult & { _result?: MatchResult })._result;
  return { editionId: progression.editionId, seed: String(opts.seed), stages, champion, identity: identityRecord };
}

function resolve(ref: string, slots: Record<string, string>): string {
  return slots[ref] ?? ref;
}

function playGroups(
  stage: GroupsStage,
  incoming: Record<string, string>,
  play: (f: Fixture) => FixtureResult,
  venuePool: (label: string) => string[],
  realFixture: (a: string, b: string, label: string) => { venueId: string | null; date: string | null; realId: string | null } | null,
  standInFixtures: EditionData["afghanistanFixtures"],
  standIn: string | null,
  rng: Rng,
): { stage: StageResult; slots: Record<string, string> } {
  const groups: Record<string, StandingRow[]> = {};
  const fixtures: FixtureResult[] = [];
  const outSlots: Record<string, string> = {};
  for (const [g, entries] of Object.entries(stage.groups)) {
    const teams = entries.map((e) => resolve(e, incoming));
    const rows = new Map(teams.map((t) => [t, emptyRow(t)]));
    const pool = venuePool(g);
    let poolIdx = 0;
    const results: FixtureResult[] = [];
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        const a = teams[i]!, b = teams[j]!;
        // Venue and date: the real fixture if this pairing happened; Afghanistan's real fixture for the
        // stand-in; otherwise cycle through the venues the group really used.
        const realVenue = realFixture(a, b, g) ?? realVenueFor(a, b, g, standIn, standInFixtures, stage.label);
        const venueId = realVenue?.venueId ?? (pool.length ? pool[(poolIdx++) % pool.length]! : null);
        const f = play({ stageId: stage.id, stageLabel: stage.label, group: g, teams: [a, b], venueId, date: realVenue?.date ?? null, realId: realVenue?.realId ?? null });
        results.push(f);
        tally(rows, f);
      }
    }
    for (const r of rows.values()) r.nrr = nrrOf(r);
    const ranked = rankGroup([...rows.values()], results, stage.seedOrder);
    groups[g] = ranked;
    fixtures.push(...results);
    const qualifiers = ranked.slice(0, stage.advance.perGroup).map((r) => r.team);
    if (stage.advance.mode === "seedSlots") {
      // Seeded qualifiers keep their slot; others inherit the highest vacated seed slot of the group.
      const slotNames = [1, 2].map((n) => `${g}${n}`);
      const taken = new Set<string>();
      for (const t of qualifiers) {
        const own = slotNames.find((s) => stage.seeds[s] === t);
        if (own) { outSlots[own] = t; taken.add(own); }
      }
      for (const t of qualifiers) {
        if (Object.values(outSlots).includes(t)) continue;
        const free = slotNames.find((s) => !taken.has(s))!;
        outSlots[free] = t; taken.add(free);
      }
    } else {
      qualifiers.forEach((t, i) => { outSlots[`${g}${i + 1}`] = t; });
    }
    // Finish positions are always available to knockout pairings ("11" = 1st of group 1).
    ranked.forEach((r, i) => { outSlots[`${g}${i + 1}#`] = r.team; });
  }
  void rng;
  return { stage: { id: stage.id, label: stage.label, groups, fixtures, slots: outSlots }, slots: outSlots };
}

function realVenueFor(a: string, b: string, group: string, standIn: string | null, standInFixtures: EditionData["afghanistanFixtures"], stageLabel: string): { venueId: string | null; date: string | null; realId: string | null } | null {
  if (standIn && (a === standIn || b === standIn)) {
    const opp = a === standIn ? b : a;
    const f = standInFixtures.find((x) => x.opponent === opp && (x.group === group || (!x.group && /semi|final/i.test(stageLabel))));
    if (f) return { venueId: f.venueId, date: f.date, realId: null };
  }
  return null;
}

function tally(rows: Map<string, StandingRow>, f: FixtureResult & { _result?: MatchResult }): void {
  const r = f._result;
  if (!r) return;
  // A no-result carries no run-rate information.
  for (const inn of r.rain?.kind === "no-result" ? [] : r.innings) {
    const bat = rows.get(inn.team), bowl = rows.get(inn.team === f.teams[0] ? f.teams[1] : f.teams[0]);
    if (!bat || !bowl) continue;
    const quota = inn.wickets >= 10 ? inn.scheduledOvers * 6 : inn.legalBalls;
    bat.runsFor += inn.runs; bat.ballsFaced += quota;
    bowl.runsAgainst += inn.runs; bowl.ballsBowled += quota;
  }
  for (const t of f.teams) {
    const row = rows.get(t)!;
    row.played += 1;
    if (f.winner === t) { row.won += 1; row.points += 2; }
    else if (f.winner) row.lost += 1;
    else { row.noResult += 1; row.points += 1; }
  }
}

function playKnockout(stage: KnockoutStage, slots: Record<string, string>, previousWinners: string[], play: (f: Fixture) => FixtureResult, venuePool: (label: string) => string[]): { stage: StageResult; winners: string[] } {
  const fixtures: FixtureResult[] = [];
  const winners: string[] = [];
  const pool = venuePool(stage.id);
  stage.pairings.forEach((pair, i) => {
    const side = (ref: string): string => {
      if (/^W\d$/.test(ref)) return previousWinners[Number(ref.slice(1)) - 1] ?? ref;
      // "E2" / "12" → finish position in the previous groups stage.
      return slots[`${ref}#`] ?? slots[ref] ?? ref;
    };
    const a = side(pair[0]), b = side(pair[1]);
    let f = play({ stageId: stage.id, stageLabel: stage.label, group: null, teams: [a, b], venueId: pool[i % Math.max(1, pool.length)] ?? null, date: null, realId: null });
    // Reserve day: a washed-out knockout is replayed once; if the weather wins again, the side that
    // finished higher in the previous stage (named first in the pairing) goes through.
    if (!f.winner) f = play({ stageId: `${stage.id}-reserve`, stageLabel: `${stage.label} (reserve day)`, group: null, teams: [a, b], venueId: pool[i % Math.max(1, pool.length)] ?? null, date: null, realId: null });
    fixtures.push(f);
    winners.push(f.winner ?? a);
  });
  const outSlots: Record<string, string> = {};
  winners.forEach((w, i) => { outSlots[`W${i + 1}`] = w; });
  return { stage: { id: stage.id, label: stage.label, groups: null, fixtures, slots: outSlots }, winners };
}
