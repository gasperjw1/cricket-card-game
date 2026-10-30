/**
 * Loads one edition's engine inputs from `data/out/`: ratings (vectors), populations, squads
 * (real elevens and batting orders), editions (environment, rules) and venues.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Phase } from "../cricsheet/match.js";
import type { SituationTables } from "../analysis/situation.js";
import { bowlClassOf, handOf, type MatchupTables } from "../analysis/matchups.js";
import { readLabels } from "../pipeline/labels.js";
import { OUTCOMES, PHASE_LIST, type PhaseVectors, type PlayerRating, type Vector } from "../ratings/model.js";
import type { EditionPopulations } from "../ratings/rate.js";
import { paths, readJson } from "../util/io.js";
import { SituationModel } from "./ball.js";
import { buildProgression, type FormatEdition, type Progression, type StandInRules } from "./progression.js";
import type { EnginePlayer, EngineTeam, MatchEnvironment } from "./types.js";

export interface SquadMatchOut {
  id: string;
  date: string;
  stage: string | null;
  group: string | null;
  venueId: string;
  opponent: string;
  battedFirst: boolean;
  xi: string[];
  battingOrder: string[];
  bowlerByOver: string[];
  total: number | null;
  wickets: number | null;
  winner: string | null;
  result: string | null;
}

export interface SquadOut {
  editionId: string;
  team: string;
  standIn: boolean;
  source: string;
  players: { id: string; name: string; matches: number }[];
  defaultXI: { id: string; name: string }[];
  defaultBowlingOrder: { id: string; name: string }[];
  matches: SquadMatchOut[];
}

interface EnvironmentOut {
  runsPerOver: number;
  chaseUplift: number;
  tossFieldPct: number;
  widesPerOver: number;
  noBallsPerOver: number;
  extrasPerOver: number;
  legalBalls: number;
  populationVectors: Record<Phase, Record<string, number>>;
}

export interface EditionOut {
  id: string;
  year: number;
  rules: { tieBreak: string };
  environment: EnvironmentOut;
  standIn: { team: string } | null;
  slotChanges: StandInRules["slotChanges"];
  teams: string[];
}

export interface AfghanistanFixture {
  editionId: string;
  date: string;
  stage: string;
  group: string | null;
  opponent: string;
  venueId: string;
  afghanistanBattedFirst: boolean | null;
}

export interface VenueOut {
  id: string;
  name: string;
  overall: EnvironmentOut;
  byEdition: Record<string, EnvironmentOut>;
}

export interface EditionData {
  edition: EditionOut;
  venues: Map<string, VenueOut>;
  squads: Map<string, SquadOut>;
  players: Map<string, EnginePlayer>;
  populations: EditionPopulations;
  situation: SituationModel;
  progression: Progression;
  afghanistanFixtures: AfghanistanFixture[];
}

const VENUE_PRIOR_BALLS = 1200;

function relative(v: Vector, pop: Vector): Vector {
  return Object.fromEntries(OUTCOMES.map((k) => [k, v[k] / Math.max(1e-4, pop[k])])) as Vector;
}

export function toEnginePlayer(r: PlayerRating, pops: EditionPopulations, label?: { handedness: string; bowlingType: string }): EnginePlayer {
  const rel = (skill: "bat" | "bowl", vectors: PhaseVectors): PhaseVectors =>
    Object.fromEntries(PHASE_LIST.map((p) => [p, relative(vectors[p], pops.valuePop[skill][p])])) as PhaseVectors;
  return {
    hand: handOf(label?.handedness),
    bowlClass: bowlClassOf(label?.bowlingType),
    id: r.personId,
    name: r.name,
    batting: r.batting.vectors,
    bowling: r.bowling.vectors,
    battingRel: rel("bat", r.batting.vectors),
    bowlingRel: rel("bowl", r.bowling.vectors),
    batLowSample: r.batting.lowSample,
    bowlLowSample: r.bowling.lowSample,
    role: r.role,
    archetype: r.archetype,
    positionMedian: r.position.median,
    bowlingShares: r.bowlingPhases,
    canBowl: !r.bowling.lowSample || r.role === "bowler" || r.role === "all-rounder" || (r.bowlingPhases !== null && r.bowling.evidence.formBalls + r.bowling.evidence.careerBalls >= 60),
    tier: r.tier,
    battingDisplay: r.batting.display,
    bowlingDisplay: r.bowling.display,
  };
}

let situationCache: SituationTables | null = null;
let matchupCache: MatchupTables | null = null;
let labelsCache: Map<string, { handedness: string; bowlingType: string }> | null = null;

export function loadEdition(editionId: string): EditionData {
  const editions = readJson<EditionOut[]>(resolve(paths.out, "editions.json"));
  const edition = editions.find((e) => e.id === editionId);
  if (!edition) throw new Error(`unknown edition ${editionId}`);
  const venues = new Map(readJson<VenueOut[]>(resolve(paths.out, "venues.json")).map((v) => [v.id, v]));
  const squads = new Map(readJson<SquadOut[]>(resolve(paths.out, "squads", `${editionId}.json`)).map((s) => [s.team, s]));
  const populations = readJson<EditionPopulations[]>(resolve(paths.out, "ratings", "populations.json")).find((p) => p.editionId === editionId);
  if (!populations) throw new Error(`no populations for ${editionId}; run ratings:build`);
  const ratings = readJson<PlayerRating[]>(resolve(paths.out, "ratings", `${editionId}.json`));
  labelsCache ??= readLabels();
  const players = new Map(ratings.map((r) => [`${r.team}|${r.personId}`, toEnginePlayer(r, populations, labelsCache!.get(r.personId))]));
  centreOnCohort(players, squads);
  situationCache ??= readJson<SituationTables>(resolve(paths.out, "situation.json"));
  matchupCache ??= existsSync(resolve(paths.out, "matchups.json")) ? readJson<MatchupTables>(resolve(paths.out, "matchups.json")) : null;
  const formats = readJson<{ editions: FormatEdition[] }>(resolve(paths.config, "formats.json")).editions.find((f) => f.editionId === editionId);
  if (!formats) throw new Error(`no format for ${editionId} in formats.json`);
  const progression = buildProgression(formats, { standIn: edition.standIn, slotChanges: edition.slotChanges ?? [] });
  const afghanistanFixtures = readJson<{ fixtures: AfghanistanFixture[] }>(resolve(paths.config, "afghanistan-fixtures.json")).fixtures.filter((f) => f.editionId === editionId);
  return { edition, venues, squads, players, populations, situation: new SituationModel(situationCache, matchupCache), progression, afghanistanFixtures };
}

/**
 * The engine's base distribution is the edition's realised population, i.e. the average World Cup
 * player of that edition, while the rating vectors are relative to the average T20I player of the
 * period (whom World Cup squads beat by 5–13%). Dividing every relative vector by the
 * appearance-weighted mean over the edition's real squads puts the two on the same footing, so
 * real elevens reproduce their own edition instead of inflating it.
 */
function centreOnCohort(players: Map<string, EnginePlayer>, squads: Map<string, SquadOut>): void {
  for (const skill of ["battingRel", "bowlingRel"] as const) {
    const sums = Object.fromEntries(PHASE_LIST.map((p) => [p, Object.fromEntries(OUTCOMES.map((k) => [k, 0])) as Vector])) as PhaseVectors;
    let weight = 0;
    for (const squad of squads.values()) {
      if (squad.standIn) continue;
      for (const member of squad.players) {
        const p = players.get(`${squad.team}|${member.id}`);
        if (!p || member.matches <= 0) continue;
        const w = member.matches * (skill === "bowlingRel" ? (p.canBowl ? 1 : 0) : 1);
        if (w <= 0) continue;
        weight += w;
        for (const ph of PHASE_LIST) for (const k of OUTCOMES) sums[ph][k] += w * p[skill][ph][k];
      }
    }
    if (weight <= 0) continue;
    for (const p of players.values()) {
      for (const ph of PHASE_LIST) for (const k of OUTCOMES) p[skill][ph][k] = p[skill][ph][k] / Math.max(1e-4, sums[ph][k] / weight);
    }
  }
}

export function engineReady(): boolean {
  return existsSync(resolve(paths.out, "situation.json")) && existsSync(resolve(paths.out, "ratings", "populations.json"));
}

/** The match environment for an edition at a venue (venue scoring factor shrunk toward the edition). */
export function matchEnvironment(data: EditionData, venueId: string | null, overs = 20): MatchEnvironment {
  const env = data.edition.environment;
  const venue = venueId ? data.venues.get(venueId) : undefined;
  let venueFactor = 1;
  if (venue) {
    const v = venue.byEdition[data.edition.id] ?? venue.overall;
    const ratio = v.runsPerOver / Math.max(1, env.runsPerOver);
    venueFactor = (v.legalBalls * ratio + VENUE_PRIOR_BALLS) / (v.legalBalls + VENUE_PRIOR_BALLS);
  }
  const base = Object.fromEntries(PHASE_LIST.map((p) => [p, Object.fromEntries(OUTCOMES.map((k) => [k, env.populationVectors[p]?.[k] ?? 1 / 7])) as Vector])) as PhaseVectors;
  const tieBreak = data.edition.rules.tieBreak === "super-over" ? "super-over" : data.edition.rules.tieBreak === "bowl-out" ? "bowl-out" : "none";
  return {
    editionId: data.edition.id,
    base,
    venueFactor,
    chaseUplift: env.chaseUplift / Math.max(1, env.runsPerOver),
    tossFieldPct: env.tossFieldPct,
    widesPerBall: env.widesPerOver / 6,
    noBallsPerBall: env.noBallsPerOver / 6,
    byesPerBall: Math.max(0, env.extrasPerOver - env.widesPerOver - env.noBallsPerOver) / 6,
    overs,
    maxOversPerBowler: Math.round(overs / 5),
    tieBreak,
  };
}

/** A team from a real match's eleven and batting order (unknown positions filled from the default XI order). */
export function teamFromMatch(data: EditionData, team: string, match: SquadMatchOut): EngineTeam {
  const squad = data.squads.get(team);
  if (!squad) throw new Error(`no squad for ${team}`);
  const players = match.xi.map((id) => data.players.get(`${team}|${id}`)).filter((p): p is EnginePlayer => !!p);
  const known = match.battingOrder.filter((id) => players.some((p) => p.id === id));
  const rest = players.filter((p) => !known.includes(p.id)).sort((a, b) => (a.positionMedian ?? 11) - (b.positionMedian ?? 11) || b.battingDisplay - a.battingDisplay).map((p) => p.id);
  return { name: team, players, battingOrder: [...known, ...rest] };
}

/** A team from its default eleven. */
export function teamFromDefault(data: EditionData, team: string): EngineTeam {
  const squad = data.squads.get(team);
  if (!squad) throw new Error(`no squad for ${team}`);
  const players = squad.defaultXI.map((x) => data.players.get(`${team}|${x.id}`)).filter((p): p is EnginePlayer => !!p);
  return { name: team, players, battingOrder: players.map((p) => p.id) };
}
