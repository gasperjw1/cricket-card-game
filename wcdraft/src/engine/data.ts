/**
 * Edition data for the engine, built from plain JSON objects so the same code runs in Node (the
 * CLI and tests read `data/out/`) and in the browser (the draft client fetches the same files).
 * Nothing here touches the file system; `load.ts` is the Node wrapper.
 */

import type { Phase } from "../cricsheet/match.js";
import type { SituationTables } from "../analysis/situation.js";
import { bowlClassOf, handOf, type MatchupTables } from "../analysis/matchups.js";
import { OUTCOMES, PHASE_LIST, type EditionPopulations, type PhaseVectors, type PlayerRating, type Vector } from "../ratings/model.js";
import { SituationModel } from "./ball.js";
import { ENGINE } from "./model.js";
import { buildProgression, type FormatEdition, type Progression, type StandInRules } from "./progression.js";
import { DISMISSAL_KINDS, type DismissalKind, type EnginePlayer, type EngineTeam, type MatchEnvironment } from "./types.js";

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

export interface EnvironmentOut {
  matches: number;
  runsPerOver: number;
  chaseUplift: number;
  tossFieldPct: number;
  widesPerOver: number;
  noBallsPerOver: number;
  extrasPerOver: number;
  legalBalls: number;
  reducedInnings: number;
  rain: { dlFinishes: number; noResults: number };
  populationVectors: Record<Phase, Record<string, number>>;
  // Descriptive fields the draft client's venue brief reads (optional: older outputs lack them).
  powerplayRpo?: number;
  middleRpo?: number;
  deathRpo?: number;
  ballsPerWicket?: number;
  chaseWinPct?: number;
  firstInningsAvg?: number;
  dotPct?: number;
  sixPct?: number;
  dismissalFingerprintPct?: Record<string, number>;
  /** Legal balls faced by batting position ("1" … "11") and phase. */
  positionPhaseBalls?: Record<string, Record<Phase, number>>;
  paceSpin?: { pace: PaceSpinOut; spin: PaceSpinOut; unknownPct: number };
}

export interface PaceSpinOut {
  balls: number;
  rpo: number;
  ballsPerWicket: number;
  sharePct: number;
}

export interface EditionOut {
  id: string;
  year: number;
  hosts?: string[];
  hostTeams?: string[];
  format?: string;
  rules: { tieBreak: string };
  environment: EnvironmentOut;
  /** Matches hosted per venue id in this edition (the grounds a stand-in without fixtures plays at). */
  venues?: Record<string, number>;
  standIn: { team: string; reason?: string } | null;
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
  city?: string;
  country?: string;
  overall: EnvironmentOut;
  byEdition: Record<string, EnvironmentOut>;
}

export interface CoachOut {
  team: string;
  coachName: string;
  role: string;
  from: string;
  to: string;
  worldCups: string[];
  months: number;
  innings: number;
  tags: string[];
  intent: Record<Phase, number>;
}

export interface CaptainOut {
  personId: string;
  name: string;
  team: string;
  firstYear: number;
  lastYear: number;
  matches: number;
  won: number;
  z: number;
}

export interface PlayerLabel {
  handedness: string;
  bowlingType: string;
  keeper?: string;
  keeperCareer?: string;
  keeperAnyT20I?: string;
}

export interface TeamProfile {
  coach: { name: string; tags: string[]; intent: Record<Phase, number> } | null;
  captain: { personId: string; name: string; z: number } | null;
}

export interface EditionData {
  edition: EditionOut;
  venues: Map<string, VenueOut>;
  squads: Map<string, SquadOut>;
  /** `${team}|${personId}` → engine player (relative vectors centred on this edition's real squads). */
  players: Map<string, EnginePlayer>;
  populations: EditionPopulations;
  situation: SituationModel;
  progression: Progression;
  afghanistanFixtures: AfghanistanFixture[];
  /** Coach intent and captaincy rating per team at this edition (CPU sides); null entries when unknown. */
  profiles: Map<string, TeamProfile>;
}

/** Everything `buildEditionData` needs, as parsed JSON. */
export interface EditionInputs {
  editionId: string;
  editions: EditionOut[];
  venues: VenueOut[];
  squads: SquadOut[];
  populations: EditionPopulations[];
  ratings: PlayerRating[];
  situation: SituationTables;
  matchups: MatchupTables | null;
  formats: FormatEdition[];
  afghanistanFixtures: AfghanistanFixture[];
  coaches: CoachOut[];
  captains: CaptainOut[];
  labels: Map<string, PlayerLabel>;
}

const VENUE_PRIOR_BALLS = 1200;

function relative(v: Vector, pop: Vector): Vector {
  return Object.fromEntries(OUTCOMES.map((k) => [k, v[k] / Math.max(1e-4, pop[k])])) as Vector;
}

export function toEnginePlayer(r: PlayerRating, pops: EditionPopulations, label?: PlayerLabel): EnginePlayer {
  const rel = (skill: "bat" | "bowl", vectors: PhaseVectors): PhaseVectors =>
    Object.fromEntries(PHASE_LIST.map((p) => [p, relative(vectors[p], pops.valuePop[skill][p])])) as PhaseVectors;
  return {
    hand: handOf(label?.handedness),
    bowlClass: bowlClassOf(label?.bowlingType),
    keeper: !!label && (label.keeper === "Y" || label.keeperCareer === "Y" || Number(label.keeperAnyT20I ?? 0) > 0),
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

/** Build one edition's engine data from parsed JSON. Shared situation and matchup tables may be reused across editions. */
export function buildEditionData(input: EditionInputs, situation?: SituationModel): EditionData {
  const edition = input.editions.find((e) => e.id === input.editionId);
  if (!edition) throw new Error(`unknown edition ${input.editionId}`);
  const venues = new Map(input.venues.map((v) => [v.id, v]));
  const squads = new Map(input.squads.filter((s) => s.editionId === input.editionId).map((s) => [s.team, s]));
  const populations = input.populations.find((p) => p.editionId === input.editionId);
  if (!populations) throw new Error(`no populations for ${input.editionId}; run ratings:build`);
  const players = new Map(input.ratings.filter((r) => r.editionId === input.editionId).map((r) => [`${r.team}|${r.personId}`, toEnginePlayer(r, populations, input.labels.get(r.personId))]));
  centreOnCohort(players, squads);
  const format = input.formats.find((f) => f.editionId === input.editionId);
  if (!format) throw new Error(`no format for ${input.editionId} in formats.json`);
  const progression = buildProgression(format, { standIn: edition.standIn, slotChanges: edition.slotChanges ?? [] });
  const afghanistanFixtures = input.afghanistanFixtures.filter((f) => f.editionId === input.editionId);
  const profiles = teamProfiles(edition, squads, input.coaches, input.captains);
  return { edition, venues, squads, players, populations, situation: situation ?? new SituationModel(input.situation, input.matchups), progression, afghanistanFixtures, profiles };
}

/** The coach who took the team to this World Cup and the captain whose tenure covers it (most matches wins a tie). */
export function teamProfiles(edition: EditionOut, squads: Map<string, SquadOut>, coaches: CoachOut[], captains: CaptainOut[]): Map<string, TeamProfile> {
  const out = new Map<string, TeamProfile>();
  for (const team of squads.keys()) {
    const coach = coaches.filter((c) => c.team === team && c.worldCups.includes(edition.id)).sort((a, b) => b.innings - a.innings)[0];
    const squadIds = new Set(squads.get(team)?.players.map((p) => p.id) ?? []);
    const captain = captains.filter((c) => c.team === team && c.firstYear <= edition.year && c.lastYear >= edition.year && squadIds.has(c.personId)).sort((a, b) => b.matches - a.matches)[0];
    out.set(team, {
      coach: coach ? { name: coach.coachName, tags: coach.tags, intent: coach.intent } : null,
      captain: captain ? { personId: captain.personId, name: captain.name, z: captain.z } : null,
    });
  }
  return out;
}

/**
 * The engine's base distribution is the edition's realised population, i.e. the average World Cup
 * player of that edition, while the rating vectors are relative to the average T20I player of the
 * period (whom World Cup squads beat by 5–13%). Dividing every relative vector by the
 * appearance-weighted mean over the edition's real squads puts the two on the same footing, so
 * real elevens reproduce their own edition instead of inflating it.
 */
export function centreOnCohort(players: Map<string, EnginePlayer>, squads: Map<string, SquadOut>): void {
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

/** The match environment for an edition at a venue (venue scoring factor shrunk toward the edition). */
/** Archive-wide dismissal shares, the fallback when a profile has no fingerprint. */
const DISMISSAL_NORM: Record<DismissalKind, number> = { caught: 0.6, bowled: 0.19, lbw: 0.08, "run out": 0.07, stumped: 0.04, "caught and bowled": 0.015, "hit wicket": 0.005 };

/** Normalised dismissal shares from a profile's fingerprint (percentages by kind; unknown kinds dropped). */
export function dismissalMixOf(fingerprint: Record<string, number> | undefined): Record<DismissalKind, number> {
  const raw = Object.fromEntries(DISMISSAL_KINDS.map((k) => [k, fingerprint?.[k] ?? 0])) as Record<DismissalKind, number>;
  const total = DISMISSAL_KINDS.reduce((a, k) => a + raw[k], 0);
  if (total <= 0) return { ...DISMISSAL_NORM };
  return Object.fromEntries(DISMISSAL_KINDS.map((k) => [k, raw[k] / total])) as Record<DismissalKind, number>;
}

export function matchEnvironment(data: EditionData, venueId: string | null, overs = 20): MatchEnvironment {
  const env = data.edition.environment;
  const venue = venueId ? data.venues.get(venueId) : undefined;
  let venueFactor = 1;
  // Second-innings uplift (dew and target knowledge): the ground's own figure shrunk toward the
  // edition's with a ten-match prior, so Dubai's chase advantage and the SCG's bat-first edge show.
  let chaseUplift = env.chaseUplift / Math.max(1, env.runsPerOver);
  if (venue) {
    const v = venue.byEdition[data.edition.id] ?? venue.overall;
    const ratio = v.runsPerOver / Math.max(1, env.runsPerOver);
    venueFactor = (v.legalBalls * ratio + VENUE_PRIOR_BALLS) / (v.legalBalls + VENUE_PRIOR_BALLS);
    const venueUplift = (v.chaseUplift ?? env.chaseUplift) / Math.max(1, v.runsPerOver || env.runsPerOver);
    const n = v.matches ?? 0;
    chaseUplift = (n * venueUplift + ENGINE.rain.venuePriorMatches * chaseUplift) / (n + ENGINE.rain.venuePriorMatches);
  }
  const base = Object.fromEntries(PHASE_LIST.map((p) => [p, Object.fromEntries(OUTCOMES.map((k) => [k, env.populationVectors[p]?.[k] ?? 1 / 7])) as Vector])) as PhaseVectors;
  const tieBreak = data.edition.rules.tieBreak === "super-over" ? "super-over" : data.edition.rules.tieBreak === "bowl-out" ? "bowl-out" : "none";
  // Rain: affected matches ≈ DL finishes + no-results + half of the reduced innings not already counted;
  // the venue's rate shrunk toward the edition's with a prior of a few matches.
  const affected = (e: EnvironmentOut) => (e.rain?.dlFinishes ?? 0) + (e.rain?.noResults ?? 0) + 0.5 * Math.max(0, (e.reducedInnings ?? 0) - (e.rain?.dlFinishes ?? 0) - (e.rain?.noResults ?? 0));
  const editionRate = env.matches ? affected(env) / env.matches : 0;
  let pAffected = editionRate;
  if (venue) {
    const v = venue.byEdition[data.edition.id] ?? venue.overall;
    pAffected = (affected(v) + ENGINE.rain.venuePriorMatches * editionRate) / ((v.matches ?? 0) + ENGINE.rain.venuePriorMatches);
  }
  const noResultShare = affected(env) > 0 ? (env.rain?.noResults ?? 0) / affected(env) : 0.2;
  // Dismissal kinds: the ground's fingerprint when it has a few matches, else the edition's, else the archive norm.
  const venueFp = venue ? (venue.byEdition[data.edition.id]?.matches ?? 0) >= 3 ? venue.byEdition[data.edition.id] : venue.overall : undefined;
  const dismissalMix = dismissalMixOf(venueFp?.dismissalFingerprintPct ?? env.dismissalFingerprintPct);
  return {
    dismissalMix,
    rain: { pAffected: +Math.min(0.5, pAffected).toFixed(3), noResultShare: +noResultShare.toFixed(3) },
    editionId: data.edition.id,
    base,
    venueFactor,
    chaseUplift: +chaseUplift.toFixed(4),
    tossFieldPct: env.tossFieldPct,
    widesPerBall: env.widesPerOver / 6,
    noBallsPerBall: env.noBallsPerOver / 6,
    byesPerBall: Math.max(0, env.extrasPerOver - env.widesPerOver - env.noBallsPerOver) / 6,
    overs,
    maxOversPerBowler: Math.round(overs / 5),
    tieBreak,
  };
}

/** Coach intent and captaincy for a CPU side (the captain counts only if he is in this eleven). */
function withProfile(data: EditionData, team: string, players: EnginePlayer[]): Pick<EngineTeam, "intent" | "captainZ"> {
  const p = data.profiles.get(team);
  const captainPlays = p?.captain && players.some((x) => x.id === p.captain!.personId);
  return { intent: p?.coach?.intent, captainZ: captainPlays ? p!.captain!.z : undefined };
}

/** A team from a real match's eleven and batting order (unknown positions filled from the default XI order). */
export function teamFromMatch(data: EditionData, team: string, match: SquadMatchOut): EngineTeam {
  const squad = data.squads.get(team);
  if (!squad) throw new Error(`no squad for ${team}`);
  const players = match.xi.map((id) => data.players.get(`${team}|${id}`)).filter((p): p is EnginePlayer => !!p);
  const known = match.battingOrder.filter((id) => players.some((p) => p.id === id));
  const rest = players.filter((p) => !known.includes(p.id)).sort((a, b) => (a.positionMedian ?? 11) - (b.positionMedian ?? 11) || b.battingDisplay - a.battingDisplay).map((p) => p.id);
  return { name: team, players, battingOrder: [...known, ...rest], ...withProfile(data, team, players) };
}

/** A team from its default eleven. */
export function teamFromDefault(data: EditionData, team: string): EngineTeam {
  const squad = data.squads.get(team);
  if (!squad) throw new Error(`no squad for ${team}`);
  const players = squad.defaultXI.map((x) => data.players.get(`${team}|${x.id}`)).filter((p): p is EnginePlayer => !!p);
  return { name: team, players, battingOrder: players.map((p) => p.id), ...withProfile(data, team, players) };
}
